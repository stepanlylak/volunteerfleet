import { Inject, Injectable } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import {
  VEHICLE_ALERT_CONFIG,
  type VehicleAlert,
  type VehicleAlertType,
} from '@volunteerfleet/shared';
import { DB } from '../../db/db.module.js';
import type { Database } from '../../db/client.js';
import { vehicleAlertsView } from '../../db/schema/index.js';

@Injectable()
export class VehicleAlertService {
  constructor(@Inject(DB) private readonly db: Database) {}

  // Reads alert types from the slim view and maps each to a full VehicleAlert
  // via VEHICLE_ALERT_CONFIG (UA message lives in shared, not in the DB).
  async getAlertsForVehicles(vehicleIds: string[]): Promise<Map<string, VehicleAlert[]>> {
    const result = new Map<string, VehicleAlert[]>();
    if (vehicleIds.length === 0) return result;

    const rows = await this.db
      .select({ vehicleId: vehicleAlertsView.vehicleId, type: vehicleAlertsView.type })
      .from(vehicleAlertsView)
      .where(inArray(vehicleAlertsView.vehicleId, vehicleIds));

    for (const row of rows) {
      if (!row.vehicleId || !row.type) continue;
      const type = row.type as VehicleAlertType;
      const config = VEHICLE_ALERT_CONFIG[type];
      if (!config) continue;
      const list = result.get(row.vehicleId) ?? [];
      list.push({ type, message: config.message });
      result.set(row.vehicleId, list);
    }

    return result;
  }

  async getAlertsForVehicle(vehicleId: string): Promise<VehicleAlert[]> {
    const map = await this.getAlertsForVehicles([vehicleId]);
    return map.get(vehicleId) ?? [];
  }
}
