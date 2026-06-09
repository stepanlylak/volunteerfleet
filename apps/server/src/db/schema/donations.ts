import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  date,
  foreignKey,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { expenseCategories } from './dictionaries.js';
import { donors, organizationDonors } from './donors.js';
import { currencyCodeEnum, rateSourceEnum } from './enums.js';
import { organizations } from './organizations.js';
import { users } from './users.js';
import { vehicles } from './vehicles.js';

export const donations = pgTable(
  'donations',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    donorId: uuid('donor_id')
      .notNull()
      .references(() => donors.id, { onDelete: 'restrict' }),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'restrict' }),
    categoryId: uuid('category_id').references(() => expenseCategories.id, {
      onDelete: 'restrict',
    }),
    donationDate: date('donation_date').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: currencyCodeEnum('currency').notNull(),
    rate: numeric('rate', { precision: 14, scale: 6 }).notNull(),
    rateSource: rateSourceEnum('rate_source').notNull(),
    description: text('description'),
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
    organizationDonorFk: foreignKey({
      name: 'donations_organization_donor_fk',
      columns: [table.organizationId, table.donorId],
      foreignColumns: [organizationDonors.organizationId, organizationDonors.donorId],
    }).onDelete('restrict'),
    amountPositive: check('donations_amount_minor_positive', sql`${table.amountMinor} > 0`),
    ratePositive: check('donations_rate_positive', sql`${table.rate} > 0`),
    rateOneForUah: check(
      'donations_rate_one_for_uah',
      sql`${table.currency} != 'UAH' OR ${table.rate} = 1`,
    ),
    organizationIdx: index('donations_organization_id_idx').on(table.organizationId),
    organizationDateIdx: index('donations_organization_date_idx').on(
      table.organizationId,
      table.donationDate,
    ),
    organizationDonorVehicleIdx: index('donations_organization_donor_vehicle_idx').on(
      table.organizationId,
      table.donorId,
      table.vehicleId,
    ),
    donorOrganizationVehicleIdx: index('donations_donor_organization_vehicle_idx').on(
      table.donorId,
      table.organizationId,
      table.vehicleId,
    ),
    organizationCategoryIdx: index('donations_organization_category_idx').on(
      table.organizationId,
      table.categoryId,
    ),
    organizationVehicleIdx: index('donations_organization_vehicle_idx').on(
      table.organizationId,
      table.vehicleId,
    ),
  }),
);
