import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  vehicleGalleryCreateSchema,
  vehicleGalleryItemUploadMetadataSchema,
} from '@volunteerfleet/shared';
import { createDb, createPool, type Database } from '../../db/client.js';
import { organizations, users, vehicleGalleryItems } from '../../db/schema/index.js';
import { VehicleGalleryItemsService } from './vehicle-gallery-items.service.js';
import { VehicleGalleriesService } from './vehicle-galleries.service.js';
import { VehiclesService } from './vehicles.service.js';
import { ORG_ROLES_KEY } from '../../common/decorators/org-roles.decorator.js';
import { VehiclesController } from './vehicles.controller.js';

// --- Unit tests (no DB, no storage) ---

describe('VehicleGalleryItemsService (unit)', () => {
  const storageStub = { putObject: vi.fn(), getObjectStream: vi.fn() };
  const svc = new VehicleGalleryItemsService({} as never, storageStub as never, {} as never);

  it('accepts allowed MIME types', () => {
    for (const mime of ['image/jpeg', 'image/png', 'image/webp', 'image/heic']) {
      expect(() => svc.assertAllowedItemForTest(mime, 1024, 0, 26214400)).not.toThrow();
    }
  });

  it('rejects non-image MIME type', () => {
    expect(() => svc.assertAllowedItemForTest('application/pdf', 1024, 0, 26214400)).toThrow(
      UnsupportedMediaTypeException,
    );
  });

  it('rejects oversized file', () => {
    expect(() => svc.assertAllowedItemForTest('image/jpeg', 26214401, 0, 26214400)).toThrow(
      PayloadTooLargeException,
    );
  });

  it('rejects upload when count is 30', () => {
    expect(() => svc.assertAllowedItemForTest('image/jpeg', 1024, 30, 26214400)).toThrow(
      BadRequestException,
    );
    expect(() => svc.assertAllowedItemForTest('image/jpeg', 1024, 29, 26214400)).not.toThrow();
  });
});

// --- Integration tests (real Postgres) ---

const databaseUrl = process.env.DATABASE_URL;
const describeIfDb = databaseUrl ? describe : describe.skip;

class Rollback extends Error {}

const alertServiceStub = {
  getAlertsForVehicle: async () => [],
  getAlertsForVehicles: async () => new Map(),
};

const VEHICLE_INPUT = {
  identifier: '',
  brand: 'Ford',
  model: 'Ranger',
  startDate: '2026-01-01',
  description: null,
  year: null,
  vin: null,
};

function makeFile(buffer: Buffer, mime = 'image/jpeg', name = 'photo.jpg'): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: name,
    encoding: '7bit',
    mimetype: mime,
    buffer,
    size: buffer.length,
    stream: null as never,
    destination: '',
    filename: '',
    path: '',
  };
}

// Minimal valid JPEG magic bytes
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
// Pad to >4100 bytes so file-type can sniff
const JPEG_BUFFER = Buffer.concat([JPEG_MAGIC, Buffer.alloc(4200 - JPEG_MAGIC.length)]);

