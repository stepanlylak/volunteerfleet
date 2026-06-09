import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb, createPool, type Database } from '../../db/client.js';
import {
  organizations,
  users,
  vehicleGalleries,
  vehicleGalleryItems,
  vehicles,
} from '../../db/schema/index.js';

// Integration tests for the vehicle gallery DB invariants (epic section 4):
// single active main per vehicle, main/custom shape checks, case-insensitive
// unique active custom names and unique active (gallery_id, sort_order).
// They run against the real Postgres (DATABASE_URL) inside a transaction that
// is always rolled back. Skipped when DATABASE_URL is not configured.
const databaseUrl = process.env.DATABASE_URL;
const describeIfDb = databaseUrl ? describe : describe.skip;

class Rollback extends Error {}

describeIfDb('vehicle galleries schema invariants', () => {
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
        const [vehicle] = await tx
          .insert(vehicles)
          .values({
            organizationId: org!.id,
            identifier: `v-${randomUUID().slice(0, 8)}`,
            brand: 'Ford',
            model: 'Ranger',
            startDate: '2026-01-01',
            createdBy: user!.id,
            updatedBy: user!.id,
          })
          .returning();
        await fn(tx, { orgId: org!.id, userId: user!.id, vehicleId: vehicle!.id });
        throw new Rollback();
      });
    } catch (err) {
      if (!(err instanceof Rollback)) throw err;
    }
  }

  function galleryValues(
    ctx: SeedContext,
    overrides: Partial<typeof vehicleGalleries.$inferInsert> = {},
  ): typeof vehicleGalleries.$inferInsert {
    return {
      organizationId: ctx.orgId,
      vehicleId: ctx.vehicleId,
      kind: 'main',
      isPublic: true,
      sortOrder: 0,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
      ...overrides,
    };
  }

  // Expected violations run in a nested savepoint so the outer tx stays usable.
  function attempt(tx: Tx, values: typeof vehicleGalleries.$inferInsert): Promise<unknown> {
    return tx.transaction(async (sp) => {
      await sp.insert(vehicleGalleries).values(values);
    });
  }

  it('allows only one active main gallery per vehicle', async () => {
    await withRollback(async (tx, ctx) => {
      await tx.insert(vehicleGalleries).values(galleryValues(ctx));
      await expect(attempt(tx, galleryValues(ctx))).rejects.toThrow(
        /vehicle_galleries_main_active_unique/,
      );
    });
  });

  it('rejects main with custom metadata, private flag or non-zero order', async () => {
    await withRollback(async (tx, ctx) => {
      await expect(attempt(tx, galleryValues(ctx, { name: 'X' }))).rejects.toThrow(
        /vehicle_galleries_main_shape_check/,
      );
      await expect(attempt(tx, galleryValues(ctx, { isPublic: false }))).rejects.toThrow(
        /vehicle_galleries_main_shape_check/,
      );
      await expect(attempt(tx, galleryValues(ctx, { sortOrder: 1 }))).rejects.toThrow(
        /vehicle_galleries_main_shape_check/,
      );
    });
  });

  it('rejects custom gallery without a non-empty name', async () => {
    await withRollback(async (tx, ctx) => {
      const custom = galleryValues(ctx, { kind: 'custom', isPublic: false, sortOrder: 1 });
      await expect(attempt(tx, custom)).rejects.toThrow(/vehicle_galleries_custom_shape_check/);
      await expect(attempt(tx, { ...custom, name: '   ' })).rejects.toThrow(
        /vehicle_galleries_custom_shape_check/,
      );
    });
  });

  it('enforces case-insensitive unique active custom names per vehicle', async () => {
    await withRollback(async (tx, ctx) => {
      const custom = galleryValues(ctx, {
        kind: 'custom',
        isPublic: false,
        sortOrder: 1,
        name: 'Після ремонту',
      });
      const [first] = await tx.insert(vehicleGalleries).values(custom).returning();
      await expect(
        attempt(tx, { ...custom, sortOrder: 2, name: '  ПІСЛЯ РЕМОНТУ ' }),
      ).rejects.toThrow(/vehicle_galleries_name_active_unique/);

      // Soft-deleting the first frees the name for a new active gallery.
      await tx
        .update(vehicleGalleries)
        .set({ deletedAt: new Date(), deletedBy: ctx.userId })
        .where(eq(vehicleGalleries.id, first!.id));
      await tx.insert(vehicleGalleries).values({ ...custom, sortOrder: 2 });
    });
  });

  it('enforces unique active (gallery_id, sort_order) for items', async () => {
    await withRollback(async (tx, ctx) => {
      const [gallery] = await tx.insert(vehicleGalleries).values(galleryValues(ctx)).returning();
      const itemValues: typeof vehicleGalleryItems.$inferInsert = {
        organizationId: ctx.orgId,
        vehicleId: ctx.vehicleId,
        galleryId: gallery!.id,
        type: 'image',
        fileKey: `vehicle-galleries/${ctx.vehicleId}/${gallery!.id}/${randomUUID()}/a.jpg`,
        originalName: 'a.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1,
        sortOrder: 1,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      };
      const [first] = await tx.insert(vehicleGalleryItems).values(itemValues).returning();
      await expect(
        tx.transaction(async (sp) => {
          await sp.insert(vehicleGalleryItems).values(itemValues);
        }),
      ).rejects.toThrow(/vehicle_gallery_items_gallery_order_active_unique/);

      await tx
        .update(vehicleGalleryItems)
        .set({ deletedAt: new Date(), deletedBy: ctx.userId })
        .where(eq(vehicleGalleryItems.id, first!.id));
      await tx.insert(vehicleGalleryItems).values(itemValues);
    });
  });

  it('rejects a cover item that does not exist', async () => {
    await withRollback(async (tx, ctx) => {
      await expect(attempt(tx, galleryValues(ctx, { coverItemId: randomUUID() }))).rejects.toThrow(
        /vehicle_galleries_cover_item_id_vehicle_gallery_items_id_fk/,
      );
    });
  });
});
