import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import {
  VEHICLE_GALLERY_MAX_ITEMS,
  type VehicleGalleryCreate,
  type VehicleGalleryItemResponse,
  type VehicleGalleryListResponse,
  type VehicleGalleryResponse,
  type VehicleGalleryUpdate,
} from '@volunteerfleet/shared';
import type { Database } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { vehicleGalleries, vehicleGalleryItems, vehicles } from '../../db/schema/index.js';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type DbOrTx = Database | Tx;

type GalleryRow = typeof vehicleGalleries.$inferSelect;
type GalleryItemRow = typeof vehicleGalleryItems.$inferSelect;

function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: unknown; constraint?: unknown };
  return candidate.code === '23505' && candidate.constraint === constraint;
}

@Injectable()
export class VehicleGalleriesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  // Called inside the create-vehicle transaction so a vehicle can never be
  // committed without its active main gallery (epic decision 1).
  async insertMainGallery(
    db: DbOrTx,
    vehicle: { id: string; organizationId: string },
    userId: string,
  ): Promise<void> {
    await db.insert(vehicleGalleries).values({
      organizationId: vehicle.organizationId,
      vehicleId: vehicle.id,
      kind: 'main',
      isPublic: true,
      sortOrder: 0,
      createdBy: userId,
      updatedBy: userId,
    });
  }

  async getGalleryResponse(
    vehicleId: string,
    galleryId: string,
    activeOrgId: string,
  ): Promise<VehicleGalleryResponse> {
    const gallery = await this.findGallery(vehicleId, galleryId, activeOrgId);
    const items = await this.findActiveItems(galleryId);
    return this.toResponse(gallery, items);
  }

  async list(vehicleId: string, activeOrgId: string): Promise<VehicleGalleryListResponse> {
    await this.assertVehicleExists(vehicleId, activeOrgId);
    const rows = await this.findGalleriesWithItems(vehicleId, activeOrgId);
    return {
      items: rows.map((row) => this.toResponse(row, row.items)),
      total: rows.length,
    };
  }

  async create(
    vehicleId: string,
    input: VehicleGalleryCreate,
    userId: string,
    activeOrgId: string,
  ): Promise<VehicleGalleryResponse> {
    const vehicle = await this.assertVehicleExists(vehicleId, activeOrgId);
    await this.assertNameAvailable(vehicleId, input.name);

    try {
      const [row] = await this.db
        .insert(vehicleGalleries)
        .values({
          organizationId: vehicle.organizationId,
          vehicleId,
          kind: 'custom',
          name: input.name,
          description: input.description ?? null,
          isPublic: input.isPublic,
          sortOrder: sql`(SELECT COALESCE(MAX(${vehicleGalleries.sortOrder}), 0) + 1 FROM ${vehicleGalleries} WHERE ${vehicleGalleries.vehicleId} = ${vehicleId})`,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();
      if (!row) throw new Error('Insert returned no rows');
      return this.toResponse(row, []);
    } catch (error) {
      if (isUniqueViolation(error, 'vehicle_galleries_name_active_unique')) {
        throw new ConflictException('GALLERY_NAME_ALREADY_EXISTS');
      }
      throw error;
    }
  }

  async update(
    vehicleId: string,
    galleryId: string,
    input: VehicleGalleryUpdate,
    userId: string,
    activeOrgId: string,
  ): Promise<VehicleGalleryResponse> {
    const gallery = await this.findGallery(vehicleId, galleryId, activeOrgId);

    if (gallery.kind === 'main' && (input.name !== undefined || input.isPublic !== undefined)) {
      throw new BadRequestException('MAIN_GALLERY_IMMUTABLE');
    }

    if (input.name !== undefined && input.name !== gallery.name) {
      await this.assertNameAvailable(vehicleId, input.name, galleryId);
    }

    const updateValues: Partial<typeof vehicleGalleries.$inferInsert> = {
      updatedBy: userId,
      updatedAt: new Date(),
    };
    if (input.name !== undefined) updateValues.name = input.name;
    if (input.description !== undefined) updateValues.description = input.description;
    if (input.isPublic !== undefined) updateValues.isPublic = input.isPublic;

    try {
      await this.db
        .update(vehicleGalleries)
        .set(updateValues)
        .where(eq(vehicleGalleries.id, galleryId));
    } catch (error) {
      if (isUniqueViolation(error, 'vehicle_galleries_name_active_unique')) {
        throw new ConflictException('GALLERY_NAME_ALREADY_EXISTS');
      }
      throw error;
    }

    const updated = await this.findGallery(vehicleId, galleryId, activeOrgId);
    return this.toResponse(updated, await this.findActiveItems(galleryId));
  }

  async softDelete(
    vehicleId: string,
    galleryId: string,
    userId: string,
    activeOrgId: string,
  ): Promise<void> {
    const gallery = await this.findGallery(vehicleId, galleryId, activeOrgId);

    if (gallery.kind === 'main') {
      throw new BadRequestException('MAIN_GALLERY_DELETE_FORBIDDEN');
    }

    const deletedAt = new Date();
    await this.db.transaction(async (tx) => {
      await tx
        .update(vehicleGalleries)
        .set({ deletedAt, deletedBy: userId, updatedBy: userId, updatedAt: deletedAt })
        .where(and(eq(vehicleGalleries.id, galleryId), isNull(vehicleGalleries.deletedAt)));
      await tx
        .update(vehicleGalleryItems)
        .set({ deletedAt, deletedBy: userId, updatedBy: userId, updatedAt: deletedAt })
        .where(
          and(eq(vehicleGalleryItems.galleryId, galleryId), isNull(vehicleGalleryItems.deletedAt)),
        );
    });
  }

  private async assertVehicleExists(
    vehicleId: string,
    activeOrgId: string,
  ): Promise<{ id: string; organizationId: string }> {
    const vehicle = await this.db.query.vehicles.findFirst({
      columns: { id: true, organizationId: true },
      where: and(
        eq(vehicles.id, vehicleId),
        eq(vehicles.organizationId, activeOrgId),
        isNull(vehicles.deletedAt),
      ),
    });
    if (!vehicle) throw new NotFoundException(`Vehicle ${vehicleId} not found`);
    return vehicle;
  }

  private async findGallery(
    vehicleId: string,
    galleryId: string,
    activeOrgId: string,
  ): Promise<GalleryRow> {
    const gallery = await this.db.query.vehicleGalleries.findFirst({
      where: and(
        eq(vehicleGalleries.id, galleryId),
        eq(vehicleGalleries.vehicleId, vehicleId),
        eq(vehicleGalleries.organizationId, activeOrgId),
        isNull(vehicleGalleries.deletedAt),
      ),
    });
    if (!gallery) throw new NotFoundException('GALLERY_NOT_FOUND');
    return gallery;
  }

  private async findGalleriesWithItems(vehicleId: string, activeOrgId: string) {
    return this.db.query.vehicleGalleries.findMany({
      where: and(
        eq(vehicleGalleries.vehicleId, vehicleId),
        eq(vehicleGalleries.organizationId, activeOrgId),
        isNull(vehicleGalleries.deletedAt),
      ),
      orderBy: [
        sql`CASE WHEN ${vehicleGalleries.kind} = 'main' THEN 0 ELSE 1 END`,
        asc(vehicleGalleries.sortOrder),
        asc(vehicleGalleries.createdAt),
      ],
      with: {
        items: {
          where: isNull(vehicleGalleryItems.deletedAt),
          orderBy: [asc(vehicleGalleryItems.sortOrder), asc(vehicleGalleryItems.createdAt)],
        },
      },
    });
  }

  private findActiveItems(galleryId: string): Promise<GalleryItemRow[]> {
    return this.db.query.vehicleGalleryItems.findMany({
      where: and(
        eq(vehicleGalleryItems.galleryId, galleryId),
        isNull(vehicleGalleryItems.deletedAt),
      ),
      orderBy: [asc(vehicleGalleryItems.sortOrder), asc(vehicleGalleryItems.createdAt)],
    });
  }

  private async assertNameAvailable(
    vehicleId: string,
    name: string,
    excludeGalleryId?: string,
  ): Promise<void> {
    const conditions = [
      eq(vehicleGalleries.vehicleId, vehicleId),
      isNull(vehicleGalleries.deletedAt),
      sql`lower(trim(${vehicleGalleries.name})) = lower(trim(${name}))`,
    ];
    const existing = await this.db.query.vehicleGalleries.findFirst({
      columns: { id: true },
      where: and(...conditions),
    });
    if (existing && existing.id !== excludeGalleryId) {
      throw new ConflictException('GALLERY_NAME_ALREADY_EXISTS');
    }
  }

  private toResponse(row: GalleryRow, items: GalleryItemRow[]): VehicleGalleryResponse {
    const explicitCoverIsActive =
      row.coverItemId !== null && items.some((item) => item.id === row.coverItemId);
    return {
      id: row.id,
      vehicleId: row.vehicleId,
      kind: row.kind,
      name: row.name,
      description: row.description,
      isPublic: row.isPublic,
      sortOrder: row.sortOrder,
      explicitCoverItemId: row.coverItemId,
      effectiveCoverItemId: explicitCoverIsActive ? row.coverItemId : (items[0]?.id ?? null),
      items: items.map((item) => this.toItemResponse(item)),
      maxItems: VEHICLE_GALLERY_MAX_ITEMS,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toItemResponse(row: GalleryItemRow): VehicleGalleryItemResponse {
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
