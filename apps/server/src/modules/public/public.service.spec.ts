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
      vehicleGalleries: {
        findMany: ReturnType<typeof vi.fn>;
      };
      vehicleGalleryItems: {
        findFirst: ReturnType<typeof vi.fn>;
      };
    };
  };
  let storage: {
    getObjectStream: ReturnType<typeof vi.fn>;
  };
  let service: PublicService;

  beforeEach(() => {
    db = {
      query: {
        vehicles: {
          findFirst: vi.fn(),
        },
        vehicleGalleries: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        vehicleGalleryItems: {
          findFirst: vi.fn(),
        },
      },
    };
    storage = {
      getObjectStream: vi.fn(),
    };
    service = new PublicService(db as never, storage as never);
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
      galleries: [],
      createdAt: now.toISOString(),
    });
    expect(result).not.toHaveProperty('vin');
    expect(result).not.toHaveProperty('description');
    expect(result).not.toHaveProperty('createdBy');
    expect(result).not.toHaveProperty('isPublic');
    expect(result).not.toHaveProperty('photos');
  });

  it('returns only public galleries (main + public custom)', async () => {
    db.query.vehicles.findFirst.mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      organizationId: '00000000-0000-0000-0000-000000000000',
      identifier: 'VHC-001',
      brand: 'Toyota',
      model: 'Hilux',
      year: 2012,
      status: 'ready',
      isPublic: true,
      publicSummary: null,
      publicCollectedAmountUahMinor: null,
      publicGoalAmountUahMinor: null,
      createdAt: now,
      deletedAt: null,
    });

    // Main gallery (always public) + one public custom + one private custom
    db.query.vehicleGalleries.findMany.mockResolvedValue([
      {
        id: 'main-gallery-id',
        vehicleId: '11111111-1111-1111-1111-111111111111',
        kind: 'main',
        name: null,
        description: null,
        isPublic: true, // main is always public per DB constraint
        sortOrder: 0,
        items: [
          {
            id: 'main-item-1',
            type: 'image',
            mimeType: 'image/jpeg',
            caption: 'Main photo',
            sortOrder: 0,
          },
        ],
        coverItem: null,
        createdAt: now,
      },
      {
        id: 'public-custom-id',
        vehicleId: '11111111-1111-1111-1111-111111111111',
        kind: 'custom',
        name: 'Public Custom',
        description: 'A public gallery',
        isPublic: true,
        sortOrder: 1,
        items: [],
        coverItem: null,
        createdAt: now,
      },
      // Private custom gallery should be filtered by SQL condition
    ]);

    const result = await service.getVehicleById(
      '00000000-0000-0000-0000-000000000000',
      '11111111-1111-1111-1111-111111111111',
    );

    expect(result.galleries).toHaveLength(2);
    expect(result.galleries[0]).toMatchObject({
      id: 'main-gallery-id',
      kind: 'main',
      displayLabel: 'Основна',
      name: null,
    });
    expect(result.galleries[1]).toMatchObject({
      id: 'public-custom-id',
      kind: 'custom',
      displayLabel: 'Public Custom',
      name: 'Public Custom',
    });
  });

  it('includes ordered gallery items with captions', async () => {
    db.query.vehicles.findFirst.mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      organizationId: '00000000-0000-0000-0000-000000000000',
      identifier: 'VHC-001',
      brand: 'Toyota',
      model: 'Hilux',
      year: 2012,
      status: 'ready',
      isPublic: true,
      publicSummary: null,
      publicCollectedAmountUahMinor: null,
      publicGoalAmountUahMinor: null,
      createdAt: now,
      deletedAt: null,
    });

    db.query.vehicleGalleries.findMany.mockResolvedValue([
      {
        id: 'main-gallery-id',
        vehicleId: '11111111-1111-1111-1111-111111111111',
        kind: 'main',
        name: null,
        description: null,
        isPublic: true,
        sortOrder: 0,
        items: [
          {
            id: 'item-1',
            type: 'image',
            mimeType: 'image/png',
            caption: 'First photo',
            sortOrder: 0,
          },
          {
            id: 'item-2',
            type: 'image',
            mimeType: 'image/jpeg',
            caption: 'Second photo',
            sortOrder: 1,
          },
        ],
        coverItem: { id: 'item-1' },
        createdAt: now,
      },
    ]);

    const result = await service.getVehicleById(
      '00000000-0000-0000-0000-000000000000',
      '11111111-1111-1111-1111-111111111111',
    );

    expect(result.galleries).toHaveLength(1);
    const gallery = result.galleries[0]!;
    expect(gallery.items).toHaveLength(2);
    expect(gallery.items[0]).toEqual({
      id: 'item-1',
      type: 'image',
      mimeType: 'image/png',
      caption: 'First photo',
      sortOrder: 0,
    });
    expect(gallery.items[1]).toEqual({
      id: 'item-2',
      type: 'image',
      mimeType: 'image/jpeg',
      caption: 'Second photo',
      sortOrder: 1,
    });
    expect(gallery.coverItemId).toBe('item-1');
  });

  it('uses first item as fallback when no explicit cover', async () => {
    db.query.vehicles.findFirst.mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      organizationId: '00000000-0000-0000-0000-000000000000',
      identifier: 'VHC-001',
      brand: 'Toyota',
      model: 'Hilux',
      year: 2012,
      status: 'ready',
      isPublic: true,
      publicSummary: null,
      publicCollectedAmountUahMinor: null,
      publicGoalAmountUahMinor: null,
      createdAt: now,
      deletedAt: null,
    });

    db.query.vehicleGalleries.findMany.mockResolvedValue([
      {
        id: 'main-gallery-id',
        vehicleId: '11111111-1111-1111-1111-111111111111',
        kind: 'main',
        name: null,
        description: null,
        isPublic: true,
        sortOrder: 0,
        items: [
          {
            id: 'item-1',
            type: 'image',
            mimeType: 'image/jpeg',
            caption: null,
            sortOrder: 0,
          },
        ],
        coverItem: null,
        createdAt: now,
      },
    ]);

    const result = await service.getVehicleById(
      '00000000-0000-0000-0000-000000000000',
      '11111111-1111-1111-1111-111111111111',
    );

    expect(result.galleries).toHaveLength(1);
    expect(result.galleries[0]!.coverItemId).toBe('item-1');
  });

  describe('getGalleryItemDownloadStream', () => {
    it('returns download stream for public item', async () => {
      db.query.vehicleGalleryItems.findFirst.mockResolvedValue({
        id: 'item-id',
        fileKey: 'vehicle-galleries/vid/gid/item/file.jpg',
        mimeType: 'image/jpeg',
        gallery: {
          id: 'gallery-id',
          deletedAt: null,
          isPublic: true,
        },
        vehicle: {
          id: 'vehicle-id',
          deletedAt: null,
          isPublic: true,
        },
      });

      storage.getObjectStream.mockResolvedValue({
        body: {} as ReadableStream,
        contentType: 'image/jpeg',
        contentLength: 12345,
      });

      const result = await service.getGalleryItemDownloadStream('item-id');

      expect(result.contentType).toBe('image/jpeg');
      expect(result.contentLength).toBe(12345);
    });

    it('returns 404 for non-public vehicle', async () => {
      db.query.vehicleGalleryItems.findFirst.mockResolvedValue({
        id: 'item-id',
        fileKey: 'vehicle-galleries/vid/gid/item/file.jpg',
        mimeType: 'image/jpeg',
        gallery: {
          id: 'gallery-id',
          deletedAt: null,
          isPublic: true,
        },
        vehicle: {
          id: 'vehicle-id',
          deletedAt: null,
          isPublic: false, // Private vehicle
        },
      });

      await expect(service.getGalleryItemDownloadStream('item-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns 404 for private custom gallery', async () => {
      db.query.vehicleGalleryItems.findFirst.mockResolvedValue({
        id: 'item-id',
        fileKey: 'vehicle-galleries/vid/gid/item/file.jpg',
        mimeType: 'image/jpeg',
        gallery: {
          id: 'gallery-id',
          deletedAt: null,
          isPublic: false, // Private gallery
          kind: 'custom',
        },
        vehicle: {
          id: 'vehicle-id',
          deletedAt: null,
          isPublic: true,
        },
      });

      await expect(service.getGalleryItemDownloadStream('item-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns 404 for soft-deleted item', async () => {
      db.query.vehicleGalleryItems.findFirst.mockResolvedValue(undefined);

      await expect(service.getGalleryItemDownloadStream('deleted-item-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns 404 for soft-deleted gallery', async () => {
      db.query.vehicleGalleryItems.findFirst.mockResolvedValue({
        id: 'item-id',
        fileKey: 'vehicle-galleries/vid/gid/item/file.jpg',
        mimeType: 'image/jpeg',
        gallery: {
          id: 'gallery-id',
          deletedAt: new Date(), // Deleted
          isPublic: true,
        },
        vehicle: {
          id: 'vehicle-id',
          deletedAt: null,
          isPublic: true,
        },
      });

      await expect(service.getGalleryItemDownloadStream('item-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns 404 for soft-deleted vehicle', async () => {
      db.query.vehicleGalleryItems.findFirst.mockResolvedValue({
        id: 'item-id',
        fileKey: 'vehicle-galleries/vid/gid/item/file.jpg',
        mimeType: 'image/jpeg',
        gallery: {
          id: 'gallery-id',
          deletedAt: null,
          isPublic: true,
        },
        vehicle: {
          id: 'vehicle-id',
          deletedAt: new Date(), // Deleted
          isPublic: true,
        },
      });

      await expect(service.getGalleryItemDownloadStream('item-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
