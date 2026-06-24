import { describe, expect, it } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  VEHICLE_STATUSES,
  isValidTransition,
  vehicleTransitionRequestSchema,
  type VehicleStatus,
} from '@volunteerfleet/shared';

describe('vehicle status transition contracts', () => {
  it('matches the allowed transition matrix', () => {
    const expected: Record<VehicleStatus, VehicleStatus[]> = {
      new: ['paid', 'lost'],
      paid: ['in_transit', 'lost'],
      in_transit: ['arrived', 'lost'],
      arrived: ['in_repair', 'ready', 'lost'],
      in_repair: ['ready', 'lost'],
      ready: ['transferred', 'lost'],
      transferred: ['returned', 'in_repair', 'lost'],
      returned: ['in_repair', 'transferred', 'lost'],
      lost: [],
    };

    expect(ALLOWED_TRANSITIONS).toEqual(expected);

    for (const from of VEHICLE_STATUSES) {
      for (const to of VEHICLE_STATUSES) {
        expect(isValidTransition(from, to)).toBe(expected[from].includes(to));
      }
    }
  });

  it('applies defaults for status-specific boolean fields', () => {
    const paid = vehicleTransitionRequestSchema.parse({
      expectedCurrentStatus: 'new',
      targetStatus: 'paid',
      transitionDate: '2026-06-09',
    });
    const transferred = vehicleTransitionRequestSchema.parse({
      expectedCurrentStatus: 'ready',
      targetStatus: 'transferred',
      transitionDate: '2026-06-10',
    });

    expect(paid).toMatchObject({ targetStatus: 'paid', isLocalPurchase: false });
    expect(transferred).toMatchObject({
      targetStatus: 'transferred',
      isRegisteredAtServiceCenter: false,
    });
  });

  it.each([
    {
      expectedCurrentStatus: 'new',
      targetStatus: 'paid',
      transitionDate: '2026-06-09',
    },
    {
      expectedCurrentStatus: 'paid',
      targetStatus: 'in_transit',
      transitionDate: '2026-06-10',
    },
    {
      expectedCurrentStatus: 'in_transit',
      targetStatus: 'arrived',
      transitionDate: '2026-06-11',
      borderCrossingDate: null,
    },
    {
      expectedCurrentStatus: 'arrived',
      targetStatus: 'in_repair',
      transitionDate: '2026-06-12',
    },
    {
      expectedCurrentStatus: 'in_repair',
      targetStatus: 'ready',
      transitionDate: '2026-06-13',
    },
    {
      expectedCurrentStatus: 'ready',
      targetStatus: 'transferred',
      transitionDate: '2026-06-14',
    },
    {
      expectedCurrentStatus: 'transferred',
      targetStatus: 'returned',
      transitionDate: '2026-06-15',
    },
    {
      expectedCurrentStatus: 'returned',
      targetStatus: 'lost',
      transitionDate: '2026-06-16',
    },
  ])('accepts the $targetStatus transition payload', (payload) => {
    expect(vehicleTransitionRequestSchema.safeParse(payload).success).toBe(true);
  });

  it('rejects fields belonging to another transition branch', () => {
    const result = vehicleTransitionRequestSchema.safeParse({
      expectedCurrentStatus: 'new',
      targetStatus: 'paid',
      transitionDate: '2026-06-09',
      purchasePrice: 5000,
      lostReason: 'This field belongs to the lost transition',
    });

    expect(result.success).toBe(false);
  });

  it('rejects the removed lostReason field on the lost transition', () => {
    const result = vehicleTransitionRequestSchema.safeParse({
      expectedCurrentStatus: 'ready',
      targetStatus: 'lost',
      transitionDate: '2026-06-09',
      lostReason: 'Причина більше не приймається',
    });

    expect(result.success).toBe(false);
  });
});
