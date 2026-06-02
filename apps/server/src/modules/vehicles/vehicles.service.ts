import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { and, asc, desc, eq, ilike, isNull, not, or, SQL, sql } from 'drizzle-orm';
import type {
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
import { vehicles, vehicleStatusHistory, vehicleStatuses } from '../../db/schema/index.js';

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
  constructor(@Inject(DB) private readonly db: Database) {}

  async list(query: VehicleListQuery, userRole: string): Promise<VehicleListResponse> {
    const { page, pageSize, sort, search, statusId, includeDeleted } = query;

    // Only admin can see deleted vehicles
    if (includeDeleted && userRole !== 'admin') {
      throw new ForbiddenException('Only admin can view deleted vehicles');
    }

    const conditions: SQL<unknown>[] = [];

    if (!includeDeleted) {
      conditions.push(isNull(vehicles.deletedAt));
    }

    if (statusId) {
      conditions.push(eq(vehicles.statusId, statusId));
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
        status: true,
        createdByUser: { columns: { id: true, fullName: true } },
        updatedByUser: { columns: { id: true, fullName: true } },
        deletedByUser: { columns: { id: true, fullName: true } },
      },
    });

    const items = rows.map((r) => this.toResponse(r));
    const totalPages = Math.ceil(total / pageSize);

    return { items, page, pageSize, total, totalPages };
  }

  async findById(id: string, includeDeleted = false): Promise<VehicleResponse> {
    const where = includeDeleted
      ? eq(vehicles.id, id)
      : and(eq(vehicles.id, id), isNull(vehicles.deletedAt));

    const row = await this.db.query.vehicles.findFirst({
      where,
      with: {
        status: true,
        createdByUser: { columns: { id: true, fullName: true } },
        updatedByUser: { columns: { id: true, fullName: true } },
        deletedByUser: { columns: { id: true, fullName: true } },
      },
    });

    if (!row) {
      throw new NotFoundException(`Vehicle ${id} not found`);
    }

    return this.toResponse(row);
  }

  async create(input: VehicleCreate, userId: string): Promise<VehicleResponse> {
    const result = await this.db.transaction(async (tx) => {
      // Insert vehicle
      const inserted = await tx
        .insert(vehicles)
        .values({
          ...input,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      const vehicle = inserted[0];
      if (!vehicle) throw new Error('Insert returned no rows');

      // Create status history entry with null oldStatusId
      await tx.insert(vehicleStatusHistory).values({
        vehicleId: vehicle.id,
        oldStatusId: null,
        newStatusId: vehicle.statusId,
        changedBy: userId,
        note: null,
      });

      return vehicle;
    });

    // Fetch full response with relations
    return this.findById(result.id);
  }

  async update(id: string, input: VehicleUpdate, userId: string): Promise<VehicleResponse> {
    const vehicle = await this.db.query.vehicles.findFirst({
      where: and(eq(vehicles.id, id), isNull(vehicles.deletedAt)),
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${id} not found`);
    }

    const oldStatusId = vehicle.statusId;
    const newStatusId = input.statusId ?? oldStatusId;
    const statusChanged = input.statusId !== undefined && input.statusId !== oldStatusId;

    // Check publicSlug uniqueness if provided
    if (
      input.publicSlug !== undefined &&
      input.publicSlug !== null &&
      input.publicSlug !== vehicle.publicSlug
    ) {
      const existing = await this.db.query.vehicles.findFirst({
        where: and(
          eq(vehicles.publicSlug, input.publicSlug),
          not(eq(vehicles.id, id)),
          isNull(vehicles.deletedAt),
        ),
      });
      if (existing) {
        throw new ConflictException('public_slug already in use');
      }
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
    if (input.borderCrossingDate !== undefined) {
      updateValues.borderCrossingDate = input.borderCrossingDate;
    }
    if (input.statusId !== undefined) updateValues.statusId = input.statusId;
    if (input.description !== undefined) updateValues.description = input.description;
    if (input.isPublic !== undefined) updateValues.isPublic = input.isPublic;
    if (input.publicSlug !== undefined) updateValues.publicSlug = input.publicSlug;
    if (input.publicSummary !== undefined) updateValues.publicSummary = input.publicSummary;
    if (input.publicCollectedAmountUah !== undefined) {
      updateValues.publicCollectedAmountUah = input.publicCollectedAmountUah?.toString() ?? null;
    }
    if (input.publicGoalAmountUah !== undefined) {
      updateValues.publicGoalAmountUah = input.publicGoalAmountUah?.toString() ?? null;
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

      // Create status history if status changed
      if (statusChanged) {
        await tx.insert(vehicleStatusHistory).values({
          vehicleId: id,
          oldStatusId,
          newStatusId,
          changedBy: userId,
          note: null,
        });
      }

      return updatedVehicle;
    });

    return this.findById(result.id);
  }

  async softDelete(id: string, userId: string): Promise<void> {
    const vehicle = await this.db.query.vehicles.findFirst({
      where: and(eq(vehicles.id, id), isNull(vehicles.deletedAt)),
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

  async restore(id: string): Promise<VehicleResponse> {
    const vehicle = await this.db.query.vehicles.findFirst({
      where: and(eq(vehicles.id, id), not(isNull(vehicles.deletedAt))),
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

    return this.findById(id, true);
  }

  async getStatusHistory(vehicleId: string): Promise<VehicleStatusHistoryListResponse> {
    // Verify vehicle exists
    const vehicle = await this.db.query.vehicles.findFirst({
      where: eq(vehicles.id, vehicleId),
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${vehicleId} not found`);
    }

    const rows = await this.db.query.vehicleStatusHistory.findMany({
      where: eq(vehicleStatusHistory.vehicleId, vehicleId),
      orderBy: [desc(vehicleStatusHistory.changedAt)],
      with: {
        oldStatus: true,
        newStatus: true,
        changedByUser: { columns: { id: true, fullName: true } },
      },
    });

    const items = rows.map((r) => ({
      id: r.id,
      vehicleId: r.vehicleId,
      oldStatusId: r.oldStatusId,
      oldStatus: r.oldStatus
        ? {
            id: r.oldStatus.id,
            name: r.oldStatus.name,
            sortOrder: r.oldStatus.sortOrder,
            isDefault: r.oldStatus.isDefault,
            kind: r.oldStatus.kind,
            color: r.oldStatus.color,
            createdAt: r.oldStatus.createdAt.toISOString(),
            updatedAt: r.oldStatus.updatedAt.toISOString(),
          }
        : null,
      newStatusId: r.newStatusId,
      newStatus: r.newStatus
        ? {
            id: r.newStatus.id,
            name: r.newStatus.name,
            sortOrder: r.newStatus.sortOrder,
            isDefault: r.newStatus.isDefault,
            kind: r.newStatus.kind,
            color: r.newStatus.color,
            createdAt: r.newStatus.createdAt.toISOString(),
            updatedAt: r.newStatus.updatedAt.toISOString(),
          }
        : undefined,
      changedBy: { id: r.changedByUser.id, fullName: r.changedByUser.fullName },
      note: r.note,
      changedAt: r.changedAt.toISOString(),
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
      status?: typeof vehicleStatuses.$inferSelect;
      createdByUser?: { id: string; fullName: string };
      updatedByUser?: { id: string; fullName: string };
      deletedByUser?: { id: string; fullName: string } | null;
    },
  ): VehicleResponse {
    return {
      id: row.id,
      identifier: row.identifier,
      brand: row.brand,
      model: row.model,
      year: row.year,
      vin: row.vin,
      borderCrossingDate: row.borderCrossingDate,
      statusId: row.statusId,
      status: row.status
        ? {
            id: row.status.id,
            name: row.status.name,
            sortOrder: row.status.sortOrder,
            isDefault: row.status.isDefault,
            kind: row.status.kind,
            color: row.status.color,
            createdAt: row.status.createdAt.toISOString(),
            updatedAt: row.status.updatedAt.toISOString(),
          }
        : undefined,
      description: row.description,
      isPublic: row.isPublic,
      publicSlug: row.publicSlug,
      publicSummary: row.publicSummary,
      publicCollectedAmountUah: row.publicCollectedAmountUah
        ? Number(row.publicCollectedAmountUah)
        : null,
      publicGoalAmountUah: row.publicGoalAmountUah ? Number(row.publicGoalAmountUah) : null,
      createdBy: this.toUserInfoRequired(row.createdByUser ?? { id: '', fullName: '' }),
      updatedBy: this.toUserInfoRequired(row.updatedByUser ?? { id: '', fullName: '' }),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      deletedBy: row.deletedByUser ? this.toUserInfo(row.deletedByUser) : null,
    };
  }
}
