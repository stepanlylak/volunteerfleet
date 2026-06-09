import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import type { DashboardStats } from '@volunteerfleet/shared';
import { DB } from '../../db/db.module.js';
import type { Database } from '../../db/client.js';
import { documents, expenses, vehicles } from '../../db/schema/index.js';
import {
  VEHICLE_STATUSES,
  VEHICLE_STATUS_DASHBOARD_GROUP,
  VEHICLE_STATUS_CONFIG,
} from '@volunteerfleet/shared';

@Injectable()
export class DashboardService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async getStats(organizationId: string): Promise<DashboardStats> {
    const totalResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(vehicles)
      .where(and(isNull(vehicles.deletedAt), eq(vehicles.organizationId, organizationId)));
    const totalVehicles = totalResult[0]?.count ?? 0;

    // Count vehicles by status enum
    const statusCountResult = await this.db
      .select({
        status: vehicles.status,
        count: sql<number>`count(${vehicles.id})::int`,
      })
      .from(vehicles)
      .where(and(isNull(vehicles.deletedAt), eq(vehicles.organizationId, organizationId)))
      .groupBy(vehicles.status);

    const statusCountMap = new Map(statusCountResult.map((r) => [r.status, r.count]));

    // Build status counts with config
    const statusRows = VEHICLE_STATUSES.map((status) => ({
      status,
      count: statusCountMap.get(status) ?? 0,
      kind: VEHICLE_STATUS_DASHBOARD_GROUP[status],
      color: VEHICLE_STATUS_CONFIG[status].color,
      sortOrder: VEHICLE_STATUS_CONFIG[status].sortOrder,
    }));

    const inWorkVehicles = statusRows
      .filter((r) => r.kind === 'in_work')
      .reduce((acc, r) => acc + r.count, 0);

    const transferredVehicles = statusRows
      .filter((r) => r.kind === 'final')
      .reduce((acc, r) => acc + r.count, 0);

    const { dateFrom, dateTo } = this.currentMonthRange();
    const expenseResult = await this.db
      .select({
        totalUah: sql<string>`coalesce(sum(${expenses.amount} * ${expenses.rate}), 0)`,
      })
      .from(expenses)
      .where(
        and(
          isNull(expenses.deletedAt),
          eq(expenses.organizationId, organizationId),
          this.expenseHasActiveVehicle(),
          gte(expenses.expenseDate, dateFrom),
          lte(expenses.expenseDate, dateTo),
        ),
      );
    const monthlyExpenseUah = Number(expenseResult[0]?.totalUah ?? 0);

    const docsTotalResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(documents)
      .where(
        and(
          isNull(documents.deletedAt),
          eq(documents.organizationId, organizationId),
          this.documentHasActiveVehicle(),
          this.documentHasActiveExpense(),
        ),
      );
    const documentsTotal = docsTotalResult[0]?.count ?? 0;

    const docsMonthResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(documents)
      .where(
        and(
          isNull(documents.deletedAt),
          eq(documents.organizationId, organizationId),
          this.documentHasActiveVehicle(),
          this.documentHasActiveExpense(),
          gte(sql`${documents.createdAt}::date`, dateFrom),
          lte(sql`${documents.createdAt}::date`, dateTo),
        ),
      );
    const documentsThisMonth = docsMonthResult[0]?.count ?? 0;

    return {
      totalVehicles,
      inWorkVehicles,
      transferredVehicles,
      statusCounts: statusRows.map((row) => ({
        status: row.status,
        statusName: VEHICLE_STATUS_CONFIG[row.status].label,
        count: row.count,
        kind: row.kind,
        color: row.color,
        sortOrder: row.sortOrder,
      })),
      monthlyExpenseUah,
      documentsTotal,
      documentsThisMonth,
    };
  }

  private currentMonthRange(): { dateFrom: string; dateTo: string } {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const dateFrom = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
    const dateTo = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
    return { dateFrom, dateTo };
  }

  private expenseHasActiveVehicle() {
    return sql`(${expenses.vehicleId} IS NULL OR EXISTS (
      SELECT 1 FROM ${vehicles}
      WHERE ${vehicles.id} = ${expenses.vehicleId}
        AND ${vehicles.deletedAt} IS NULL
    ))`;
  }

  private documentHasActiveVehicle() {
    return sql`(${documents.vehicleId} IS NULL OR EXISTS (
      SELECT 1 FROM ${vehicles}
      WHERE ${vehicles.id} = ${documents.vehicleId}
        AND ${vehicles.deletedAt} IS NULL
    ))`;
  }

  private documentHasActiveExpense() {
    return sql`(${documents.expenseId} IS NULL OR EXISTS (
      SELECT 1 FROM ${expenses}
      WHERE ${expenses.id} = ${documents.expenseId}
        AND ${expenses.deletedAt} IS NULL
        AND (${expenses.vehicleId} IS NULL OR EXISTS (
          SELECT 1 FROM ${vehicles}
          WHERE ${vehicles.id} = ${expenses.vehicleId}
            AND ${vehicles.deletedAt} IS NULL
        ))
    ))`;
  }
}
