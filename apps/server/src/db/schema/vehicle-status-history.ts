import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { vehicleStatusEnum } from './enums.js';
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
    oldStatus: vehicleStatusEnum('old_status'),
    newStatus: vehicleStatusEnum('new_status').notNull(),
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
