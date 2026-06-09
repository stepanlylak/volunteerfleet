import { describe, expect, it } from 'vitest';
import {
  donationCreateSchema,
  expenseCreateSchema,
  financialEntrySchema,
} from '@volunteerfleet/shared';

const id = '11111111-1111-4111-8111-111111111111';

const donation = {
  donationDate: '2026-06-09',
  amountMinor: 100_00,
  currency: 'USD',
  rate: 41.25,
  vehicleId: id,
};

const financialEntry = {
  id,
  entryDate: '2026-06-09',
  amountMinor: 100_00,
  currency: 'USD',
  rate: 41.25,
  amountUahMinor: 412_500,
  vehicle: {
    id,
    identifier: 'VF-001',
    brand: 'Ford',
    model: 'Ranger',
  },
  description: null,
  createdAt: '2026-06-09T12:00:00.000Z',
};

describe('financial contracts', () => {
  it('accepts exactly one donor selector', () => {
    expect(donationCreateSchema.safeParse({ ...donation, donorId: id }).success).toBe(true);
    expect(
      donationCreateSchema.safeParse({ ...donation, newDonorName: '  Donor Name  ' }).success,
    ).toBe(true);
    expect(donationCreateSchema.safeParse(donation).success).toBe(false);
    expect(
      donationCreateSchema.safeParse({
        ...donation,
        donorId: id,
        newDonorName: 'Donor Name',
      }).success,
    ).toBe(false);
  });

  it('rejects organization and signed amounts in donation requests', () => {
    expect(
      donationCreateSchema.safeParse({
        ...donation,
        donorId: id,
        organizationId: id,
      }).success,
    ).toBe(false);
    expect(
      donationCreateSchema.safeParse({
        ...donation,
        donorId: id,
        signedAmountMinor: 100_00,
      }).success,
    ).toBe(false);
  });

  it('requires an expense vehicle and positive integer minor amount', () => {
    expect(
      expenseCreateSchema.safeParse({
        expenseDate: '2026-06-09',
        amountMinor: 100_00,
        currency: 'UAH',
        categoryId: id,
      }).success,
    ).toBe(false);
    expect(
      expenseCreateSchema.safeParse({
        vehicleId: id,
        expenseDate: '2026-06-09',
        amountMinor: 100.5,
        currency: 'UAH',
        categoryId: id,
      }).success,
    ).toBe(false);
  });

  it('rejects fields from the other financial entry branch', () => {
    expect(
      financialEntrySchema.safeParse({
        ...financialEntry,
        type: 'expense',
        signedAmountMinor: -100_00,
        signedAmountUahMinor: -412_500,
        category: { id, name: 'Купівля авто' },
        donor: null,
        documentCount: 1,
      }).success,
    ).toBe(true);

    expect(
      financialEntrySchema.safeParse({
        ...financialEntry,
        type: 'donation',
        signedAmountMinor: 100_00,
        signedAmountUahMinor: 412_500,
        category: null,
        donor: { id, name: 'Donor Name' },
        documentCount: 1,
      }).success,
    ).toBe(false);
  });
});
