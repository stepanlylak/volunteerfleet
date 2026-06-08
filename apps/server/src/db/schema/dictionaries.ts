import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { fundingSourceTypeEnum, vehicleStatusKindEnum } from './enums.js';
import { organizations } from './organizations.js';

export const vehicleStatuses = pgTable(
  'vehicle_statuses',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 64 }).notNull().unique(),
    sortOrder: smallint('sort_order').notNull().default(0),
    isDefault: boolean('is_default').notNull().default(false),
    kind: vehicleStatusKindEnum('kind').notNull().default('other'),
    color: varchar('color', { length: 7 }).notNull().default('#8c8c8c'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    colorCheck: check('vehicle_statuses_color_check', sql`${table.color} ~ '^#[0-9A-Fa-f]{6}$'`),
    onlyOneDefault: uniqueIndex('vehicle_statuses_only_one_default')
      .on(table.isDefault)
      .where(sql`${table.isDefault}`),
  }),
);

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
