import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { vehicleStatusEnum } from './enums.js';
import { documentGroups } from './document-groups.js';
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
    transitionDate: date('transition_date').notNull().defaultNow(),

    isLocalPurchase: boolean('is_local_purchase'),

    isRegisteredAtServiceCenter: boolean('is_registered_at_service_center'),

    registrationGroupId: uuid('registration_group_id').references(() => documentGroups.id, {
      onDelete: 'restrict',
    }),
    stampedRegistrationGroupId: uuid('stamped_registration_group_id').references(
      () => documentGroups.id,
      { onDelete: 'restrict' },
    ),
    customsDeclarationGroupId: uuid('customs_declaration_group_id').references(
      () => documentGroups.id,
      { onDelete: 'restrict' },
    ),
    stampedCustomsDeclarationGroupId: uuid('stamped_customs_declaration_group_id').references(
      () => documentGroups.id,
      { onDelete: 'restrict' },
    ),
    transferActDraftGroupId: uuid('transfer_act_draft_group_id').references(
      () => documentGroups.id,
      { onDelete: 'restrict' },
    ),
    transferActSignedGroupId: uuid('transfer_act_signed_group_id').references(
      () => documentGroups.id,
      { onDelete: 'restrict' },
    ),
    returnActGroupId: uuid('return_act_group_id').references(() => documentGroups.id, {
      onDelete: 'restrict',
    }),
  },
  (table) => ({
    organizationIdx: index('vehicle_status_history_organization_id_idx').on(table.organizationId),
    vehicleChangedAtIdx: index('vehicle_status_history_vehicle_changed_at_idx').on(
      table.vehicleId,
      table.changedAt,
    ),
    transitionDateIdx: index('vehicle_status_history_transition_date_idx').on(table.transitionDate),
    uniquePaidPerVehicle: uniqueIndex('vehicle_status_history_unique_paid_per_vehicle')
      .on(table.vehicleId)
      .where(sql`${table.newStatus} = 'paid'`),
  }),
);
