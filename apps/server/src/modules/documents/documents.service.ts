import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { and, asc, desc, eq, inArray, isNull, or, SQL, sql } from 'drizzle-orm';
import type {
  DocumentLinkCreate,
  DocumentListQuery,
  DocumentListResponse,
  DocumentResponse,
  DocumentUpdate,
  DocumentUploadMetadata,
  DocumentUploadReplaceMetadata,
  DocumentUserInfo,
  JwtPayload,
  OrgRole,
} from '@volunteerfleet/shared';
import type { Database } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { documents, expenses, users, vehicles } from '../../db/schema/index.js';
import { StorageService } from '../../storage/storage.service.js';
import { decodeUploadFileName } from '../../common/utils/decode-upload-filename.js';

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
] as const;

const DOCUMENT_SORT_WHITELIST = ['name', 'kind', 'createdAt', 'updatedAt'] as const;
type DocumentSortField = (typeof DOCUMENT_SORT_WHITELIST)[number];

interface SortItem {
  field: DocumentSortField;
  dir: 'asc' | 'desc';
}

type DocumentRow = typeof documents.$inferSelect & {
  vehicle?: Pick<typeof vehicles.$inferSelect, 'id' | 'identifier' | 'brand' | 'model'> | null;
  expense?: Pick<typeof expenses.$inferSelect, 'id' | 'expenseDate' | 'amount' | 'currency'> | null;
  createdByUser?: Pick<typeof users.$inferSelect, 'id' | 'fullName'>;
  updatedByUser?: Pick<typeof users.$inferSelect, 'id' | 'fullName'>;
  deletedByUser?: Pick<typeof users.$inferSelect, 'id' | 'fullName'> | null;
};

