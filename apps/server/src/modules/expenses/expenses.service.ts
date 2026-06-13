import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, isNull, lte, SQL, sql } from 'drizzle-orm';
import { BASE_CURRENCY, minorAmountSchema, type Currency } from '@volunteerfleet/shared';
import type {
  ExpenseCreate,
  ExpenseListQuery,
  ExpenseListResponse,
  ExpenseResponse,
  ExpenseUpdate,
  ExpenseUserInfo,
  OrgRole,
} from '@volunteerfleet/shared';
import type { Database } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { expenses, financialCategories, users, vehicles } from '../../db/schema/index.js';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service.js';

const EXPENSE_SORT_WHITELIST = [
  'expenseDate',
  'amountMinor',
  'currency',
  'createdAt',
  'updatedAt',
] as const;
type ExpenseSortField = (typeof EXPENSE_SORT_WHITELIST)[number];

interface SortItem {
  field: ExpenseSortField;
  dir: 'asc' | 'desc';
}

type ExpenseRow = typeof expenses.$inferSelect & {
  vehicle?: Pick<typeof vehicles.$inferSelect, 'id' | 'identifier' | 'brand' | 'model'> | null;
  category?: typeof financialCategories.$inferSelect;
  createdByUser?: Pick<typeof users.$inferSelect, 'id' | 'fullName'>;
  updatedByUser?: Pick<typeof users.$inferSelect, 'id' | 'fullName'>;
  deletedByUser?: Pick<typeof users.$inferSelect, 'id' | 'fullName'> | null;
};

