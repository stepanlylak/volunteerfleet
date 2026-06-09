import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { vehicleGalleryItemTypeEnum } from './enums.js';
import { organizations } from './organizations.js';
import { users } from './users.js';
import { vehicles } from './vehicles.js';
import { vehicleGalleries } from './vehicle-galleries.js';

export const vehicleGalleryItems = pgTable(
  'vehicle_gallery_items',
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
    galleryId: uuid('gallery_id')
      .notNull()
      .references(() => vehicleGalleries.id, { onDelete: 'restrict' }),
    type: vehicleGalleryItemTypeEnum('type').notNull(),
    fileKey: varchar('file_key', { length: 512 }).notNull(),
    originalName: varchar('original_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 128 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    caption: text('caption'),
    sortOrder: integer('sort_order').notNull().default(0),
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
    orgVehicleGalleryIdx: index('vehicle_gallery_items_org_vehicle_gallery_idx').on(
      table.organizationId,
      table.vehicleId,
      table.galleryId,
    ),
    galleryOrderIdx: index('vehicle_gallery_items_gallery_order_idx').on(
      table.galleryId,
      table.sortOrder,
    ),
    galleryOrderUniqueActive: uniqueIndex('vehicle_gallery_items_gallery_order_active_unique')
      .on(table.galleryId, table.sortOrder)
      .where(sql`${table.deletedAt} IS NULL`),
  }),
);
