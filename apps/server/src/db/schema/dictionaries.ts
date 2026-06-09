import { sql } from 'drizzle-orm';
import { pgTable, smallint, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const financialCategories = pgTable('financial_categories', {
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
