import { describe, expect, it } from 'vitest';
import {
  VEHICLE_GALLERY_MAX_ITEMS,
  vehicleGalleryCreateSchema,
  vehicleGalleryItemOrderUpdateSchema,
  vehicleGalleryItemUpdateSchema,
  vehicleGalleryItemUploadMetadataSchema,
  vehicleGalleryResponseSchema,
  vehicleGallerySetCoverSchema,
  vehicleGalleryUpdateSchema,
  vehicleMainGalleryCoverSchema,
  vehicleResponseSchema,
} from '@volunteerfleet/shared';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('vehicle gallery contracts', () => {
  describe('create', () => {
    it('defaults isPublic to false', () => {
      const parsed = vehicleGalleryCreateSchema.parse({ name: 'Після ремонту' });
      expect(parsed.isPublic).toBe(false);
    });

    it('trims the name and rejects empty names', () => {
      expect(vehicleGalleryCreateSchema.parse({ name: '  До ремонту  ' }).name).toBe('До ремонту');
      expect(vehicleGalleryCreateSchema.safeParse({ name: '   ' }).success).toBe(false);
      expect(vehicleGalleryCreateSchema.safeParse({}).success).toBe(false);
    });

    it('normalizes empty description to null', () => {
      expect(vehicleGalleryCreateSchema.parse({ name: 'A', description: '  ' }).description).toBe(
        null,
      );
      expect(vehicleGalleryCreateSchema.parse({ name: 'A', description: ' B ' }).description).toBe(
        'B',
      );
    });

    it('rejects unknown fields', () => {
      expect(vehicleGalleryCreateSchema.safeParse({ name: 'A', kind: 'main' }).success).toBe(false);
    });
  });

  describe('update', () => {
    it('allows partial updates and normalizes empty description to null', () => {
      expect(vehicleGalleryUpdateSchema.parse({})).toEqual({});
      expect(vehicleGalleryUpdateSchema.parse({ description: '' }).description).toBe(null);
      expect(vehicleGalleryUpdateSchema.parse({ isPublic: true }).isPublic).toBe(true);
    });

    it('rejects unknown fields', () => {
      expect(vehicleGalleryUpdateSchema.safeParse({ sortOrder: 1 }).success).toBe(false);
    });
  });

  describe('item caption', () => {
    it('normalizes empty caption to null on upload metadata and update', () => {
      expect(vehicleGalleryItemUploadMetadataSchema.parse({ caption: '  ' }).caption).toBe(null);
      expect(vehicleGalleryItemUploadMetadataSchema.parse({}).caption).toBeUndefined();
      expect(vehicleGalleryItemUpdateSchema.parse({ caption: '' }).caption).toBe(null);
      expect(vehicleGalleryItemUpdateSchema.parse({ caption: ' Фарбування ' }).caption).toBe(
        'Фарбування',
      );
      expect(vehicleGalleryItemUpdateSchema.parse({ caption: null }).caption).toBe(null);
    });
  });

  describe('order', () => {
    it('accepts up to the max number of unique IDs', () => {
      const ids = Array.from({ length: VEHICLE_GALLERY_MAX_ITEMS }, (_, i) => uuid(i + 1));
      expect(vehicleGalleryItemOrderUpdateSchema.parse({ itemIds: ids }).itemIds).toHaveLength(
        VEHICLE_GALLERY_MAX_ITEMS,
      );
    });

    it('rejects more than the max number of items', () => {
      const ids = Array.from({ length: VEHICLE_GALLERY_MAX_ITEMS + 1 }, (_, i) => uuid(i + 1));
      expect(vehicleGalleryItemOrderUpdateSchema.safeParse({ itemIds: ids }).success).toBe(false);
    });

    it('rejects duplicate and empty ID lists', () => {
      expect(
        vehicleGalleryItemOrderUpdateSchema.safeParse({ itemIds: [uuid(1), uuid(1)] }).success,
      ).toBe(false);
      expect(vehicleGalleryItemOrderUpdateSchema.safeParse({ itemIds: [] }).success).toBe(false);
    });
  });

  describe('cover', () => {
    it('accepts an item ID or null', () => {
      expect(vehicleGallerySetCoverSchema.parse({ itemId: uuid(1) }).itemId).toBe(uuid(1));
      expect(vehicleGallerySetCoverSchema.parse({ itemId: null }).itemId).toBe(null);
      expect(vehicleGallerySetCoverSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('responses', () => {
    it('requires maxItems to be the fixed limit', () => {
      const base = {
        id: uuid(1),
        vehicleId: uuid(2),
        kind: 'main',
        name: null,
        description: null,
        isPublic: true,
        sortOrder: 0,
        explicitCoverItemId: null,
        effectiveCoverItemId: null,
        items: [],
        createdAt: '2026-06-10T00:00:00.000Z',
        updatedAt: '2026-06-10T00:00:00.000Z',
      };
      expect(
        vehicleGalleryResponseSchema.safeParse({ ...base, maxItems: VEHICLE_GALLERY_MAX_ITEMS })
          .success,
      ).toBe(true);
      expect(vehicleGalleryResponseSchema.safeParse({ ...base, maxItems: 10 }).success).toBe(false);
    });

    it('exposes nullable mainGalleryCover on the vehicle response contract', () => {
      const shape = vehicleResponseSchema.shape.mainGalleryCover;
      expect(shape.safeParse(null).success).toBe(true);
      expect(
        shape.safeParse({ galleryId: uuid(2), itemId: uuid(1), mimeType: 'image/jpeg' }).success,
      ).toBe(true);
      expect(shape.safeParse({ itemId: uuid(1), mimeType: 'image/jpeg' }).success).toBe(false);
      expect(vehicleMainGalleryCoverSchema.safeParse({ itemId: uuid(1) }).success).toBe(false);
    });
  });
});
