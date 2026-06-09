import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { currencyCodeEnum, rateSourceEnum, vehicleStatusEnum } from './enums.js';
import { documents } from './documents.js';
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

    purchasePrice: numeric('purchase_price', { precision: 14, scale: 2 }),
    purchaseCurrency: currencyCodeEnum('purchase_currency'),
    purchaseRate: numeric('purchase_rate', { precision: 14, scale: 6 }),
    purchaseRateSource: rateSourceEnum('purchase_rate_source'),
    isLocalPurchase: boolean('is_local_purchase'),

    repairNote: text('repair_note'),
    isRegisteredAtServiceCenter: boolean('is_registered_at_service_center'),
    lostReason: text('lost_reason'),

    registrationDocId: uuid('registration_doc_id').references(() => documents.id, {
      onDelete: 'restrict',
    }),
    customsDeclarationDocId: uuid('customs_declaration_doc_id').references(() => documents.id, {
      onDelete: 'restrict',
    }),
    stampedCustomsDeclarationDocId: uuid('stamped_customs_declaration_doc_id').references(
      () => documents.id,
      { onDelete: 'restrict' },
    ),
    transferActDraftDocId: uuid('transfer_act_draft_doc_id').references(() => documents.id, {
      onDelete: 'restrict',
    }),
    transferActSignedDocId: uuid('transfer_act_signed_doc_id').references(() => documents.id, {
      onDelete: 'restrict',
    }),
    returnActDocId: uuid('return_act_doc_id').references(() => documents.id, {
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

    purchaseCurrencyGroup: check(
      'vehicle_status_history_purchase_currency_group',
      sql`(
        (${table.purchasePrice} IS NULL AND ${table.purchaseCurrency} IS NULL AND ${table.purchaseRate} IS NULL AND ${table.purchaseRateSource} IS NULL)
        OR
        (${table.purchasePrice} IS NOT NULL AND ${table.purchaseCurrency} IS NOT NULL AND ${table.purchaseRate} IS NOT NULL AND ${table.purchaseRateSource} IS NOT NULL)
      )`,
    ),
    purchaseRateOneForUah: check(
      'vehicle_status_history_purchase_rate_one_for_uah',
      sql`(
        ${table.purchaseCurrency} IS NULL
        OR
        ${table.purchaseCurrency} != 'UAH'
        OR
        ${table.purchaseRate} = 1
      )`,
    ),
  }),
);
