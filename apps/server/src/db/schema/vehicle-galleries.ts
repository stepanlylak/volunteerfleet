import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { vehicleGalleryKindEnum } from './enums.js';
import { organizations } from './organizations.js';
import { users } from './users.js';
import { vehicles } from './vehicles.js';
import { vehicleGalleryItems } from './vehicle-gallery-items.js';

export const vehicleGalleries = pgTable(
  'vehicle_galleries',
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
    kind: vehicleGalleryKindEnum('kind').notNull(),
    name: varchar('name', { length: 255 }),
    description: text('description'),
    isPublic: boolean('is_public').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    coverItemId: uuid('cover_item_id').references((): AnyPgColumn => vehicleGalleryItems.id, {
      onDelete: 'set null',
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
    deletedBy: uuid('deleted_by').references(() => users.id, { onDelete: 'restrict' }),
  },
  (table) => ({
    mainUniqueActive: uniqueIndex('vehicle_galleries_main_active_unique')
      .on(table.vehicleId)
      .where(sql`${table.kind} = 'main' AND ${table.deletedAt} IS NULL`),
    nameUniqueActive: uniqueIndex('vehicle_galleries_name_active_unique')
      .on(table.vehicleId, sql`lower(trim(${table.name}))`)
      .where(sql`${table.deletedAt} IS NULL`),
    orgVehicleIdx: index('vehicle_galleries_org_vehicle_idx').on(
      table.organizationId,
      table.vehicleId,
    ),
    vehicleOrderIdx: index('vehicle_galleries_vehicle_order_idx').on(
      table.vehicleId,
      table.sortOrder,
    ),
    mainShapeCheck: check(
      'vehicle_galleries_main_shape_check',
      sql`${table.kind} <> 'main' OR (${table.name} IS NULL AND ${table.isPublic} = true AND ${table.sortOrder} = 0)`,
    ),
    customShapeCheck: check(
      'vehicle_galleries_custom_shape_check',
      sql`${table.kind} <> 'custom' OR (${table.name} IS NOT NULL AND length(trim(${table.name})) > 0)`,
    ),
  }),
);
