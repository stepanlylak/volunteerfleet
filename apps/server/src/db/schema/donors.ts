import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, primaryKey, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { users } from './users.js';

export const donors = pgTable(
  'donors',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar('name', { length: 255 }).notNull(),
    normalizedName: varchar('normalized_name', { length: 255 }).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    normalizedNameIdx: index('donors_normalized_name_idx').on(table.normalizedName),
  }),
);

export const organizationDonors = pgTable(
  'organization_donors',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    donorId: uuid('donor_id')
      .notNull()
      .references(() => donors.id, { onDelete: 'restrict' }),
    isActive: boolean('is_active').notNull().default(true),
    addedBy: uuid('added_by')
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
  },
  (table) => ({
    pk: primaryKey({
      name: 'organization_donors_pkey',
      columns: [table.organizationId, table.donorId],
    }),
    organizationActiveIdx: index('organization_donors_organization_active_idx').on(
      table.organizationId,
      table.isActive,
    ),
    donorIdx: index('organization_donors_donor_id_idx').on(table.donorId),
  }),
);
