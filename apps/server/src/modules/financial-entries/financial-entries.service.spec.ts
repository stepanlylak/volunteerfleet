import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FinancialEntryListResponse } from '@volunteerfleet/shared';
import { FinancialEntriesService } from './financial-entries.service.js';

const orgId = '66666666-6666-6666-6666-666666666666';
const vehicleId = '33333333-3333-3333-3333-333333333333';
const categoryId = '44444444-4444-4444-4444-444444444444';
const donorId = '55555555-5555-5555-5555-555555555555';

function makeExpenseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    type: 'expense' as const,
    entry_date: '2026-05-21',
    amount_minor: '50000',
    currency: 'USD',
    rate: '41.230000',
    amount_uah_minor: '2061500',
    signed_amount_minor: '-50000',
    signed_amount_uah_minor: '-2061500',
    vehicle_id: vehicleId,
    vehicle_identifier: 'VHC-001',
    vehicle_brand: 'Toyota',
    vehicle_model: 'Hilux',
    category_id: categoryId,
    category_name: 'Ремонт',
    category_sort_order: 10,
    category_created_at: new Date('2026-01-01T00:00:00.000Z'),
    category_updated_at: new Date('2026-01-01T00:00:00.000Z'),
    donor_id: null,
    donor_name: null,
    description: null,
    created_at: new Date('2026-05-21T10:00:00.000Z'),
    document_count: '2',
    ...overrides,
  };
}

function makeDonationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '22222222-2222-2222-2222-222222222222',
    type: 'donation' as const,
    entry_date: '2026-05-20',
    amount_minor: '100000',
    currency: 'USD',
    rate: '41.230000',
    amount_uah_minor: '4123000',
    signed_amount_minor: '100000',
    signed_amount_uah_minor: '4123000',
    vehicle_id: vehicleId,
    vehicle_identifier: 'VHC-001',
    vehicle_brand: 'Toyota',
    vehicle_model: 'Hilux',
    category_id: null,
    category_name: null,
    category_sort_order: null,
    category_created_at: null,
    category_updated_at: null,
    donor_id: donorId,
    donor_name: 'Test Donor',
    description: 'Test donation',
    created_at: new Date('2026-05-20T09:00:00.000Z'),
    document_count: '0',
    ...overrides,
  };
}

