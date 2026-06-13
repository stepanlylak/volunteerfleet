import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { createDb, createPool, type Database } from '../../db/client.js';
import {
  documentGroups,
  documents,
  expenses,
  financialCategories,
  organizations,
  users,
  vehicles,
  vehicleStatusHistory,
} from '../../db/schema/index.js';
import { DocumentsService } from '../documents/documents.service.js';
import { DocumentGroupsService } from './document-groups.service.js';

// DB-backed tests for the document-groups move flow (guard + orphan cleanup).
// They run inside a rolled-back transaction passed to the service as its db, so
// the service's inner transaction becomes a savepoint. Skipped without DATABASE_URL.
const databaseUrl = process.env.DATABASE_URL;
const describeIfDb = databaseUrl ? describe : describe.skip;

class Rollback extends Error {}

describeIfDb('DocumentGroupsService', () => {
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
    service: DocumentGroupsService;
    documentsService: DocumentsService;
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
            status: 'new',
            createdBy: user!.id,
            updatedBy: user!.id,
          })
          .returning();

        const txDb = tx as unknown as Database;
        const documentsService = new DocumentsService(txDb, {} as never);
        const service = new DocumentGroupsService(txDb, documentsService);

        await fn(tx, {
          orgId: org!.id,
          userId: user!.id,
          vehicleId: vehicle!.id,
          service,
          documentsService,
        });
        throw new Rollback();
      });
    } catch (err) {
      if (!(err instanceof Rollback)) throw err;
    }
  }

  async function insertGroup(tx: Tx, ctx: SeedContext): Promise<string> {
    const [group] = await tx
      .insert(documentGroups)
      .values({
        organizationId: ctx.orgId,
        vehicleId: ctx.vehicleId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    return group!.id;
  }

  async function insertDoc(tx: Tx, ctx: SeedContext, groupId: string): Promise<string> {
    const [doc] = await tx
      .insert(documents)
      .values({
        organizationId: ctx.orgId,
        name: 'doc',
        kind: 'link',
        url: 'https://example.com/doc.pdf',
        groupId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    return doc!.id;
  }

  async function insertExpense(
    tx: Tx,
    ctx: SeedContext,
    documentGroupId: string | null = null,
  ): Promise<string> {
    const [category] = await tx
      .insert(financialCategories)
      .values({
        name: `category-${randomUUID()}`,
        sortOrder: 1,
      })
      .returning();
    const [expense] = await tx
      .insert(expenses)
      .values({
        organizationId: ctx.orgId,
        vehicleId: ctx.vehicleId,
        documentGroupId,
        expenseDate: '2026-01-01',
        amountMinor: 100,
        currency: 'UAH',
        rate: '1',
        rateSource: 'default',
        categoryId: category!.id,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    return expense!.id;
  }

  it('create returns a group with no documents', async () => {
    await withRollback(async (_tx, ctx) => {
      const group = await ctx.service.create({ vehicleId: ctx.vehicleId }, ctx.userId, ctx.orgId);
      expect(group.vehicleId).toBe(ctx.vehicleId);
      expect(group.documents).toEqual([]);
    });
  });

  it('lazily creates one group for an expense and reuses it', async () => {
    await withRollback(async (tx, ctx) => {
      const expenseId = await insertExpense(tx, ctx);

      const first = await ctx.service.create(
        { vehicleId: ctx.vehicleId, expenseId },
        ctx.userId,
        ctx.orgId,
      );
      const second = await ctx.service.create(
        { vehicleId: ctx.vehicleId, expenseId },
        ctx.userId,
        ctx.orgId,
      );

      expect(second.id).toBe(first.id);
      expect(first.expenseIds).toEqual([expenseId]);
      const expense = await tx.query.expenses.findFirst({
        where: eq(expenses.id, expenseId),
      });
      expect(expense?.documentGroupId).toBe(first.id);
    });
  });

  it('allows one document group to be shared by multiple expenses', async () => {
    await withRollback(async (tx, ctx) => {
      const groupId = await insertGroup(tx, ctx);
      const firstExpenseId = await insertExpense(tx, ctx, groupId);
      const secondExpenseId = await insertExpense(tx, ctx, groupId);

      const group = await ctx.service.findById(groupId, ctx.orgId);
      expect(group.expenseIds.sort()).toEqual([firstExpenseId, secondExpenseId].sort());
    });
  });

  it('lists the same grouped document for each expense sharing the group', async () => {
    await withRollback(async (tx, ctx) => {
      const groupId = await insertGroup(tx, ctx);
      const docId = await insertDoc(tx, ctx, groupId);
      const firstExpenseId = await insertExpense(tx, ctx, groupId);
      const secondExpenseId = await insertExpense(tx, ctx, groupId);

      for (const expenseId of [firstExpenseId, secondExpenseId]) {
        const result = await ctx.documentsService.list(
          {
            page: 1,
            pageSize: 100,
            expenseId,
            includeDeleted: false,
            excludeStatusBound: false,
          },
          'volunteer',
          ctx.orgId,
        );
        expect(result.items.map((document) => document.id)).toEqual([docId]);
      }
    });
  });

  it('hides grouped documents of a soft-deleted vehicle from the organization list', async () => {
    await withRollback(async (tx, ctx) => {
      const groupId = await insertGroup(tx, ctx);
      await insertDoc(tx, ctx, groupId);
      await tx
        .update(vehicles)
        .set({ deletedAt: new Date(), deletedBy: ctx.userId })
        .where(eq(vehicles.id, ctx.vehicleId));

      const result = await ctx.documentsService.list(
        {
          page: 1,
          pageSize: 100,
          includeDeleted: false,
          excludeStatusBound: false,
        },
        'volunteer',
        ctx.orgId,
      );
      expect(result.items).toEqual([]);
    });
  });

  it('updateName renames the group', async () => {
    await withRollback(async (tx, ctx) => {
      const groupId = await insertGroup(tx, ctx);
      const updated = await ctx.service.updateName(
        groupId,
        '  Техпаспорт  ',
        ctx.userId,
        ctx.orgId,
      );
      expect(updated.name).toBe('Техпаспорт');
    });
  });

  it('moveDocument moves a free document into the target group', async () => {
    await withRollback(async (tx, ctx) => {
      const target = await insertGroup(tx, ctx);
      const sourceGroup = await insertGroup(tx, ctx);
      const docId = await insertDoc(tx, ctx, sourceGroup);

      const result = await ctx.service.moveDocument(target, docId, ctx.orgId);
      expect(result.documents.map((d) => d.id)).toEqual([docId]);
    });
  });

  it('hard-deletes the source group when the move empties it', async () => {
    await withRollback(async (tx, ctx) => {
      const target = await insertGroup(tx, ctx);
      const sourceGroup = await insertGroup(tx, ctx);
      const docId = await insertDoc(tx, ctx, sourceGroup);

      await ctx.service.moveDocument(target, docId, ctx.orgId);

      const remaining = await tx.query.documentGroups.findFirst({
        where: eq(documentGroups.id, sourceGroup),
      });
      expect(remaining).toBeUndefined();
    });
  });

  it('clears expense references when moving the last active document out', async () => {
    await withRollback(async (tx, ctx) => {
      const target = await insertGroup(tx, ctx);
      const sourceGroup = await insertGroup(tx, ctx);
      const expenseId = await insertExpense(tx, ctx, sourceGroup);
      const docId = await insertDoc(tx, ctx, sourceGroup);

      await ctx.service.moveDocument(target, docId, ctx.orgId);

      const expense = await tx.query.expenses.findFirst({
        where: eq(expenses.id, expenseId),
      });
      expect(expense?.documentGroupId).toBeNull();
    });
  });

  it('deletes an orphan group after its last active document is soft-deleted', async () => {
    await withRollback(async (tx, ctx) => {
      const groupId = await insertGroup(tx, ctx);
      const expenseId = await insertExpense(tx, ctx, groupId);
      const docId = await insertDoc(tx, ctx, groupId);

      await ctx.documentsService.softDelete(
        docId,
        {
          sub: ctx.userId,
          email: 'test@example.com',
          userRole: 'user',
          orgRole: 'coordinator',
          activeOrgId: ctx.orgId,
          iat: 0,
          exp: 0,
        },
        ctx.orgId,
      );

      const group = await tx.query.documentGroups.findFirst({
        where: eq(documentGroups.id, groupId),
      });
      const expense = await tx.query.expenses.findFirst({
        where: eq(expenses.id, expenseId),
      });
      expect(group).toBeUndefined();
      expect(expense?.documentGroupId).toBeNull();
    });
  });

  it('keeps the source group when other documents remain', async () => {
    await withRollback(async (tx, ctx) => {
      const target = await insertGroup(tx, ctx);
      const sourceGroup = await insertGroup(tx, ctx);
      const movedDoc = await insertDoc(tx, ctx, sourceGroup);
      await insertDoc(tx, ctx, sourceGroup);

      await ctx.service.moveDocument(target, movedDoc, ctx.orgId);

      const remaining = await tx.query.documentGroups.findFirst({
        where: eq(documentGroups.id, sourceGroup),
      });
      expect(remaining).toBeDefined();
    });
  });

  it('deleteGroup removes the group and soft-deletes its documents', async () => {
    await withRollback(async (tx, ctx) => {
      const groupId = await insertGroup(tx, ctx);
      const docId = await insertDoc(tx, ctx, groupId);

      await ctx.service.deleteGroup(groupId, ctx.userId, ctx.orgId);

      const group = await tx.query.documentGroups.findFirst({
        where: eq(documentGroups.id, groupId),
      });
      expect(group).toBeUndefined();

      const doc = await tx.query.documents.findFirst({ where: eq(documents.id, docId) });
      expect(doc?.groupId).toBeNull();
      expect(doc?.vehicleId).toBe(ctx.vehicleId);
      expect(doc?.deletedAt).not.toBeNull();
    });
  });

  it('rejects deleting a status-bound group', async () => {
    await withRollback(async (tx, ctx) => {
      const statusGroup = await insertGroup(tx, ctx);
      await insertDoc(tx, ctx, statusGroup);
      await tx.insert(vehicleStatusHistory).values({
        organizationId: ctx.orgId,
        vehicleId: ctx.vehicleId,
        newStatus: 'paid',
        changedBy: ctx.userId,
        registrationGroupId: statusGroup,
      });

      await expect(ctx.service.deleteGroup(statusGroup, ctx.userId, ctx.orgId)).rejects.toThrow(
        /status-change evidence/,
      );
    });
  });

  it('rejects moving a document whose group is status-bound', async () => {
    await withRollback(async (tx, ctx) => {
      const statusGroup = await insertGroup(tx, ctx);
      const docId = await insertDoc(tx, ctx, statusGroup);
      await tx.insert(vehicleStatusHistory).values({
        organizationId: ctx.orgId,
        vehicleId: ctx.vehicleId,
        newStatus: 'paid',
        changedBy: ctx.userId,
        registrationGroupId: statusGroup,
      });
      const target = await insertGroup(tx, ctx);

      await expect(ctx.service.moveDocument(target, docId, ctx.orgId)).rejects.toThrow(
        /status-change evidence/,
      );

      // The document stays in its original (status-bound) group.
      const doc = await tx.query.documents.findFirst({
        where: and(eq(documents.id, docId)),
      });
      expect(doc?.groupId).toBe(statusGroup);
    });
  });
});