interface FileTypeModule {
  fileTypeFromBuffer(input: Uint8Array): Promise<{ mime: string } | undefined>;
}

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly storage: StorageService,
  ) {}

  async list(
    query: DocumentListQuery,
    orgRole: OrgRole | null | undefined,
    organizationId: string,
  ): Promise<DocumentListResponse> {
    const { page, pageSize, sort, vehicleId, expenseId, kind, includeDeleted } = query;

    if (includeDeleted && orgRole !== 'coordinator') {
      throw new ForbiddenException('Only coordinator can view deleted documents');
    }

    const conditions: SQL<unknown>[] = [eq(documents.organizationId, organizationId)];
    if (!includeDeleted) {
      conditions.push(
        isNull(documents.deletedAt),
        this.hasActiveVehicle(),
        this.hasActiveExpense(),
      );
    }
    if (vehicleId) conditions.push(this.belongsToVehicleScope(vehicleId));
    if (expenseId) conditions.push(eq(documents.expenseId, expenseId));
    if (kind) conditions.push(eq(documents.kind, kind));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(documents)
      .where(whereClause);
    const total = countResult[0]?.count ?? 0;

    const orderBy = this.parseSort(sort).map((s) =>
      s.dir === 'asc' ? asc(documents[s.field]) : desc(documents[s.field]),
    );
    if (orderBy.length === 0) orderBy.push(desc(documents.createdAt));

    const pageRows = await this.db
      .select({ id: documents.id })
      .from(documents)
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const ids = pageRows.map((row) => row.id);

    const rows =
      ids.length > 0
        ? await this.db.query.documents.findMany({
            where: inArray(documents.id, ids),
            with: this.responseRelations(),
          })
        : [];
    const rowsById = new Map(rows.map((row) => [row.id, row]));

    return {
      items: ids.flatMap((id) => {
        const row = rowsById.get(id);
        return row ? [this.toResponse(row)] : [];
      }),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findById(
    id: string,
    organizationId: string,
    includeDeleted = false,
  ): Promise<DocumentResponse> {
    const row = await this.findRowById(id, organizationId, includeDeleted);
    return this.toResponse(row);
  }

  async upload(
    file: Express.Multer.File | undefined,
    input: DocumentUploadMetadata,
    userId: string,
    organizationId: string,
    maxUploadBytes: number,
  ): Promise<DocumentResponse> {
    if (!file) throw new BadRequestException('FILE_REQUIRED');
    if (file.size > maxUploadBytes) {
      throw new PayloadTooLargeException('MAX_UPLOAD_BYTES_EXCEEDED');
    }

    const mime = await this.detectMime(file);
    if (!this.isAllowedMime(mime)) {
      throw new UnsupportedMediaTypeException('UNSUPPORTED_MEDIA_TYPE');
    }

    if (input.vehicleId) {
      const vehicle = await this.db.query.vehicles.findFirst({
        where: and(eq(vehicles.id, input.vehicleId), eq(vehicles.organizationId, organizationId)),
      });
      if (!vehicle) {
        throw new NotFoundException(`Vehicle ${input.vehicleId} not found in this organization`);
      }
    }
    if (input.expenseId) {
      const expense = await this.db.query.expenses.findFirst({
        where: and(eq(expenses.id, input.expenseId), eq(expenses.organizationId, organizationId)),
      });
      if (!expense) {
        throw new NotFoundException(`Expense ${input.expenseId} not found in this organization`);
      }
    }

    const id = randomUUID();
    const key = `documents/${id}/${this.sanitizeFileName(decodeUploadFileName(file.originalname) || input.name)}`;

    await this.storage.putObject(Readable.from(file.buffer), {
      key,
      mime,
      size: file.size,
    });

    const inserted = await this.db
      .insert(documents)
      .values({
        id,
        organizationId,
        name: input.name,
        kind: 'upload',
        fileKey: key,
        url: null,
        mimeType: mime,
        sizeBytes: file.size,
        vehicleId: input.vehicleId ?? null,
        expenseId: input.expenseId ?? null,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning({ id: documents.id });

    const row = inserted[0];
    if (!row) throw new Error('Insert returned no rows');
    return this.findById(row.id, organizationId);
  }

  async replaceUpload(
    id: string,
    file: Express.Multer.File | undefined,
    input: DocumentUploadReplaceMetadata,
    user: JwtPayload,
    maxUploadBytes: number,
    organizationId: string,
  ): Promise<DocumentResponse> {
    const existing = await this.db.query.documents.findFirst({
      where: and(
        eq(documents.id, id),
        eq(documents.organizationId, organizationId),
        isNull(documents.deletedAt),
      ),
    });
    if (!existing) throw new NotFoundException(`Document ${id} not found`);
    this.assertOwner(existing.createdBy, user);
    if (existing.kind !== 'upload')
      throw new BadRequestException('LINK_DOCUMENT_FILE_CANNOT_BE_UPDATED');
    if (!file) throw new BadRequestException('FILE_REQUIRED');
    if (file.size > maxUploadBytes) {
      throw new PayloadTooLargeException('MAX_UPLOAD_BYTES_EXCEEDED');
    }

    const mime = await this.detectMime(file);
    if (!this.isAllowedMime(mime)) {
      throw new UnsupportedMediaTypeException('UNSUPPORTED_MEDIA_TYPE');
    }

    const key = `documents/${id}/${this.sanitizeFileName(decodeUploadFileName(file.originalname) || input.name)}`;
    await this.storage.putObject(Readable.from(file.buffer), {
      key,
      mime,
      size: file.size,
    });

    const updated = await this.db
      .update(documents)
      .set({
        name: input.name,
        fileKey: key,
        mimeType: mime,
        sizeBytes: file.size,
        updatedBy: user.sub,
        updatedAt: new Date(),
      })
      .where(and(eq(documents.id, id), eq(documents.organizationId, organizationId)))
      .returning({ id: documents.id });

    if (!updated[0]) throw new NotFoundException(`Document ${id} not found`);
    return this.findById(id, organizationId);
  }

  async createLink(
    input: DocumentLinkCreate,
    userId: string,
    organizationId: string,
  ): Promise<DocumentResponse> {
    if (input.vehicleId) {
      const vehicle = await this.db.query.vehicles.findFirst({
        where: and(eq(vehicles.id, input.vehicleId), eq(vehicles.organizationId, organizationId)),
      });
      if (!vehicle) {
        throw new NotFoundException(`Vehicle ${input.vehicleId} not found in this organization`);
      }
    }
    if (input.expenseId) {
      const expense = await this.db.query.expenses.findFirst({
        where: and(eq(expenses.id, input.expenseId), eq(expenses.organizationId, organizationId)),
      });
      if (!expense) {
        throw new NotFoundException(`Expense ${input.expenseId} not found in this organization`);
      }
    }

    const inserted = await this.db
      .insert(documents)
      .values({
        organizationId,
        name: input.name,
        kind: 'link',
        fileKey: null,
        url: input.url,
        mimeType: null,
        sizeBytes: null,
        vehicleId: input.vehicleId ?? null,
        expenseId: input.expenseId ?? null,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning({ id: documents.id });

    const row = inserted[0];
    if (!row) throw new Error('Insert returned no rows');
    return this.findById(row.id, organizationId);
  }

  async getDownload(
    id: string,
    organizationId: string,
  ): Promise<
    | { kind: 'link'; url: string }
    | {
        kind: 'file';
        body: Readable;
        contentType: string;
        contentLength?: number;
        fileName: string;
      }
  > {
    const doc = await this.db.query.documents.findFirst({
      where: and(
        eq(documents.id, id),
        eq(documents.organizationId, organizationId),
        isNull(documents.deletedAt),
      ),
    });
    if (!doc) throw new NotFoundException(`Document ${id} not found`);
    if (doc.kind === 'link') {
      if (!doc.url) throw new NotFoundException(`Document ${id} has no URL`);
      return { kind: 'link', url: doc.url };
    }
    if (!doc.fileKey) throw new NotFoundException(`Document ${id} has no file`);
    const object = await this.storage.getObjectStream(doc.fileKey);
    return {
      kind: 'file',
      body: object.body,
      contentType: doc.mimeType ?? object.contentType,
      contentLength: object.contentLength,
      fileName: doc.name,
    };
  }

  async update(
    id: string,
    input: DocumentUpdate,
    user: JwtPayload,
    organizationId: string,
  ): Promise<DocumentResponse> {
    const existing = await this.db.query.documents.findFirst({
      where: and(
        eq(documents.id, id),
        eq(documents.organizationId, organizationId),
        isNull(documents.deletedAt),
      ),
    });
    if (!existing) throw new NotFoundException(`Document ${id} not found`);
    this.assertOwner(existing.createdBy, user);

    const updateValues: Record<string, unknown> = {
      updatedBy: user.sub,
      updatedAt: new Date(),
    };
    if (input.name !== undefined) updateValues.name = input.name;

    if (input.vehicleId !== undefined && input.vehicleId !== null) {
      const vehicle = await this.db.query.vehicles.findFirst({
        where: and(eq(vehicles.id, input.vehicleId), eq(vehicles.organizationId, organizationId)),
      });
      if (!vehicle) {
        throw new NotFoundException(`Vehicle ${input.vehicleId} not found in this organization`);
      }
      updateValues.vehicleId = input.vehicleId;
    } else if (input.vehicleId === null) {
      updateValues.vehicleId = null;
    }

    if (input.expenseId !== undefined && input.expenseId !== null) {
      const expense = await this.db.query.expenses.findFirst({
        where: and(eq(expenses.id, input.expenseId), eq(expenses.organizationId, organizationId)),
      });
      if (!expense) {
        throw new NotFoundException(`Expense ${input.expenseId} not found in this organization`);
      }
      updateValues.expenseId = input.expenseId;
    } else if (input.expenseId === null) {
      updateValues.expenseId = null;
    }

    if (input.url !== undefined) {
      if (existing.kind !== 'link') {
        throw new BadRequestException('UPLOAD_DOCUMENT_URL_CANNOT_BE_UPDATED');
      }
      updateValues.url = input.url;
    }

    const updated = await this.db
      .update(documents)
      .set(updateValues)
      .where(and(eq(documents.id, id), eq(documents.organizationId, organizationId)))
      .returning({ id: documents.id });

    if (!updated[0]) throw new NotFoundException(`Document ${id} not found`);
    return this.findById(id, organizationId);
  }

  async softDelete(id: string, user: JwtPayload, organizationId: string): Promise<void> {
    const existing = await this.db.query.documents.findFirst({
      where: and(
        eq(documents.id, id),
        eq(documents.organizationId, organizationId),
        isNull(documents.deletedAt),
      ),
    });
    if (!existing) throw new NotFoundException(`Document ${id} not found`);
    this.assertOwner(existing.createdBy, user);

    await this.db
      .update(documents)
      .set({
        deletedAt: new Date(),
        deletedBy: user.sub,
        updatedBy: user.sub,
        updatedAt: new Date(),
      })
      .where(and(eq(documents.id, id), eq(documents.organizationId, organizationId)));
  }

  async restore(id: string, userId: string, organizationId: string): Promise<DocumentResponse> {
    const existing = await this.db.query.documents.findFirst({
      where: and(
        eq(documents.id, id),
        eq(documents.organizationId, organizationId),
        sql`${documents.deletedAt} IS NOT NULL`,
      ),
    });
    if (!existing) throw new NotFoundException(`Deleted document ${id} not found`);

    await this.db
      .update(documents)
      .set({ deletedAt: null, deletedBy: null, updatedBy: userId, updatedAt: new Date() })
      .where(and(eq(documents.id, id), eq(documents.organizationId, organizationId)));

    return this.findById(id, organizationId, true);
  }

  assertAllowedUploadForTest(mime: string, size: number, maxUploadBytes: number): void {
    if (size > maxUploadBytes) {
      throw new PayloadTooLargeException('MAX_UPLOAD_BYTES_EXCEEDED');
    }
    if (!this.isAllowedMime(mime)) {
      throw new UnsupportedMediaTypeException('UNSUPPORTED_MEDIA_TYPE');
    }
  }

  private async findRowById(
    id: string,
    organizationId: string,
    includeDeleted: boolean,
  ): Promise<DocumentRow> {
    const where = includeDeleted
      ? and(eq(documents.id, id), eq(documents.organizationId, organizationId))
      : and(
          eq(documents.id, id),
          eq(documents.organizationId, organizationId),
          isNull(documents.deletedAt),
        );
    const row = await this.db.query.documents.findFirst({
      where,
      with: this.responseRelations(),
    });
    if (!row) throw new NotFoundException(`Document ${id} not found`);
    return row;
  }

  private assertOwner(createdBy: string, user: JwtPayload): void {
    if (user.orgRole !== 'coordinator' && createdBy !== user.sub) {
      throw new ForbiddenException('NOT_OWNER');
    }
  }

  private async detectMime(file: Express.Multer.File): Promise<string> {
    const fileType = await this.loadFileType();
    const sniffed = await fileType.fileTypeFromBuffer(file.buffer.subarray(0, 4100));
    return sniffed?.mime ?? file.mimetype;
  }

  private async loadFileType(): Promise<FileTypeModule> {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (
      specifier: string,
    ) => Promise<FileTypeModule>;
    return dynamicImport('file-type');
  }

  private isAllowedMime(mime: string): boolean {
    return ALLOWED_MIME_TYPES.includes(mime as (typeof ALLOWED_MIME_TYPES)[number]);
  }

  private sanitizeFileName(name: string): string {
    const sanitized = name
      .replace(/[/\\]/g, '_')
      .replace(/\.\./g, '_')
      .split('')
      .filter((char) => {
        const code = char.charCodeAt(0);
        return code >= 32 && code !== 127;
      })
      .join('')
      .trim()
      .slice(0, 200);
    return sanitized || 'document';
  }

  private parseSort(sort: string | undefined): SortItem[] {
    if (!sort) return [];
    return sort.split(',').flatMap((part) => {
      const [field, dir] = part.split(':') as [string, string | undefined];
      if (!DOCUMENT_SORT_WHITELIST.includes(field as DocumentSortField)) return [];
      if (dir !== 'asc' && dir !== 'desc') return [];
      return [{ field: field as DocumentSortField, dir }];
    });
  }

  private hasActiveVehicle(): SQL<unknown> {
    return sql`(${documents.vehicleId} IS NULL OR EXISTS (
      SELECT 1 FROM ${vehicles}
      WHERE ${vehicles.id} = ${documents.vehicleId}
        AND ${vehicles.deletedAt} IS NULL
    ))`;
  }

  private hasActiveExpense(): SQL<unknown> {
    return sql`(${documents.expenseId} IS NULL OR EXISTS (
      SELECT 1 FROM ${expenses}
      WHERE ${expenses.id} = ${documents.expenseId}
        AND ${expenses.deletedAt} IS NULL
        AND (${expenses.vehicleId} IS NULL OR EXISTS (
          SELECT 1 FROM ${vehicles}
          WHERE ${vehicles.id} = ${expenses.vehicleId}
            AND ${vehicles.deletedAt} IS NULL
        ))
    ))`;
  }

  private belongsToVehicleScope(vehicleId: string): SQL<unknown> {
    return or(
      eq(documents.vehicleId, vehicleId),
      and(
        isNull(documents.vehicleId),
        sql`EXISTS (
          SELECT 1 FROM ${expenses}
          WHERE ${expenses.id} = ${documents.expenseId}
            AND ${expenses.vehicleId} = ${vehicleId}
        )`,
      ),
    )!;
  }

  private responseRelations() {
    return {
      vehicle: { columns: { id: true, identifier: true, brand: true, model: true } },
      expense: { columns: { id: true, expenseDate: true, amount: true, currency: true } },
      createdByUser: { columns: { id: true, fullName: true } },
      updatedByUser: { columns: { id: true, fullName: true } },
      deletedByUser: { columns: { id: true, fullName: true } },
    } as const;
  }

  private toUserInfo(row: { id: string; fullName: string } | null | undefined): DocumentUserInfo {
    return { id: row?.id ?? '', fullName: row?.fullName ?? '' };
  }

  private toResponse(row: DocumentRow): DocumentResponse {
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      fileKey: row.fileKey,
      url: row.url,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      vehicleId: row.vehicleId,
      vehicle: row.vehicle
        ? {
            id: row.vehicle.id,
            identifier: row.vehicle.identifier,
            brand: row.vehicle.brand,
            model: row.vehicle.model,
          }
        : null,
      expenseId: row.expenseId,
      expense: row.expense
        ? {
            id: row.expense.id,
            expenseDate: row.expense.expenseDate,
            amount: Number(row.expense.amount),
            currency: row.expense.currency,
          }
        : null,
      createdBy: this.toUserInfo(row.createdByUser),
      updatedBy: this.toUserInfo(row.updatedByUser),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      deletedBy: row.deletedByUser ? this.toUserInfo(row.deletedByUser) : null,
    };
  }
}
