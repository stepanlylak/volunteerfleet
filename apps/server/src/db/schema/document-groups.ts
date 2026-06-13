import { sql } from 'drizzle-orm';
import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { users } from './users.js';
import { vehicles } from './vehicles.js';

// A document group is a logical document (e.g. a vehicle passport, a transfer act)
// that fans out to N physical artifacts in `documents` (uploads or links).
// The group always belongs to a vehicle. Expenses point to groups so one group
// may be reused by multiple expenses.
// Groups are NOT soft-deleted: an empty group has no meaning and is hard-deleted
// once its last document leaves it.
export const documentGroups = pgTable(
  'document_groups',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 255 }),
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
  },
  (table) => ({
    orgVehicleIdx: index('document_groups_org_vehicle_idx').on(
      table.organizationId,
      table.vehicleId,
    ),
  }),
);
