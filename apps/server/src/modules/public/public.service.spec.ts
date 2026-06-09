import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicService } from './public.service.js';

const now = new Date('2026-05-22T10:00:00.000Z');

describe('PublicService', () => {
  let db: {
    query: {
      vehicles: {
        findFirst: ReturnType<typeof vi.fn>;
      };
      vehiclePhotos: {
        findMany: ReturnType<typeof vi.fn>;
      };
    };
  };
  let photos: {
    getDownloadStream: ReturnType<typeof vi.fn>;
  };
  let service: PublicService;

  beforeEach(() => {
    db = {
      query: {
        vehicles: {
          findFirst: vi.fn(),
        },
        vehiclePhotos: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    };
    photos = {
      getDownloadStream: vi.fn(),
    };
    service = new PublicService(db as never, photos as never);
  });

  it('returns 404 for non-public or missing vehicles', async () => {
    db.query.vehicles.findFirst.mockResolvedValue(undefined);

    await expect(
      service.getVehicleById(
        '00000000-0000-0000-0000-000000000000',
        '11111111-1111-1111-1111-111111111111',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns sanitized vehicle response without private fields', async () => {
    db.query.vehicles.findFirst.mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      organizationId: '00000000-0000-0000-0000-000000000000',
      identifier: 'VHC-001',
      brand: 'Toyota',
      model: 'Hilux',
      year: 2012,
      vin: 'PRIVATE-VIN',
      status: 'in_repair',
      description: 'private description',
      isPublic: true,
      publicSummary: 'Публічний опис без приватних деталей',
      publicCollectedAmountUahMinor: 1_000_000,
      publicGoalAmountUahMinor: 2_500_000,
      createdBy: '33333333-3333-3333-3333-333333333333',
      updatedBy: '33333333-3333-3333-3333-333333333333',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deletedBy: null,
    });

    const result = await service.getVehicleById(
      '00000000-0000-0000-0000-000000000000',
      '11111111-1111-1111-1111-111111111111',
    );

    expect(result).toEqual({
      identifier: 'VHC-001',
      brand: 'Toyota',
      model: 'Hilux',
      year: 2012,
      status: { name: 'На ремонті' },
      publicSummary: 'Публічний опис без приватних деталей',
      publicCollectedAmountUahMinor: 1_000_000,
      publicGoalAmountUahMinor: 2_500_000,
      photos: [],
      createdAt: now.toISOString(),
    });
    expect(result).not.toHaveProperty('vin');
    expect(result).not.toHaveProperty('description');
    expect(result).not.toHaveProperty('createdBy');
    expect(result).not.toHaveProperty('isPublic');
  });
});
