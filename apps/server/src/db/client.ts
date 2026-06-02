import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index.js';

export type Database = ReturnType<typeof createDb>;

export function createPool(databaseUrl: string): Pool {
  return new Pool({ connectionString: databaseUrl });
}

export function createDb(pool: Pool) {
  return drizzle(pool, { schema });
}
