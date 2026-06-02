import { sql } from 'drizzle-orm';
import { bigint, index, pgTable, smallint, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { vehicles } from './vehicles.js';

export const vehiclePhotos = pgTable(
  'vehicle_photos',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'restrict' }),
    fileKey: varchar('file_key', { length: 512 }).notNull(),
    mimeType: varchar('mime_type', { length: 128 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    sortOrder: smallint('sort_order').notNull().default(0),
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
    vehicleIdx: index('vehicle_photos_vehicle_id_idx').on(table.vehicleId),
    orderIdx: index('vehicle_photos_vehicle_order_idx').on(table.vehicleId, table.sortOrder),
  }),
);
