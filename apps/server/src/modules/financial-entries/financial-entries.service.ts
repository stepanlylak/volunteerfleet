import { Inject, Injectable } from '@nestjs/common';
import { sql, SQL } from 'drizzle-orm';
import type {
  FinancialEntry,
  FinancialEntryListQuery,
  FinancialEntryListResponse,
  FinancialSummary,
  MinorAmount,
} from '@volunteerfleet/shared';
import type { Database } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { documents, donations, expenses, vehicles } from '../../db/schema/index.js';

const ENTRY_SORT_WHITELIST = ['entryDate', 'amountUahMinor', 'createdAt', 'currency'] as const;
type EntrySortField = (typeof ENTRY_SORT_WHITELIST)[number];

interface SortItem {
  field: EntrySortField;
  dir: 'asc' | 'desc';
}

type UnionRow = Record<string, unknown> & {
  id: string;
  type: 'expense' | 'donation';
  entry_date: string;
  amount_minor: string | number;
  currency: string;
  rate: string;
  amount_uah_minor: string | number;
  signed_amount_minor: string | number;
  signed_amount_uah_minor: string | number;
  vehicle_id: string;
  vehicle_identifier: string;
  vehicle_brand: string;
  vehicle_model: string;
  category_id: string | null;
  category_name: string | null;
  category_sort_order: number | string | null;
  category_created_at: Date | string | null;
  category_updated_at: Date | string | null;
  donor_id: string | null;
  donor_name: string | null;
  description: string | null;
  created_at: Date | string;
  document_count: string | number;
};

type SummaryRow = Record<string, unknown> & {
  expenses_uah_minor: string | number;
  donations_uah_minor: string | number;
  balance_uah_minor: string | number;
};

type CurrencyBreakdownRow = Record<string, unknown> & {
  currency: string;
  expenses_minor: string | number;
  donations_minor: string | number;
  balance_minor: string | number;
};

