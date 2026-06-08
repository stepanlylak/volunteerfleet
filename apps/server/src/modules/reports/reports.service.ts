import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gte, inArray, isNull, lte, or, SQL, sql } from 'drizzle-orm';
import type {
  DocumentResponse,
  DocumentUserInfo,
  ExpenseResponse,
  ExpenseUserInfo,
  FundingSourceReportQuery,
  FundingSourceReportResponse,
  VehicleExpenseBreakdown,
  VehicleReportResponse,
  VehicleResponse,
  VehicleStatusHistory,
  VehicleUserInfo,
} from '@volunteerfleet/shared';
import type { Database } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import {
  documents,
  expenseCategories,
  expenses,
  fundingSources,
  users,
  vehicles,
  vehicleStatuses,
  vehicleStatusHistory,
} from '../../db/schema/index.js';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service.js';

type VehicleRow = typeof vehicles.$inferSelect & {
  status?: typeof vehicleStatuses.$inferSelect;
  createdByUser?: Pick<typeof users.$inferSelect, 'id' | 'fullName'>;
  updatedByUser?: Pick<typeof users.$inferSelect, 'id' | 'fullName'>;
  deletedByUser?: Pick<typeof users.$inferSelect, 'id' | 'fullName'> | null;
};

type ExpenseRow = typeof expenses.$inferSelect & {
  vehicle?: Pick<typeof vehicles.$inferSelect, 'id' | 'identifier' | 'brand' | 'model'> | null;
  category?: typeof expenseCategories.$inferSelect;
  fundingSource?: typeof fundingSources.$inferSelect;
  createdByUser?: Pick<typeof users.$inferSelect, 'id' | 'fullName'>;
  updatedByUser?: Pick<typeof users.$inferSelect, 'id' | 'fullName'>;
  deletedByUser?: Pick<typeof users.$inferSelect, 'id' | 'fullName'> | null;
};

type DocumentRow = typeof documents.$inferSelect & {
  vehicle?: Pick<typeof vehicles.$inferSelect, 'id' | 'identifier' | 'brand' | 'model'> | null;
  expense?: Pick<typeof expenses.$inferSelect, 'id' | 'expenseDate' | 'amount' | 'currency'> | null;
  createdByUser?: Pick<typeof users.$inferSelect, 'id' | 'fullName'>;
  updatedByUser?: Pick<typeof users.$inferSelect, 'id' | 'fullName'>;
  deletedByUser?: Pick<typeof users.$inferSelect, 'id' | 'fullName'> | null;
};

type StatusHistoryRow = typeof vehicleStatusHistory.$inferSelect & {
  oldStatus?: typeof vehicleStatuses.$inferSelect | null;
  newStatus?: typeof vehicleStatuses.$inferSelect;
  changedByUser?: Pick<typeof users.$inferSelect, 'id' | 'fullName'>;
};

type AggregationExpense = {
  amount: string | number;
  currency: 'UAH' | 'USD' | 'EUR';
  rate: string | number;
  expenseDate?: string | Date;
  deletedAt?: Date | null;
  category?: { name: string } | null;
  vehicle?: {
    id: string;
    identifier: string;
    brand: string;
    model: string;
  } | null;
};

type ReportRateResolver = (row: AggregationExpense) => number;

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function addMoney(current: number, next: number): number {
  return roundMoney(current + next);
}

