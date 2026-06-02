/* eslint-disable no-console */
import 'dotenv/config';
import { Client } from 'pg';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function getDatabaseName(databaseUrl: URL): string {
  const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ''));
  if (!databaseName) {
    throw new Error('DATABASE_URL must include a database name');
  }
  return databaseName;
}

function buildMaintenanceUrl(databaseUrl: URL): string {
  const maintenanceUrl = new URL(databaseUrl);
  maintenanceUrl.pathname = '/postgres';
  return maintenanceUrl.toString();
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function connectWithRetry(client: Client): Promise<void> {
  const maxAttempts = 20;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await client.connect();
      return;
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw lastError;
}

async function main(): Promise<void> {
  const databaseUrl = new URL(requireEnv('DATABASE_URL'));
  const databaseName = getDatabaseName(databaseUrl);
  const client = new Client({ connectionString: buildMaintenanceUrl(databaseUrl) });

  await connectWithRetry(client);
  try {
    const existing = await client.query<{ exists: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS "exists"',
      [databaseName],
    );

    if (existing.rows[0]?.exists) {
      console.log(`[db:ensure] database already exists: ${databaseName}`);
      return;
    }

    try {
      await client.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
      console.log(`[db:ensure] database created: ${databaseName}`);
    } catch (error) {
      if ((error as { code?: string }).code === '42P04') {
        console.log(`[db:ensure] database already exists: ${databaseName}`);
        return;
      }
      throw error;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[db:ensure] failed:', error);
  process.exitCode = 1;
});
