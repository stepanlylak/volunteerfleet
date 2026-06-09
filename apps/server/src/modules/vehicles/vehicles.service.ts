import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { and, asc, desc, eq, exists, ilike, inArray, isNull, not, or, SQL, sql } from 'drizzle-orm';
import type {
  OrgRole,
  VehicleAlert,
  VehicleCreate,
  VehicleListQuery,
  VehicleListResponse,
  VehicleResponse,
  VehicleStatusHistoryListResponse,
  VehicleUpdate,
  VehicleUserInfo,
} from '@volunteerfleet/shared';
import { DB } from '../../db/db.module.js';
import type { Database } from '../../db/client.js';
import { vehicleAlertsView, vehicles, vehicleStatusHistory } from '../../db/schema/index.js';
import { VehicleAlertService } from './vehicle-alert.service.js';

const VEHICLE_SORT_WHITELIST = [
  'identifier',
  'brand',
  'model',
  'year',
  'createdAt',
  'updatedAt',
] as const;
type VehicleSortField = (typeof VEHICLE_SORT_WHITELIST)[number];

interface SortItem {
  field: VehicleSortField;
  dir: 'asc' | 'desc';
}

@Injectable()
export class VehiclesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly alertService: VehicleAlertService,
  ) {}

  async list(
    query: VehicleListQuery,
    orgRole: OrgRole | null | undefined,
    activeOrgId: string,
  ): Promise<VehicleListResponse> {
    const { page, pageSize, sort, search, status, statuses, hasAlerts, includeDeleted } = query;

    // Only coordinator can see deleted vehicles
    if (includeDeleted && orgRole !== 'coordinator') {
      throw new ForbiddenException('Only coordinator can view deleted vehicles');
    }

    const conditions: SQL<unknown>[] = [eq(vehicles.organizationId, activeOrgId)];

    if (!includeDeleted) {
      conditions.push(isNull(vehicles.deletedAt));
    }

    if (statuses && statuses.length > 0) {
      conditions.push(inArray(vehicles.status, statuses));
    } else if (status) {
      conditions.push(eq(vehicles.status, status));
    }

    if (hasAlerts !== undefined) {
      const hasAlertsExpr = exists(
        this.db
          .select({ one: sql`1` })
          .from(vehicleAlertsView)
          .where(eq(vehicleAlertsView.vehicleId, vehicles.id)),
      );
      conditions.push(hasAlerts ? hasAlertsExpr : not(hasAlertsExpr));
    }

    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          ilike(vehicles.brand, searchPattern),
          ilike(vehicles.model, searchPattern),
          ilike(vehicles.vin, searchPattern),
          ilike(vehicles.identifier, searchPattern),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count total
    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(vehicles)
      .where(whereClause);
    const total = countResult[0]?.count ?? 0;

    // Parse and validate sort
    const sortItems = this.parseSort(sort);
    const orderBy: SQL<unknown>[] = sortItems.map((s) =>
      s.dir === 'asc' ? asc(vehicles[s.field]) : desc(vehicles[s.field]),
    );
    if (orderBy.length === 0) {
      orderBy.push(desc(vehicles.createdAt));
    }

    // Fetch items with relations
    const rows = await this.db.query.vehicles.findMany({
      where: whereClause,
      orderBy,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      with: {
        createdByUser: { columns: { id: true, fullName: true } },
        updatedByUser: { columns: { id: true, fullName: true } },
        deletedByUser: { columns: { id: true, fullName: true } },
      },
    });

    const alertsByVehicle = await this.alertService.getAlertsForVehicles(rows.map((r) => r.id));
    const items = rows.map((r) => this.toResponse(r, alertsByVehicle.get(r.id) ?? []));
    const totalPages = Math.ceil(total / pageSize);

    return { items, page, pageSize, total, totalPages };
  }

  async findById(
    id: string,
    activeOrgId: string,
    includeDeleted = false,
  ): Promise<VehicleResponse> {
    const conditions: SQL<unknown>[] = [
      eq(vehicles.id, id),
      eq(vehicles.organizationId, activeOrgId),
    ];
    if (!includeDeleted) {
      conditions.push(isNull(vehicles.deletedAt));
    }
    const where = and(...conditions);

    const row = await this.db.query.vehicles.findFirst({
      where,
      with: {
        createdByUser: { columns: { id: true, fullName: true } },
        updatedByUser: { columns: { id: true, fullName: true } },
        deletedByUser: { columns: { id: true, fullName: true } },
      },
    });

    if (!row) {
      throw new NotFoundException(`Vehicle ${id} not found`);
    }

    const alerts = await this.alertService.getAlertsForVehicle(row.id);
    return this.toResponse(row, alerts);
  }

  async create(
    input: VehicleCreate,
    userId: string,
    organizationId: string,
  ): Promise<VehicleResponse> {
    const result = await this.db.transaction(async (tx) => {
      // Insert vehicle
      const inserted = await tx
        .insert(vehicles)
        .values({
          ...input,
          organizationId,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      const vehicle = inserted[0];
      if (!vehicle) throw new Error('Insert returned no rows');

      // Create status history entry with null oldStatus
      await tx.insert(vehicleStatusHistory).values({
        organizationId: vehicle.organizationId,
        vehicleId: vehicle.id,
        oldStatus: null,
        newStatus: vehicle.status,
        changedBy: userId,
        note: null,
        transitionDate: input.startDate,
      });

      return vehicle;
    });

    // Fetch full response with relations
    return this.findById(result.id, organizationId);
  }

  async update(
    id: string,
    input: VehicleUpdate,
    userId: string,
    activeOrgId: string,
  ): Promise<VehicleResponse> {
    const vehicle = await this.db.query.vehicles.findFirst({
      where: and(
        eq(vehicles.id, id),
        eq(vehicles.organizationId, activeOrgId),
        isNull(vehicles.deletedAt),
      ),
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${id} not found`);
    }

    // Build update values with proper type conversion
    const updateValues: Record<string, unknown> = {
      updatedBy: userId,
      updatedAt: new Date(),
    };

    if (input.identifier !== undefined) updateValues.identifier = input.identifier;
    if (input.brand !== undefined) updateValues.brand = input.brand;
    if (input.model !== undefined) updateValues.model = input.model;
    if (input.year !== undefined) updateValues.year = input.year;
    if (input.vin !== undefined) updateValues.vin = input.vin;
    if (input.startDate !== undefined) updateValues.startDate = input.startDate;
    if (input.description !== undefined) updateValues.description = input.description;
    if (input.isPublic !== undefined) updateValues.isPublic = input.isPublic;
    if (input.publicSummary !== undefined) updateValues.publicSummary = input.publicSummary;
    if (input.publicCollectedAmountUahMinor !== undefined) {
      updateValues.publicCollectedAmountUahMinor = input.publicCollectedAmountUahMinor ?? null;
    }
    if (input.publicGoalAmountUahMinor !== undefined) {
      updateValues.publicGoalAmountUahMinor = input.publicGoalAmountUahMinor ?? null;
    }

    const result = await this.db.transaction(async (tx) => {
      // Update vehicle
      const updated = await tx
        .update(vehicles)
        .set(updateValues)
        .where(eq(vehicles.id, id))
        .returning();

      const updatedVehicle = updated[0];
      if (!updatedVehicle) throw new NotFoundException(`Vehicle ${id} not found`);

      return updatedVehicle;
    });

    return this.findById(result.id, activeOrgId);
  }

  async softDelete(id: string, userId: string, activeOrgId: string): Promise<void> {
    const vehicle = await this.db.query.vehicles.findFirst({
      where: and(
        eq(vehicles.id, id),
        eq(vehicles.organizationId, activeOrgId),
        isNull(vehicles.deletedAt),
      ),
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${id} not found`);
    }

    await this.db
      .update(vehicles)
      .set({
        deletedAt: new Date(),
        deletedBy: userId,
      })
      .where(eq(vehicles.id, id));
  }

  async restore(id: string, activeOrgId: string): Promise<VehicleResponse> {
    const vehicle = await this.db.query.vehicles.findFirst({
      where: and(
        eq(vehicles.id, id),
        eq(vehicles.organizationId, activeOrgId),
        not(isNull(vehicles.deletedAt)),
      ),
    });

    if (!vehicle) {
      throw new NotFoundException(`Deleted vehicle ${id} not found`);
    }

    await this.db
      .update(vehicles)
      .set({
        deletedAt: null,
        deletedBy: null,
      })
      .where(eq(vehicles.id, id));

    return this.findById(id, activeOrgId, true);
  }

  async getStatusHistory(
    vehicleId: string,
    activeOrgId: string,
  ): Promise<VehicleStatusHistoryListResponse> {
    // Verify vehicle exists
    const vehicle = await this.db.query.vehicles.findFirst({
      where: and(eq(vehicles.id, vehicleId), eq(vehicles.organizationId, activeOrgId)),
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${vehicleId} not found`);
    }

    const rows = await this.db.query.vehicleStatusHistory.findMany({
      where: eq(vehicleStatusHistory.vehicleId, vehicleId),
      orderBy: [desc(vehicleStatusHistory.changedAt)],
      with: {
        changedByUser: { columns: { id: true, fullName: true } },
      },
    });

    const items = rows.map((r) => ({
      id: r.id,
      vehicleId: r.vehicleId,
      oldStatus: r.oldStatus,
      newStatus: r.newStatus,
      changedBy: { id: r.changedByUser.id, fullName: r.changedByUser.fullName },
      note: r.note,
      changedAt: r.changedAt.toISOString(),
      transitionDate: r.transitionDate,
      isLocalPurchase: r.isLocalPurchase,
      isRegisteredAtServiceCenter: r.isRegisteredAtServiceCenter,
      lostReason: r.lostReason,
      registrationDocId: r.registrationDocId,
      stampedRegistrationDocId: r.stampedRegistrationDocId,
      customsDeclarationDocId: r.customsDeclarationDocId,
      stampedCustomsDeclarationDocId: r.stampedCustomsDeclarationDocId,
      transferActDraftDocId: r.transferActDraftDocId,
      transferActSignedDocId: r.transferActSignedDocId,
      returnActDocId: r.returnActDocId,
    }));

    return { items, total: items.length };
  }

  private parseSort(sort: string | undefined): SortItem[] {
    if (!sort) return [];

    const items: SortItem[] = [];
    const parts = sort.split(',');

    for (const part of parts) {
      const [field, dir] = part.split(':') as [string, string | undefined];
      if (!VEHICLE_SORT_WHITELIST.includes(field as VehicleSortField)) continue;
      if (dir !== 'asc' && dir !== 'desc') continue;
      items.push({ field: field as VehicleSortField, dir });
    }

    return items;
  }

  private toUserInfo(row: { id: string; fullName: string } | null): VehicleUserInfo | null {
    if (!row) return null;
    return { id: row.id, fullName: row.fullName };
  }

  private toUserInfoRequired(row: { id: string; fullName: string }): VehicleUserInfo {
    return { id: row.id, fullName: row.fullName };
  }

  private toResponse(
    row: typeof vehicles.$inferSelect & {
      createdByUser?: { id: string; fullName: string };
      updatedByUser?: { id: string; fullName: string };
      deletedByUser?: { id: string; fullName: string } | null;
    },
    alerts: VehicleAlert[] = [],
  ): VehicleResponse {
    return {
      id: row.id,
      identifier: row.identifier,
      brand: row.brand,
      model: row.model,
      year: row.year,
      vin: row.vin,
      startDate: row.startDate,
      borderCrossingDate: row.borderCrossingDate,
      status: row.status,
      description: row.description,
      isPublic: row.isPublic,
      publicSummary: row.publicSummary,
      publicCollectedAmountUahMinor: row.publicCollectedAmountUahMinor,
      publicGoalAmountUahMinor: row.publicGoalAmountUahMinor,
      createdBy: this.toUserInfoRequired(row.createdByUser ?? { id: '', fullName: '' }),
      updatedBy: this.toUserInfoRequired(row.updatedByUser ?? { id: '', fullName: '' }),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      deletedBy: row.deletedByUser ? this.toUserInfo(row.deletedByUser) : null,
      alerts,
    };
  }
}
