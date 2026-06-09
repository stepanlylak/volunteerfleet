/* eslint-disable no-console */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { createDb, createPool } from '../db/client.js';
import { expenseCategories, users } from '../db/schema/index.js';
import { SEED_EXPENSE_CATEGORY_IDS } from './seed-ids.js';

interface ExpenseCategorySeed {
  id: string;
  name: string;
  sortOrder: number;
}

const EXPENSE_CATEGORIES: ExpenseCategorySeed[] = [
  { id: SEED_EXPENSE_CATEGORY_IDS.purchase, name: 'Купівля авто', sortOrder: 10 },
  { id: SEED_EXPENSE_CATEGORY_IDS.repair, name: 'Ремонт', sortOrder: 20 },
  { id: SEED_EXPENSE_CATEGORY_IDS.fuel, name: 'Паливо', sortOrder: 30 },
  { id: SEED_EXPENSE_CATEGORY_IDS.parts, name: 'Запчастини', sortOrder: 40 },
  { id: SEED_EXPENSE_CATEGORY_IDS.logistics, name: 'Логістика', sortOrder: 50 },
  { id: SEED_EXPENSE_CATEGORY_IDS.documents, name: 'Документи', sortOrder: 60 },
  { id: SEED_EXPENSE_CATEGORY_IDS.other, name: 'Інше', sortOrder: 70 },
];

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.length === 0) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
}

// Platform superuser. Has no implicit access to organization data and is not a
// member of any organization — the first superuser creates organizations and
// assigns members manually after login.
async function seedSuperuser(db: ReturnType<typeof createDb>): Promise<void> {
  const email = requireEnv('ADMIN_EMAIL');
  const password = requireEnv('ADMIN_PASSWORD');
  const fullName = requireEnv('ADMIN_NAME');
  const bcryptCost = Number(process.env.BCRYPT_COST ?? '12');

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing[0]) {
    console.log(`[seed] superuser already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, bcryptCost);
  await db
    .insert(users)
    .values({ email, passwordHash, fullName, role: 'superuser', isActive: true });
  console.log(`[seed] created superuser: ${email}`);
}

// Global reference data is insert-only by id: missing rows are created, existing
// rows are left untouched. This keeps the seed safe to run on every container
// start without resetting admin edits.
async function seedExpenseCategories(db: ReturnType<typeof createDb>): Promise<void> {
  await db.insert(expenseCategories).values(EXPENSE_CATEGORIES).onConflictDoNothing();
  console.log('[seed] expense_categories ensured');
}

async function main(): Promise<void> {
  const databaseUrl = requireEnv('DATABASE_URL');
  const pool = createPool(databaseUrl);
  const db = createDb(pool);

  try {
    await seedSuperuser(db);
    await seedExpenseCategories(db);
    console.log('[seed] done');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('[seed] failed:', error);
  process.exit(1);
});
