import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import type { Env } from '../config/env.schema.js';
import { createDb, createPool, type Database } from './client.js';

export const DB = Symbol('DB');
export const DB_POOL = Symbol('DB_POOL');

@Global()
@Module({
  providers: [
    {
      provide: DB_POOL,
      useFactory: (cfg: ConfigService<Env, true>): Pool =>
        createPool(cfg.get('DATABASE_URL', { infer: true })),
      inject: [ConfigService],
    },
    {
      provide: DB,
      useFactory: (pool: Pool): Database => createDb(pool),
      inject: [DB_POOL],
    },
  ],
  exports: [DB, DB_POOL],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