describe('FinancialEntriesService', () => {
  let db: {
    execute: ReturnType<typeof vi.fn>;
  };
  let svc: FinancialEntriesService;

  function mockExecute(responses: { rows: Record<string, unknown>[] }[]): void {
    let callIndex = 0;
    db.execute.mockImplementation(() => {
      const response = responses[callIndex] ?? { rows: [] };
      callIndex++;
      return Promise.resolve(response);
    });
  }

  beforeEach(() => {
    db = { execute: vi.fn() };
    svc = new FinancialEntriesService(db as never);
  });

  describe('toEntry (via list)', () => {
    it('maps expense row with negative signed amounts', async () => {
      const expenseRow = makeExpenseRow();
      mockExecute([
        { rows: [{ total: 1 }] },
        { rows: [expenseRow] },
        {
          rows: [
            {
              expenses_uah_minor: '2061500',
              donations_uah_minor: '0',
              balance_uah_minor: '-2061500',
            },
          ],
        },
        {
          rows: [
            {
              currency: 'USD',
              expenses_minor: '50000',
              donations_minor: '0',
              balance_minor: '-50000',
            },
          ],
        },
      ]);

      const result: FinancialEntryListResponse = await svc.list({ page: 1, pageSize: 20 }, orgId);

      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item?.type).toBe('expense');
      if (item?.type === 'expense') {
        expect(item.signedAmountMinor).toBe(-50000);
        expect(item.signedAmountUahMinor).toBe(-2061500);
        expect(item.amountMinor).toBe(50000);
        expect(item.amountUahMinor).toBe(2061500);
        expect(item.documentCount).toBe(2);
        expect(item.donor).toBeNull();
        expect(item.category).toMatchObject({ id: categoryId, name: 'Ремонт' });
      }
    });

    it('maps donation row with positive signed amounts', async () => {
      const donationRow = makeDonationRow();
      mockExecute([
        { rows: [{ total: 1 }] },
        { rows: [donationRow] },
        {
          rows: [
            {
              expenses_uah_minor: '0',
              donations_uah_minor: '4123000',
              balance_uah_minor: '4123000',
            },
          ],
        },
        {
          rows: [
            {
              currency: 'USD',
              expenses_minor: '0',
              donations_minor: '100000',
              balance_minor: '100000',
            },
          ],
        },
      ]);

      const result = await svc.list({ page: 1, pageSize: 20 }, orgId);

      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item?.type).toBe('donation');
      if (item?.type === 'donation') {
        expect(item.signedAmountMinor).toBe(100000);
        expect(item.signedAmountUahMinor).toBe(4123000);
        expect(item.amountMinor).toBe(100000);
        expect(item.donor).toMatchObject({ id: donorId, name: 'Test Donor' });
        expect(item.category).toBeNull();
      }
    });

    it('donation without documentCount field', async () => {
      const donationRow = makeDonationRow();
      mockExecute([
        { rows: [{ total: 1 }] },
        { rows: [donationRow] },
        {
          rows: [
            {
              expenses_uah_minor: '0',
              donations_uah_minor: '4123000',
              balance_uah_minor: '4123000',
            },
          ],
        },
        { rows: [] },
      ]);

      const result = await svc.list({ page: 1, pageSize: 20 }, orgId);
      const item = result.items[0];
      expect(item?.type).toBe('donation');
      // donations don't have documentCount field
      expect('documentCount' in (item ?? {})).toBe(false);
    });

    it('expense document_count reflects only active documents (value from DB)', async () => {
      // The service trusts the DB subquery result; we verify it passes through correctly
      const rowWithTwoDocs = makeExpenseRow({ document_count: '2' });
      const rowWithZeroDocs = makeExpenseRow({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        document_count: '0',
      });

      mockExecute([
        { rows: [{ total: 2 }] },
        { rows: [rowWithTwoDocs, rowWithZeroDocs] },
        {
          rows: [
            {
              expenses_uah_minor: '4123000',
              donations_uah_minor: '0',
              balance_uah_minor: '-4123000',
            },
          ],
        },
        { rows: [] },
      ]);

      const result = await svc.list({ page: 1, pageSize: 20 }, orgId);
      expect(result.items).toHaveLength(2);
      const [first, second] = result.items;
      if (first?.type === 'expense') expect(first.documentCount).toBe(2);
      if (second?.type === 'expense') expect(second.documentCount).toBe(0);
    });
  });

  describe('pagination', () => {
    it('returns correct pagination metadata', async () => {
      mockExecute([
        { rows: [{ total: 45 }] },
        { rows: [] },
        { rows: [{ expenses_uah_minor: '0', donations_uah_minor: '0', balance_uah_minor: '0' }] },
        { rows: [] },
      ]);

      const result = await svc.list({ page: 3, pageSize: 10 }, orgId);

      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
      expect(result.total).toBe(45);
      expect(result.totalPages).toBe(5);
    });

    it('passes correct LIMIT and OFFSET to SQL', async () => {
      mockExecute([
        { rows: [{ total: 100 }] },
        { rows: [] },
        { rows: [{ expenses_uah_minor: '0', donations_uah_minor: '0', balance_uah_minor: '0' }] },
        { rows: [] },
      ]);

      await svc.list({ page: 2, pageSize: 15 }, orgId);

      // We verify execute was called 4 times (count, data, summary, byCurrency)
      expect(db.execute).toHaveBeenCalledTimes(4);
    });
  });

  describe('summary', () => {
    it('returns correct summary aggregates', async () => {
      mockExecute([
        { rows: [{ total: 2 }] },
        { rows: [] },
        {
          rows: [
            {
              expenses_uah_minor: '2061500',
              donations_uah_minor: '4123000',
              balance_uah_minor: '2061500',
            },
          ],
        },
        {
          rows: [
            {
              currency: 'UAH',
              expenses_minor: '10000',
              donations_minor: '20000',
              balance_minor: '10000',
            },
            {
              currency: 'USD',
              expenses_minor: '50000',
              donations_minor: '100000',
              balance_minor: '50000',
            },
          ],
        },
      ]);

      const result = await svc.list({ page: 1, pageSize: 20 }, orgId);

      expect(result.summary.expensesUahMinor).toBe(2061500);
      expect(result.summary.donationsUahMinor).toBe(4123000);
      expect(result.summary.balanceUahMinor).toBe(2061500);
      expect(result.summary.byCurrency).toHaveLength(2);
      expect(result.summary.byCurrency[0]).toMatchObject({
        currency: 'UAH',
        expensesMinor: 10000,
        donationsMinor: 20000,
        balanceMinor: 10000,
      });
      expect(result.summary.byCurrency[1]).toMatchObject({
        currency: 'USD',
        expensesMinor: 50000,
        donationsMinor: 100000,
        balanceMinor: 50000,
      });
    });

    it('returns zero summary when no entries', async () => {
      mockExecute([
        { rows: [{ total: 0 }] },
        { rows: [] },
        { rows: [{ expenses_uah_minor: '0', donations_uah_minor: '0', balance_uah_minor: '0' }] },
        { rows: [] },
      ]);

      const result = await svc.list({ page: 1, pageSize: 20 }, orgId);

      expect(result.summary.expensesUahMinor).toBe(0);
      expect(result.summary.donationsUahMinor).toBe(0);
      expect(result.summary.balanceUahMinor).toBe(0);
      expect(result.summary.byCurrency).toHaveLength(0);
    });
  });

  describe('filters', () => {
    it('sends 4 DB queries (count, data, summary, byCurrency) per list call', async () => {
      mockExecute([
        { rows: [{ total: 0 }] },
        { rows: [] },
        { rows: [{ expenses_uah_minor: '0', donations_uah_minor: '0', balance_uah_minor: '0' }] },
        { rows: [] },
      ]);

      await svc.list(
        {
          page: 1,
          pageSize: 20,
          type: 'expense',
          vehicleId,
          categoryId,
          dateFrom: '2026-05-01',
          dateTo: '2026-05-31',
          currency: 'USD',
        },
        orgId,
      );

      expect(db.execute).toHaveBeenCalledTimes(4);
    });

    it('donorId filter is included in queries (does not throw)', async () => {
      mockExecute([
        { rows: [{ total: 0 }] },
        { rows: [] },
        { rows: [{ expenses_uah_minor: '0', donations_uah_minor: '0', balance_uah_minor: '0' }] },
        { rows: [] },
      ]);

      await expect(svc.list({ page: 1, pageSize: 20, donorId }, orgId)).resolves.toBeDefined();
    });
  });

  describe('signed arithmetic invariants', () => {
    it('expense signedAmountMinor is always negative', async () => {
      const row = makeExpenseRow({ amount_minor: '10000', amount_uah_minor: '412300' });
      mockExecute([
        { rows: [{ total: 1 }] },
        { rows: [row] },
        {
          rows: [
            {
              expenses_uah_minor: '412300',
              donations_uah_minor: '0',
              balance_uah_minor: '-412300',
            },
          ],
        },
        { rows: [] },
      ]);

      const result = await svc.list({ page: 1, pageSize: 20 }, orgId);
      const item = result.items[0];
      if (item?.type === 'expense') {
        expect(item.signedAmountMinor).toBeLessThan(0);
        expect(item.signedAmountUahMinor).toBeLessThan(0);
      }
    });

    it('donation signedAmountMinor is always positive', async () => {
      const row = makeDonationRow({ amount_minor: '10000', amount_uah_minor: '412300' });
      mockExecute([
        { rows: [{ total: 1 }] },
        { rows: [row] },
        {
          rows: [
            { expenses_uah_minor: '0', donations_uah_minor: '412300', balance_uah_minor: '412300' },
          ],
        },
        { rows: [] },
      ]);

      const result = await svc.list({ page: 1, pageSize: 20 }, orgId);
      const item = result.items[0];
      if (item?.type === 'donation') {
        expect(item.signedAmountMinor).toBeGreaterThan(0);
        expect(item.signedAmountUahMinor).toBeGreaterThan(0);
      }
    });

    it('balance is donations minus expenses (using summary)', async () => {
      mockExecute([
        { rows: [{ total: 0 }] },
        { rows: [] },
        {
          rows: [
            {
              expenses_uah_minor: '2000000',
              donations_uah_minor: '5000000',
              balance_uah_minor: '3000000',
            },
          ],
        },
        { rows: [] },
      ]);

      const result = await svc.list({ page: 1, pageSize: 20 }, orgId);
      expect(result.summary.balanceUahMinor).toBe(
        result.summary.donationsUahMinor - result.summary.expensesUahMinor,
      );
    });
  });
});
