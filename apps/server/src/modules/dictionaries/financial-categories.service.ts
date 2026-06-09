import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type {
  FinancialCategory,
  FinancialCategoryCreate,
  FinancialCategoryUpdate,
} from '@volunteerfleet/shared';
import { DB } from '../../db/db.module.js';
import type { Database } from '../../db/client.js';
import { financialCategories } from '../../db/schema/index.js';

@Injectable()
export class FinancialCategoriesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async list(): Promise<FinancialCategory[]> {
    const rows = await this.db
      .select()
      .from(financialCategories)
      .orderBy(asc(financialCategories.sortOrder), asc(financialCategories.name));
    return rows.map(toResponse);
  }

  async create(input: FinancialCategoryCreate): Promise<FinancialCategory> {
    const rows = await this.db.insert(financialCategories).values(input).returning();
    const row = rows[0];
    if (!row) throw new Error('Insert returned no rows');
    return toResponse(row);
  }

  async update(id: string, input: FinancialCategoryUpdate): Promise<FinancialCategory> {
    const rows = await this.db
      .update(financialCategories)
      .set(input)
      .where(eq(financialCategories.id, id))
      .returning();
    const row = rows[0];
    if (!row) throw new NotFoundException(`financial_category ${id} not found`);
    return toResponse(row);
  }

  async remove(id: string): Promise<void> {
    const result = await this.db
      .delete(financialCategories)
      .where(eq(financialCategories.id, id))
      .returning({ id: financialCategories.id });
    if (result.length === 0) {
      throw new NotFoundException(`financial_category ${id} not found`);
    }
  }
}

function toResponse(row: typeof financialCategories.$inferSelect): FinancialCategory {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
