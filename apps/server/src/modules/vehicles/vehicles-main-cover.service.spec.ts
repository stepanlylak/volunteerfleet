import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb, createPool, type Database } from '../../db/client.js';
import {
  organizations,
  users,
  vehicleGalleries,
  vehicleGalleryItems,
} from '../../db/schema/index.js';
import { VehicleGalleriesService } from './vehicle-galleries.service.js';
import { VehiclesService } from './vehicles.service.js';

// Integration tests for GAL-7: effective main cover in vehicle responses.
// Run against the real Postgres (DATABASE_URL) inside a rolled-back transaction.
// Skipped when DATABASE_URL is not configured.
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

describeIfDb('VehiclesService main gallery cover (GAL-7)', () => {
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
    vehicleId: string;
    mainGalleryId: string;
    vehiclesService: VehiclesService;
    galleries: VehicleGalleriesService;
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

        const galleries = new VehicleGalleriesService(tx as unknown as Database);
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

        const galleryList = await galleries.list(vehicle.id, org!.id);
        const mainGalleryId = galleryList.items[0]!.id;

        await fn(tx, {
          orgId: org!.id,
          userId: user!.id,
          vehicleId: vehicle.id,
          mainGalleryId,
          vehiclesService,
          galleries,
        });
        throw new Rollback();
      });
    } catch (err) {
      if (!(err instanceof Rollback)) throw err;
    }
  }

  async function insertItem(
    tx: Tx,
    ctx: SeedContext,
    galleryId: string,
    sortOrder: number,
    mimeType = 'image/jpeg',
  ) {
    const [item] = await tx
      .insert(vehicleGalleryItems)
      .values({
        organizationId: ctx.orgId,
        vehicleId: ctx.vehicleId,
        galleryId,
        type: 'image',
        fileKey: `vehicle-galleries/${ctx.vehicleId}/${galleryId}/${randomUUID()}/a.jpg`,
        originalName: 'a.jpg',
        mimeType,
        sizeBytes: 1,
        sortOrder,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    return item!;
  }

  it('empty main gallery returns mainGalleryCover: null in detail response', async () => {
    await withRollback(async (_tx, ctx) => {
      const response = await ctx.vehiclesService.findById(ctx.vehicleId, ctx.orgId);
      expect(response.mainGalleryCover).toBeNull();
    });
  });

  it('empty main gallery returns mainGalleryCover: null in list response', async () => {
    await withRollback(async (_tx, ctx) => {
      const list = await ctx.vehiclesService.list(
        { page: 1, pageSize: 10, includeDeleted: false },
        'coordinator',
        ctx.orgId,
      );
      const vehicle = list.items.find((v) => v.id === ctx.vehicleId)!;
      expect(vehicle.mainGalleryCover).toBeNull();
    });
  });

  it('fallback: no explicit cover returns first active item as cover', async () => {
    await withRollback(async (tx, ctx) => {
      const first = await insertItem(tx, ctx, ctx.mainGalleryId, 0, 'image/jpeg');
      await insertItem(tx, ctx, ctx.mainGalleryId, 1, 'image/png');

      const response = await ctx.vehiclesService.findById(ctx.vehicleId, ctx.orgId);
      expect(response.mainGalleryCover).toEqual(
        expect.objectContaining({
          galleryId: ctx.mainGalleryId,
          itemId: first.id,
          mimeType: 'image/jpeg',
        }),
      );
    });
  });

  it('explicit cover returns the designated item as cover', async () => {
    await withRollback(async (tx, ctx) => {
      await insertItem(tx, ctx, ctx.mainGalleryId, 0, 'image/jpeg');
      const second = await insertItem(tx, ctx, ctx.mainGalleryId, 1, 'image/png');

      await tx
        .update(vehicleGalleries)
        .set({ coverItemId: second.id })
        .where(eq(vehicleGalleries.id, ctx.mainGalleryId));

      const response = await ctx.vehiclesService.findById(ctx.vehicleId, ctx.orgId);
      expect(response.mainGalleryCover).toEqual(
        expect.objectContaining({
          galleryId: ctx.mainGalleryId,
          itemId: second.id,
          mimeType: 'image/png',
        }),
      );
    });
  });

  it('explicit invalid cover (soft-deleted item) falls back to first active item', async () => {
    await withRollback(async (tx, ctx) => {
      const first = await insertItem(tx, ctx, ctx.mainGalleryId, 0, 'image/jpeg');
      const second = await insertItem(tx, ctx, ctx.mainGalleryId, 1, 'image/png');

      await tx
        .update(vehicleGalleries)
        .set({ coverItemId: second.id })
        .where(eq(vehicleGalleries.id, ctx.mainGalleryId));

      // Soft-delete the explicit cover item
      await tx
        .update(vehicleGalleryItems)
        .set({ deletedAt: new Date(), deletedBy: ctx.userId })
        .where(eq(vehicleGalleryItems.id, second.id));

      const response = await ctx.vehiclesService.findById(ctx.vehicleId, ctx.orgId);
      expect(response.mainGalleryCover).toEqual(
        expect.objectContaining({
          galleryId: ctx.mainGalleryId,
          itemId: first.id,
          mimeType: 'image/jpeg',
        }),
      );
    });
  });

  it('list and detail return the same mainGalleryCover for the same vehicle', async () => {
    await withRollback(async (tx, ctx) => {
      await insertItem(tx, ctx, ctx.mainGalleryId, 0, 'image/jpeg');
      const second = await insertItem(tx, ctx, ctx.mainGalleryId, 1, 'image/webp');

      await tx
        .update(vehicleGalleries)
        .set({ coverItemId: second.id })
        .where(eq(vehicleGalleries.id, ctx.mainGalleryId));

      const detail = await ctx.vehiclesService.findById(ctx.vehicleId, ctx.orgId);
      const list = await ctx.vehiclesService.list(
        { page: 1, pageSize: 10, includeDeleted: false },
        'coordinator',
        ctx.orgId,
      );
      const listItem = list.items.find((v) => v.id === ctx.vehicleId)!;

      expect(detail.mainGalleryCover).toEqual(
        expect.objectContaining({
          galleryId: ctx.mainGalleryId,
          itemId: second.id,
          mimeType: 'image/webp',
        }),
      );
      expect(listItem.mainGalleryCover).toEqual(detail.mainGalleryCover);
    });
  });

  it('list with multiple vehicles returns individual covers without N+1', async () => {
    await withRollback(async (tx, ctx) => {
      // Create a second vehicle in same org
      const galleries2 = new VehicleGalleriesService(tx as unknown as Database);
      const vehiclesService2 = new VehiclesService(
        tx as unknown as Database,
        alertServiceStub as never,
        galleries2,
      );
      const vehicle2 = await vehiclesService2.create(
        { ...VEHICLE_INPUT, identifier: `v2-${randomUUID().slice(0, 8)}` },
        ctx.userId,
        ctx.orgId,
      );
      const galleryList2 = await galleries2.list(vehicle2.id, ctx.orgId);
      const mainGalleryId2 = galleryList2.items[0]!.id;

      const item1 = await insertItem(tx, ctx, ctx.mainGalleryId, 0, 'image/jpeg');
      const item2 = await insertItem(tx, ctx, mainGalleryId2, 0, 'image/png');

      const list = await ctx.vehiclesService.list(
        { page: 1, pageSize: 10, includeDeleted: false },
        'coordinator',
        ctx.orgId,
      );

      const v1 = list.items.find((v) => v.id === ctx.vehicleId)!;
      const v2 = list.items.find((v) => v.id === vehicle2.id)!;

      expect(v1.mainGalleryCover).toEqual(
        expect.objectContaining({
          galleryId: ctx.mainGalleryId,
          itemId: item1.id,
          mimeType: 'image/jpeg',
        }),
      );
      expect(v2.mainGalleryCover).toEqual(
        expect.objectContaining({
          galleryId: mainGalleryId2,
          itemId: item2.id,
          mimeType: 'image/png',
        }),
      );
    });
  });

  it('custom gallery is never used as vehicle cover (only main gallery)', async () => {
    await withRollback(async (tx, ctx) => {
      // Create a custom gallery with items but no items in main gallery
      const [customGallery] = await tx
        .insert(vehicleGalleries)
        .values({
          organizationId: ctx.orgId,
          vehicleId: ctx.vehicleId,
          kind: 'custom',
          name: 'Custom Gallery',
          isPublic: false,
          sortOrder: 1,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        })
        .returning();

      await insertItem(tx, ctx, customGallery!.id, 0, 'image/jpeg');

      const response = await ctx.vehiclesService.findById(ctx.vehicleId, ctx.orgId);
      expect(response.mainGalleryCover).toBeNull();
    });
  });

  it('getMainGalleryCoversForVehicles returns empty map for empty input', async () => {
    await withRollback(async (_tx, ctx) => {
      const result = await ctx.galleries.getMainGalleryCoversForVehicles([], ctx.orgId);
      expect(result.size).toBe(0);
    });
  });
});
