import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DonationResponse } from '@volunteerfleet/shared';
import { DonationsService } from './donations.service.js';

const userId = '11111111-1111-1111-1111-111111111111';
const orgId = '66666666-6666-6666-6666-666666666666';
const donorId = '55555555-5555-5555-5555-555555555555';
const vehicleId = '33333333-3333-3333-3333-333333333333';

function makeResponse(overrides: Partial<DonationResponse> = {}): DonationResponse {
  return {
    id: '22222222-2222-2222-2222-222222222222',
    donorId: donorId,
    donor: {
      id: donorId,
      name: 'Test Donor',
    },
    vehicleId: vehicleId,
    vehicle: {
      id: vehicleId,
      identifier: 'VHC-001',
      brand: 'Toyota',
      model: 'Hilux',
    },
    categoryId: '44444444-4444-4444-4444-444444444444',
    category: {
      id: '44444444-4444-4444-4444-444444444444',
      name: 'Fuel',
      sortOrder: 10,
      createdAt: '2026-05-21T10:00:00.000Z',
      updatedAt: '2026-05-21T10:00:00.000Z',
    },
    donationDate: '2026-05-21',
    amountMinor: 10_000,
    currency: 'USD',
    rate: 41.23,
    rateSource: 'default',
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

describe('DonationsService', () => {
  let db: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
    query: {
      donations: {
        findFirst: ReturnType<typeof vi.fn>;
        findMany: ReturnType<typeof vi.fn>;
      };
      vehicles: {
        findFirst: ReturnType<typeof vi.fn>;
      };
      donors: {
        findFirst: ReturnType<typeof vi.fn>;
      };
      organizationDonors: {
        findFirst: ReturnType<typeof vi.fn>;
      };
      financialCategories: {
        findFirst: ReturnType<typeof vi.fn>;
      };
    };
  };
  let exchangeRates: { getRate: ReturnType<typeof vi.fn> };
  let svc: DonationsService;
  let insertedValues: Record<string, unknown> | undefined;

  beforeEach(() => {
    db = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      transaction: vi.fn(),
      query: {
        donations: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        vehicles: {
          findFirst: vi.fn().mockResolvedValue({ id: vehicleId }),
        },
        donors: {
          findFirst: vi.fn().mockResolvedValue({ id: donorId, name: 'Test Donor' }),
        },
        organizationDonors: {
          findFirst: vi.fn().mockResolvedValue({ organizationId: orgId, donorId, isActive: true }),
        },
        financialCategories: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ id: '44444444-4444-4444-4444-444444444444', isActive: true }),
        },
      },
    };
    exchangeRates = { getRate: vi.fn().mockReturnValue(41.23) };
    svc = new DonationsService(db as never, exchangeRates as never);
    insertedValues = undefined;
  });

  function mockTransaction(): void {
    const mockTx = {
      insert: vi.fn().mockImplementation((table) => {
        if (table === 'donors' || table?.$name === 'donors') {
          return {
            values: vi.fn(() => {
              return {
                returning: vi.fn().mockResolvedValue([{ id: donorId }]),
              };
            }),
          };
        }
        return {
          values: vi.fn(() => {
            return {
              returning: vi
                .fn()
                .mockResolvedValue([{ id: '22222222-2222-2222-2222-222222222222' }]),
            };
          }),
        };
      }),
      query: {
        donors: {
          findFirst: vi.fn().mockResolvedValue({ id: donorId, name: 'Test Donor' }),
        },
        organizationDonors: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    };

    db.transaction.mockImplementation(async (fn) => {
      return fn(mockTx);
    });

    vi.spyOn(svc, 'findById').mockResolvedValue(makeResponse());
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function _mockInsert(): void {
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

  function mockUpdate(): void {
    db.update.mockReturnValue({
      set: vi.fn((values) => {
        insertedValues = values;
        return {
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: '22222222-2222-2222-2222-222222222222' }]),
          }),
        };
      }),
    });
    vi.spyOn(svc, 'findById').mockResolvedValue(makeResponse());
  }

  describe('create', () => {
    it('uses default exchange rate when creating non-UAH donation without rate', async () => {
      mockTransaction();

      await svc.create(
        {
          vehicleId,
          donationDate: '2026-05-21',
          amountMinor: 10_000,
          currency: 'USD',
          donorId,
        },
        userId,
        orgId,
      );

      expect(exchangeRates.getRate).toHaveBeenCalledWith(new Date('2026-05-21'), 'USD');
    });

    it('keeps manual rate on create', async () => {
      mockTransaction();

      await svc.create(
        {
          vehicleId,
          donationDate: '2026-05-21',
          amountMinor: 10_000,
          currency: 'EUR',
          rate: 44.99,
          donorId,
        },
        userId,
        orgId,
      );

      expect(exchangeRates.getRate).not.toHaveBeenCalled();
    });

    it('forces UAH rate to 1 on create', async () => {
      mockTransaction();

      await svc.create(
        {
          vehicleId,
          donationDate: '2026-05-21',
          amountMinor: 10_000,
          currency: 'UAH',
          rate: 99,
          donorId,
        },
        userId,
        orgId,
      );

      expect(exchangeRates.getRate).not.toHaveBeenCalled();
    });

    it('throws 404 when vehicle does not belong to the organization on create', async () => {
      db.query.vehicles.findFirst.mockResolvedValue(undefined);

      await expect(
        svc.create(
          {
            vehicleId,
            donationDate: '2026-05-21',
            amountMinor: 10_000,
            currency: 'UAH',
            donorId,
          },
          userId,
          orgId,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates donation with existing donorId', async () => {
      mockTransaction();

      await svc.create(
        {
          vehicleId,
          donationDate: '2026-05-21',
          amountMinor: 10_000,
          currency: 'UAH',
          donorId,
        },
        userId,
        orgId,
      );

      expect(db.transaction).toHaveBeenCalled();
    });

    it('creates donation with newDonorName', async () => {
      mockTransaction();

      await svc.create(
        {
          vehicleId,
          donationDate: '2026-05-21',
          amountMinor: 10_000,
          currency: 'UAH',
          newDonorName: 'New Donor',
        },
        userId,
        orgId,
      );

      expect(db.transaction).toHaveBeenCalled();
    });

    it('throws 404 when category does not belong to the organization on create', async () => {
      db.query.financialCategories.findFirst.mockResolvedValue(undefined);

      await expect(
        svc.create(
          {
            vehicleId,
            donationDate: '2026-05-21',
            amountMinor: 10_000,
            currency: 'UAH',
            donorId,
            categoryId: '44444444-4444-4444-4444-444444444444',
          },
          userId,
          orgId,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates organization donor link when donor exists but not linked', async () => {
      db.query.organizationDonors.findFirst.mockResolvedValue(null);
      mockTransaction();

      await svc.create(
        {
          vehicleId,
          donationDate: '2026-05-21',
          amountMinor: 10_000,
          currency: 'UAH',
          donorId,
        },
        userId,
        orgId,
      );

      expect(db.transaction).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('does not recalculate rate on update', async () => {
      db.query.donations.findFirst.mockResolvedValue({
        id: '22222222-2222-2222-2222-222222222222',
        organizationId: orgId,
        donorId,
        rate: '41.230000',
        rateSource: 'default',
        currency: 'USD',
      });
      mockUpdate();

      await svc.update(
        '22222222-2222-2222-2222-222222222222',
        {
          amountMinor: 20_000,
          currency: 'USD',
        },
        userId,
        orgId,
      );

      expect(exchangeRates.getRate).not.toHaveBeenCalled();
    });

    it('updates rate when explicitly provided', async () => {
      db.query.donations.findFirst.mockResolvedValue({
        id: '22222222-2222-2222-2222-222222222222',
        organizationId: orgId,
        donorId,
        rate: '41.230000',
        rateSource: 'default',
      });
      mockUpdate();

      await svc.update(
        '22222222-2222-2222-2222-222222222222',
        {
          rate: 45.5,
        },
        userId,
        orgId,
      );

      expect(insertedValues).toMatchObject({ rate: '45.500000', rateSource: 'manual' });
    });

    it('forces UAH rate to 1 on update without explicit rate', async () => {
      db.query.donations.findFirst.mockResolvedValue({
        id: '22222222-2222-2222-2222-222222222222',
        organizationId: orgId,
        donorId,
        rate: '41.230000',
        rateSource: 'default',
        currency: 'USD',
      });
      mockUpdate();

      await svc.update(
        '22222222-2222-2222-2222-222222222222',
        {
          currency: 'UAH',
        },
        userId,
        orgId,
      );

      expect(insertedValues).toMatchObject({ rate: '1.000000', rateSource: 'default' });
    });

    it('throws 404 when donation not found on update', async () => {
      db.query.donations.findFirst.mockResolvedValue(undefined);

      await expect(
        svc.update(
          'missing-id',
          {
            amountMinor: 20_000,
          },
          userId,
          orgId,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('soft deletes existing donation', async () => {
      db.query.donations.findFirst.mockResolvedValue({ id: 'donation-id' });
      db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await expect(svc.softDelete('donation-id', userId, orgId)).resolves.toBeUndefined();
      expect(db.update).toHaveBeenCalled();
    });

    it('throws on soft delete when donation is missing', async () => {
      db.query.donations.findFirst.mockResolvedValue(undefined);

      await expect(svc.softDelete('missing', userId, orgId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('restore', () => {
    it('restores deleted donation', async () => {
      db.query.donations.findFirst.mockResolvedValue({ id: 'donation-id', deletedAt: new Date() });
      db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      vi.spyOn(svc, 'findById').mockResolvedValue(makeResponse({ deletedAt: null }));

      const result = await svc.restore('donation-id', userId, orgId);

      expect(db.update).toHaveBeenCalled();
      expect(result.deletedAt).toBeNull();
    });

    it('throws when donation is not deleted', async () => {
      db.query.donations.findFirst.mockResolvedValue(undefined);

      await expect(svc.restore('missing', userId, orgId)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('list', () => {
    it('rejects includeDeleted for non-coordinator', async () => {
      await expect(
        svc.list({ page: 1, pageSize: 20, includeDeleted: true }, 'volunteer', orgId),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('supports filtered list for coordinator', async () => {
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
      db.query.donations.findMany.mockResolvedValue([]);

      await svc.list(
        {
          page: 1,
          pageSize: 20,
          donorId,
          vehicleId,
          categoryId: '44444444-4444-4444-4444-444444444444',
          dateFrom: '2026-05-01',
          dateTo: '2026-05-31',
          currency: 'USD',
          includeDeleted: false,
        },
        'coordinator',
        orgId,
      );

      expect(limitMock).toHaveBeenCalledWith(20);
    });
  });

  describe('findById', () => {
    it('returns donation by id', async () => {
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: '22222222-2222-2222-2222-222222222222' }]),
            }),
          }),
        }),
      });
      db.query.donations.findFirst.mockResolvedValue({
        id: '22222222-2222-2222-2222-222222222222',
        donorId,
        donor: { id: donorId, name: 'Test Donor' },
        vehicleId,
        vehicle: { id: vehicleId, identifier: 'VHC-001', brand: 'Toyota', model: 'Hilux' },
        donationDate: '2026-05-21',
        amountMinor: 10_000,
        currency: 'USD',
        rate: '41.23',
        rateSource: 'default',
        category: null,
        description: null,
        createdByUser: { id: userId, fullName: 'Volunteer' },
        updatedByUser: { id: userId, fullName: 'Volunteer' },
        deletedByUser: null,
        createdAt: new Date('2026-05-21T10:00:00.000Z'),
        updatedAt: new Date('2026-05-21T10:00:00.000Z'),
        deletedAt: null,
      });

      const result = await svc.findById('22222222-2222-2222-2222-222222222222', orgId);

      expect(result.id).toBe('22222222-2222-2222-2222-222222222222');
      expect(result.donorId).toBe(donorId);
    });

    it('throws 404 when donation not found', async () => {
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      await expect(svc.findById('missing-id', orgId)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
