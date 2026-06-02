import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type {
  VehicleStatus,
  VehicleStatusCreate,
  VehicleStatusUpdate,
} from '@volunteerfleet/shared';
import { DB } from '../../db/db.module.js';
import type { Database } from '../../db/client.js';
import { vehicleStatuses } from '../../db/schema/index.js';

@Injectable()
export class VehicleStatusesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async list(): Promise<VehicleStatus[]> {
    const rows = await this.db
      .select()
      .from(vehicleStatuses)
      .orderBy(asc(vehicleStatuses.sortOrder), asc(vehicleStatuses.name));
    return rows.map(toResponse);
  }

  async create(input: VehicleStatusCreate): Promise<VehicleStatus> {
    const rows = await this.db.insert(vehicleStatuses).values(input).returning();
    const row = rows[0];
    if (!row) throw new Error('Insert returned no rows');
    return toResponse(row);
  }

  async update(id: string, input: VehicleStatusUpdate): Promise<VehicleStatus> {
    const rows = await this.db
      .update(vehicleStatuses)
      .set(input)
      .where(eq(vehicleStatuses.id, id))
      .returning();
    const row = rows[0];
    if (!row) throw new NotFoundException(`vehicle_status ${id} not found`);
    return toResponse(row);
  }

  async remove(id: string): Promise<void> {
    const result = await this.db
      .delete(vehicleStatuses)
      .where(eq(vehicleStatuses.id, id))
      .returning({ id: vehicleStatuses.id });
    if (result.length === 0) {
      throw new NotFoundException(`vehicle_status ${id} not found`);
    }
  }
}

function toResponse(row: typeof vehicleStatuses.$inferSelect): VehicleStatus {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sortOrder,
    isDefault: row.isDefault,
    kind: row.kind,
    color: row.color,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
