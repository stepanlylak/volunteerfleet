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
  organizationMembers,
  organizations,
  users,
  vehicles,
} from '../db/schema/index.js';
import {
  SEED_EXPENSE_CATEGORY_IDS,
  SEED_FUNDING_SOURCE_IDS,
  SEED_ORG_IDS,
} from './seed-ids.js';
import { VEHICLE_STATUS_CONFIG } from '@volunteerfleet/shared';

type OrgKey = 'A' | 'B';

interface DemoUserSpec {
  email: string;
  password: string;
  fullName: string;
}

const COORDINATOR_B: DemoUserSpec = {
  email: 'coordinator.b@example.com',
  password: 'demo-coordinator-pass',
  fullName: 'Демо Координатор Б',
};

const MEMBER_A: DemoUserSpec = {
  email: 'volunteer.a@example.com',
  password: 'demo-volunteer-pass',
  fullName: 'Демо Волонтер А',
};

const DEMO_ORGS: Record<OrgKey, { id: string; name: string }> = {
  A: { id: SEED_ORG_IDS.demoA, name: 'Перша Чота (демо)' },
  B: { id: SEED_ORG_IDS.demoB, name: 'Друга Чота (демо)' },
};

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

async function getOrCreateUser(
  db: ReturnType<typeof createDb>,
  spec: DemoUserSpec,
): Promise<string> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, spec.email))
    .limit(1);
  const found = existing[0];
  if (found) return found.id;

  const bcryptCost = Number(process.env.BCRYPT_COST ?? '12');
  const passwordHash = await bcrypt.hash(spec.password, bcryptCost);
  const inserted = await db
    .insert(users)
    .values({
      email: spec.email,
      passwordHash,
      fullName: spec.fullName,
      role: 'user',
      isActive: true,
    })
    .returning({ id: users.id });
  const row = inserted[0];
  if (!row) throw new Error(`Failed to insert user ${spec.email}`);
  console.log(`[seed-demo] created user: ${spec.email}`);
  return row.id;
}

async function getSuperuserId(db: ReturnType<typeof createDb>): Promise<string> {
  const adminEmail = requireEnv('ADMIN_EMAIL');
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);
  const admin = rows[0];
  if (!admin) {
    throw new Error('Superuser not found. Run `pnpm db:seed` first.');
  }
  return admin.id;
}

async function demoOrgExists(db: ReturnType<typeof createDb>): Promise<boolean> {
  const rows = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, DEMO_ORGS.A.id))
    .limit(1);
  return rows.length > 0;
}

