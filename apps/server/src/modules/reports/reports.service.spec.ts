import { describe, expect, it } from 'vitest';
import { buildExpenseAggregations } from './reports.service.js';

describe('buildExpenseAggregations', () => {
  it('returns exact UAH totals across currencies and categories', () => {
    const result = buildExpenseAggregations([
      {
        amountMinor: 10_000,
        currency: 'USD',
        rate: '41.230000',
        deletedAt: null,
        category: { name: 'Ремонт' },
        vehicle: {
          id: '11111111-1111-1111-1111-111111111111',
          identifier: 'VHC-001',
          brand: 'Toyota',
          model: 'Hilux',
        },
      },
      {
        amountMinor: 200_000,
        currency: 'UAH',
        rate: '1.000000',
        deletedAt: null,
        category: { name: 'Паливо' },
        vehicle: {
          id: '22222222-2222-2222-2222-222222222222',
          identifier: 'VHC-002',
          brand: 'Nissan',
          model: 'Navara',
        },
      },
      {
        amountMinor: 1_000,
        currency: 'EUR',
        rate: '44.850000',
        deletedAt: null,
        category: { name: 'Ремонт' },
        vehicle: {
          id: '11111111-1111-1111-1111-111111111111',
          identifier: 'VHC-001',
          brand: 'Toyota',
          model: 'Hilux',
        },
      },
    ]);

    expect(result.totalUahMinor).toBe(657_150);
    expect(result.byCurrency).toEqual([
      { currency: 'EUR', totalInCurrencyMinor: 1_000, totalUahMinor: 44_850 },
      { currency: 'UAH', totalInCurrencyMinor: 200_000, totalUahMinor: 200_000 },
      { currency: 'USD', totalInCurrencyMinor: 10_000, totalUahMinor: 412_300 },
    ]);
    expect(result.byCategory).toEqual([
      { category: 'Ремонт', totalUahMinor: 457_150 },
      { category: 'Паливо', totalUahMinor: 200_000 },
    ]);
    expect(result.byVehicle).toEqual([
      {
        vehicle: {
          id: '11111111-1111-1111-1111-111111111111',
          identifier: 'VHC-001',
          brand: 'Toyota',
          model: 'Hilux',
        },
        totalUahMinor: 457_150,
      },
      {
        vehicle: {
          id: '22222222-2222-2222-2222-222222222222',
          identifier: 'VHC-002',
          brand: 'Nissan',
          model: 'Navara',
        },
        totalUahMinor: 200_000,
      },
    ]);
  });

  it('does not count soft-deleted expenses', () => {
    const result = buildExpenseAggregations([
      {
        amountMinor: 10_000,
        currency: 'USD',
        rate: '41.230000',
        deletedAt: null,
        category: { name: 'Ремонт' },
      },
      {
        amountMinor: 90_000,
        currency: 'USD',
        rate: '41.230000',
        deletedAt: new Date('2026-05-22T10:00:00.000Z'),
        category: { name: 'Ремонт' },
      },
    ]);

    expect(result.totalUahMinor).toBe(412_300);
    expect(result.byCurrency).toEqual([
      { currency: 'USD', totalInCurrencyMinor: 10_000, totalUahMinor: 412_300 },
    ]);
    expect(result.byCategory).toEqual([{ category: 'Ремонт', totalUahMinor: 412_300 }]);
  });

  it('uses fallback rate resolver for legacy foreign-currency expenses', () => {
    const result = buildExpenseAggregations(
      [
        {
          amountMinor: 10_000,
          currency: 'USD',
          rate: '1.000000',
          deletedAt: null,
          category: { name: 'Купівля' },
        },
      ],
      () => 41.5,
    );

    expect(result.totalUahMinor).toBe(415_000);
    expect(result.byCurrency).toEqual([
      { currency: 'USD', totalInCurrencyMinor: 10_000, totalUahMinor: 415_000 },
    ]);
    expect(result.byCategory).toEqual([{ category: 'Купівля', totalUahMinor: 415_000 }]);
  });

  it('rounds converted UAH values per row without an off-by-100 error', () => {
    const result = buildExpenseAggregations([
      {
        amountMinor: 101,
        currency: 'USD',
        rate: '41.234567',
        deletedAt: null,
      },
      {
        amountMinor: 101,
        currency: 'USD',
        rate: '41.234567',
        deletedAt: null,
      },
    ]);

    expect(result.totalUahMinor).toBe(8_330);
    expect(result.byCurrency[0]?.totalUahMinor).toBe(8_330);
  });
});