export function buildExpenseAggregations(
  rows: AggregationExpense[],
  resolveRate?: ReportRateResolver,
): {
  totalUah: number;
  byCurrency: { currency: 'UAH' | 'USD' | 'EUR'; totalInCurrency: number; totalUah: number }[];
  byCategory: { category: string; totalUah: number }[];
  byVehicle: VehicleExpenseBreakdown[];
} {
  const activeRows = rows.filter((row) => !row.deletedAt);
  const byCurrency = new Map<
    'UAH' | 'USD' | 'EUR',
    { currency: 'UAH' | 'USD' | 'EUR'; totalInCurrency: number; totalUah: number }
  >();
  const byCategory = new Map<string, number>();
  const byVehicle = new Map<
    string,
    { vehicle: VehicleExpenseBreakdown['vehicle']; totalUah: number }
  >();
  let totalUah = 0;

  for (const row of activeRows) {
    const amount = Number(row.amount);
    const rate = resolveRate?.(row) ?? Number(row.rate);
    const total = roundMoney(amount * rate);
    totalUah = addMoney(totalUah, total);

    const currencyGroup = byCurrency.get(row.currency) ?? {
      currency: row.currency,
      totalInCurrency: 0,
      totalUah: 0,
    };
    currencyGroup.totalInCurrency = addMoney(currencyGroup.totalInCurrency, amount);
    currencyGroup.totalUah = addMoney(currencyGroup.totalUah, total);
    byCurrency.set(row.currency, currencyGroup);

    const categoryName = row.category?.name ?? 'Без категорії';
    byCategory.set(categoryName, addMoney(byCategory.get(categoryName) ?? 0, total));

    const vehicleKey = row.vehicle?.id ?? 'none';
    const vehicleGroup = byVehicle.get(vehicleKey) ?? {
      vehicle: row.vehicle
        ? {
            id: row.vehicle.id,
            identifier: row.vehicle.identifier,
            brand: row.vehicle.brand,
            model: row.vehicle.model,
          }
        : null,
      totalUah: 0,
    };
    vehicleGroup.totalUah = addMoney(vehicleGroup.totalUah, total);
    byVehicle.set(vehicleKey, vehicleGroup);
  }

  return {
    totalUah,
    byCurrency: [...byCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
    byCategory: [...byCategory.entries()]
      .map(([category, total]) => ({ category, totalUah: total }))
      .sort((a, b) => b.totalUah - a.totalUah),
    byVehicle: [...byVehicle.values()].sort((a, b) => b.totalUah - a.totalUah),
  };
}

@Injectable()
export class ReportsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly exchangeRates: ExchangeRatesService,
  ) {}

  async getVehicleReport(vehicleId: string): Promise<VehicleReportResponse> {
    const vehicle = await this.db.query.vehicles.findFirst({
      where: and(eq(vehicles.id, vehicleId), isNull(vehicles.deletedAt)),
      with: {
        status: true,
        createdByUser: { columns: { id: true, fullName: true } },
        updatedByUser: { columns: { id: true, fullName: true } },
        deletedByUser: { columns: { id: true, fullName: true } },
      },
    });
    if (!vehicle) throw new NotFoundException(`Vehicle ${vehicleId} not found`);

    const expenseRows = await this.db.query.expenses.findMany({
      where: and(eq(expenses.vehicleId, vehicleId), isNull(expenses.deletedAt)),
      orderBy: [desc(expenses.expenseDate), desc(expenses.createdAt)],
      with: this.expenseRelations(),
    });

    const documentIdRows = await this.db
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(
          this.documentBelongsToVehicleScope(vehicleId),
          isNull(documents.deletedAt),
          this.documentHasActiveExpense(),
        ),
      )
      .orderBy(desc(documents.createdAt));
    const documentIds = documentIdRows.map((row) => row.id);
    const documentRows =
      documentIds.length > 0
        ? await this.db.query.documents.findMany({
            where: inArray(documents.id, documentIds),
            with: this.documentRelations(),
          })
        : [];
    const documentsById = new Map(documentRows.map((row) => [row.id, row]));

    const statusRows = await this.db.query.vehicleStatusHistory.findMany({
      where: eq(vehicleStatusHistory.vehicleId, vehicleId),
      orderBy: [desc(vehicleStatusHistory.changedAt)],
      with: {
        oldStatus: true,
        newStatus: true,
        changedByUser: { columns: { id: true, fullName: true } },
      },
    });

    const aggregations = buildExpenseAggregations(expenseRows, (row) =>
      this.resolveReportRate(row),
    );

    return {
      vehicle: this.toVehicleResponse(vehicle),
      totalUah: aggregations.totalUah,
      byCurrency: aggregations.byCurrency,
      byCategory: aggregations.byCategory,
      statusHistory: statusRows.map((row) => this.toStatusHistoryResponse(row)),
      expenses: expenseRows.map((row) => this.toExpenseResponse(row)),
      documents: documentIds.flatMap((id) => {
        const row = documentsById.get(id);
        return row ? [this.toDocumentResponse(row)] : [];
      }),
    };
  }

  async getFundingSourceReport(
    fundingSourceId: string,
    query: FundingSourceReportQuery,
  ): Promise<FundingSourceReportResponse> {
    const fundingSource = await this.db.query.fundingSources.findFirst({
      where: eq(fundingSources.id, fundingSourceId),
    });
    if (!fundingSource) {
      throw new NotFoundException(`Funding source ${fundingSourceId} not found`);
    }

    const conditions: SQL<unknown>[] = [
      eq(expenses.fundingSourceId, fundingSourceId),
      isNull(expenses.deletedAt),
    ];
    if (query.dateFrom) conditions.push(gte(expenses.expenseDate, query.dateFrom));
    if (query.dateTo) conditions.push(lte(expenses.expenseDate, query.dateTo));

    const expenseRows = await this.db.query.expenses.findMany({
      where: and(...conditions),
      orderBy: [desc(expenses.expenseDate), desc(expenses.createdAt)],
      with: this.expenseRelations(),
    });

    const aggregations = buildExpenseAggregations(expenseRows, (row) =>
      this.resolveReportRate(row),
    );

    return {
      fundingSource: {
        id: fundingSource.id,
        name: fundingSource.name,
        type: fundingSource.type,
        description: fundingSource.description,
        createdAt: fundingSource.createdAt.toISOString(),
        updatedAt: fundingSource.updatedAt.toISOString(),
      },
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      totalUah: aggregations.totalUah,
      byCategory: aggregations.byCategory,
      byVehicle: aggregations.byVehicle,
      expenses: expenseRows.map((row) => this.toExpenseResponse(row)),
    };
  }

  async getPublicFundingSourceReport(
    fundingSourceId: string,
    query: FundingSourceReportQuery,
  ): Promise<
    Pick<
      FundingSourceReportResponse,
      'fundingSource' | 'dateFrom' | 'dateTo' | 'totalUah' | 'byCategory' | 'byVehicle'
    >
  > {
    const fundingSource = await this.db.query.fundingSources.findFirst({
      where: eq(fundingSources.id, fundingSourceId),
    });
    if (!fundingSource) {
      throw new NotFoundException(`Funding source ${fundingSourceId} not found`);
    }

    const conditions: SQL<unknown>[] = [
      eq(expenses.fundingSourceId, fundingSourceId),
      isNull(expenses.deletedAt),
      eq(vehicles.isPublic, true),
      isNull(vehicles.deletedAt),
    ];
    if (query.dateFrom) conditions.push(gte(expenses.expenseDate, query.dateFrom));
    if (query.dateTo) conditions.push(lte(expenses.expenseDate, query.dateTo));

    const rows = await this.db
      .select({
        amount: expenses.amount,
        currency: expenses.currency,
        rate: expenses.rate,
        expenseDate: expenses.expenseDate,
        deletedAt: expenses.deletedAt,
        categoryName: expenseCategories.name,
        vehicleId: vehicles.id,
        identifier: vehicles.identifier,
        brand: vehicles.brand,
        model: vehicles.model,
      })
      .from(expenses)
      .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .innerJoin(vehicles, eq(expenses.vehicleId, vehicles.id))
      .where(and(...conditions));

    const aggregations = buildExpenseAggregations(
      rows.map((row) => ({
        amount: row.amount,
        currency: row.currency,
        rate: row.rate,
        expenseDate: row.expenseDate,
        deletedAt: row.deletedAt,
        category: { name: row.categoryName },
        vehicle: {
          id: row.vehicleId,
          identifier: row.identifier,
          brand: row.brand,
          model: row.model,
        },
      })),
      (row) => this.resolveReportRate(row),
    );

    return {
      fundingSource: {
        id: fundingSource.id,
        name: fundingSource.name,
        type: fundingSource.type,
        description: fundingSource.description,
        createdAt: fundingSource.createdAt.toISOString(),
        updatedAt: fundingSource.updatedAt.toISOString(),
      },
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      totalUah: aggregations.totalUah,
      byCategory: aggregations.byCategory,
      byVehicle: aggregations.byVehicle,
    };
  }

  private expenseRelations() {
    return {
      vehicle: {
        columns: {
          id: true,
          identifier: true,
          brand: true,
          model: true,
        },
      },
      category: true,
      fundingSource: true,
      createdByUser: { columns: { id: true, fullName: true } },
      updatedByUser: { columns: { id: true, fullName: true } },
      deletedByUser: { columns: { id: true, fullName: true } },
    } as const;
  }

  private documentRelations() {
    return {
      vehicle: { columns: { id: true, identifier: true, brand: true, model: true } },
      expense: { columns: { id: true, expenseDate: true, amount: true, currency: true } },
      createdByUser: { columns: { id: true, fullName: true } },
      updatedByUser: { columns: { id: true, fullName: true } },
      deletedByUser: { columns: { id: true, fullName: true } },
    } as const;
  }

  private documentBelongsToVehicleScope(vehicleId: string): SQL<unknown> {
    return or(
      eq(documents.vehicleId, vehicleId),
      and(
        isNull(documents.vehicleId),
        sql`EXISTS (
          SELECT 1 FROM ${expenses}
          WHERE ${expenses.id} = ${documents.expenseId}
            AND ${expenses.vehicleId} = ${vehicleId}
        )`,
      ),
    )!;
  }

  private documentHasActiveExpense(): SQL<unknown> {
    return sql`(${documents.expenseId} IS NULL OR EXISTS (
      SELECT 1 FROM ${expenses}
      WHERE ${expenses.id} = ${documents.expenseId}
        AND ${expenses.deletedAt} IS NULL
    ))`;
  }

  private resolveReportRate(row: AggregationExpense): number {
    const storedRate = Number(row.rate);
    if (row.currency === 'UAH') return 1;
    if (storedRate > 1) return storedRate;
    if (!row.expenseDate) return storedRate;
    return this.exchangeRates.getRate(new Date(row.expenseDate), row.currency);
  }

  private toVehicleResponse(row: VehicleRow): VehicleResponse {
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
      publicSlug: null,
      publicSummary: row.publicSummary,
      publicCollectedAmountUah: row.publicCollectedAmountUah
        ? Number(row.publicCollectedAmountUah)
        : null,
      publicGoalAmountUah: row.publicGoalAmountUah ? Number(row.publicGoalAmountUah) : null,
      createdBy: this.toVehicleUserInfo(row.createdByUser),
      updatedBy: this.toVehicleUserInfo(row.updatedByUser),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      deletedBy: row.deletedByUser ? this.toVehicleUserInfo(row.deletedByUser) : null,
    };
  }

  private toStatusHistoryResponse(row: StatusHistoryRow): VehicleStatusHistory {
    return {
      id: row.id,
      vehicleId: row.vehicleId,
      oldStatusId: row.oldStatusId,
      oldStatus: row.oldStatus
        ? {
            id: row.oldStatus.id,
            name: row.oldStatus.name,
            sortOrder: row.oldStatus.sortOrder,
            isDefault: row.oldStatus.isDefault,
            kind: row.oldStatus.kind,
            color: row.oldStatus.color,
            createdAt: row.oldStatus.createdAt.toISOString(),
            updatedAt: row.oldStatus.updatedAt.toISOString(),
          }
        : null,
      newStatusId: row.newStatusId,
      newStatus: row.newStatus
        ? {
            id: row.newStatus.id,
            name: row.newStatus.name,
            sortOrder: row.newStatus.sortOrder,
            isDefault: row.newStatus.isDefault,
            kind: row.newStatus.kind,
            color: row.newStatus.color,
            createdAt: row.newStatus.createdAt.toISOString(),
            updatedAt: row.newStatus.updatedAt.toISOString(),
          }
        : undefined,
      changedBy: this.toVehicleUserInfo(row.changedByUser),
      note: row.note,
      changedAt: row.changedAt.toISOString(),
    };
  }

  private toExpenseResponse(row: ExpenseRow): ExpenseResponse {
    const rate = this.resolveReportRate(row);
    return {
      id: row.id,
      vehicleId: row.vehicleId,
      vehicle: row.vehicle
        ? {
            id: row.vehicle.id,
            identifier: row.vehicle.identifier,
            brand: row.vehicle.brand,
            model: row.vehicle.model,
          }
        : null,
      expenseDate: row.expenseDate,
      amount: Number(row.amount),
      currency: row.currency,
      rate,
      rateSource: row.rateSource,
      categoryId: row.categoryId,
      category: {
        id: row.category?.id ?? '',
        name: row.category?.name ?? '',
        sortOrder: row.category?.sortOrder ?? 0,
        createdAt: row.category?.createdAt.toISOString() ?? '',
        updatedAt: row.category?.updatedAt.toISOString() ?? '',
      },
      fundingSourceId: row.fundingSourceId,
      fundingSource: {
        id: row.fundingSource?.id ?? '',
        name: row.fundingSource?.name ?? '',
        type: row.fundingSource?.type ?? 'other',
        description: row.fundingSource?.description ?? null,
        createdAt: row.fundingSource?.createdAt.toISOString() ?? '',
        updatedAt: row.fundingSource?.updatedAt.toISOString() ?? '',
      },
      description: row.description,
      createdBy: this.toExpenseUserInfo(row.createdByUser),
      updatedBy: this.toExpenseUserInfo(row.updatedByUser),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      deletedBy: row.deletedByUser ? this.toExpenseUserInfo(row.deletedByUser) : null,
    };
  }

  private toDocumentResponse(row: DocumentRow): DocumentResponse {
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      fileKey: row.fileKey,
      url: row.url,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      vehicleId: row.vehicleId,
      vehicle: row.vehicle
        ? {
            id: row.vehicle.id,
            identifier: row.vehicle.identifier,
            brand: row.vehicle.brand,
            model: row.vehicle.model,
          }
        : null,
      expenseId: row.expenseId,
      expense: row.expense
        ? {
            id: row.expense.id,
            expenseDate: row.expense.expenseDate,
            amount: Number(row.expense.amount),
            currency: row.expense.currency,
          }
        : null,
      createdBy: this.toDocumentUserInfo(row.createdByUser),
      updatedBy: this.toDocumentUserInfo(row.updatedByUser),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      deletedBy: row.deletedByUser ? this.toDocumentUserInfo(row.deletedByUser) : null,
    };
  }

  private toVehicleUserInfo(row: { id: string; fullName: string } | undefined): VehicleUserInfo {
    return { id: row?.id ?? '', fullName: row?.fullName ?? '' };
  }

  private toExpenseUserInfo(row: { id: string; fullName: string } | undefined): ExpenseUserInfo {
    return { id: row?.id ?? '', fullName: row?.fullName ?? '' };
  }

  private toDocumentUserInfo(row: { id: string; fullName: string } | undefined): DocumentUserInfo {
    return { id: row?.id ?? '', fullName: row?.fullName ?? '' };
  }
}
