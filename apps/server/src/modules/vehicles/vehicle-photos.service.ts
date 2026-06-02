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
import { and, asc, count, eq, isNull, sql } from 'drizzle-orm';
import type {
  JwtPayload,
  VehiclePhotoListResponse,
  VehiclePhotoOrderUpdate,
  VehiclePhotoResponse,
  VehiclePhotoUploadMetadata,
} from '@volunteerfleet/shared';
import type { Database } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { vehiclePhotos, vehicles } from '../../db/schema/index.js';
import { StorageService } from '../../storage/storage.service.js';

const MAX_VEHICLE_PHOTOS = 10;
const ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;

interface FileTypeModule {
  fileTypeFromBuffer(input: Uint8Array): Promise<{ mime: string } | undefined>;
}

@Injectable()
export class VehiclePhotosService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly storage: StorageService,
  ) {}

  async list(vehicleId: string): Promise<VehiclePhotoListResponse> {
    await this.assertVehicleExists(vehicleId);
    const rows = await this.db.query.vehiclePhotos.findMany({
      where: and(eq(vehiclePhotos.vehicleId, vehicleId), isNull(vehiclePhotos.deletedAt)),
      orderBy: [asc(vehiclePhotos.sortOrder), asc(vehiclePhotos.createdAt)],
    });

    return {
      items: rows.map((row) => this.toResponse(row)),
      total: rows.length,
      maxPhotos: MAX_VEHICLE_PHOTOS,
    };
  }

  async upload(
    vehicleId: string,
    file: Express.Multer.File | undefined,
    input: VehiclePhotoUploadMetadata,
    userId: string,
    maxUploadBytes: number,
  ): Promise<VehiclePhotoResponse> {
    if (!file) throw new BadRequestException('FILE_REQUIRED');
    if (file.size > maxUploadBytes) {
      throw new PayloadTooLargeException('MAX_UPLOAD_BYTES_EXCEEDED');
    }

    const mime = await this.detectMime(file);
    if (!this.isAllowedPhotoMime(mime)) {
      throw new UnsupportedMediaTypeException('UNSUPPORTED_PHOTO_TYPE');
    }

    const inserted = await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM vehicles WHERE id = ${vehicleId} AND deleted_at IS NULL FOR UPDATE`,
      );

      const existingVehicle = await tx.query.vehicles.findFirst({
        where: and(eq(vehicles.id, vehicleId), isNull(vehicles.deletedAt)),
      });
      if (!existingVehicle) throw new NotFoundException(`Vehicle ${vehicleId} not found`);

      const existingCount = await tx
        .select({ value: count() })
        .from(vehiclePhotos)
        .where(and(eq(vehiclePhotos.vehicleId, vehicleId), isNull(vehiclePhotos.deletedAt)));
      const currentCount = existingCount[0]?.value ?? 0;
      if (currentCount >= MAX_VEHICLE_PHOTOS) {
        throw new BadRequestException('VEHICLE_PHOTO_LIMIT_EXCEEDED');
      }

      const id = randomUUID();
      const key = `vehicle-photos/${vehicleId}/${id}/${this.sanitizeFileName(file.originalname)}`;
      await this.storage.putObject(Readable.from(file.buffer), {
        key,
        mime,
        size: file.size,
      });

      const [row] = await tx
        .insert(vehiclePhotos)
        .values({
          id,
          vehicleId,
          fileKey: key,
          mimeType: mime,
          sizeBytes: file.size,
          sortOrder: input.sortOrder ?? currentCount,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      if (!row) throw new Error('Insert returned no rows');
      return row;
    });

    return this.toResponse(inserted);
  }

  async reorder(
    vehicleId: string,
    input: VehiclePhotoOrderUpdate,
    userId: string,
  ): Promise<VehiclePhotoListResponse> {
    await this.assertVehicleExists(vehicleId);
    const rows = await this.db.query.vehiclePhotos.findMany({
      where: and(eq(vehiclePhotos.vehicleId, vehicleId), isNull(vehiclePhotos.deletedAt)),
    });
    const activeIds = new Set(rows.map((row) => row.id));
    const incomingIds = new Set(input.photoIds);
    const isSameSet =
      activeIds.size === incomingIds.size && [...activeIds].every((id) => incomingIds.has(id));
    if (!isSameSet) throw new BadRequestException('PHOTO_ORDER_MUST_INCLUDE_ALL_ACTIVE_PHOTOS');

    await this.db.transaction(async (tx) => {
      for (const [index, photoId] of input.photoIds.entries()) {
        await tx
          .update(vehiclePhotos)
          .set({ sortOrder: index, updatedBy: userId, updatedAt: new Date() })
          .where(eq(vehiclePhotos.id, photoId));
      }
    });

    return this.list(vehicleId);
  }

  async remove(vehicleId: string, photoId: string, user: JwtPayload): Promise<void> {
    const existing = await this.db.query.vehiclePhotos.findFirst({
      where: and(
        eq(vehiclePhotos.id, photoId),
        eq(vehiclePhotos.vehicleId, vehicleId),
        isNull(vehiclePhotos.deletedAt),
      ),
    });
    if (!existing) throw new NotFoundException(`Vehicle photo ${photoId} not found`);
    if (user.role !== 'admin' && existing.createdBy !== user.sub) {
      throw new ForbiddenException('NOT_OWNER');
    }

    await this.db
      .update(vehiclePhotos)
      .set({
        deletedAt: new Date(),
        deletedBy: user.sub,
        updatedBy: user.sub,
        updatedAt: new Date(),
      })
      .where(eq(vehiclePhotos.id, photoId));
  }

  assertAllowedPhotoForTest(mime: string, size: number, currentCount: number, maxUploadBytes: number) {
    if (currentCount >= MAX_VEHICLE_PHOTOS) {
      throw new BadRequestException('VEHICLE_PHOTO_LIMIT_EXCEEDED');
    }
    if (size > maxUploadBytes) {
      throw new PayloadTooLargeException('MAX_UPLOAD_BYTES_EXCEEDED');
    }
    if (!this.isAllowedPhotoMime(mime)) {
      throw new UnsupportedMediaTypeException('UNSUPPORTED_PHOTO_TYPE');
    }
  }

  async getDownloadUrl(photoId: string, publicOnly = false): Promise<string> {
    const row = await this.db.query.vehiclePhotos.findFirst({
      where: and(eq(vehiclePhotos.id, photoId), isNull(vehiclePhotos.deletedAt)),
      with: { vehicle: true },
    });
    if (!row || !row.vehicle || row.vehicle.deletedAt) {
      throw new NotFoundException(`Vehicle photo ${photoId} not found`);
    }
    if (publicOnly && !row.vehicle.isPublic) {
      throw new NotFoundException(`Vehicle photo ${photoId} not found`);
    }
    return this.storage.getPresignedDownloadUrl(row.fileKey, 300);
  }

  private async assertVehicleExists(vehicleId: string): Promise<void> {
    const vehicle = await this.db.query.vehicles.findFirst({
      where: and(eq(vehicles.id, vehicleId), isNull(vehicles.deletedAt)),
    });
    if (!vehicle) throw new NotFoundException(`Vehicle ${vehicleId} not found`);
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

  private isAllowedPhotoMime(mime: string): boolean {
    return ALLOWED_PHOTO_MIME_TYPES.includes(mime as (typeof ALLOWED_PHOTO_MIME_TYPES)[number]);
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
    return sanitized || 'photo';
  }

  private toResponse(row: typeof vehiclePhotos.$inferSelect): VehiclePhotoResponse {
    return {
      id: row.id,
      vehicleId: row.vehicleId,
      fileKey: row.fileKey,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
