/* eslint-disable no-console */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import bcrypt from 'bcrypt';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createDb, createPool } from '../db/client.js';
import {
  documents,
  expenseCategories,
  expenses,
  fundingSources,
  users,
  vehicleStatuses,
  vehicles,
} from '../db/schema/index.js';
import {
  SEED_EXPENSE_CATEGORY_IDS,
  SEED_FUNDING_SOURCE_IDS,
  SEED_VEHICLE_STATUS_IDS,
} from './seed-ids.js';

const VOLUNTEER_EMAIL = 'volunteer@example.com';
const VOLUNTEER_PASSWORD = 'demo-volunteer-pass';
const VOLUNTEER_NAME = 'Демо Волонтер';

const ratesFileSchema = z.record(
  z.string().regex(/^\d{4}-\d{2}$/),
  z.record(z.string(), z.number().positive()),
);

type RatesMap = z.infer<typeof ratesFileSchema>;

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.length === 0) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
}

function formatYearMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getRate(rates: RatesMap, date: Date, currency: 'UAH' | 'USD' | 'EUR'): string {
  if (currency === 'UAH') return '1.000000';
  const key = formatYearMonth(date);
  const direct = rates[key]?.[currency];
  if (direct !== undefined) return direct.toFixed(6);
  const sortedKeys = Object.keys(rates).sort();
  let fallback: number | undefined;
  for (const k of sortedKeys) {
    if (k > key) break;
    const value = rates[k]?.[currency];
    if (value !== undefined) fallback = value;
  }
  if (fallback === undefined) {
    throw new Error(`No rate for ${currency} on ${key}`);
  }
  return fallback.toFixed(6);
}

async function loadRates(): Promise<RatesMap> {
  const path = resolve(
    process.cwd(),
    process.env.EXCHANGE_RATES_FILE ?? './data/exchange-rates.json',
  );
  const raw = await readFile(path, 'utf-8');
  const parsed = JSON.parse(raw) as unknown;
  return ratesFileSchema.parse(parsed);
}

async function getOrCreateVolunteer(
  db: ReturnType<typeof createDb>,
): Promise<{ id: string; created: boolean }> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, VOLUNTEER_EMAIL))
    .limit(1);
  const found = existing[0];
  if (found) return { id: found.id, created: false };

  const bcryptCost = Number(process.env.BCRYPT_COST ?? '12');
  const passwordHash = await bcrypt.hash(VOLUNTEER_PASSWORD, bcryptCost);
  const inserted = await db
    .insert(users)
    .values({
      email: VOLUNTEER_EMAIL,
      passwordHash,
      fullName: VOLUNTEER_NAME,
      role: 'volunteer',
      isActive: true,
    })
    .returning({ id: users.id });
  const row = inserted[0];
  if (!row) throw new Error('Failed to insert volunteer user');
  console.log(`[seed-demo] created volunteer: ${VOLUNTEER_EMAIL}`);
  return { id: row.id, created: true };
}

async function getAdminId(db: ReturnType<typeof createDb>): Promise<string> {
  const adminEmail = requireEnv('ADMIN_EMAIL');
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);
  const admin = rows[0];
  if (!admin) {
    throw new Error('Admin user not found. Run `pnpm db:seed` first.');
  }
  return admin.id;
}

async function loadStatusMap(db: ReturnType<typeof createDb>): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: vehicleStatuses.id, name: vehicleStatuses.name })
    .from(vehicleStatuses);
  const map = new Map<string, string>();
  const seeds = [
    ['в ремонті', SEED_VEHICLE_STATUS_IDS.repairing],
    ['готове', SEED_VEHICLE_STATUS_IDS.ready],
    ['передано', SEED_VEHICLE_STATUS_IDS.transferred],
  ] as const;
  for (const [name, seedId] of seeds) {
    const row = rows.find((item) => item.id === seedId || item.name.toLowerCase() === name);
    if (row) map.set(name, row.id);
  }
  return map;
}

async function loadCategoryMap(db: ReturnType<typeof createDb>): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: expenseCategories.id, name: expenseCategories.name })
    .from(expenseCategories);
  const map = new Map<string, string>();
  const seeds = [
    ['Купівля авто', SEED_EXPENSE_CATEGORY_IDS.purchase],
    ['Логістика', SEED_EXPENSE_CATEGORY_IDS.logistics],
    ['Ремонт', SEED_EXPENSE_CATEGORY_IDS.repair],
    ['Запчастини', SEED_EXPENSE_CATEGORY_IDS.parts],
    ['Документи', SEED_EXPENSE_CATEGORY_IDS.documents],
    ['Паливо', SEED_EXPENSE_CATEGORY_IDS.fuel],
    ['Інше', SEED_EXPENSE_CATEGORY_IDS.other],
  ] as const;
  for (const [name, seedId] of seeds) {
    const row = rows.find(
      (item) => item.id === seedId || item.name.toLowerCase() === name.toLowerCase(),
    );
    if (row) map.set(name, row.id);
  }
  return map;
}