describeIfDb('VehicleGalleryItemsService (integration)', () => {
  let pool: ReturnType<typeof createPool>;
  let db: Database;

  beforeAll(() => {
    pool = createPool(databaseUrl as string);
    db = createDb(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

  interface SeedContext {
    orgId: string;
    otherOrgId: string;
    userId: string;
    vehicleId: string;
    galleryId: string;
    galleries: VehicleGalleriesService;
    items: VehicleGalleryItemsService;
  }

  function makeStorageMock() {
    return {
      putObject: vi.fn().mockResolvedValue(undefined),
      getObjectStream: vi.fn().mockResolvedValue({
        body: { pipe: vi.fn() },
        contentType: 'image/jpeg',
        contentLength: 100,
      }),
    };
  }

  async function withRollback(fn: (tx: Tx, ctx: SeedContext) => Promise<void>): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            email: `${randomUUID()}@test.local`,
            passwordHash: 'x',
            fullName: 'Test User',
            role: 'user',
          })
          .returning();
        const [org] = await tx
          .insert(organizations)
          .values({ name: `org-${randomUUID()}`, createdBy: user!.id })
          .returning();
        const [otherOrg] = await tx
          .insert(organizations)
          .values({ name: `org-${randomUUID()}`, createdBy: user!.id })
          .returning();

        const galleries = new VehicleGalleriesService(tx as unknown as Database);
        const storage = makeStorageMock();
        const items = new VehicleGalleryItemsService(
          tx as unknown as Database,
          storage as never,
          galleries,
        );
        const vehiclesService = new VehiclesService(
          tx as unknown as Database,
          alertServiceStub as never,
          galleries,
        );
        const vehicle = await vehiclesService.create(
          { ...VEHICLE_INPUT, identifier: `v-${randomUUID().slice(0, 8)}` },
          user!.id,
          org!.id,
        );

        const list = await galleries.list(vehicle.id, org!.id);
        const galleryId = list.items[0]!.id;

        await fn(tx, {
          orgId: org!.id,
          otherOrgId: otherOrg!.id,
          userId: user!.id,
          vehicleId: vehicle.id,
          galleryId,
          galleries,
          items,
        });
        throw new Rollback();
      });
    } catch (err) {
      if (!(err instanceof Rollback)) throw err;
    }
  }

  async function uploadItem(ctx: SeedContext, caption?: string | null) {
    return ctx.items.upload(
      ctx.vehicleId,
      ctx.galleryId,
      makeFile(JPEG_BUFFER),
      vehicleGalleryItemUploadMetadataSchema.parse({ caption: caption ?? undefined }),
      ctx.userId,
      26214400,
      ctx.orgId,
    );
  }

  it('uploads up to 30 items, 31st gives GALLERY_ITEM_LIMIT_EXCEEDED', async () => {
    await withRollback(async (tx, ctx) => {
      for (let i = 0; i < 30; i++) {
        await tx.insert(vehicleGalleryItems).values({
          organizationId: ctx.orgId,
          vehicleId: ctx.vehicleId,
          galleryId: ctx.galleryId,
          type: 'image',
          fileKey: `vehicle-galleries/${ctx.vehicleId}/${ctx.galleryId}/${randomUUID()}/a.jpg`,
          originalName: 'a.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 1,
          sortOrder: i,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        });
      }

      await expect(uploadItem(ctx)).rejects.toThrow('GALLERY_ITEM_LIMIT_EXCEEDED');
    });
  });

  it('caption round-trip works, empty caption becomes null', async () => {
    await withRollback(async (_tx, ctx) => {
      const item = await uploadItem(ctx, 'Підпис фото');
      expect(item.caption).toBe('Підпис фото');

      const updated = await ctx.items.updateCaption(
        ctx.vehicleId,
        ctx.galleryId,
        item.id,
        vehicleGalleryItemUploadMetadataSchema.parse({ caption: '' }),
        ctx.userId,
        ctx.orgId,
      );
      expect(updated.caption).toBeNull();
    });
  });

  it('authenticated download of cross-org item returns 404', async () => {
    await withRollback(async (_tx, ctx) => {
      const item = await uploadItem(ctx);
      await expect(
        ctx.items.getDownloadStream(ctx.vehicleId, ctx.galleryId, item.id, ctx.otherOrgId),
      ).rejects.toThrow('GALLERY_ITEM_NOT_FOUND');
    });
  });

  it('appends items with sequential sortOrder', async () => {
    await withRollback(async (_tx, ctx) => {
      const first = await uploadItem(ctx);
      const second = await uploadItem(ctx);
      const third = await uploadItem(ctx);
      expect(first.sortOrder).toBe(0);
      expect(second.sortOrder).toBe(1);
      expect(third.sortOrder).toBe(2);
    });
  });

  it('gallery list response includes uploaded items', async () => {
    await withRollback(async (_tx, ctx) => {
      await uploadItem(ctx, 'caption1');
      await uploadItem(ctx);
      const list = await ctx.galleries.list(ctx.vehicleId, ctx.orgId);
      const gallery = list.items[0]!;
      expect(gallery.items).toHaveLength(2);
      expect(gallery.items[0]!.caption).toBe('caption1');
      expect(gallery.items[1]!.caption).toBeNull();
    });
  });
});

// --- Controller permission tests ---

describe('VehiclesController gallery item permissions (GAL-4)', () => {
  const rolesOf = (method: keyof VehiclesController): string[] =>
    Reflect.getMetadata(ORG_ROLES_KEY, VehiclesController.prototype[method]) as string[];

  it('allows all org roles to download, only coordinator/volunteer to upload/edit', () => {
    expect(rolesOf('uploadGalleryItem')).toEqual(['coordinator', 'volunteer']);
    expect(rolesOf('updateGalleryItemCaption')).toEqual(['coordinator', 'volunteer']);
    expect(rolesOf('downloadGalleryItem')).toEqual(['coordinator', 'volunteer', 'viewer']);
  });
});

