import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { vehicleStatuses } from './dictionaries.js';
import { users } from './users.js';

export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    identifier: varchar('identifier', { length: 64 }).notNull(),
    brand: varchar('brand', { length: 128 }).notNull(),
    model: varchar('model', { length: 128 }).notNull(),
    year: smallint('year'),
    vin: varchar('vin', { length: 64 }),
    borderCrossingDate: date('border_crossing_date'),
    statusId: uuid('status_id')
      .notNull()
      .references(() => vehicleStatuses.id, { onDelete: 'restrict' }),
    description: text('description'),
    isPublic: boolean('is_public').notNull().default(false),
    publicSlug: varchar('public_slug', { length: 96 }),
    publicSummary: text('public_summary'),
    publicCollectedAmountUah: numeric('public_collected_amount_uah', {
      precision: 14,
      scale: 2,
    }),
    publicGoalAmountUah: numeric('public_goal_amount_uah', {
      precision: 14,
      scale: 2,
    }),
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
    identifierUniqueActive: uniqueIndex('vehicles_identifier_active_unique')
      .on(table.identifier)
      .where(sql`${table.deletedAt} IS NULL`),
    publicSlugUniqueActive: uniqueIndex('vehicles_public_slug_active_unique')
      .on(table.publicSlug)
      .where(sql`${table.publicSlug} IS NOT NULL AND ${table.deletedAt} IS NULL`),
    statusIdx: index('vehicles_status_id_idx').on(table.statusId),
    brandModelIdx: index('vehicles_brand_model_idx').on(table.brand, table.model),
    vinLowerIdx: index('vehicles_vin_lower_idx').on(sql`lower(${table.vin})`),
    isPublicIdx: index('vehicles_is_public_idx').on(table.isPublic),
  }),
);
