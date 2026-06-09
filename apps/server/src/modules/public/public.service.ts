import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Readable } from 'stream';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { PublicVehicleResponse } from '@volunteerfleet/shared';
import type { Database } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { vehiclePhotos, vehicles } from '../../db/schema/index.js';
import { VEHICLE_STATUS_CONFIG } from '@volunteerfleet/shared';
import { VehiclePhotosService } from '../vehicles/vehicle-photos.service.js';

@Injectable()
export class PublicService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly photos: VehiclePhotosService,
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
      photos: await this.getPublicPhotos(row.id),
      createdAt: row.createdAt.toISOString(),
    };
  }

  async getPhotoDownloadStream(
    photoId: string,
  ): Promise<{ body: Readable; contentType: string; contentLength?: number }> {
    return this.photos.getDownloadStream(photoId, true);
  }

  private async getPublicPhotos(vehicleId: string): Promise<PublicVehicleResponse['photos']> {
    const rows = await this.db.query.vehiclePhotos.findMany({
      where: and(eq(vehiclePhotos.vehicleId, vehicleId), isNull(vehiclePhotos.deletedAt)),
      orderBy: [asc(vehiclePhotos.sortOrder), asc(vehiclePhotos.createdAt)],
    });
    return rows.map((row) => ({
      id: row.id,
      mimeType: row.mimeType,
      sortOrder: row.sortOrder,
    }));
  }
}
