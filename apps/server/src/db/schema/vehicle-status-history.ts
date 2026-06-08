import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { vehicleStatuses } from './dictionaries.js';
import { organizations } from './organizations.js';
import { users } from './users.js';
import { vehicles } from './vehicles.js';

export const vehicleStatusHistory = pgTable(
  'vehicle_status_history',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
    oldStatusId: uuid('old_status_id').references(() => vehicleStatuses.id, {
      onDelete: 'restrict',
    }),
    newStatusId: uuid('new_status_id')
      .notNull()
      .references(() => vehicleStatuses.id, { onDelete: 'restrict' }),
    changedBy: uuid('changed_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    note: text('note'),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    organizationIdx: index('vehicle_status_history_organization_id_idx').on(table.organizationId),
    vehicleChangedAtIdx: index('vehicle_status_history_vehicle_changed_at_idx').on(
      table.vehicleId,
      table.changedAt,
    ),
  }),
);
