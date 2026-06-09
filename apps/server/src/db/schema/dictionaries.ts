import { sql } from 'drizzle-orm';
import { pgTable, smallint, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { fundingSourceTypeEnum } from './enums.js';
import { organizations } from './organizations.js';

export const expenseCategories = pgTable('expense_categories', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 128 }).notNull().unique(),
  sortOrder: smallint('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const fundingSources = pgTable('funding_sources', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 128 }).notNull().unique(),
  type: fundingSourceTypeEnum('type').notNull(),
  description: text('description'),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
