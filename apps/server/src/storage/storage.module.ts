import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import type { Env } from '../config/env.schema.js';
import { StorageService } from './storage.service.js';
import { S3_CLIENT } from './storage.tokens.js';

export { S3_CLIENT };

@Module({
  providers: [
    {
      provide: S3_CLIENT,
      useFactory: (cfg: ConfigService<Env, true>): S3Client =>
        new S3Client({
          endpoint: cfg.get('S3_ENDPOINT', { infer: true }),
          region: cfg.get('S3_REGION', { infer: true }),
          credentials: {
            accessKeyId: cfg.get('S3_ACCESS_KEY', { infer: true }),
            secretAccessKey: cfg.get('S3_SECRET_KEY', { infer: true }),
          },
          forcePathStyle: true,
        }),
      inject: [ConfigService],
    },
    StorageService,
  ],
  exports: [S3_CLIENT, StorageService],
})
export class StorageModule {}
