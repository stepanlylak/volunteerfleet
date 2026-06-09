import {
  BadRequestException,
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
  VehicleGalleryItemMove,
  VehicleGalleryItemOrderUpdate,
  VehicleGalleryItemResponse,
  VehicleGalleryItemUpdate,
  VehicleGalleryItemUploadMetadata,
  VehicleGalleryResponse,
  VehicleGallerySetCover,
} from '@volunteerfleet/shared';
import { VEHICLE_GALLERY_MAX_ITEMS } from '@volunteerfleet/shared';
import type { Database } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { vehicleGalleries, vehicleGalleryItems, vehicles } from '../../db/schema/index.js';
import { StorageService } from '../../storage/storage.service.js';
import { decodeUploadFileName } from '../../common/utils/decode-upload-filename.js';
import { VehicleGalleriesService } from './vehicle-galleries.service.js';

const ALLOWED_ITEM_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;

interface FileTypeModule {
  fileTypeFromBuffer(input: Uint8Array): Promise<{ mime: string } | undefined>;
}

type GalleryItemRow = typeof vehicleGalleryItems.$inferSelect;

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

@Injectable()
export class VehicleGalleryItemsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly storage: StorageService,
    private readonly galleriesService: VehicleGalleriesService,
  ) {}

  async upload(
    vehicleId: string,
    galleryId: string,
    file: Express.Multer.File | undefined,
    input: VehicleGalleryItemUploadMetadata,
    userId: string,
    maxUploadBytes: number,
    activeOrgId: string,
  ): Promise<VehicleGalleryItemResponse> {
    if (!file) throw new BadRequestException('FILE_REQUIRED');
    if (file.size > maxUploadBytes) {
      throw new PayloadTooLargeException('MAX_UPLOAD_BYTES_EXCEEDED');
    }

    const mime = await this.detectMime(file);
    if (!this.isAllowedItemMime(mime)) {
      throw new UnsupportedMediaTypeException('UNSUPPORTED_ITEM_TYPE');
    }

    const id = randomUUID();
    const sanitizedName = this.sanitizeFileName(decodeUploadFileName(file.originalname));
    const key = `vehicle-galleries/${vehicleId}/${galleryId}/${id}/${sanitizedName}`;

    const inserted = await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM vehicle_galleries WHERE id = ${galleryId} AND deleted_at IS NULL FOR UPDATE`,
      );

      const vehicle = await tx.query.vehicles.findFirst({
        columns: { id: true, organizationId: true },
        where: and(
          eq(vehicles.id, vehicleId),
          eq(vehicles.organizationId, activeOrgId),
          isNull(vehicles.deletedAt),
        ),
      });
      if (!vehicle) throw new NotFoundException(`Vehicle ${vehicleId} not found`);

      const gallery = await tx.query.vehicleGalleries.findFirst({
        columns: { id: true },
        where: and(
          eq(vehicleGalleries.id, galleryId),
          eq(vehicleGalleries.vehicleId, vehicleId),
          eq(vehicleGalleries.organizationId, activeOrgId),
          isNull(vehicleGalleries.deletedAt),
        ),
      });
      if (!gallery) throw new NotFoundException('GALLERY_NOT_FOUND');

      const countResult = await tx
        .select({ value: count() })
        .from(vehicleGalleryItems)
        .where(
          and(eq(vehicleGalleryItems.galleryId, galleryId), isNull(vehicleGalleryItems.deletedAt)),
        );
      const currentCount = countResult[0]?.value ?? 0;
      if (currentCount >= VEHICLE_GALLERY_MAX_ITEMS) {
        throw new BadRequestException('GALLERY_ITEM_LIMIT_EXCEEDED');
      }

      await this.storage.putObject(Readable.from(file.buffer), {
        key,
        mime,
        size: file.size,
      });

      const [row] = await tx
        .insert(vehicleGalleryItems)
        .values({
          id,
          organizationId: vehicle.organizationId,
          vehicleId,
          galleryId,
          type: 'image',
          fileKey: key,
          originalName: sanitizedName,
          mimeType: mime,
          sizeBytes: file.size,
          caption: input.caption ?? null,
          sortOrder: currentCount,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      if (!row) throw new Error('Insert returned no rows');
      return row;
    });

    return this.toResponse(inserted);
  }

  async updateCaption(
    vehicleId: string,
    galleryId: string,
    itemId: string,
    input: VehicleGalleryItemUpdate,
    userId: string,
    activeOrgId: string,
  ): Promise<VehicleGalleryItemResponse> {
    const existing = await this.db.query.vehicleGalleryItems.findFirst({
      where: and(
        eq(vehicleGalleryItems.id, itemId),
        eq(vehicleGalleryItems.galleryId, galleryId),
        eq(vehicleGalleryItems.vehicleId, vehicleId),
        eq(vehicleGalleryItems.organizationId, activeOrgId),
        isNull(vehicleGalleryItems.deletedAt),
      ),
    });
    if (!existing) throw new NotFoundException('GALLERY_ITEM_NOT_FOUND');

    const [updated] = await this.db
      .update(vehicleGalleryItems)
      .set({
        caption: input.caption ?? null,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(vehicleGalleryItems.id, itemId))
      .returning();

    if (!updated) throw new Error('Update returned no rows');
    return this.toResponse(updated);
  }

  async getDownloadStream(
    vehicleId: string,
    galleryId: string,
    itemId: string,
    activeOrgId: string,
  ): Promise<{ body: Readable; contentType: string; contentLength?: number }> {
    const item = await this.db.query.vehicleGalleryItems.findFirst({
      where: and(
        eq(vehicleGalleryItems.id, itemId),
        eq(vehicleGalleryItems.galleryId, galleryId),
        eq(vehicleGalleryItems.vehicleId, vehicleId),
        eq(vehicleGalleryItems.organizationId, activeOrgId),
        isNull(vehicleGalleryItems.deletedAt),
      ),
      with: {
        gallery: true,
        vehicle: true,
      },
    });

    if (!item || item.gallery.deletedAt !== null || item.vehicle.deletedAt !== null) {
      throw new NotFoundException('GALLERY_ITEM_NOT_FOUND');
    }

    const object = await this.storage.getObjectStream(item.fileKey);
    return {
      body: object.body,
      contentType: item.mimeType ?? object.contentType,
      contentLength: object.contentLength,
    };
  }

  async reorder(
    vehicleId: string,
    galleryId: string,
    input: VehicleGalleryItemOrderUpdate,
    userId: string,
    activeOrgId: string,
  ): Promise<VehicleGalleryItemResponse[]> {
    await this.findGalleryOrFail(vehicleId, galleryId, activeOrgId);

    const activeItems = await this.db.query.vehicleGalleryItems.findMany({
      where: and(
        eq(vehicleGalleryItems.galleryId, galleryId),
        isNull(vehicleGalleryItems.deletedAt),
      ),
    });

    const activeIds = new Set(activeItems.map((i) => i.id));
    const inputIds = input.itemIds;

    if (inputIds.length !== activeIds.size || inputIds.some((id) => !activeIds.has(id))) {
      throw new BadRequestException('ITEM_ORDER_MUST_INCLUDE_ALL_ACTIVE_ITEMS');
    }

    const now = new Date();
    await this.db.transaction(async (tx) => {
      // First pass: shift all to high values to avoid unique constraint collisions
      for (const [index, id] of inputIds.entries()) {
        await tx
          .update(vehicleGalleryItems)
          .set({ sortOrder: VEHICLE_GALLERY_MAX_ITEMS + index, updatedBy: userId, updatedAt: now })
          .where(eq(vehicleGalleryItems.id, id));
      }
      // Second pass: set final values
      for (const [index, id] of inputIds.entries()) {
        await tx
          .update(vehicleGalleryItems)
          .set({ sortOrder: index, updatedBy: userId, updatedAt: now })
          .where(eq(vehicleGalleryItems.id, id));
      }
    });

    const updated = await this.db.query.vehicleGalleryItems.findMany({
      where: and(
        eq(vehicleGalleryItems.galleryId, galleryId),
        isNull(vehicleGalleryItems.deletedAt),
      ),
      orderBy: [asc(vehicleGalleryItems.sortOrder), asc(vehicleGalleryItems.createdAt)],
    });

    return updated.map((row) => this.toResponse(row));
  }

  async setCover(
    vehicleId: string,
    galleryId: string,
    input: VehicleGallerySetCover,
    userId: string,
    activeOrgId: string,
  ): Promise<VehicleGalleryResponse> {
    await this.findGalleryOrFail(vehicleId, galleryId, activeOrgId);

    if (input.itemId !== null) {
      const item = await this.db.query.vehicleGalleryItems.findFirst({
        where: and(
          eq(vehicleGalleryItems.id, input.itemId),
          eq(vehicleGalleryItems.galleryId, galleryId),
          eq(vehicleGalleryItems.vehicleId, vehicleId),
          eq(vehicleGalleryItems.organizationId, activeOrgId),
          isNull(vehicleGalleryItems.deletedAt),
        ),
      });
      if (!item || item.type !== 'image') {
        throw new BadRequestException('COVER_ITEM_NOT_IN_GALLERY');
      }
    }

    await this.db
      .update(vehicleGalleries)
      .set({ coverItemId: input.itemId, updatedBy: userId, updatedAt: new Date() })
      .where(eq(vehicleGalleries.id, galleryId));

    return this.galleriesService.getGalleryResponse(vehicleId, galleryId, activeOrgId);
  }

  async move(
    vehicleId: string,
    galleryId: string,
    itemId: string,
    input: VehicleGalleryItemMove,
    userId: string,
    activeOrgId: string,
  ): Promise<VehicleGalleryItemResponse> {
    const { targetGalleryId } = input;

    if (targetGalleryId === galleryId) {
      throw new BadRequestException('MOVE_TARGET_MUST_DIFFER_FROM_SOURCE');
    }

    const item = await this.db.query.vehicleGalleryItems.findFirst({
      where: and(
        eq(vehicleGalleryItems.id, itemId),
        eq(vehicleGalleryItems.galleryId, galleryId),
        eq(vehicleGalleryItems.vehicleId, vehicleId),
        eq(vehicleGalleryItems.organizationId, activeOrgId),
        isNull(vehicleGalleryItems.deletedAt),
      ),
    });
    if (!item) throw new NotFoundException('GALLERY_ITEM_NOT_FOUND');

    const targetGallery = await this.db.query.vehicleGalleries.findFirst({
      where: and(
        eq(vehicleGalleries.id, targetGalleryId),
        eq(vehicleGalleries.vehicleId, vehicleId),
        eq(vehicleGalleries.organizationId, activeOrgId),
        isNull(vehicleGalleries.deletedAt),
      ),
    });
    if (!targetGallery) throw new NotFoundException('TARGET_GALLERY_NOT_FOUND');

    const moved = await this.db.transaction(async (tx) => {
      const lockIds = [galleryId, targetGalleryId].sort();
      for (const id of lockIds) {
        await tx.execute(
          sql`SELECT id FROM vehicle_galleries WHERE id = ${id} AND deleted_at IS NULL FOR UPDATE`,
        );
      }

      const targetCountResult = await tx
        .select({ value: count() })
        .from(vehicleGalleryItems)
        .where(
          and(
            eq(vehicleGalleryItems.galleryId, targetGalleryId),
            isNull(vehicleGalleryItems.deletedAt),
          ),
        );
      const targetCount = targetCountResult[0]?.value ?? 0;
      if (targetCount >= VEHICLE_GALLERY_MAX_ITEMS) {
        throw new BadRequestException('GALLERY_ITEM_LIMIT_EXCEEDED');
      }

      const sourceGallery = await tx.query.vehicleGalleries.findFirst({
        columns: { coverItemId: true },
        where: eq(vehicleGalleries.id, galleryId),
      });
      if (sourceGallery?.coverItemId === itemId) {
        await tx
          .update(vehicleGalleries)
          .set({ coverItemId: null, updatedBy: userId, updatedAt: new Date() })
          .where(eq(vehicleGalleries.id, galleryId));
      }

      const [movedItem] = await tx
        .update(vehicleGalleryItems)
        .set({
          galleryId: targetGalleryId,
          sortOrder: targetCount,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(vehicleGalleryItems.id, itemId))
        .returning();
      if (!movedItem) throw new Error('Update returned no rows');

      await this.normalizeSourceOrder(tx, galleryId, userId);

      return movedItem;
    });

    return this.toResponse(moved);
  }

  async softDelete(
    vehicleId: string,
    galleryId: string,
    itemId: string,
    userId: string,
    activeOrgId: string,
  ): Promise<void> {
    const item = await this.db.query.vehicleGalleryItems.findFirst({
      where: and(
        eq(vehicleGalleryItems.id, itemId),
        eq(vehicleGalleryItems.galleryId, galleryId),
        eq(vehicleGalleryItems.vehicleId, vehicleId),
        eq(vehicleGalleryItems.organizationId, activeOrgId),
        isNull(vehicleGalleryItems.deletedAt),
      ),
    });
    if (!item) throw new NotFoundException('GALLERY_ITEM_NOT_FOUND');

    const deletedAt = new Date();
    await this.db.transaction(async (tx) => {
      await tx
        .update(vehicleGalleries)
        .set({ coverItemId: null, updatedBy: userId, updatedAt: deletedAt })
        .where(and(eq(vehicleGalleries.id, galleryId), eq(vehicleGalleries.coverItemId, itemId)));

      await tx
        .update(vehicleGalleryItems)
        .set({ deletedAt, deletedBy: userId, updatedBy: userId, updatedAt: deletedAt })
        .where(eq(vehicleGalleryItems.id, itemId));

      await this.normalizeSourceOrder(tx, galleryId, userId);
    });
  }

  assertAllowedItemForTest(
    mime: string,
    size: number,
    currentCount: number,
    maxUploadBytes: number,
  ): void {
    if (size > maxUploadBytes) {
      throw new PayloadTooLargeException('MAX_UPLOAD_BYTES_EXCEEDED');
    }
    if (!this.isAllowedItemMime(mime)) {
      throw new UnsupportedMediaTypeException('UNSUPPORTED_ITEM_TYPE');
    }
    if (currentCount >= VEHICLE_GALLERY_MAX_ITEMS) {
      throw new BadRequestException('GALLERY_ITEM_LIMIT_EXCEEDED');
    }
  }

  private async findGalleryOrFail(
    vehicleId: string,
    galleryId: string,
    activeOrgId: string,
  ): Promise<void> {
    const gallery = await this.db.query.vehicleGalleries.findFirst({
      columns: { id: true },
      where: and(
        eq(vehicleGalleries.id, galleryId),
        eq(vehicleGalleries.vehicleId, vehicleId),
        eq(vehicleGalleries.organizationId, activeOrgId),
        isNull(vehicleGalleries.deletedAt),
      ),
    });
    if (!gallery) throw new NotFoundException('GALLERY_NOT_FOUND');
  }

  private async normalizeSourceOrder(
    tx: Tx,
    sourceGalleryId: string,
    userId: string,
  ): Promise<void> {
    const remaining = await tx.query.vehicleGalleryItems.findMany({
      where: and(
        eq(vehicleGalleryItems.galleryId, sourceGalleryId),
        isNull(vehicleGalleryItems.deletedAt),
      ),
      orderBy: [asc(vehicleGalleryItems.sortOrder), asc(vehicleGalleryItems.createdAt)],
    });
    for (const [index, item] of remaining.entries()) {
      if (item.sortOrder !== index) {
        await tx
          .update(vehicleGalleryItems)
          .set({ sortOrder: index, updatedBy: userId, updatedAt: new Date() })
          .where(eq(vehicleGalleryItems.id, item.id));
      }
    }
  }

  private async detectMime(file: Express.Multer.File): Promise<string> {
    const fileType = await this.loadFileType();
    const sniffed = await fileType.fileTypeFromBuffer(file.buffer.subarray(0, 4100));
    return sniffed?.mime ?? file.mimetype;
  }

  private async loadFileType(): Promise<FileTypeModule> {
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      return { fileTypeFromBuffer: async () => undefined };
    }
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (
      specifier: string,
    ) => Promise<FileTypeModule>;
    return dynamicImport('file-type');
  }

  private isAllowedItemMime(mime: string): boolean {
    return ALLOWED_ITEM_MIME_TYPES.includes(mime as (typeof ALLOWED_ITEM_MIME_TYPES)[number]);
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
    return sanitized || 'file';
  }

  private toResponse(row: GalleryItemRow): VehicleGalleryItemResponse {
    return {
      id: row.id,
      vehicleId: row.vehicleId,
      galleryId: row.galleryId,
      type: row.type,
      originalName: row.originalName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      caption: row.caption,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
