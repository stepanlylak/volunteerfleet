import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type {
  ExpenseCategory,
  ExpenseCategoryCreate,
  ExpenseCategoryUpdate,
} from '@volunteerfleet/shared';
import { DB } from '../../db/db.module.js';
import type { Database } from '../../db/client.js';
import { expenseCategories } from '../../db/schema/index.js';

@Injectable()
export class ExpenseCategoriesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async list(): Promise<ExpenseCategory[]> {
    const rows = await this.db
      .select()
      .from(expenseCategories)
      .orderBy(asc(expenseCategories.sortOrder), asc(expenseCategories.name));
    return rows.map(toResponse);
  }

  async create(input: ExpenseCategoryCreate): Promise<ExpenseCategory> {
    const rows = await this.db.insert(expenseCategories).values(input).returning();
    const row = rows[0];
    if (!row) throw new Error('Insert returned no rows');
    return toResponse(row);
  }

  async update(id: string, input: ExpenseCategoryUpdate): Promise<ExpenseCategory> {
    const rows = await this.db
      .update(expenseCategories)
      .set(input)
      .where(eq(expenseCategories.id, id))
      .returning();
    const row = rows[0];
    if (!row) throw new NotFoundException(`expense_category ${id} not found`);
    return toResponse(row);
  }

  async remove(id: string): Promise<void> {
    const result = await this.db
      .delete(expenseCategories)
      .where(eq(expenseCategories.id, id))
      .returning({ id: expenseCategories.id });
    if (result.length === 0) {
      throw new NotFoundException(`expense_category ${id} not found`);
    }
  }
}

function toResponse(row: typeof expenseCategories.$inferSelect): ExpenseCategory {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