async function getFundingSourceId(db: ReturnType<typeof createDb>): Promise<string> {
  const rows = await db
    .select({ id: fundingSources.id, name: fundingSources.name })
    .from(fundingSources)
    .where(
      sql`${fundingSources.id} = ${SEED_FUNDING_SOURCE_IDS.generalFundraiser} OR lower(${fundingSources.name}) = lower(${'Загальний збір'})`,
    );
  const row = rows[0];
  if (!row) {
    throw new Error('Funding source not found. Run `pnpm db:seed` first.');
  }
  return row.id;
}

interface VehicleSeedSpec {
  identifier: string;
  brand: string;
  model: string;
  year: number;
  statusName: string;
}

const DEMO_VEHICLES: VehicleSeedSpec[] = [
  {
    identifier: 'VF-DEMO-001',
    brand: 'Mitsubishi',
    model: 'L200',
    year: 2008,
    statusName: 'в ремонті',
  },
  {
    identifier: 'VF-DEMO-002',
    brand: 'Volkswagen',
    model: 'Transporter T4',
    year: 2001,
    statusName: 'готове',
  },
  {
    identifier: 'VF-DEMO-003',
    brand: 'Toyota',
    model: 'Land Cruiser 80',
    year: 1995,
    statusName: 'передано',
  },
];

