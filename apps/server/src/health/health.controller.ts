import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HeadBucketCommand, type S3Client } from '@aws-sdk/client-s3';
import { sql } from 'drizzle-orm';
import { Public } from '../common/decorators/public.decorator.js';
import { DB } from '../db/db.module.js';
import type { Database } from '../db/client.js';
import type { Env } from '../config/env.schema.js';
import { S3_CLIENT } from '../storage/storage.tokens.js';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(S3_CLIENT) private readonly s3: S3Client,
    private readonly cfg: ConfigService<Env, true>,
  ) {}

  @Get()
  @Public()
  async check() {
    let dbStatus: 'ok' | 'error' = 'ok';
    try {
      await this.db.execute(sql`SELECT 1`);
    } catch {
      dbStatus = 'error';
    }

    let s3Status: 'ok' | 'error' = 'ok';
    try {
      await this.s3.send(
        new HeadBucketCommand({
          Bucket: this.cfg.get('S3_BUCKET', { infer: true }),
        }),
      );
    } catch {
      s3Status = 'error';
    }

    return {
      status: 'ok',
      uptime: process.uptime(),
      db: dbStatus,
      s3: s3Status,
    };
  }
}
