import { sql } from 'drizzle-orm';
import { check, date, index, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { expenseCategories, fundingSources } from './dictionaries.js';
import { currencyCodeEnum, rateSourceEnum } from './enums.js';
import { organizations } from './organizations.js';
import { users } from './users.js';
import { vehicles } from './vehicles.js';

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    vehicleId: uuid('vehicle_id').references(() => vehicles.id, {
      onDelete: 'restrict',
    }),
    expenseDate: date('expense_date').notNull(),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    currency: currencyCodeEnum('currency').notNull(),
    rate: numeric('rate', { precision: 14, scale: 6 }).notNull(),
    rateSource: rateSourceEnum('rate_source').notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => expenseCategories.id, { onDelete: 'restrict' }),
    fundingSourceId: uuid('funding_source_id')
      .notNull()
      .references(() => fundingSources.id, { onDelete: 'restrict' }),
    description: text('description'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    updatedBy: uuid('updated_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by').references(() => users.id, {
      onDelete: 'restrict',
    }),
  },
  (table) => ({
    amountPositive: check('expenses_amount_positive', sql`${table.amount} > 0`),
    ratePositive: check('expenses_rate_positive', sql`${table.rate} > 0`),
    organizationIdx: index('expenses_organization_id_idx').on(table.organizationId),
    vehicleIdx: index('expenses_vehicle_id_idx').on(table.vehicleId),
    expenseDateIdx: index('expenses_expense_date_idx').on(table.expenseDate),
    fundingSourceIdx: index('expenses_funding_source_id_idx').on(table.fundingSourceId),
    categoryIdx: index('expenses_category_id_idx').on(table.categoryId),
  }),
);
