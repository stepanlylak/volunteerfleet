import { sql } from 'drizzle-orm';
import { bigint, check, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { documentKindEnum, documentTypeEnum } from './enums.js';
import { expenses } from './expenses.js';
import { organizations } from './organizations.js';
import { users } from './users.js';
import { vehicles } from './vehicles.js';

export const documents = pgTable(
  'documents',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 255 }).notNull(),
    kind: documentKindEnum('kind').notNull(),
    documentType: documentTypeEnum('document_type').notNull().default('other'),
    fileKey: varchar('file_key', { length: 512 }),
    url: varchar('url', { length: 2048 }),
    mimeType: varchar('mime_type', { length: 128 }),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),
    vehicleId: uuid('vehicle_id').references(() => vehicles.id, {
      onDelete: 'restrict',
    }),
    expenseId: uuid('expense_id').references(() => expenses.id, {
      onDelete: 'restrict',
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
    deletedBy: uuid('deleted_by').references(() => users.id, {
      onDelete: 'restrict',
    }),
  },
  (table) => ({
    kindPayload: check(
      'documents_kind_payload',
      sql`(${table.kind} = 'upload' AND ${table.fileKey} IS NOT NULL AND ${table.url} IS NULL) OR (${table.kind} = 'link' AND ${table.url} IS NOT NULL AND ${table.fileKey} IS NULL)`,
    ),
    attachedToSomething: check(
      'documents_attached_to_something',
      sql`${table.vehicleId} IS NOT NULL OR ${table.expenseId} IS NOT NULL`,
    ),
    organizationIdx: index('documents_organization_id_idx').on(table.organizationId),
    vehicleIdx: index('documents_vehicle_id_idx').on(table.vehicleId),
    expenseIdx: index('documents_expense_id_idx').on(table.expenseId),
  }),
);
