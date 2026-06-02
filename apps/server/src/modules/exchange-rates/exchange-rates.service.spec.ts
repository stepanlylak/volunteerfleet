import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';

vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn().mockResolvedValue(
      JSON.stringify({
        '2023-01': { USD: 36.5686, EUR: 39.1142 },
        '2023-02': { USD: 36.5686, EUR: 39.2548 },
        '2024-05': { USD: 39.475, EUR: 42.69 },
        '2026-05': { USD: 41.23, EUR: 44.85 },
      }),
    ),
  },
}));

describe('ExchangeRatesService', () => {
  let svc: import('./exchange-rates.service.js').ExchangeRatesService;

  beforeEach(async () => {
    const { ExchangeRatesService } = await import('./exchange-rates.service.js');
    const cfg = {
      get: vi.fn().mockReturnValue('/fake/path/exchange-rates.json'),
    } as unknown as ConfigService<Env, true>;
    svc = new ExchangeRatesService(cfg);
    await svc.onModuleInit();
  });

  it('returns 1 for UAH regardless of date', () => {
    expect(svc.getRate(new Date('2025-03-15'), 'UAH')).toBe(1);
  });

  it('returns direct rate when month exists', () => {
    expect(svc.getRate(new Date('2024-05-15'), 'USD')).toBe(39.475);
  });

  it('falls back to nearest past month when exact not found', () => {
    expect(svc.getRate(new Date('2024-06-15'), 'USD')).toBe(39.475);
  });

  it('throws when no past rate available', () => {
    expect(() => svc.getRate(new Date('2010-01-01'), 'USD')).toThrow(/NO_RATE/);
  });

  it('returns exact rate for EUR', () => {
    expect(svc.getRate(new Date('2026-05-01'), 'EUR')).toBe(44.85);
  });
});
