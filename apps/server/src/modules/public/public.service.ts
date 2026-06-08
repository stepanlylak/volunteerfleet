import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Readable } from 'stream';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type {
  FundingSourceReportQuery,
  PublicFundingReportResponse,
  PublicVehicleResponse,
} from '@volunteerfleet/shared';
import type { Database } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { vehiclePhotos, vehicles } from '../../db/schema/index.js';
import { ReportsService } from '../reports/reports.service.js';
import { VehiclePhotosService } from '../vehicles/vehicle-photos.service.js';

@Injectable()
export class PublicService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly reports: ReportsService,
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
      with: {
        status: true,
      },
    });

    if (!row) throw new NotFoundException('PUBLIC_VEHICLE_NOT_FOUND');

    return {
      identifier: row.identifier,
      brand: row.brand,
      model: row.model,
      year: row.year,
      status: { name: row.status?.name ?? '—' },
      publicSummary: row.publicSummary,
      publicCollectedAmountUah: row.publicCollectedAmountUah
        ? Number(row.publicCollectedAmountUah)
        : null,
      publicGoalAmountUah: row.publicGoalAmountUah ? Number(row.publicGoalAmountUah) : null,
      photos: await this.getPublicPhotos(row.id),
      createdAt: row.createdAt.toISOString(),
    };
  }

  async getPhotoDownloadStream(
    photoId: string,
  ): Promise<{ body: Readable; contentType: string; contentLength?: number }> {
    return this.photos.getDownloadStream(photoId, true);
  }

  async getFundingReport(
    orgId: string,
    fundingSourceId: string,
    query: FundingSourceReportQuery,
  ): Promise<PublicFundingReportResponse> {
    const report = await this.reports.getPublicFundingSourceReport(fundingSourceId, query);

    if (report.fundingSource.organizationId !== orgId) {
      throw new NotFoundException('PUBLIC_REPORT_NOT_FOUND');
    }

    return {
      fundingSource: {
        id: report.fundingSource.id,
        name: report.fundingSource.name,
        type: report.fundingSource.type,
        description: report.fundingSource.description,
      },
      dateFrom: report.dateFrom,
      dateTo: report.dateTo,
      totalUah: report.totalUah,
      byCategory: report.byCategory,
      byVehicle: report.byVehicle.filter((row) => row.vehicle != null),
    };
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
