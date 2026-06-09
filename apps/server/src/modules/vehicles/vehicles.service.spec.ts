import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VehiclesService } from './vehicles.service.js';

describe('VehiclesService (VSF-7)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  let svc: VehiclesService;

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
          findFirst: vi.fn().mockResolvedValue({
            id: vehicleId,
            status: 'new',
            organizationId: orgId,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
          findMany: vi.fn().mockResolvedValue([]),
        },
        vehicleStatusHistory: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: vehicleId, status: 'new' }]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: vehicleId,
              status: 'new',
              organizationId: orgId,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]),
        }),
      }),
    };

    const alertService = {
      getAlertsForVehicle: vi.fn().mockResolvedValue([]),
      getAlertsForVehicles: vi.fn().mockResolvedValue(new Map()),
    };

    svc = new VehiclesService(db as never, alertService as never);
    vi.spyOn(svc, 'findById').mockResolvedValue({
      id: vehicleId,
      status: 'new',
    } as unknown as import('@volunteerfleet/shared').VehicleResponse);
  });

  it('creates a vehicle with automatic new status and transitionDate = startDate', async () => {
    await svc.create(
      {
        identifier: 'TEST',
        brand: 'Ford',
        model: 'Focus',
        startDate: '2026-05-21',
        description: null,
        year: null,
        vin: null,
      },
      userId,
      orgId,
    );

    expect(db.insert).toHaveBeenCalledTimes(2); // vehicles and vehicleStatusHistory

    const historyInsertCall = db.insert().values.mock.calls[1][0];
    expect(historyInsertCall).toMatchObject({
      oldStatus: null,
      newStatus: 'new',
      transitionDate: '2026-05-21',
    });
  });

  it('PATCH /vehicles/:id does not update status (status is ignored)', async () => {
    await svc.update(
      vehicleId,
      {
        brand: 'BMW',
        status: 'paid', // Intentionally trying to bypass the type system to test runtime behavior if someone passes it
      } as unknown as import('@volunteerfleet/shared').VehicleUpdate,
      userId,
      orgId,
    );

    const updateCall = db.update().set.mock.calls[0][0];
    expect(updateCall).toHaveProperty('brand', 'BMW');
    expect(updateCall).not.toHaveProperty('status'); // Status should not be included in update values
  });
});
