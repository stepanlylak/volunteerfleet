import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'stream';
import type { Env } from '../config/env.schema.js';
import { S3_CLIENT } from './storage.tokens.js';

@Injectable()
export class StorageService {
  private readonly bucket: string;

  constructor(
    @Inject(S3_CLIENT) private readonly s3: S3Client,
    cfg: ConfigService<Env, true>,
  ) {
    this.bucket = cfg.get('S3_BUCKET', { infer: true });
  }

  async putObject(
    stream: Readable,
    opts: { key: string; mime: string; size: number },
  ): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: opts.key,
        Body: stream,
        ContentType: opts.mime,
        ContentLength: opts.size,
      }),
    );
  }

  async getPresignedDownloadUrl(key: string, ttlSeconds = 300): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
      { expiresIn: ttlSeconds },
    );
  }

  async headObject(key: string): Promise<{ size: number; mime: string } | null> {
    try {
      const result = await this.s3.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return {
        size: result.ContentLength ?? 0,
        mime: result.ContentType ?? 'application/octet-stream',
      };
    } catch (error) {
      if (error instanceof NotFound) return null;
      throw error;
    }
  }
}
