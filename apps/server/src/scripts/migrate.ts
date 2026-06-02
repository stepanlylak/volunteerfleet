/* eslint-disable no-console */
import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb, createPool } from '../db/client.js';

// Production migration runner: applies pending Drizzle migrations using only
// runtime dependencies (no drizzle-kit). The journal in the migrations folder
// makes this idempotent — already-applied migrations are skipped.
async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  const migrationsFolder = process.env.MIGRATIONS_FOLDER ?? './drizzle';

  const pool = createPool(databaseUrl);
  const db = createDb(pool);

  try {
    console.log(`[migrate] applying migrations from ${migrationsFolder}`);
    await migrate(db, { migrationsFolder });
    console.log('[migrate] done');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('[migrate] failed:', error);
  process.exit(1);
});