@Injectable()
export class ExpensesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly exchangeRates: ExchangeRatesService,
  ) {}

  async list(
    query: ExpenseListQuery,
    orgRole: OrgRole | null | undefined,
    organizationId: string,
  ): Promise<ExpenseListResponse> {
    const {
      page,
      pageSize,
      sort,
      vehicleId,
      categoryId,
      dateFrom,
      dateTo,
      currency,
      includeDeleted,
    } = query;

    if (includeDeleted && orgRole !== 'coordinator') {
      throw new ForbiddenException('Only coordinator can view deleted expenses');
    }

    const conditions: SQL<unknown>[] = [eq(expenses.organizationId, organizationId)];
    if (!includeDeleted) {
      conditions.push(isNull(expenses.deletedAt), this.hasJoinedActiveVehicle());
    }
    if (vehicleId) conditions.push(eq(expenses.vehicleId, vehicleId));
    if (categoryId) conditions.push(eq(expenses.categoryId, categoryId));
    if (dateFrom) conditions.push(gte(expenses.expenseDate, dateFrom));
    if (dateTo) conditions.push(lte(expenses.expenseDate, dateTo));
    if (currency) conditions.push(eq(expenses.currency, currency));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(expenses)
      .leftJoin(vehicles, eq(vehicles.id, expenses.vehicleId))
      .where(whereClause);
    const total = countResult[0]?.count ?? 0;

    const orderBy = this.parseSort(sort).map((s) =>
      s.dir === 'asc' ? asc(expenses[s.field]) : desc(expenses[s.field]),
    );
    if (orderBy.length === 0) orderBy.push(desc(expenses.expenseDate));

    const pageRows = await this.db
      .select({ id: expenses.id })
      .from(expenses)
      .leftJoin(vehicles, eq(vehicles.id, expenses.vehicleId))
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const ids = pageRows.map((row) => row.id);

    const rows =
      ids.length > 0
        ? await this.db.query.expenses.findMany({
            where: inArray(expenses.id, ids),
            with: this.responseRelations(),
          })
        : [];
    const rowsById = new Map(rows.map((row) => [row.id, row]));

    return {
      items: ids.flatMap((id) => {
        const row = rowsById.get(id);
        return row ? [this.toResponse(row)] : [];
      }),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findById(
    id: string,
    organizationId: string,
    includeDeleted = false,
  ): Promise<ExpenseResponse> {
    if (!includeDeleted) {
      const visibleRows = await this.db
        .select({ id: expenses.id })
        .from(expenses)
        .leftJoin(vehicles, eq(vehicles.id, expenses.vehicleId))
        .where(
          and(
            eq(expenses.id, id),
            eq(expenses.organizationId, organizationId),
            isNull(expenses.deletedAt),
            this.hasJoinedActiveVehicle(),
          ),
        )
        .limit(1);
      if (!visibleRows[0]) throw new NotFoundException(`Expense ${id} not found`);
    }

    const row = await this.db.query.expenses.findFirst({
      where: and(eq(expenses.id, id), eq(expenses.organizationId, organizationId)),
      with: this.responseRelations(),
    });

    if (!row) throw new NotFoundException(`Expense ${id} not found`);
    return this.toResponse(row);
  }

  async create(
    input: ExpenseCreate,
    userId: string,
    organizationId: string,
  ): Promise<ExpenseResponse> {
    const vehicle = await this.db.query.vehicles.findFirst({
      where: and(
        eq(vehicles.id, input.vehicleId),
        eq(vehicles.organizationId, organizationId),
        isNull(vehicles.deletedAt),
      ),
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${input.vehicleId} not found in this organization`);
    }

    const rateInfo = this.resolveCreateRate(input);

    const inserted = await this.db
      .insert(expenses)
      .values({
        organizationId,
        vehicleId: input.vehicleId,
        expenseDate: input.expenseDate,
        amountMinor: input.amountMinor,
        currency: input.currency,
        rate: rateInfo.rate.toFixed(6),
        rateSource: rateInfo.rateSource,
        categoryId: input.categoryId,
        description: input.description ?? null,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning({ id: expenses.id });

    const row = inserted[0];
    if (!row) throw new Error('Insert returned no rows');
    return this.findById(row.id, organizationId);
  }

  async update(
    id: string,
    input: ExpenseUpdate,
    userId: string,
    organizationId: string,
  ): Promise<ExpenseResponse> {
    const existing = await this.db.query.expenses.findFirst({
      where: and(
        eq(expenses.id, id),
        eq(expenses.organizationId, organizationId),
        isNull(expenses.deletedAt),
      ),
    });
    if (!existing) throw new NotFoundException(`Expense ${id} not found`);

    if (input.vehicleId !== undefined && input.vehicleId !== null) {
      const vehicle = await this.db.query.vehicles.findFirst({
        where: and(eq(vehicles.id, input.vehicleId), eq(vehicles.organizationId, organizationId)),
      });
      if (!vehicle) {
        throw new NotFoundException(`Vehicle ${input.vehicleId} not found in this organization`);
      }
    }

    const updateValues: Record<string, unknown> = {
      updatedBy: userId,
      updatedAt: new Date(),
    };

    if (input.vehicleId !== undefined) updateValues.vehicleId = input.vehicleId;
    if (input.expenseDate !== undefined) updateValues.expenseDate = input.expenseDate;
    if (input.amountMinor !== undefined) updateValues.amountMinor = input.amountMinor;
    if (input.currency !== undefined) updateValues.currency = input.currency;
    if (input.categoryId !== undefined) updateValues.categoryId = input.categoryId;
    if (input.description !== undefined) updateValues.description = input.description;

    if (input.currency !== undefined && input.currency !== existing.currency) {
      if (input.currency === BASE_CURRENCY) {
        updateValues.rate = '1.000000';
        updateValues.rateSource = 'default';
      } else if (input.rate !== undefined) {
        updateValues.rate = input.rate.toFixed(6);
        updateValues.rateSource = 'manual';
      } else {
        const date = input.expenseDate ?? existing.expenseDate;
        updateValues.rate = this.exchangeRates
          .getRate(new Date(date), input.currency as Currency)
          .toFixed(6);
        updateValues.rateSource = 'default';
      }
    } else if (input.rate !== undefined) {
      updateValues.rate = input.rate.toFixed(6);
      updateValues.rateSource = 'manual';
    }

    const updated = await this.db
      .update(expenses)
      .set(updateValues)
      .where(and(eq(expenses.id, id), eq(expenses.organizationId, organizationId)))
      .returning({ id: expenses.id });

    if (!updated[0]) throw new NotFoundException(`Expense ${id} not found`);
    return this.findById(id, organizationId);
  }

  async softDelete(id: string, userId: string, organizationId: string): Promise<void> {
    const existing = await this.db.query.expenses.findFirst({
      where: and(
        eq(expenses.id, id),
        eq(expenses.organizationId, organizationId),
        isNull(expenses.deletedAt),
      ),
    });
    if (!existing) throw new NotFoundException(`Expense ${id} not found`);

    await this.db
      .update(expenses)
      .set({ deletedAt: new Date(), deletedBy: userId, updatedBy: userId, updatedAt: new Date() })
      .where(and(eq(expenses.id, id), eq(expenses.organizationId, organizationId)));
  }

  async restore(id: string, userId: string, organizationId: string): Promise<ExpenseResponse> {
    const existing = await this.db.query.expenses.findFirst({
      where: and(
        eq(expenses.id, id),
        eq(expenses.organizationId, organizationId),
        sql`${expenses.deletedAt} IS NOT NULL`,
      ),
    });
    if (!existing) throw new NotFoundException(`Deleted expense ${id} not found`);

    await this.db
      .update(expenses)
      .set({ deletedAt: null, deletedBy: null, updatedBy: userId, updatedAt: new Date() })
      .where(and(eq(expenses.id, id), eq(expenses.organizationId, organizationId)));

    return this.findById(id, organizationId, true);
  }

  private resolveCreateRate(input: ExpenseCreate): {
    rate: number;
    rateSource: 'default' | 'manual';
  } {
    if (input.currency === BASE_CURRENCY) {
      return { rate: 1, rateSource: 'default' };
    }
    if (input.rate !== undefined) {
      return { rate: input.rate, rateSource: 'manual' };
    }
    return {
      rate: this.exchangeRates.getRate(new Date(input.expenseDate), input.currency as Currency),
      rateSource: 'default',
    };
  }

  private parseSort(sort: string | undefined): SortItem[] {
    if (!sort) return [];
    return sort.split(',').flatMap((part) => {
      const [field, dir] = part.split(':') as [string, string | undefined];
      if (!EXPENSE_SORT_WHITELIST.includes(field as ExpenseSortField)) return [];
      if (dir !== 'asc' && dir !== 'desc') return [];
      return [{ field: field as ExpenseSortField, dir }];
    });
  }

  private hasJoinedActiveVehicle(): SQL<unknown> {
    return isNull(vehicles.deletedAt);
  }

  private responseRelations() {
    return {
      vehicle: { columns: { id: true, identifier: true, brand: true, model: true } },
      category: true,
      createdByUser: { columns: { id: true, fullName: true } },
      updatedByUser: { columns: { id: true, fullName: true } },
      deletedByUser: { columns: { id: true, fullName: true } },
    } as const;
  }

  private toUserInfo(row: { id: string; fullName: string } | null | undefined): ExpenseUserInfo {
    return { id: row?.id ?? '', fullName: row?.fullName ?? '' };
  }

  private toResponse(row: ExpenseRow): ExpenseResponse {
    if (!row.vehicleId || !row.vehicle) {
      throw new Error(`Expense ${row.id} is missing its required vehicle`);
    }

    return {
      id: row.id,
      vehicleId: row.vehicleId,
      documentGroupId: row.documentGroupId,
      vehicle: {
        id: row.vehicle.id,
        identifier: row.vehicle.identifier,
        brand: row.vehicle.brand,
        model: row.vehicle.model,
      },
      expenseDate: row.expenseDate,
      amountMinor: minorAmountSchema.parse(row.amountMinor),
      currency: row.currency,
      rate: Number(row.rate),
      rateSource: row.rateSource,
      categoryId: row.categoryId,
      category: {
        id: row.category?.id ?? '',
        name: row.category?.name ?? '',
        sortOrder: row.category?.sortOrder ?? 0,
        createdAt: row.category?.createdAt.toISOString() ?? '',
        updatedAt: row.category?.updatedAt.toISOString() ?? '',
      },
      description: row.description,
      createdBy: this.toUserInfo(row.createdByUser),
      updatedBy: this.toUserInfo(row.updatedByUser),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      deletedBy: row.deletedByUser ? this.toUserInfo(row.deletedByUser) : null,
    };
  }
}
