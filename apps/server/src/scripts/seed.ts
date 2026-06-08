/* eslint-disable no-console */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { and, eq, isNull } from 'drizzle-orm';
import { createDb, createPool } from '../db/client.js';
import {
  expenseCategories,
  fundingSources,
  organizationMembers,
  organizations,
  users,
  vehicleStatuses,
} from '../db/schema/index.js';
import {
  SEED_EXPENSE_CATEGORY_IDS,
  SEED_FUNDING_SOURCE_IDS,
  SEED_ORG_IDS,
  SEED_VEHICLE_STATUS_IDS,
} from './seed-ids.js';

interface VehicleStatusSeed {
  id: string;
  name: string;
  sortOrder: number;
  isDefault: boolean;
  kind: 'in_work' | 'final' | 'other';
  color: string;
}

interface ExpenseCategorySeed {
  id: string;
  name: string;
  sortOrder: number;
}

interface FundingSourceSeed {
  id: string;
  name: string;
  type: 'donor' | 'fundraiser' | 'initiative' | 'other';
  description: string | null;
}

const VEHICLE_STATUSES: VehicleStatusSeed[] = [
  {
    id: SEED_VEHICLE_STATUS_IDS.found,
    name: 'Знайдено',
    sortOrder: 10,
    isDefault: true,
    kind: 'in_work',
    color: '#1677ff',
  },
  {
    id: SEED_VEHICLE_STATUS_IDS.purchased,
    name: 'Куплено',
    sortOrder: 20,
    isDefault: false,
    kind: 'in_work',
    color: '#faad14',
  },
  {
    id: SEED_VEHICLE_STATUS_IDS.repairing,
    name: 'В ремонті',
    sortOrder: 30,
    isDefault: false,
    kind: 'in_work',
    color: '#ff7a45',
  },
  {
    id: SEED_VEHICLE_STATUS_IDS.ready,
    name: 'Готове',
    sortOrder: 40,
    isDefault: false,
    kind: 'in_work',
    color: '#13c2c2',
  },
  {
    id: SEED_VEHICLE_STATUS_IDS.transferred,
    name: 'Передано',
    sortOrder: 50,
    isDefault: false,
    kind: 'final',
    color: '#52c41a',
  },
];

const EXPENSE_CATEGORIES: ExpenseCategorySeed[] = [
  { id: SEED_EXPENSE_CATEGORY_IDS.purchase, name: 'Купівля авто', sortOrder: 10 },
  { id: SEED_EXPENSE_CATEGORY_IDS.repair, name: 'Ремонт', sortOrder: 20 },
  { id: SEED_EXPENSE_CATEGORY_IDS.fuel, name: 'Паливо', sortOrder: 30 },
  { id: SEED_EXPENSE_CATEGORY_IDS.parts, name: 'Запчастини', sortOrder: 40 },
  { id: SEED_EXPENSE_CATEGORY_IDS.logistics, name: 'Логістика', sortOrder: 50 },
  { id: SEED_EXPENSE_CATEGORY_IDS.documents, name: 'Документи', sortOrder: 60 },
  { id: SEED_EXPENSE_CATEGORY_IDS.other, name: 'Інше', sortOrder: 70 },
];

const FUNDING_SOURCES: FundingSourceSeed[] = [
  {
    id: SEED_FUNDING_SOURCE_IDS.generalFundraiser,
    name: 'Загальний збір',
    type: 'fundraiser',
    description: 'Стандартний загальний волонтерський збір.',
  },
];

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.length === 0) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
}

const PRIMARY_ORG_NAME = 'Демо Організація';

// Platform superuser. Has no implicit access to organization data — it reaches
// org data only through membership (added as coordinator of the primary org below).
async function seedSuperuser(db: ReturnType<typeof createDb>): Promise<string> {
  const email = requireEnv('ADMIN_EMAIL');
  const password = requireEnv('ADMIN_PASSWORD');
  const fullName = requireEnv('ADMIN_NAME');
  const bcryptCost = Number(process.env.BCRYPT_COST ?? '12');

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const found = existing[0];
  if (found) {
    console.log(`[seed] superuser already exists: ${email}`);
    return found.id;
  }

  const passwordHash = await bcrypt.hash(password, bcryptCost);
  const inserted = await db
    .insert(users)
    .values({ email, passwordHash, fullName, role: 'superuser', isActive: true })
    .returning({ id: users.id });
  const row = inserted[0];
  if (!row) throw new Error('Failed to insert superuser');
  console.log(`[seed] created superuser: ${email}`);
  return row.id;
}

// One organization with the superuser as its coordinator, so a fresh install has
// a working active organization to land in after login.
async function seedPrimaryOrganization(
  db: ReturnType<typeof createDb>,
  superuserId: string,
): Promise<void> {
  await db
    .insert(organizations)
    .values({ id: SEED_ORG_IDS.primary, name: PRIMARY_ORG_NAME, createdBy: superuserId })
    .onConflictDoNothing();

  await db
    .insert(organizationMembers)
    .values({ organizationId: SEED_ORG_IDS.primary, userId: superuserId, role: 'coordinator' })
    .onConflictDoNothing();

  await db
    .update(users)
    .set({ lastActiveOrgId: SEED_ORG_IDS.primary })
    .where(and(eq(users.id, superuserId), isNull(users.lastActiveOrgId)));

  console.log(`[seed] primary organization ensured: ${PRIMARY_ORG_NAME}`);
}

// Reference data is insert-only by id: missing rows are created, existing rows are
// left untouched. This keeps the seed safe to run on every container start without
// resetting admin edits (renamed/recoloured statuses, sort order, default flag).
async function seedVehicleStatuses(db: ReturnType<typeof createDb>): Promise<void> {
  await db.insert(vehicleStatuses).values(VEHICLE_STATUSES).onConflictDoNothing();
  console.log('[seed] vehicle_statuses ensured');
}

async function seedExpenseCategories(db: ReturnType<typeof createDb>): Promise<void> {
  await db.insert(expenseCategories).values(EXPENSE_CATEGORIES).onConflictDoNothing();
  console.log('[seed] expense_categories ensured');
}

async function seedFundingSources(db: ReturnType<typeof createDb>): Promise<void> {
  await db.insert(fundingSources).values(FUNDING_SOURCES).onConflictDoNothing();
  console.log('[seed] funding_sources ensured');
}

async function main(): Promise<void> {
  const databaseUrl = requireEnv('DATABASE_URL');
  const pool = createPool(databaseUrl);
  const db = createDb(pool);

  try {
    const superuserId = await seedSuperuser(db);
    await seedPrimaryOrganization(db, superuserId);
    await seedVehicleStatuses(db);
    await seedExpenseCategories(db);
    await seedFundingSources(db);
    console.log('[seed] done');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('[seed] failed:', error);
  process.exit(1);
});
