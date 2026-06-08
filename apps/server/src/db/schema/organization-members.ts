import { sql } from 'drizzle-orm';
import { index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { orgRoleEnum } from './enums.js';
import { organizations } from './organizations.js';
import { users } from './users.js';

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    role: orgRoleEnum('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    orgUserUnique: uniqueIndex('organization_members_org_user_unique').on(
      table.organizationId,
      table.userId,
    ),
    userIdx: index('organization_members_user_id_idx').on(table.userId),
    organizationIdx: index('organization_members_organization_id_idx').on(table.organizationId),
  }),
);
