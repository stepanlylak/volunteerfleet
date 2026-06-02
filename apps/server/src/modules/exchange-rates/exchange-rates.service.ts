import { Injectable, OnModuleInit, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { z } from 'zod';
import { BASE_CURRENCY, type Currency } from '@volunteerfleet/shared';
import type { Env } from '../../config/env.schema.js';

const ratesFileSchema = z.record(z.string(), z.record(z.string(), z.number()));

function formatYearMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

@Injectable()
export class ExchangeRatesService implements OnModuleInit {
  private rates: Map<string, Partial<Record<Currency, number>>> = new Map();

  constructor(private readonly cfg: ConfigService<Env, true>) {}

  async onModuleInit(): Promise<void> {
    const filePath = this.cfg.get('EXCHANGE_RATES_FILE', { infer: true });
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = ratesFileSchema.parse(JSON.parse(raw));
    for (const [k, v] of Object.entries(data)) {
      this.rates.set(k, v as Partial<Record<Currency, number>>);
    }
  }

  getRate(date: Date, currency: Currency): number {
    if (currency === BASE_CURRENCY) return 1;
    const key = formatYearMonth(date);
    const direct = this.rates.get(key)?.[currency];
    if (direct !== undefined) return direct;
    const fallback = this.findClosestPast(key, currency);
    if (fallback === null) {
      throw new UnprocessableEntityException(`NO_RATE_FOR_${currency}_${key}`);
    }
    return fallback;
  }

  private findClosestPast(key: string, currency: Currency): number | null {
    const sortedKeys = Array.from(this.rates.keys()).sort();
    let result: number | null = null;
    for (const k of sortedKeys) {
      if (k >= key) break;
      const val = this.rates.get(k)?.[currency];
      if (val !== undefined) result = val;
    }
    return result;
  }
}
