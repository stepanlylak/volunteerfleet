import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { vehicleGalleryCreateSchema, vehicleGalleryUpdateSchema } from '@volunteerfleet/shared';
import { createDb, createPool, type Database } from '../../db/client.js';
import {
  organizations,
  users,
  vehicleGalleries,
  vehicleGalleryItems,
  vehicles,
} from '../../db/schema/index.js';
import { ORG_ROLES_KEY } from '../../common/decorators/org-roles.decorator.js';
import { VehicleGalleriesService } from './vehicle-galleries.service.js';
import { VehiclesService } from './vehicles.service.js';
import { VehiclesController } from './vehicles.controller.js';

// Integration tests for GAL-3: atomic main gallery creation and gallery CRUD.
// They run against the real Postgres (DATABASE_URL) inside a transaction that
// is always rolled back. Skipped when DATABASE_URL is not configured.
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

describeIfDb('VehicleGalleriesService (GAL-3)', () => {
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
        const [otherOrg] = await tx
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

        await fn(tx, {
          orgId: org!.id,
          otherOrgId: otherOrg!.id,
          userId: user!.id,
          vehicleId: vehicle.id,
          vehiclesService,
          galleries,
        });
        throw new Rollback();
      });
    } catch (err) {
      if (!(err instanceof Rollback)) throw err;
    }
  }

  function createCustom(ctx: SeedContext, name: string, overrides: Record<string, unknown> = {}) {
    return ctx.galleries.create(
      ctx.vehicleId,
      vehicleGalleryCreateSchema.parse({ name, ...overrides }),
      ctx.userId,
      ctx.orgId,
    );
  }

  async function insertItem(tx: Tx, ctx: SeedContext, galleryId: string, sortOrder: number) {
    const [item] = await tx
      .insert(vehicleGalleryItems)
      .values({
        organizationId: ctx.orgId,
        vehicleId: ctx.vehicleId,
        galleryId,
        type: 'image',
        fileKey: `vehicle-galleries/${ctx.vehicleId}/${galleryId}/${randomUUID()}/a.jpg`,
        originalName: 'a.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1,
        sortOrder,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    return item!;
  }

  it('create vehicle atomically creates exactly one active main gallery', async () => {
    await withRollback(async (tx, ctx) => {
      const rows = await tx.query.vehicleGalleries.findMany({
        where: and(
          eq(vehicleGalleries.vehicleId, ctx.vehicleId),
          isNull(vehicleGalleries.deletedAt),
        ),
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        kind: 'main',
        name: null,
        isPublic: true,
        sortOrder: 0,
        organizationId: ctx.orgId,
      });
    });
  });

  it('rolls back the vehicle when main gallery creation fails', async () => {
    await withRollback(async (tx, ctx) => {
      const failingGalleries = {
        insertMainGallery: () => Promise.reject(new Error('main gallery failed')),
      };
      const svc = new VehiclesService(
        tx as unknown as Database,
        alertServiceStub as never,
        failingGalleries as never,
      );
      const identifier = `v-${randomUUID().slice(0, 8)}`;
      await expect(
        svc.create({ ...VEHICLE_INPUT, identifier }, ctx.userId, ctx.orgId),
      ).rejects.toThrow('main gallery failed');

      const orphan = await tx.query.vehicles.findFirst({
        where: eq(vehicles.identifier, identifier),
      });
      expect(orphan).toBeUndefined();
    });
  });

  it('creates custom galleries private by default with sequential sortOrder', async () => {
    await withRollback(async (tx, ctx) => {
      const first = await createCustom(ctx, 'До ремонту');
      const second = await createCustom(ctx, 'Після ремонту', { description: '  ' });

      expect(first).toMatchObject({ kind: 'custom', isPublic: false, sortOrder: 1 });
      expect(second).toMatchObject({ sortOrder: 2, description: null });

      const list = await ctx.galleries.list(ctx.vehicleId, ctx.orgId);
      expect(list.total).toBe(3);
      expect(list.items.map((g) => g.kind)).toEqual(['main', 'custom', 'custom']);
      expect(list.items[0]!.maxItems).toBe(30);
    });
  });

  it('rejects duplicate active custom names case-insensitively', async () => {
    await withRollback(async (tx, ctx) => {
      await createCustom(ctx, 'Після ремонту');
      await expect(createCustom(ctx, '  ПІСЛЯ РЕМОНТУ ')).rejects.toThrow(
        'GALLERY_NAME_ALREADY_EXISTS',
      );

      const other = await createCustom(ctx, 'Інша');
      await expect(
        ctx.galleries.update(
          ctx.vehicleId,
          other.id,
          vehicleGalleryUpdateSchema.parse({ name: 'після ремонту' }),
          ctx.userId,
          ctx.orgId,
        ),
      ).rejects.toThrow('GALLERY_NAME_ALREADY_EXISTS');
    });
  });

  it('frees the name after soft-delete of a custom gallery', async () => {
    await withRollback(async (tx, ctx) => {
      const first = await createCustom(ctx, 'Після ремонту');
      await ctx.galleries.softDelete(ctx.vehicleId, first.id, ctx.userId, ctx.orgId);
      await expect(createCustom(ctx, 'Після ремонту')).resolves.toMatchObject({
        name: 'Після ремонту',
      });
    });
  });

  it('allows editing only the description of main', async () => {
    await withRollback(async (tx, ctx) => {
      const list = await ctx.galleries.list(ctx.vehicleId, ctx.orgId);
      const main = list.items[0]!;

      const updated = await ctx.galleries.update(
        ctx.vehicleId,
        main.id,
        vehicleGalleryUpdateSchema.parse({ description: 'Опис' }),
        ctx.userId,
        ctx.orgId,
      );
      expect(updated.description).toBe('Опис');

      for (const dto of [{ name: 'X' }, { isPublic: false }, { isPublic: true }]) {
        await expect(
          ctx.galleries.update(
            ctx.vehicleId,
            main.id,
            vehicleGalleryUpdateSchema.parse(dto),
            ctx.userId,
            ctx.orgId,
          ),
        ).rejects.toThrow('MAIN_GALLERY_IMMUTABLE');
      }
    });
  });

  it('updates custom name, description and visibility', async () => {
    await withRollback(async (tx, ctx) => {
      const gallery = await createCustom(ctx, 'До ремонту');
      const updated = await ctx.galleries.update(
        ctx.vehicleId,
        gallery.id,
        vehicleGalleryUpdateSchema.parse({ name: 'Передача', description: '', isPublic: true }),
        ctx.userId,
        ctx.orgId,
      );
      expect(updated).toMatchObject({ name: 'Передача', description: null, isPublic: true });
    });
  });

  it('forbids deleting main and soft-deletes custom with its items atomically', async () => {
    await withRollback(async (tx, ctx) => {
      const list = await ctx.galleries.list(ctx.vehicleId, ctx.orgId);
      await expect(
        ctx.galleries.softDelete(ctx.vehicleId, list.items[0]!.id, ctx.userId, ctx.orgId),
      ).rejects.toThrow('MAIN_GALLERY_DELETE_FORBIDDEN');

      const custom = await createCustom(ctx, 'Після ремонту');
      await insertItem(tx, ctx, custom.id, 1);
      await insertItem(tx, ctx, custom.id, 2);

      await ctx.galleries.softDelete(ctx.vehicleId, custom.id, ctx.userId, ctx.orgId);

      const galleryRow = await tx.query.vehicleGalleries.findFirst({
        where: eq(vehicleGalleries.id, custom.id),
      });
      expect(galleryRow?.deletedAt).not.toBeNull();
      expect(galleryRow?.deletedBy).toBe(ctx.userId);

      const itemRows = await tx.query.vehicleGalleryItems.findMany({
        where: eq(vehicleGalleryItems.galleryId, custom.id),
      });
      expect(itemRows).toHaveLength(2);
      expect(itemRows.every((row) => row.deletedAt !== null)).toBe(true);

      const remaining = await ctx.galleries.list(ctx.vehicleId, ctx.orgId);
      expect(remaining.total).toBe(1);
    });
  });

  it('computes explicit and effective covers from active items', async () => {
    await withRollback(async (tx, ctx) => {
      const custom = await createCustom(ctx, 'Після ремонту');
      const first = await insertItem(tx, ctx, custom.id, 1);
      const second = await insertItem(tx, ctx, custom.id, 2);

      let list = await ctx.galleries.list(ctx.vehicleId, ctx.orgId);
      let gallery = list.items.find((g) => g.id === custom.id)!;
      expect(gallery.explicitCoverItemId).toBeNull();
      expect(gallery.effectiveCoverItemId).toBe(first.id);
      expect(gallery.items.map((i) => i.id)).toEqual([first.id, second.id]);

      await tx
        .update(vehicleGalleries)
        .set({ coverItemId: second.id })
        .where(eq(vehicleGalleries.id, custom.id));

      list = await ctx.galleries.list(ctx.vehicleId, ctx.orgId);
      gallery = list.items.find((g) => g.id === custom.id)!;
      expect(gallery.explicitCoverItemId).toBe(second.id);
      expect(gallery.effectiveCoverItemId).toBe(second.id);
    });
  });

  it('returns 404 for foreign org or foreign vehicle galleries', async () => {
    await withRollback(async (tx, ctx) => {
      const custom = await createCustom(ctx, 'Після ремонту');

      await expect(ctx.galleries.list(ctx.vehicleId, ctx.otherOrgId)).rejects.toThrow('not found');
      await expect(
        ctx.galleries.update(
          ctx.vehicleId,
          custom.id,
          vehicleGalleryUpdateSchema.parse({ name: 'X' }),
          ctx.userId,
          ctx.otherOrgId,
        ),
      ).rejects.toThrow('GALLERY_NOT_FOUND');

      const otherVehicle = await ctx.vehiclesService.create(
        { ...VEHICLE_INPUT, identifier: `v-${randomUUID().slice(0, 8)}` },
        ctx.userId,
        ctx.orgId,
      );
      await expect(
        ctx.galleries.softDelete(otherVehicle.id, custom.id, ctx.userId, ctx.orgId),
      ).rejects.toThrow('GALLERY_NOT_FOUND');
    });
  });
});

describe('VehiclesController gallery permissions (GAL-3)', () => {
  const rolesOf = (method: keyof VehiclesController): string[] =>
    Reflect.getMetadata(ORG_ROLES_KEY, VehiclesController.prototype[method]) as string[];

  it('allows all org roles to read and only coordinator/volunteer to mutate', () => {
    expect(rolesOf('listGalleries')).toEqual(['coordinator', 'volunteer', 'viewer']);
    expect(rolesOf('createGallery')).toEqual(['coordinator', 'volunteer']);
    expect(rolesOf('updateGallery')).toEqual(['coordinator', 'volunteer']);
    expect(rolesOf('removeGallery')).toEqual(['coordinator', 'volunteer']);
  });
});
