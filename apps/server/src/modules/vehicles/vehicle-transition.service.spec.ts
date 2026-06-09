import { ConflictException, BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VehicleTransitionService } from './vehicle-transition.service.js';

describe('VehicleTransitionService', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let exchangeRatesService: any;
  let vehiclesService: unknown;
  let svc: VehicleTransitionService;

  const vehicleId = '11111111-1111-1111-1111-111111111111';
  const orgId = '22222222-2222-2222-2222-222222222222';
  const userId = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    db = {
      transaction: vi.fn(async (cb) => {
        return await cb(db);
      }),
      query: {
        vehicles: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ id: vehicleId, status: 'new', organizationId: orgId }),
        },
        vehicleStatusHistory: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        documents: {
          findFirst: vi.fn().mockResolvedValue({ id: 'doc-1' }),
        },
      },
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: vehicleId }]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
    };

    exchangeRatesService = {
      getRate: vi.fn().mockReturnValue(40.5),
    };

    vehiclesService = {
      findById: vi.fn().mockResolvedValue({ id: vehicleId, status: 'paid' }),
    };

    svc = new VehicleTransitionService(
      db as never,
      exchangeRatesService as never,
      vehiclesService as never,
    );
  });

  it('throws BadRequestException for invalid transition matrix', async () => {
    await expect(
      svc.transition(vehicleId, userId, orgId, {
        expectedCurrentStatus: 'new',
        targetStatus: 'arrived', // new -> arrived is invalid
        transitionDate: '2026-05-21',
      } as unknown as import('@volunteerfleet/shared').VehicleTransitionRequest),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws ConflictException if vehicle status does not match expected', async () => {
    db.query.vehicles.findFirst.mockResolvedValue({ id: vehicleId, status: 'paid' }); // Actual is paid

    await expect(
      svc.transition(vehicleId, userId, orgId, {
        expectedCurrentStatus: 'new', // Expected is new
        targetStatus: 'paid',
        transitionDate: '2026-05-21',
      } as unknown as import('@volunteerfleet/shared').VehicleTransitionRequest),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('successfully transitions from new to paid', async () => {
    await svc.transition(vehicleId, userId, orgId, {
      expectedCurrentStatus: 'new',
      targetStatus: 'paid',
      transitionDate: '2026-05-21',
      purchasePrice: 1000,
      purchaseCurrency: 'USD',
      purchaseRateSource: 'default',
      isLocalPurchase: true,
      note: 'test note',
    } as unknown as import('@volunteerfleet/shared').VehicleTransitionRequest);

    expect(db.update).toHaveBeenCalled();
    expect(db.insert).toHaveBeenCalled();
    expect(exchangeRatesService.getRate).toHaveBeenCalledWith(expect.any(Date), 'USD');
  });

  it('throws BadRequestException if paid -> arrived is attempted but not a local purchase', async () => {
    db.query.vehicles.findFirst.mockResolvedValue({ id: vehicleId, status: 'paid' });
    db.query.vehicleStatusHistory.findFirst.mockResolvedValue({
      newStatus: 'paid',
      isLocalPurchase: false, // Not local
      transitionDate: '2026-05-20',
    });

    await expect(
      svc.transition(vehicleId, userId, orgId, {
        expectedCurrentStatus: 'paid',
        targetStatus: 'arrived',
        transitionDate: '2026-05-21',
      } as unknown as import('@volunteerfleet/shared').VehicleTransitionRequest),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
