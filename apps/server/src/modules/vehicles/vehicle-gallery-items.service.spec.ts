import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { vehicleGalleryItemUploadMetadataSchema } from '@volunteerfleet/shared';
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
  const svc = new VehicleGalleryItemsService({} as never, storageStub as never);

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
        const items = new VehicleGalleryItemsService(tx as unknown as Database, storage as never);
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
