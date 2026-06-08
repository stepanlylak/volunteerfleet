import { describe, expect, it } from 'vitest';
import { buildExpenseAggregations } from './reports.service.js';

describe('buildExpenseAggregations', () => {
  it('returns exact UAH totals across currencies and categories', () => {
    const result = buildExpenseAggregations([
      {
        amount: '100.00',
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
        amount: '2000.00',
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
        amount: '10.00',
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

    expect(result.totalUah).toBe(6571.5);
    expect(result.byCurrency).toEqual([
      { currency: 'EUR', totalInCurrency: 10, totalUah: 448.5 },
      { currency: 'UAH', totalInCurrency: 2000, totalUah: 2000 },
      { currency: 'USD', totalInCurrency: 100, totalUah: 4123 },
    ]);
    expect(result.byCategory).toEqual([
      { category: 'Ремонт', totalUah: 4571.5 },
      { category: 'Паливо', totalUah: 2000 },
    ]);
    expect(result.byVehicle).toEqual([
      {
        vehicle: {
          id: '11111111-1111-1111-1111-111111111111',
          identifier: 'VHC-001',
          brand: 'Toyota',
          model: 'Hilux',
        },
        totalUah: 4571.5,
      },
      {
        vehicle: {
          id: '22222222-2222-2222-2222-222222222222',
          identifier: 'VHC-002',
          brand: 'Nissan',
          model: 'Navara',
        },
        totalUah: 2000,
      },
    ]);
  });

  it('does not count soft-deleted expenses', () => {
    const result = buildExpenseAggregations([
      {
        amount: '100.00',
        currency: 'USD',
        rate: '41.230000',
        deletedAt: null,
        category: { name: 'Ремонт' },
      },
      {
        amount: '900.00',
        currency: 'USD',
        rate: '41.230000',
        deletedAt: new Date('2026-05-22T10:00:00.000Z'),
        category: { name: 'Ремонт' },
      },
    ]);

    expect(result.totalUah).toBe(4123);
    expect(result.byCurrency).toEqual([{ currency: 'USD', totalInCurrency: 100, totalUah: 4123 }]);
    expect(result.byCategory).toEqual([{ category: 'Ремонт', totalUah: 4123 }]);
  });

  it('uses fallback rate resolver for legacy foreign-currency expenses', () => {
    const result = buildExpenseAggregations(
      [
        {
          amount: '100.00',
          currency: 'USD',
          rate: '1.000000',
          deletedAt: null,
          category: { name: 'Купівля' },
        },
      ],
      () => 41.5,
    );

    expect(result.totalUah).toBe(4150);
    expect(result.byCurrency).toEqual([{ currency: 'USD', totalInCurrency: 100, totalUah: 4150 }]);
    expect(result.byCategory).toEqual([{ category: 'Купівля', totalUah: 4150 }]);
  });
});
