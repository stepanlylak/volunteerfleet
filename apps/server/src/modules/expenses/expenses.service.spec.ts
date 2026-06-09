import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExpenseResponse } from '@volunteerfleet/shared';
import { ExpensesService } from './expenses.service.js';

const userId = '11111111-1111-1111-1111-111111111111';
const orgId = '66666666-6666-6666-6666-666666666666';

function makeResponse(overrides: Partial<ExpenseResponse> = {}): ExpenseResponse {
  return {
    id: '22222222-2222-2222-2222-222222222222',
    vehicleId: '33333333-3333-3333-3333-333333333333',
    vehicle: {
      id: '33333333-3333-3333-3333-333333333333',
      identifier: 'VHC-001',
      brand: 'Toyota',
      model: 'Hilux',
    },
    expenseDate: '2026-05-21',
    amountMinor: 10_000,
    currency: 'USD',
    rate: 41.23,
    rateSource: 'default',
    categoryId: '44444444-4444-4444-4444-444444444444',
    category: {
      id: '44444444-4444-4444-4444-444444444444',
      name: 'Ремонт',
      sortOrder: 10,
      createdAt: '2026-05-21T10:00:00.000Z',
      updatedAt: '2026-05-21T10:00:00.000Z',
    },
    description: null,
    createdBy: { id: userId, fullName: 'Volunteer' },
    updatedBy: { id: userId, fullName: 'Volunteer' },
    createdAt: '2026-05-21T10:00:00.000Z',
    updatedAt: '2026-05-21T10:00:00.000Z',
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  };
}

describe('ExpensesService', () => {
  let db: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    query: {
      expenses: {
        findFirst: ReturnType<typeof vi.fn>;
        findMany: ReturnType<typeof vi.fn>;
      };
      vehicles: {
        findFirst: ReturnType<typeof vi.fn>;
      };
    };
  };
  let exchangeRates: { getRate: ReturnType<typeof vi.fn> };
  let svc: ExpensesService;
  let insertedValues: Record<string, unknown> | undefined;

  beforeEach(() => {
    db = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      query: {
        expenses: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        vehicles: {
          findFirst: vi.fn().mockResolvedValue({ id: '33333333-3333-3333-3333-333333333333' }),
        },
      },
    };
    exchangeRates = { getRate: vi.fn().mockReturnValue(41.23) };
    svc = new ExpensesService(db as never, exchangeRates as never);
    insertedValues = undefined;
  });

  function mockInsert(): void {
    db.insert.mockReturnValue({
      values: vi.fn((values) => {
        insertedValues = values;
        return {
          returning: vi.fn().mockResolvedValue([{ id: '22222222-2222-2222-2222-222222222222' }]),
        };
      }),
    });
    vi.spyOn(svc, 'findById').mockResolvedValue(makeResponse());
  }

  it('uses default exchange rate when creating non-UAH expense without rate', async () => {
    mockInsert();

    await svc.create(
      {
        vehicleId: '33333333-3333-3333-3333-333333333333',
        expenseDate: '2026-05-21',
        amountMinor: 10_000,
        currency: 'USD',
        categoryId: '44444444-4444-4444-4444-444444444444',
      },
      userId,
      orgId,
    );

    expect(exchangeRates.getRate).toHaveBeenCalledWith(new Date('2026-05-21'), 'USD');
    expect(insertedValues).toMatchObject({ rate: '41.230000', rateSource: 'default' });
  });

  it('keeps manual rate on create', async () => {
    mockInsert();

    await svc.create(
      {
        vehicleId: '33333333-3333-3333-3333-333333333333',
        expenseDate: '2026-05-21',
        amountMinor: 10_000,
        currency: 'EUR',
        rate: 44.99,
        categoryId: '44444444-4444-4444-4444-444444444444',
      },
      userId,
      orgId,
    );

    expect(exchangeRates.getRate).not.toHaveBeenCalled();
    expect(insertedValues).toMatchObject({ rate: '44.990000', rateSource: 'manual' });
  });

  it('forces UAH rate to 1 on create', async () => {
    mockInsert();

    await svc.create(
      {
        vehicleId: '33333333-3333-3333-3333-333333333333',
        expenseDate: '2026-05-21',
        amountMinor: 10_000,
        currency: 'UAH',
        rate: 99,
        categoryId: '44444444-4444-4444-4444-444444444444',
      },
      userId,
      orgId,
    );

    expect(insertedValues).toMatchObject({ rate: '1.000000', rateSource: 'default' });
  });

  it('soft deletes existing expense', async () => {
    db.query.expenses.findFirst.mockResolvedValue({ id: 'expense-id' });
    db.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await expect(svc.softDelete('expense-id', userId, orgId)).resolves.toBeUndefined();
    expect(db.update).toHaveBeenCalled();
  });

  it('throws on soft delete when expense is missing', async () => {
    db.query.expenses.findFirst.mockResolvedValue(undefined);
    await expect(svc.softDelete('missing', userId, orgId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects includeDeleted for non-admin list and supports filtered list for admin', async () => {
    await expect(
      svc.list({ page: 1, pageSize: 20, includeDeleted: true }, 'volunteer', orgId),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const limitMock = vi.fn().mockReturnValue({
      offset: vi.fn().mockResolvedValue([]),
    });
    db.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: limitMock,
              }),
            }),
          }),
        }),
      });
    db.query.expenses.findMany.mockResolvedValue([]);

    await svc.list(
      {
        page: 2,
        pageSize: 10,
        vehicleId: '33333333-3333-3333-3333-333333333333',
        categoryId: '44444444-4444-4444-4444-444444444444',
        dateFrom: '2026-05-01',
        dateTo: '2026-05-31',
        currency: 'USD',
        includeDeleted: false,
      },
      'coordinator',
      orgId,
    );

    expect(limitMock).toHaveBeenCalledWith(10);
  });
});
