import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import type { VehicleStatus } from '@volunteerfleet/shared';
import { createDb, createPool, type Database } from '../../db/client.js';
import {
  documentGroups,
  documents,
  organizations,
  users,
  vehicleAlertsView,
  vehicles,
  vehicleStatusHistory,
} from '../../db/schema/index.js';

// Integration tests for the vehicle_alerts_view SQL predicates (epic section 5).
// They run against the real Postgres (DATABASE_URL) so the view's CASE/WHEN
// logic is exercised, and use a transaction that is always rolled back so the
// database is left untouched. Skipped when DATABASE_URL is not configured.
const databaseUrl = process.env.DATABASE_URL;
const describeIfDb = databaseUrl ? describe : describe.skip;

class Rollback extends Error {}

describeIfDb('vehicle_alerts_view', () => {
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

  // Runs fn inside a transaction that is always rolled back.
  async function withRollback(fn: (tx: Tx, ctx: SeedContext) => Promise<void>): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        const ctx = await seedOrg(tx);
        await fn(tx, ctx);
        throw new Rollback();
      });
    } catch (err) {
      if (!(err instanceof Rollback)) throw err;
    }
  }

  interface SeedContext {
    orgId: string;
    userId: string;
  }

  async function seedOrg(tx: Tx): Promise<SeedContext> {
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
    return { orgId: org!.id, userId: user!.id };
  }

  async function insertVehicle(
    tx: Tx,
    ctx: SeedContext,
    status: VehicleStatus,
    overrides: Partial<typeof vehicles.$inferInsert> = {},
  ): Promise<string> {
    const [v] = await tx
      .insert(vehicles)
      .values({
        organizationId: ctx.orgId,
        identifier: `v-${randomUUID().slice(0, 8)}`,
        brand: 'Ford',
        model: 'Ranger',
        startDate: '2026-01-01',
        status,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
        ...overrides,
      })
      .returning();
    return v!.id;
  }

  // Creates a document group holding one document and returns the GROUP id
  // (status-history slots reference groups, not documents). The document carries
  // the org/deletedAt that the alert view checks.
  async function insertDoc(
    tx: Tx,
    ctx: SeedContext,
    vehicleId: string,
    overrides: Partial<typeof documents.$inferInsert> = {},
  ): Promise<string> {
    const [group] = await tx
      .insert(documentGroups)
      .values({
        organizationId: ctx.orgId,
        vehicleId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    await tx.insert(documents).values({
      organizationId: ctx.orgId,
      name: 'doc',
      kind: 'link',
      url: 'https://example.com/doc.pdf',
      groupId: group!.id,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
      ...overrides,
    });
    return group!.id;
  }

  async function insertHistory(
    tx: Tx,
    ctx: SeedContext,
    vehicleId: string,
    values: Partial<typeof vehicleStatusHistory.$inferInsert> & {
      newStatus: VehicleStatus;
    },
  ): Promise<void> {
    await tx.insert(vehicleStatusHistory).values({
      organizationId: ctx.orgId,
      vehicleId,
      changedBy: ctx.userId,
      ...values,
    });
  }

  async function alertTypes(tx: Tx, vehicleId: string): Promise<string[]> {
    const rows = await tx
      .select({ type: vehicleAlertsView.type })
      .from(vehicleAlertsView)
      .where(eq(vehicleAlertsView.vehicleId, vehicleId));
    return rows.map((r) => r.type!).sort();
  }

  it('lost vehicle has no alerts (terminal status is in no alert set)', async () => {
    await withRollback(async (tx, ctx) => {
      const vehicleId = await insertVehicle(tx, ctx, 'lost');
      await insertHistory(tx, ctx, vehicleId, { newStatus: 'lost', lostReason: 'destroyed' });
      expect(await alertTypes(tx, vehicleId)).toEqual([]);
    });
  });

  it('imported (non-local) paid vehicle missing all docs raises registration + customs alerts', async () => {
    await withRollback(async (tx, ctx) => {
      const vehicleId = await insertVehicle(tx, ctx, 'in_transit');
      await insertHistory(tx, ctx, vehicleId, { newStatus: 'paid', isLocalPurchase: false });
      await insertHistory(tx, ctx, vehicleId, { newStatus: 'in_transit' });
      expect(await alertTypes(tx, vehicleId)).toEqual([
        'missing_customs_declaration',
        'missing_registration_doc',
      ]);
    });
  });

  it('local purchase does not raise customs alerts', async () => {
    await withRollback(async (tx, ctx) => {
      const vehicleId = await insertVehicle(tx, ctx, 'arrived');
      await insertHistory(tx, ctx, vehicleId, { newStatus: 'paid', isLocalPurchase: true });
      await insertHistory(tx, ctx, vehicleId, { newStatus: 'arrived' });
      // Only registration is missing; no customs/stamped because purchase is local.
      expect(await alertTypes(tx, vehicleId)).toEqual(['missing_registration_doc']);
    });
  });

  it('attached active documents clear the corresponding alerts', async () => {
    await withRollback(async (tx, ctx) => {
      const vehicleId = await insertVehicle(tx, ctx, 'arrived');
      const regDoc = await insertDoc(tx, ctx, vehicleId);
      const stampedRegDoc = await insertDoc(tx, ctx, vehicleId);
      const customsDoc = await insertDoc(tx, ctx, vehicleId);
      const stampedDoc = await insertDoc(tx, ctx, vehicleId);
      await insertHistory(tx, ctx, vehicleId, {
        newStatus: 'paid',
        isLocalPurchase: false,
        registrationGroupId: regDoc,
      });
      await insertHistory(tx, ctx, vehicleId, {
        newStatus: 'in_transit',
        customsDeclarationGroupId: customsDoc,
        stampedRegistrationGroupId: stampedRegDoc,
      });
      await insertHistory(tx, ctx, vehicleId, {
        newStatus: 'arrived',
        stampedCustomsDeclarationGroupId: stampedDoc,
      });
      expect(await alertTypes(tx, vehicleId)).toEqual([]);
    });
  });

  it('soft-deleted document does not clear its alert', async () => {
    await withRollback(async (tx, ctx) => {
      const vehicleId = await insertVehicle(tx, ctx, 'paid');
      const regDoc = await insertDoc(tx, ctx, vehicleId, {
        deletedAt: new Date(),
        deletedBy: ctx.userId,
      });
      await insertHistory(tx, ctx, vehicleId, {
        newStatus: 'paid',
        isLocalPurchase: true,
        registrationGroupId: regDoc,
      });
      expect(await alertTypes(tx, vehicleId)).toEqual(['missing_registration_doc']);
    });
  });

  it('soft-deleted vehicle produces no alerts', async () => {
    await withRollback(async (tx, ctx) => {
      const vehicleId = await insertVehicle(tx, ctx, 'paid', {
        deletedAt: new Date(),
        deletedBy: ctx.userId,
      });
      await insertHistory(tx, ctx, vehicleId, { newStatus: 'paid', isLocalPurchase: true });
      expect(await alertTypes(tx, vehicleId)).toEqual([]);
    });
  });

  it('returned vehicle without return act raises missing_return_act', async () => {
    await withRollback(async (tx, ctx) => {
      const vehicleId = await insertVehicle(tx, ctx, 'returned');
      await insertHistory(tx, ctx, vehicleId, { newStatus: 'paid', isLocalPurchase: true });
      const regDoc = await insertDoc(tx, ctx, vehicleId);
      await insertHistory(tx, ctx, vehicleId, {
        newStatus: 'arrived',
        registrationGroupId: regDoc,
      });
      await insertHistory(tx, ctx, vehicleId, { newStatus: 'ready' });
      await insertHistory(tx, ctx, vehicleId, { newStatus: 'transferred' });
      await insertHistory(tx, ctx, vehicleId, { newStatus: 'returned' });
      // ready also wants a draft act → missing_transfer_act_draft persists in transferred/ready,
      // but current status is returned, so only the returned-specific alert applies here.
      expect(await alertTypes(tx, vehicleId)).toContain('missing_return_act');
      expect(await alertTypes(tx, vehicleId)).not.toContain('missing_transfer_act_signed');
    });
  });

  it('old signed act does not clear the alert for a new transfer after return', async () => {
    await withRollback(async (tx, ctx) => {
      const vehicleId = await insertVehicle(tx, ctx, 'transferred');
      const regDoc = await insertDoc(tx, ctx, vehicleId);
      const draftDoc = await insertDoc(tx, ctx, vehicleId);
      const oldSignedDoc = await insertDoc(tx, ctx, vehicleId);
      await insertHistory(tx, ctx, vehicleId, {
        newStatus: 'paid',
        isLocalPurchase: true,
        registrationGroupId: regDoc,
      });
      await insertHistory(tx, ctx, vehicleId, { newStatus: 'arrived' });
      await insertHistory(tx, ctx, vehicleId, {
        newStatus: 'ready',
        transferActDraftGroupId: draftDoc,
      });
      // First transfer with a signed act (older changed_at).
      await insertHistory(tx, ctx, vehicleId, {
        newStatus: 'transferred',
        transferActSignedGroupId: oldSignedDoc,
        isRegisteredAtServiceCenter: true,
        changedAt: new Date('2026-02-01T00:00:00Z'),
      });
      await insertHistory(tx, ctx, vehicleId, {
        newStatus: 'returned',
        changedAt: new Date('2026-03-01T00:00:00Z'),
      });
      // New transfer without a signed act (latest changed_at): the old act must NOT close it.
      await insertHistory(tx, ctx, vehicleId, {
        newStatus: 'transferred',
        isRegisteredAtServiceCenter: true,
        changedAt: new Date('2026-04-01T00:00:00Z'),
      });
      const types = await alertTypes(tx, vehicleId);
      expect(types).toContain('missing_transfer_act_signed');
    });
  });

  it('repair cycle: latest transfer with a fresh signed act has no signed-act alert', async () => {
    await withRollback(async (tx, ctx) => {
      const vehicleId = await insertVehicle(tx, ctx, 'transferred');
      const regDoc = await insertDoc(tx, ctx, vehicleId);
      const draftDoc = await insertDoc(tx, ctx, vehicleId);
      const signedDoc = await insertDoc(tx, ctx, vehicleId);
      await insertHistory(tx, ctx, vehicleId, {
        newStatus: 'paid',
        isLocalPurchase: true,
        registrationGroupId: regDoc,
      });
      await insertHistory(tx, ctx, vehicleId, { newStatus: 'arrived' });
      await insertHistory(tx, ctx, vehicleId, {
        newStatus: 'ready',
        transferActDraftGroupId: draftDoc,
        changedAt: new Date('2026-02-01T00:00:00Z'),
      });
      await insertHistory(tx, ctx, vehicleId, {
        newStatus: 'transferred',
        transferActSignedGroupId: signedDoc,
        isRegisteredAtServiceCenter: true,
        changedAt: new Date('2026-02-15T00:00:00Z'),
      });
      // transferred -> in_repair -> ready -> transferred (reuse existing signed act).
      await insertHistory(tx, ctx, vehicleId, {
        newStatus: 'in_repair',
        changedAt: new Date('2026-03-01T00:00:00Z'),
      });
      await insertHistory(tx, ctx, vehicleId, {
        newStatus: 'ready',
        changedAt: new Date('2026-03-10T00:00:00Z'),
      });
      await insertHistory(tx, ctx, vehicleId, {
        newStatus: 'transferred',
        transferActSignedGroupId: signedDoc,
        isRegisteredAtServiceCenter: true,
        changedAt: new Date('2026-03-20T00:00:00Z'),
      });
      const types = await alertTypes(tx, vehicleId);
      expect(types).not.toContain('missing_transfer_act_signed');
      expect(types).not.toContain('not_registered_at_service_center');
    });
  });

  it('not_registered_at_service_center raised when latest transfer is not registered', async () => {
    await withRollback(async (tx, ctx) => {
      const vehicleId = await insertVehicle(tx, ctx, 'transferred');
      const regDoc = await insertDoc(tx, ctx, vehicleId);
      const draftDoc = await insertDoc(tx, ctx, vehicleId);
      const signedDoc = await insertDoc(tx, ctx, vehicleId);
      await insertHistory(tx, ctx, vehicleId, {
        newStatus: 'paid',
        isLocalPurchase: true,
        registrationGroupId: regDoc,
      });
      await insertHistory(tx, ctx, vehicleId, { newStatus: 'arrived' });
      await insertHistory(tx, ctx, vehicleId, {
        newStatus: 'ready',
        transferActDraftGroupId: draftDoc,
      });
      await insertHistory(tx, ctx, vehicleId, {
        newStatus: 'transferred',
        transferActSignedGroupId: signedDoc,
        isRegisteredAtServiceCenter: false,
      });
      expect(await alertTypes(tx, vehicleId)).toEqual(['not_registered_at_service_center']);
    });
  });

  it('org isolation: a document owned by another org does not clear the alert', async () => {
    await withRollback(async (tx, ctx) => {
      const other = await seedOrg(tx);
      const vehicleId = await insertVehicle(tx, ctx, 'paid');
      // Document belongs to a different organization than the vehicle/history.
      const foreignDoc = await insertDoc(tx, other, vehicleId);
      await insertHistory(tx, ctx, vehicleId, {
        newStatus: 'paid',
        isLocalPurchase: true,
        registrationGroupId: foreignDoc,
      });
      expect(await alertTypes(tx, vehicleId)).toEqual(['missing_registration_doc']);
    });
  });

  it('getAlertsForVehicles query shape works across multiple vehicles', async () => {
    await withRollback(async (tx, ctx) => {
      const lostId = await insertVehicle(tx, ctx, 'lost');
      await insertHistory(tx, ctx, lostId, { newStatus: 'lost', lostReason: 'x' });
      const paidId = await insertVehicle(tx, ctx, 'paid');
      await insertHistory(tx, ctx, paidId, { newStatus: 'paid', isLocalPurchase: true });

      const rows = await tx
        .select({ vehicleId: vehicleAlertsView.vehicleId, type: vehicleAlertsView.type })
        .from(vehicleAlertsView)
        .where(inArray(vehicleAlertsView.vehicleId, [lostId, paidId]));

      const byVehicle = new Map<string, string[]>();
      for (const r of rows) {
        const list = byVehicle.get(r.vehicleId!) ?? [];
        list.push(r.type!);
        byVehicle.set(r.vehicleId!, list);
      }
      expect(byVehicle.get(lostId)).toBeUndefined();
      expect(byVehicle.get(paidId)).toEqual(['missing_registration_doc']);
    });
  });
});
