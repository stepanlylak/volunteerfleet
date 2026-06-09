import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Readable } from 'stream';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { PublicVehicleGallery, PublicVehicleResponse } from '@volunteerfleet/shared';
import { VEHICLE_GALLERY_PRESENTATION, VEHICLE_STATUS_CONFIG } from '@volunteerfleet/shared';
import type { Database } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { vehicleGalleries, vehicleGalleryItems, vehicles } from '../../db/schema/index.js';
import { StorageService } from '../../storage/storage.service.js';

@Injectable()
export class PublicService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly storage: StorageService,
  ) {}

  async getVehicleById(orgId: string, vehicleId: string): Promise<PublicVehicleResponse> {
    const row = await this.db.query.vehicles.findFirst({
      where: and(
        eq(vehicles.id, vehicleId),
        eq(vehicles.organizationId, orgId),
        eq(vehicles.isPublic, true),
        isNull(vehicles.deletedAt),
      ),
    });

    if (!row) throw new NotFoundException('PUBLIC_VEHICLE_NOT_FOUND');

    return {
      identifier: row.identifier,
      brand: row.brand,
      model: row.model,
      year: row.year,
      status: { name: VEHICLE_STATUS_CONFIG[row.status].label },
      publicSummary: row.publicSummary,
      publicCollectedAmountUahMinor: row.publicCollectedAmountUahMinor,
      publicGoalAmountUahMinor: row.publicGoalAmountUahMinor,
      galleries: await this.getPublicGalleries(row.id),
      createdAt: row.createdAt.toISOString(),
    };
  }

  async getGalleryItemDownloadStream(
    itemId: string,
  ): Promise<{ body: Readable; contentType: string; contentLength?: number }> {
    // Full visibility chain check: active/public vehicle, active/public gallery, active item
    const item = await this.db.query.vehicleGalleryItems.findFirst({
      where: and(eq(vehicleGalleryItems.id, itemId), isNull(vehicleGalleryItems.deletedAt)),
      with: {
        gallery: true,
        vehicle: true,
      },
    });

    if (!item) throw new NotFoundException('GALLERY_ITEM_NOT_FOUND');

    // Check vehicle is active and public
    if (item.vehicle.deletedAt !== null || !item.vehicle.isPublic) {
      throw new NotFoundException('GALLERY_ITEM_NOT_FOUND');
    }

    // Check gallery is active and public (main is always public per DB constraint)
    if (item.gallery.deletedAt !== null || !item.gallery.isPublic) {
      throw new NotFoundException('GALLERY_ITEM_NOT_FOUND');
    }

    const object = await this.storage.getObjectStream(item.fileKey);
    return {
      body: object.body,
      contentType: item.mimeType ?? object.contentType,
      contentLength: object.contentLength,
    };
  }

  private async getPublicGalleries(vehicleId: string): Promise<PublicVehicleGallery[]> {
    // Fetch public galleries (main is always public; custom must have isPublic=true)
    const galleries = await this.db.query.vehicleGalleries.findMany({
      where: and(
        eq(vehicleGalleries.vehicleId, vehicleId),
        isNull(vehicleGalleries.deletedAt),
        // Main gallery is always public per DB constraint; custom galleries must be public
        sql`(${vehicleGalleries.kind} = 'main' OR ${vehicleGalleries.isPublic} = true)`,
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
        coverItem: true,
      },
    });

    return galleries.map((gallery) => ({
      id: gallery.id,
      kind: gallery.kind,
      name: gallery.name,
      displayLabel:
        gallery.kind === 'main' ? VEHICLE_GALLERY_PRESENTATION.main.label : (gallery.name ?? ''), // Custom galleries should always have a name per DB constraint
      description: gallery.description,
      sortOrder: gallery.sortOrder,
      coverItemId: gallery.coverItem?.id ?? gallery.items[0]?.id ?? null,
      items: gallery.items.map((item) => ({
        id: item.id,
        type: item.type,
        mimeType: item.mimeType,
        caption: item.caption,
        sortOrder: item.sortOrder,
      })),
    }));
  }
}