async function seedVehicles(
  db: ReturnType<typeof createDb>,
  userId: string,
  statusMap: Map<string, string>,
): Promise<string[]> {
  const vehicleIds: string[] = [];
  for (const spec of DEMO_VEHICLES) {
    const statusId = statusMap.get(spec.statusName);
    if (!statusId) {
      throw new Error(`Unknown status: ${spec.statusName}`);
    }
    const inserted = await db
      .insert(vehicles)
      .values({
        identifier: spec.identifier,
        brand: spec.brand,
        model: spec.model,
        year: spec.year,
        statusId,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning({ id: vehicles.id });
    const row = inserted[0];
    if (!row) throw new Error('Failed to insert vehicle');
    vehicleIds.push(row.id);
    console.log(`[seed-demo] vehicle: ${spec.identifier}`);
  }
  return vehicleIds;
}

interface ExpenseSeedSpec {
  vehicleIndex: number;
  expenseDate: string;
  amount: string;
  currency: 'UAH' | 'USD' | 'EUR';
  categoryName: string;
  description: string;
}

const DEMO_EXPENSES: ExpenseSeedSpec[] = [
  {
    vehicleIndex: 0,
    expenseDate: '2026-01-15',
    amount: '4500.00',
    currency: 'USD',
    categoryName: 'Купівля авто',
    description: 'Купівля пікапа у Польщі.',
  },
  {
    vehicleIndex: 0,
    expenseDate: '2026-02-03',
    amount: '850.00',
    currency: 'EUR',
    categoryName: 'Логістика',
    description: 'Доставка з Польщі до Львова.',
  },
  {
    vehicleIndex: 0,
    expenseDate: '2026-03-10',
    amount: '12500.00',
    currency: 'UAH',
    categoryName: 'Ремонт',
    description: 'Заміна підвіски і гальмівних колодок.',
  },
  {
    vehicleIndex: 0,
    expenseDate: '2026-04-22',
    amount: '3200.00',
    currency: 'UAH',
    categoryName: 'Запчастини',
    description: 'Гумa BFGoodrich.',
  },
  {
    vehicleIndex: 1,
    expenseDate: '2026-01-28',
    amount: '3000.00',
    currency: 'EUR',
    categoryName: 'Купівля авто',
    description: 'Купівля бусa Transporter.',
  },
  {
    vehicleIndex: 1,
    expenseDate: '2026-02-14',
    amount: '450.00',
    currency: 'USD',
    categoryName: 'Документи',
    description: 'Оформлення розмитнення.',
  },
  {
    vehicleIndex: 1,
    expenseDate: '2026-03-05',
    amount: '6800.00',
    currency: 'UAH',
    categoryName: 'Паливо',
    description: 'Паливо для перегону.',
  },
  {
    vehicleIndex: 2,
    expenseDate: '2025-12-20',
    amount: '7500.00',
    currency: 'USD',
    categoryName: 'Купівля авто',
    description: 'Купівля Land Cruiser у США (з аукціону).',
  },
  {
    vehicleIndex: 2,
    expenseDate: '2026-02-18',
    amount: '24000.00',
    currency: 'UAH',
    categoryName: 'Ремонт',
    description: 'Капремонт двигуна.',
  },
  {
    vehicleIndex: 2,
    expenseDate: '2026-04-30',
    amount: '950.00',
    currency: 'EUR',
    categoryName: 'Інше',
    description: 'Тактичне обладнання у комплекті.',
  },
];

async function seedExpenses(
  db: ReturnType<typeof createDb>,
  vehicleIds: string[],
  categoryMap: Map<string, string>,
  fundingSourceId: string,
  userId: string,
  rates: RatesMap,
): Promise<string[]> {
  const expenseIds: string[] = [];
  for (const spec of DEMO_EXPENSES) {
    const vehicleId = vehicleIds[spec.vehicleIndex];
    if (!vehicleId) throw new Error(`No vehicle at index ${spec.vehicleIndex}`);
    const categoryId = categoryMap.get(spec.categoryName);
    if (!categoryId) throw new Error(`Unknown category: ${spec.categoryName}`);
    const rate = getRate(rates, new Date(spec.expenseDate), spec.currency);
    const inserted = await db
      .insert(expenses)
      .values({
        vehicleId,
        expenseDate: spec.expenseDate,
        amount: spec.amount,
        currency: spec.currency,
        rate,
        rateSource: 'default',
        categoryId,
        fundingSourceId,
        description: spec.description,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning({ id: expenses.id });
    const row = inserted[0];
    if (!row) throw new Error('Failed to insert expense');
    expenseIds.push(row.id);
  }
  console.log(`[seed-demo] expenses: ${expenseIds.length}`);
  return expenseIds;
}

interface DocumentSeedSpec {
  name: string;
  kind: 'upload' | 'link';
  fileKey: string | null;
  url: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  vehicleIndex: number | null;
  expenseIndex: number | null;
}

const DEMO_DOCUMENTS: DocumentSeedSpec[] = [
  {
    name: 'Чек на ремонт підвіски.pdf',
    kind: 'upload',
    fileKey: 'demo/expenses/repair-receipt-001.pdf',
    url: null,
    mimeType: 'application/pdf',
    sizeBytes: 0,
    vehicleIndex: null,
    expenseIndex: 2,
  },
  {
    name: 'Договір купівлі-продажу.pdf',
    kind: 'upload',
    fileKey: 'demo/vehicles/contract-001.pdf',
    url: null,
    mimeType: 'application/pdf',
    sizeBytes: 0,
    vehicleIndex: 0,
    expenseIndex: null,
  },
  {
    name: 'Свідоцтво про реєстрацію.jpg',
    kind: 'upload',
    fileKey: 'demo/vehicles/registration-002.jpg',
    url: null,
    mimeType: 'image/jpeg',
    sizeBytes: 0,
    vehicleIndex: 1,
    expenseIndex: null,
  },
  {
    name: 'Звіт волонтерів (Google Drive)',
    kind: 'link',
    fileKey: null,
    url: 'https://drive.google.com/file/d/demo-report-volunteers',
    mimeType: null,
    sizeBytes: null,
    vehicleIndex: 2,
    expenseIndex: null,
  },
  {
    name: 'Фото передачі ЗСУ (Telegram)',
    kind: 'link',
    fileKey: null,
    url: 'https://t.me/volunteerfleet/demo-handover',
    mimeType: null,
    sizeBytes: null,
    vehicleIndex: 2,
    expenseIndex: null,
  },
];

async function seedDocuments(
  db: ReturnType<typeof createDb>,
  vehicleIds: string[],
  expenseIds: string[],
  userId: string,
): Promise<void> {
  for (const spec of DEMO_DOCUMENTS) {
    const vehicleId = spec.vehicleIndex !== null ? vehicleIds[spec.vehicleIndex] : null;
    const expenseId = spec.expenseIndex !== null ? expenseIds[spec.expenseIndex] : null;
    if (spec.vehicleIndex !== null && !vehicleId) {
      throw new Error(`No vehicle at index ${spec.vehicleIndex}`);
    }
    if (spec.expenseIndex !== null && !expenseId) {
      throw new Error(`No expense at index ${spec.expenseIndex}`);
    }
    await db.insert(documents).values({
      name: spec.name,
      kind: spec.kind,
      fileKey: spec.fileKey,
      url: spec.url,
      mimeType: spec.mimeType,
      sizeBytes: spec.sizeBytes,
      vehicleId: vehicleId ?? null,
      expenseId: expenseId ?? null,
      createdBy: userId,
      updatedBy: userId,
    });
  }
  console.log(`[seed-demo] documents: ${DEMO_DOCUMENTS.length}`);
}

async function main(): Promise<void> {
  const databaseUrl = requireEnv('DATABASE_URL');
  const pool = createPool(databaseUrl);
  const db = createDb(pool);

  try {
    const { id: volunteerId, created } = await getOrCreateVolunteer(db);
    if (!created) {
      console.log(
        '[seed-demo] volunteer already exists — skipping demo entities to keep idempotency.',
      );
      return;
    }

    const adminId = await getAdminId(db);
    const statusMap = await loadStatusMap(db);
    const categoryMap = await loadCategoryMap(db);
    const fundingSourceId = await getFundingSourceId(db);
    const rates = await loadRates();

    await db.execute(sql`BEGIN`);
    try {
      const vehicleIds = await seedVehicles(db, adminId, statusMap);
      const expenseIds = await seedExpenses(
        db,
        vehicleIds,
        categoryMap,
        fundingSourceId,
        volunteerId,
        rates,
      );
      await seedDocuments(db, vehicleIds, expenseIds, volunteerId);
      await db.execute(sql`COMMIT`);
    } catch (error) {
      await db.execute(sql`ROLLBACK`);
      throw error;
    }
    console.log('[seed-demo] done');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('[seed-demo] failed:', error);
  process.exit(1);
});