@Injectable()
export class FinancialEntriesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async list(
    query: FinancialEntryListQuery,
    organizationId: string,
  ): Promise<FinancialEntryListResponse> {
    const {
      page,
      pageSize,
      sort,
      type,
      vehicleId,
      categoryId,
      donorId,
      dateFrom,
      dateTo,
      currency,
    } = query;

    const filterConditions = this.buildFilterConditions({
      type,
      vehicleId,
      categoryId,
      donorId,
      dateFrom,
      dateTo,
      currency,
    });
    const orderSql = this.buildOrderSql(sort);
    const offset = (page - 1) * pageSize;

    const unionCte = this.buildUnionCte(organizationId);
    const whereClause =
      filterConditions.length > 0
        ? sql`WHERE ${filterConditions.reduce((acc, cond, i) => (i === 0 ? cond : sql`${acc} AND ${cond}`))}`
        : sql``;

    const countResult = await this.db.execute<{ total: number }>(sql`
      WITH entries AS (${unionCte})
      SELECT count(*)::int AS total
      FROM entries
      ${whereClause}
    `);
    const total = Number(countResult.rows[0]?.total ?? 0);

    const rows = await this.db.execute<UnionRow>(sql`
      WITH entries AS (${unionCte})
      SELECT *
      FROM entries
      ${whereClause}
      ORDER BY ${sql.raw(orderSql)}
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    const summary = await this.querySummary(organizationId, filterConditions);

    return {
      items: rows.rows.map((r) => this.toEntry(r)),
      summary,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  private async querySummary(
    organizationId: string,
    filterConditions: SQL[],
  ): Promise<FinancialSummary> {
    const unionCte = this.buildUnionCte(organizationId);
    const whereClause =
      filterConditions.length > 0
        ? sql`WHERE ${filterConditions.reduce((acc, cond, i) => (i === 0 ? cond : sql`${acc} AND ${cond}`))}`
        : sql``;

    const summaryResult = await this.db.execute<SummaryRow>(sql`
      WITH entries AS (${unionCte})
      SELECT
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_uah_minor ELSE 0 END), 0)::bigint AS expenses_uah_minor,
        COALESCE(SUM(CASE WHEN type = 'donation' THEN amount_uah_minor ELSE 0 END), 0)::bigint AS donations_uah_minor,
        COALESCE(SUM(signed_amount_uah_minor), 0)::bigint AS balance_uah_minor
      FROM entries
      ${whereClause}
    `);

    const s = summaryResult.rows[0] ?? {
      expenses_uah_minor: 0,
      donations_uah_minor: 0,
      balance_uah_minor: 0,
    };

    const byCurrencyResult = await this.db.execute<CurrencyBreakdownRow>(sql`
      WITH entries AS (${unionCte})
      SELECT
        currency,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_minor ELSE 0 END), 0)::bigint AS expenses_minor,
        COALESCE(SUM(CASE WHEN type = 'donation' THEN amount_minor ELSE 0 END), 0)::bigint AS donations_minor,
        COALESCE(SUM(signed_amount_minor), 0)::bigint AS balance_minor
      FROM entries
      ${whereClause}
      GROUP BY currency
      ORDER BY currency
    `);

    return {
      expensesUahMinor: Number(s.expenses_uah_minor),
      donationsUahMinor: Number(s.donations_uah_minor),
      balanceUahMinor: Number(s.balance_uah_minor),
      byCurrency: byCurrencyResult.rows.map((r) => ({
        currency: r.currency as 'UAH' | 'USD' | 'EUR',
        expensesMinor: Number(r.expenses_minor),
        donationsMinor: Number(r.donations_minor),
        balanceMinor: Number(r.balance_minor),
      })),
    };
  }

  private buildUnionCte(organizationId: string): SQL {
    return sql`
      SELECT
        e.id,
        'expense'::text AS type,
        e.expense_date AS entry_date,
        e.amount_minor,
        e.currency,
        e.rate,
        ROUND(e.amount_minor * e.rate::numeric)::bigint AS amount_uah_minor,
        (-e.amount_minor)::bigint AS signed_amount_minor,
        (-ROUND(e.amount_minor * e.rate::numeric))::bigint AS signed_amount_uah_minor,
        e.vehicle_id,
        v.identifier AS vehicle_identifier,
        v.brand AS vehicle_brand,
        v.model AS vehicle_model,
        e.category_id,
        fc.name AS category_name,
        fc.sort_order AS category_sort_order,
        fc.created_at AS category_created_at,
        fc.updated_at AS category_updated_at,
        NULL::uuid AS donor_id,
        NULL::text AS donor_name,
        e.description,
        e.created_at,
        (
          SELECT count(${documents.id})::int
          FROM ${documents}
          WHERE ${documents.expenseId} = e.id
            AND ${documents.deletedAt} IS NULL
        ) AS document_count
      FROM ${expenses} e
      INNER JOIN ${vehicles} v ON v.id = e.vehicle_id AND v.deleted_at IS NULL
      LEFT JOIN financial_categories fc ON fc.id = e.category_id
      WHERE e.organization_id = ${organizationId}
        AND e.deleted_at IS NULL

      UNION ALL

      SELECT
        d.id,
        'donation'::text AS type,
        d.donation_date AS entry_date,
        d.amount_minor,
        d.currency,
        d.rate,
        ROUND(d.amount_minor * d.rate::numeric)::bigint AS amount_uah_minor,
        d.amount_minor::bigint AS signed_amount_minor,
        ROUND(d.amount_minor * d.rate::numeric)::bigint AS signed_amount_uah_minor,
        d.vehicle_id,
        v.identifier AS vehicle_identifier,
        v.brand AS vehicle_brand,
        v.model AS vehicle_model,
        d.category_id,
        fc.name AS category_name,
        fc.sort_order AS category_sort_order,
        fc.created_at AS category_created_at,
        fc.updated_at AS category_updated_at,
        d.donor_id,
        dn.name AS donor_name,
        d.description,
        d.created_at,
        0::int AS document_count
      FROM ${donations} d
      INNER JOIN ${vehicles} v ON v.id = d.vehicle_id
      LEFT JOIN financial_categories fc ON fc.id = d.category_id
      INNER JOIN donors dn ON dn.id = d.donor_id
      WHERE d.organization_id = ${organizationId}
        AND d.deleted_at IS NULL
    `;
  }

  private buildFilterConditions(filters: {
    type?: 'expense' | 'donation';
    vehicleId?: string;
    categoryId?: string;
    donorId?: string;
    dateFrom?: string;
    dateTo?: string;
    currency?: string;
  }): SQL[] {
    const parts: SQL[] = [];

    if (filters.type) {
      parts.push(sql`type = ${filters.type}`);
    }
    if (filters.vehicleId) {
      parts.push(sql`vehicle_id = ${filters.vehicleId}::uuid`);
    }
    if (filters.categoryId) {
      parts.push(sql`category_id = ${filters.categoryId}::uuid`);
    }
    if (filters.donorId) {
      parts.push(sql`donor_id = ${filters.donorId}::uuid`);
    }
    if (filters.dateFrom) {
      parts.push(sql`entry_date >= ${filters.dateFrom}::date`);
    }
    if (filters.dateTo) {
      parts.push(sql`entry_date <= ${filters.dateTo}::date`);
    }
    if (filters.currency) {
      parts.push(sql`currency = ${filters.currency}`);
    }

    return parts;
  }

  private buildOrderSql(sort: string | undefined): string {
    const items = this.parseSort(sort);
    const clauses = items.map((s) => {
      const col = this.sortFieldToColumn(s.field);
      return `${col} ${s.dir.toUpperCase()}`;
    });
    clauses.push('created_at DESC', 'id DESC');
    return clauses.join(', ');
  }

  private sortFieldToColumn(field: EntrySortField): string {
    switch (field) {
      case 'entryDate':
        return 'entry_date';
      case 'amountUahMinor':
        return 'amount_uah_minor';
      case 'createdAt':
        return 'created_at';
      case 'currency':
        return 'currency';
    }
  }

  private parseSort(sort: string | undefined): SortItem[] {
    if (!sort) return [];
    return sort.split(',').flatMap((part) => {
      const [field, dir] = part.split(':') as [string, string | undefined];
      if (!ENTRY_SORT_WHITELIST.includes(field as EntrySortField)) return [];
      if (dir !== 'asc' && dir !== 'desc') return [];
      return [{ field: field as EntrySortField, dir }];
    });
  }

  private toEntry(row: UnionRow): FinancialEntry {
    const vehicle = {
      id: row.vehicle_id,
      identifier: row.vehicle_identifier,
      brand: row.vehicle_brand,
      model: row.vehicle_model,
    };

    const category =
      row.category_id && row.category_name
        ? {
            id: row.category_id,
            name: row.category_name,
            sortOrder: Number(row.category_sort_order ?? 0),
            createdAt:
              row.category_created_at instanceof Date
                ? row.category_created_at.toISOString()
                : String(row.category_created_at ?? ''),
            updatedAt:
              row.category_updated_at instanceof Date
                ? row.category_updated_at.toISOString()
                : String(row.category_updated_at ?? ''),
          }
        : null;

    const createdAt =
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at);

    const amountMinor = Number(row.amount_minor) as MinorAmount;
    const amountUahMinor = Number(row.amount_uah_minor) as MinorAmount;

    const base = {
      id: row.id,
      entryDate: row.entry_date,
      amountMinor,
      currency: row.currency as 'UAH' | 'USD' | 'EUR',
      rate: Number(row.rate),
      amountUahMinor,
      vehicle,
      description: row.description ?? null,
      createdAt,
    };

    if (row.type === 'expense') {
      return {
        ...base,
        type: 'expense' as const,
        signedAmountMinor: -amountMinor as unknown as MinorAmount,
        signedAmountUahMinor: -amountUahMinor as unknown as MinorAmount,
        category: category ?? { id: '', name: '', sortOrder: 0, createdAt: '', updatedAt: '' },
        donor: null,
        documentCount: Number(row.document_count),
      };
    }

    return {
      ...base,
      type: 'donation' as const,
      signedAmountMinor: amountMinor,
      signedAmountUahMinor: amountUahMinor,
      category,
      donor: {
        id: row.donor_id ?? '',
        name: row.donor_name ?? '',
      },
    };
  }
}