describe('VehiclesController gallery item permissions (GAL-5)', () => {
  const rolesOf = (method: keyof VehiclesController): string[] =>
    Reflect.getMetadata(ORG_ROLES_KEY, VehiclesController.prototype[method]) as string[];

  it('reorder/cover/move/delete are coordinator+volunteer only', () => {
    expect(rolesOf('reorderGalleryItems')).toEqual(['coordinator', 'volunteer']);
    expect(rolesOf('setGalleryCover')).toEqual(['coordinator', 'volunteer']);
    expect(rolesOf('moveGalleryItem')).toEqual(['coordinator', 'volunteer']);
    expect(rolesOf('removeGalleryItem')).toEqual(['coordinator', 'volunteer']);
  });
});

// --- GAL-5 integration tests ---

describeIfDb('VehicleGalleryItemsService GAL-5 (integration)', () => {
  let pool: ReturnType<typeof createPool>;
  let db: Database;

  beforeAll(() => {
    pool = createPool(databaseUrl as string);
    db = createDb(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

  interface SeedContext {
    orgId: string;
    userId: string;
    otherUserId: string;
    vehicleId: string;
    galleryId: string;
    galleries: VehicleGalleriesService;
    items: VehicleGalleryItemsService;
  }

  function makeStorageMock() {
    return {
      putObject: vi.fn().mockResolvedValue(undefined),
      getObjectStream: vi.fn().mockResolvedValue({
        body: { pipe: vi.fn() },
        contentType: 'image/jpeg',
        contentLength: 100,
      }),
    };
  }

  async function withRollback(fn: (tx: Tx, ctx: SeedContext) => Promise<void>): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            email: `${randomUUID()}@test.local`,
            passwordHash: 'x',
            fullName: 'Test User',
            role: 'user',
          })
          .returning();
        const [otherUser] = await tx
          .insert(users)
          .values({
            email: `other-${randomUUID()}@test.local`,
            passwordHash: 'x',
            fullName: 'Other User',
            role: 'user',
          })
          .returning();
        const [org] = await tx
          .insert(organizations)
          .values({ name: `org-${randomUUID()}`, createdBy: user!.id })
          .returning();

        const galleries = new VehicleGalleriesService(tx as unknown as Database);
        const storage = makeStorageMock();
        const items = new VehicleGalleryItemsService(
          tx as unknown as Database,
          storage as never,
          galleries,
        );
        const vehiclesService = new VehiclesService(
          tx as unknown as Database,
          alertServiceStub as never,
          galleries,
        );
        const vehicle = await vehiclesService.create(
          { ...VEHICLE_INPUT, identifier: `v-${randomUUID().slice(0, 8)}` },
          user!.id,
          org!.id,
        );

        const list = await galleries.list(vehicle.id, org!.id);
        const galleryId = list.items[0]!.id;

        await fn(tx, {
          orgId: org!.id,
          userId: user!.id,
          otherUserId: otherUser!.id,
          vehicleId: vehicle.id,
          galleryId,
          galleries,
          items,
        });
        throw new Rollback();
      });
    } catch (err) {
      if (!(err instanceof Rollback)) throw err;
    }
  }

  async function uploadItem(ctx: SeedContext, galleryId?: string, caption?: string | null) {
    return ctx.items.upload(
      ctx.vehicleId,
      galleryId ?? ctx.galleryId,
      makeFile(JPEG_BUFFER),
      vehicleGalleryItemUploadMetadataSchema.parse({ caption: caption ?? undefined }),
      ctx.userId,
      26214400,
      ctx.orgId,
    );
  }

  async function createCustomGallery(ctx: SeedContext) {
    return ctx.galleries.create(
      ctx.vehicleId,
      vehicleGalleryCreateSchema.parse({
        name: `gallery-${randomUUID().slice(0, 8)}`,
        isPublic: false,
      }),
      ctx.userId,
      ctx.orgId,
    );
  }

  it('reorder changes sortOrder for all items and returns correct order', async () => {
    await withRollback(async (_tx, ctx) => {
      const a = await uploadItem(ctx);
      const b = await uploadItem(ctx);
      const c = await uploadItem(ctx);

      const reordered = await ctx.items.reorder(
        ctx.vehicleId,
        ctx.galleryId,
        { itemIds: [c.id, a.id, b.id] },
        ctx.userId,
        ctx.orgId,
      );

      expect(reordered[0]!.id).toBe(c.id);
      expect(reordered[0]!.sortOrder).toBe(0);
      expect(reordered[1]!.id).toBe(a.id);
      expect(reordered[1]!.sortOrder).toBe(1);
      expect(reordered[2]!.id).toBe(b.id);
      expect(reordered[2]!.sortOrder).toBe(2);
    });
  });

  it('reorder rejects missing item (incomplete set)', async () => {
    await withRollback(async (_tx, ctx) => {
      const a = await uploadItem(ctx);
      await uploadItem(ctx);

      await expect(
        ctx.items.reorder(ctx.vehicleId, ctx.galleryId, { itemIds: [a.id] }, ctx.userId, ctx.orgId),
      ).rejects.toThrow('ITEM_ORDER_MUST_INCLUDE_ALL_ACTIVE_ITEMS');
    });
  });

  it('reorder rejects foreign item ID', async () => {
    await withRollback(async (_tx, ctx) => {
      const target = await createCustomGallery(ctx);
      const foreignItem = await uploadItem(ctx, target.id);
      const ownItem = await uploadItem(ctx);

      await expect(
        ctx.items.reorder(
          ctx.vehicleId,
          ctx.galleryId,
          { itemIds: [ownItem.id, foreignItem.id] },
          ctx.userId,
          ctx.orgId,
        ),
      ).rejects.toThrow('ITEM_ORDER_MUST_INCLUDE_ALL_ACTIVE_ITEMS');
    });
  });

  it('setCover sets explicit cover and returns gallery with effectiveCoverItemId', async () => {
    await withRollback(async (_tx, ctx) => {
      const item = await uploadItem(ctx);

      const gallery = await ctx.items.setCover(
        ctx.vehicleId,
        ctx.galleryId,
        { itemId: item.id },
        ctx.userId,
        ctx.orgId,
      );

      expect(gallery.explicitCoverItemId).toBe(item.id);
      expect(gallery.effectiveCoverItemId).toBe(item.id);
    });
  });

  it('setCover with null resets cover', async () => {
    await withRollback(async (_tx, ctx) => {
      const item = await uploadItem(ctx);

      await ctx.items.setCover(
        ctx.vehicleId,
        ctx.galleryId,
        { itemId: item.id },
        ctx.userId,
        ctx.orgId,
      );

      const gallery = await ctx.items.setCover(
        ctx.vehicleId,
        ctx.galleryId,
        { itemId: null },
        ctx.userId,
        ctx.orgId,
      );

      expect(gallery.explicitCoverItemId).toBeNull();
      expect(gallery.effectiveCoverItemId).toBe(item.id);
    });
  });

  it('setCover rejects item from another gallery', async () => {
    await withRollback(async (_tx, ctx) => {
      const target = await createCustomGallery(ctx);
      const foreignItem = await uploadItem(ctx, target.id);

      await expect(
        ctx.items.setCover(
          ctx.vehicleId,
          ctx.galleryId,
          { itemId: foreignItem.id },
          ctx.userId,
          ctx.orgId,
        ),
      ).rejects.toThrow('COVER_ITEM_NOT_IN_GALLERY');
    });
  });

  it('effectiveCoverItemId fallback: deleted explicit cover returns first active item', async () => {
    await withRollback(async (_tx, ctx) => {
      const first = await uploadItem(ctx);
      const second = await uploadItem(ctx);

      await ctx.items.setCover(
        ctx.vehicleId,
        ctx.galleryId,
        { itemId: second.id },
        ctx.userId,
        ctx.orgId,
      );

      await ctx.items.softDelete(ctx.vehicleId, ctx.galleryId, second.id, ctx.userId, ctx.orgId);

      const gallery = await ctx.galleries.getGalleryResponse(
        ctx.vehicleId,
        ctx.galleryId,
        ctx.orgId,
      );
      expect(gallery.explicitCoverItemId).toBeNull();
      expect(gallery.effectiveCoverItemId).toBe(first.id);
    });
  });

  it('move transfers item to target gallery preserving caption', async () => {
    await withRollback(async (_tx, ctx) => {
      const item = await uploadItem(ctx, undefined, 'my caption');
      const target = await createCustomGallery(ctx);

      const moved = await ctx.items.move(
        ctx.vehicleId,
        ctx.galleryId,
        item.id,
        { targetGalleryId: target.id },
        ctx.userId,
        ctx.orgId,
      );

      expect(moved.galleryId).toBe(target.id);
      expect(moved.caption).toBe('my caption');
    });
  });

  it('move rejects when target gallery is full (30 items)', async () => {
    await withRollback(async (tx, ctx) => {
      const target = await createCustomGallery(ctx);
      const item = await uploadItem(ctx);

      for (let i = 0; i < 30; i++) {
        await tx.insert(vehicleGalleryItems).values({
          organizationId: ctx.orgId,
          vehicleId: ctx.vehicleId,
          galleryId: target.id,
          type: 'image',
          fileKey: `vehicle-galleries/${ctx.vehicleId}/${target.id}/${randomUUID()}/a.jpg`,
          originalName: 'a.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 1,
          sortOrder: i,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        });
      }

      await expect(
        ctx.items.move(
          ctx.vehicleId,
          ctx.galleryId,
          item.id,
          { targetGalleryId: target.id },
          ctx.userId,
          ctx.orgId,
        ),
      ).rejects.toThrow('GALLERY_ITEM_LIMIT_EXCEEDED');
    });
  });

  it('move clears coverItemId on source gallery if moved item was cover', async () => {
    await withRollback(async (_tx, ctx) => {
      const item = await uploadItem(ctx);
      const target = await createCustomGallery(ctx);

      await ctx.items.setCover(
        ctx.vehicleId,
        ctx.galleryId,
        { itemId: item.id },
        ctx.userId,
        ctx.orgId,
      );

      await ctx.items.move(
        ctx.vehicleId,
        ctx.galleryId,
        item.id,
        { targetGalleryId: target.id },
        ctx.userId,
        ctx.orgId,
      );

      const gallery = await ctx.galleries.getGalleryResponse(
        ctx.vehicleId,
        ctx.galleryId,
        ctx.orgId,
      );
      expect(gallery.explicitCoverItemId).toBeNull();
    });
  });

  it('move normalizes sortOrder on source gallery', async () => {
    await withRollback(async (_tx, ctx) => {
      const a = await uploadItem(ctx);
      const b = await uploadItem(ctx);
      const c = await uploadItem(ctx);
      const target = await createCustomGallery(ctx);

      await ctx.items.move(
        ctx.vehicleId,
        ctx.galleryId,
        b.id,
        { targetGalleryId: target.id },
        ctx.userId,
        ctx.orgId,
      );

      const gallery = await ctx.galleries.getGalleryResponse(
        ctx.vehicleId,
        ctx.galleryId,
        ctx.orgId,
      );
      const orders = gallery.items.map((i) => i.sortOrder);
      expect(orders).toEqual([0, 1]);
      const ids = gallery.items.map((i) => i.id);
      expect(ids).toContain(a.id);
      expect(ids).toContain(c.id);
    });
  });

  it('softDelete soft-deletes item without touching other items', async () => {
    await withRollback(async (_tx, ctx) => {
      const a = await uploadItem(ctx);
      const b = await uploadItem(ctx);

      await ctx.items.softDelete(ctx.vehicleId, ctx.galleryId, a.id, ctx.userId, ctx.orgId);

      const gallery = await ctx.galleries.getGalleryResponse(
        ctx.vehicleId,
        ctx.galleryId,
        ctx.orgId,
      );
      expect(gallery.items).toHaveLength(1);
      expect(gallery.items[0]!.id).toBe(b.id);
    });
  });

  it('softDelete clears coverItemId if deleted item was cover', async () => {
    await withRollback(async (_tx, ctx) => {
      const item = await uploadItem(ctx);

      await ctx.items.setCover(
        ctx.vehicleId,
        ctx.galleryId,
        { itemId: item.id },
        ctx.userId,
        ctx.orgId,
      );

      await ctx.items.softDelete(ctx.vehicleId, ctx.galleryId, item.id, ctx.userId, ctx.orgId);

      const gallery = await ctx.galleries.getGalleryResponse(
        ctx.vehicleId,
        ctx.galleryId,
        ctx.orgId,
      );
      expect(gallery.explicitCoverItemId).toBeNull();
      expect(gallery.effectiveCoverItemId).toBeNull();
    });
  });

  it('volunteer can delete item created by another user (no owner check)', async () => {
    await withRollback(async (_tx, ctx) => {
      const item = await ctx.items.upload(
        ctx.vehicleId,
        ctx.galleryId,
        makeFile(JPEG_BUFFER),
        vehicleGalleryItemUploadMetadataSchema.parse({}),
        ctx.userId,
        26214400,
        ctx.orgId,
      );

      await expect(
        ctx.items.softDelete(ctx.vehicleId, ctx.galleryId, item.id, ctx.otherUserId, ctx.orgId),
      ).resolves.toBeUndefined();
    });
  });
});