// Two organizations with different member compositions, so isolation can be checked
// by hand: org A is run by the superuser (coordinator) with member A as a volunteer;
// org B is run by coordinator B, and member A only has read access there (viewer).
async function seedOrganizations(
  db: ReturnType<typeof createDb>,
  superuserId: string,
  coordinatorBId: string,
  memberAId: string,
): Promise<void> {
  await db.insert(organizations).values([
    { id: DEMO_ORGS.A.id, name: DEMO_ORGS.A.name, createdBy: superuserId },
    { id: DEMO_ORGS.B.id, name: DEMO_ORGS.B.name, createdBy: superuserId },
  ]);

  await db.insert(organizationMembers).values([
    { organizationId: DEMO_ORGS.A.id, userId: superuserId, role: 'coordinator' },
    { organizationId: DEMO_ORGS.A.id, userId: memberAId, role: 'volunteer' },
    { organizationId: DEMO_ORGS.B.id, userId: coordinatorBId, role: 'coordinator' },
    { organizationId: DEMO_ORGS.B.id, userId: memberAId, role: 'viewer' },
  ]);

  console.log('[seed-demo] organizations and memberships created (A, B)');
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

const STATUS_NAME_TO_ENUM: Record<string, 'new' | 'paid' | 'in_transit' | 'arrived' | 'in_repair' | 'ready' | 'transferred' | 'returned' | 'lost'> = {
  'нове': 'new',
  'оплачено': 'paid',
  'в дорозі': 'in_transit',
  'прибуло': 'arrived',
  'в ремонті': 'in_repair',
  'готове': 'ready',
  'передано': 'transferred',
  'повернено': 'returned',
  'втрачено': 'lost',
};

interface VehicleSeedSpec {
  identifier: string;
  brand: string;
  model: string;
  year: number;
  statusName: string;
  org: OrgKey;
}

interface VehicleRecord {
  id: string;
  org: OrgKey;
}

const DEMO_VEHICLES: VehicleSeedSpec[] = [
  {
    identifier: 'VF-DEMO-001',
    brand: 'Mitsubishi',
    model: 'L200',
    year: 2008,
    statusName: 'в ремонті',
    org: 'A',
  },
  {
    identifier: 'VF-DEMO-002',
    brand: 'Volkswagen',
    model: 'Transporter T4',
    year: 2001,
    statusName: 'готове',
    org: 'A',
  },
  {
    identifier: 'VF-DEMO-003',
    brand: 'Toyota',
    model: 'Land Cruiser 80',
    year: 1995,
    statusName: 'передано',
    org: 'B',
  },
];

async function seedVehicles(
  db: ReturnType<typeof createDb>,
  creatorByOrg: Record<OrgKey, string>,
): Promise<VehicleRecord[]> {
  const records: VehicleRecord[] = [];
  for (const spec of DEMO_VEHICLES) {
    const status = STATUS_NAME_TO_ENUM[spec.statusName];
    if (!status) {
      throw new Error(`Unknown status: ${spec.statusName}`);
    }
    const createdBy = creatorByOrg[spec.org];
    const inserted = await db
      .insert(vehicles)
      .values({
        organizationId: DEMO_ORGS[spec.org].id,
        identifier: spec.identifier,
        brand: spec.brand,
        model: spec.model,
        year: spec.year,
        startDate: '2024-01-01',
        status,
        createdBy,
        updatedBy: createdBy,
      })
      .returning({ id: vehicles.id });
    const row = inserted[0];
    if (!row) throw new Error('Failed to insert vehicle');
    records.push({ id: row.id, org: spec.org });
    console.log(`[seed-demo] vehicle: ${spec.identifier} (org ${spec.org})`);
  }
  return records;
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

interface ExpenseRecord {
  id: string;
  org: OrgKey;
}

async function seedExpenses(
  db: ReturnType<typeof createDb>,
  vehicleRecords: VehicleRecord[],
  categoryMap: Map<string, string>,
  fundingSourceId: string,
  creatorByOrg: Record<OrgKey, string>,
  rates: RatesMap,
): Promise<ExpenseRecord[]> {
  const records: ExpenseRecord[] = [];
  for (const spec of DEMO_EXPENSES) {
    const vehicle = vehicleRecords[spec.vehicleIndex];
    if (!vehicle) throw new Error(`No vehicle at index ${spec.vehicleIndex}`);
    const categoryId = categoryMap.get(spec.categoryName);
    if (!categoryId) throw new Error(`Unknown category: ${spec.categoryName}`);
    const rate = getRate(rates, new Date(spec.expenseDate), spec.currency);
    const createdBy = creatorByOrg[vehicle.org];
    const inserted = await db
      .insert(expenses)
      .values({
        organizationId: DEMO_ORGS[vehicle.org].id,
        vehicleId: vehicle.id,
        expenseDate: spec.expenseDate,
        amount: spec.amount,
        currency: spec.currency,
        rate,
        rateSource: 'default',
        categoryId,
        fundingSourceId,
        description: spec.description,
        createdBy,
        updatedBy: createdBy,
      })
      .returning({ id: expenses.id });
    const row = inserted[0];
    if (!row) throw new Error('Failed to insert expense');
    records.push({ id: row.id, org: vehicle.org });
  }
  console.log(`[seed-demo] expenses: ${records.length}`);
  return records;
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
  vehicleRecords: VehicleRecord[],
  expenseRecords: ExpenseRecord[],
  creatorByOrg: Record<OrgKey, string>,
): Promise<void> {
  for (const spec of DEMO_DOCUMENTS) {
    const vehicle = spec.vehicleIndex !== null ? vehicleRecords[spec.vehicleIndex] : null;
    const expense = spec.expenseIndex !== null ? expenseRecords[spec.expenseIndex] : null;
    if (spec.vehicleIndex !== null && !vehicle) {
      throw new Error(`No vehicle at index ${spec.vehicleIndex}`);
    }
    if (spec.expenseIndex !== null && !expense) {
      throw new Error(`No expense at index ${spec.expenseIndex}`);
    }
    // A document inherits the organization of whatever it is attached to.
    const org = vehicle?.org ?? expense?.org;
    if (!org) throw new Error(`Document "${spec.name}" is not attached to anything`);
    const createdBy = creatorByOrg[org];
    await db.insert(documents).values({
      organizationId: DEMO_ORGS[org].id,
      name: spec.name,
      kind: spec.kind,
      fileKey: spec.fileKey,
      url: spec.url,
      mimeType: spec.mimeType,
      sizeBytes: spec.sizeBytes,
      vehicleId: vehicle?.id ?? null,
      expenseId: expense?.id ?? null,
      createdBy,
      updatedBy: createdBy,
    });
  }
  console.log(`[seed-demo] documents: ${DEMO_DOCUMENTS.length}`);
}

async function main(): Promise<void> {
  const databaseUrl = requireEnv('DATABASE_URL');
  const pool = createPool(databaseUrl);
  const db = createDb(pool);

  try {
    if (await demoOrgExists(db)) {
      console.log('[seed-demo] demo organizations already exist — skipping to keep idempotency.');
      return;
    }

    const superuserId = await getSuperuserId(db);
    const coordinatorBId = await getOrCreateUser(db, COORDINATOR_B);
    const memberAId = await getOrCreateUser(db, MEMBER_A);

    const categoryMap = await loadCategoryMap(db);
    const fundingSourceId = await getFundingSourceId(db);
    const rates = await loadRates();

    // Coordinators own vehicles; members author expenses/documents within their org.
    const vehicleCreatorByOrg: Record<OrgKey, string> = { A: superuserId, B: coordinatorBId };
    const entryCreatorByOrg: Record<OrgKey, string> = { A: memberAId, B: coordinatorBId };

    await db.execute(sql`BEGIN`);
    try {
      await seedOrganizations(db, superuserId, coordinatorBId, memberAId);
      const vehicleRecords = await seedVehicles(db, vehicleCreatorByOrg);
      const expenseRecords = await seedExpenses(
        db,
        vehicleRecords,
        categoryMap,
        fundingSourceId,
        entryCreatorByOrg,
        rates,
      );
      await seedDocuments(db, vehicleRecords, expenseRecords, entryCreatorByOrg);
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
