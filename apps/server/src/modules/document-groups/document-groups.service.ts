import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import type { DocumentGroupCreate, DocumentGroupResponse } from '@volunteerfleet/shared';
import { DB } from '../../db/db.module.js';
import type { Database } from '../../db/client.js';
import {
  documentGroups,
  documents,
  donations,
  expenses,
  vehicles,
  vehicleStatusHistory,
} from '../../db/schema/index.js';
import { DocumentsService } from '../documents/documents.service.js';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

type GroupRow = typeof documentGroups.$inferSelect & {
  expenses?: { id: string }[];
  donations?: { id: string }[];
  createdByUser?: { id: string; fullName: string };
  updatedByUser?: { id: string; fullName: string };
};

@Injectable()
export class DocumentGroupsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly documentsService: DocumentsService,
  ) {}

  async create(
    input: DocumentGroupCreate,
    userId: string,
    organizationId: string,
  ): Promise<DocumentGroupResponse> {
    const vehicle = await this.db.query.vehicles.findFirst({
      where: and(
        eq(vehicles.id, input.vehicleId),
        eq(vehicles.organizationId, organizationId),
        isNull(vehicles.deletedAt),
      ),
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${input.vehicleId} not found in this organization`);
    }

    const groupId = await this.db.transaction(async (tx) => {
      if (input.expenseId) {
        const expense = await tx.query.expenses.findFirst({
          where: and(
            eq(expenses.id, input.expenseId),
            eq(expenses.organizationId, organizationId),
            isNull(expenses.deletedAt),
          ),
        });
        if (!expense) {
          throw new NotFoundException(`Expense ${input.expenseId} not found in this organization`);
        }
        if (expense.vehicleId !== input.vehicleId) {
          throw new BadRequestException(
            'Expense and document group must belong to the same vehicle',
          );
        }
        if (expense.documentGroupId) return expense.documentGroupId;
      }

      if (input.donationId) {
        const donation = await tx.query.donations.findFirst({
          where: and(
            eq(donations.id, input.donationId),
            eq(donations.organizationId, organizationId),
            isNull(donations.deletedAt),
          ),
        });
        if (!donation) {
          throw new NotFoundException(
            `Donation ${input.donationId} not found in this organization`,
          );
        }
        if (donation.vehicleId !== input.vehicleId) {
          throw new BadRequestException(
            'Donation and document group must belong to the same vehicle',
          );
        }
        if (donation.documentGroupId) return donation.documentGroupId;
      }

      const inserted = await tx
        .insert(documentGroups)
        .values({
          organizationId,
          vehicleId: input.vehicleId,
          name: input.name ?? null,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning({ id: documentGroups.id });

      const row = inserted[0];
      if (!row) throw new Error('Insert returned no rows');

      if (input.expenseId) {
        await tx
          .update(expenses)
          .set({ documentGroupId: row.id, updatedBy: userId, updatedAt: new Date() })
          .where(
            and(eq(expenses.id, input.expenseId), eq(expenses.organizationId, organizationId)),
          );
      }
      if (input.donationId) {
        await tx
          .update(donations)
          .set({ documentGroupId: row.id, updatedBy: userId, updatedAt: new Date() })
          .where(
            and(eq(donations.id, input.donationId), eq(donations.organizationId, organizationId)),
          );
      }
      return row.id;
    });

    return this.findById(groupId, organizationId);
  }

  async findById(id: string, organizationId: string): Promise<DocumentGroupResponse> {
    const group = await this.findRow(id, organizationId);
    const docs = await this.documentsService.listByGroup(id, organizationId);
    return this.toResponse(group, docs);
  }

  async updateName(
    id: string,
    name: string | null,
    userId: string,
    organizationId: string,
  ): Promise<DocumentGroupResponse> {
    const updated = await this.db
      .update(documentGroups)
      .set({ name: name?.trim() || null, updatedBy: userId, updatedAt: new Date() })
      .where(and(eq(documentGroups.id, id), eq(documentGroups.organizationId, organizationId)))
      .returning({ id: documentGroups.id });
    if (!updated[0]) throw new NotFoundException(`Document group ${id} not found`);
    return this.findById(id, organizationId);
  }

  // Move an existing document into this group. The document's previous group, if
  // it becomes empty, is hard-deleted. A document whose current group is bound to
  // a status-history slot is status evidence and cannot be moved (guard).
  async moveDocument(
    groupId: string,
    documentId: string,
    organizationId: string,
  ): Promise<DocumentGroupResponse> {
    await this.db.transaction(async (tx) => {
      const target = await tx.query.documentGroups.findFirst({
        where: and(
          eq(documentGroups.id, groupId),
          eq(documentGroups.organizationId, organizationId),
        ),
      });
      if (!target) throw new NotFoundException(`Document group ${groupId} not found`);

      const document = await tx.query.documents.findFirst({
        where: and(
          eq(documents.id, documentId),
          eq(documents.organizationId, organizationId),
          isNull(documents.deletedAt),
        ),
      });
      if (!document) throw new NotFoundException(`Document ${documentId} not found`);

      const sourceGroupId = document.groupId;
      if (sourceGroupId === groupId) return; // already in target group, no-op

      if (sourceGroupId && (await this.isGroupStatusBound(tx, sourceGroupId))) {
        throw new BadRequestException(
          'Document is used as status-change evidence and cannot be moved',
        );
      }

      if (document.vehicleId && document.vehicleId !== target.vehicleId) {
        throw new BadRequestException('Document and target group must belong to the same vehicle');
      }
      if (sourceGroupId) {
        const source = await tx.query.documentGroups.findFirst({
          where: eq(documentGroups.id, sourceGroupId),
        });
        if (!source || source.vehicleId !== target.vehicleId) {
          throw new BadRequestException('Document groups must belong to the same vehicle');
        }
      }

      await tx
        .update(documents)
        .set({ groupId, vehicleId: null, updatedAt: new Date() })
        .where(eq(documents.id, documentId));

      if (sourceGroupId) {
        const remaining = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(documents)
          .where(and(eq(documents.groupId, sourceGroupId), isNull(documents.deletedAt)));
        if (
          (remaining[0]?.count ?? 0) === 0 &&
          !(await this.isGroupStatusBound(tx, sourceGroupId))
        ) {
          await this.deleteEmptyGroup(tx, sourceGroupId);
        }
      }
    });

    return this.findById(groupId, organizationId);
  }

  // Deletes a group: its documents are reverted to vehicle scope and soft-deleted
  // (so the restrict FK clears), then the group row is hard-deleted. A group bound
  // to a status-history slot cannot be deleted (would break required evidence).
  async deleteGroup(id: string, userId: string, organizationId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const group = await tx.query.documentGroups.findFirst({
        where: and(eq(documentGroups.id, id), eq(documentGroups.organizationId, organizationId)),
      });
      if (!group) throw new NotFoundException(`Document group ${id} not found`);

      if (await this.isGroupStatusBound(tx, id)) {
        throw new BadRequestException(
          'Document group is used as status-change evidence and cannot be deleted',
        );
      }

      await tx
        .update(documents)
        .set({
          groupId: null,
          vehicleId: group.vehicleId,
          deletedAt: new Date(),
          deletedBy: userId,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(documents.groupId, id));

      await tx
        .update(expenses)
        .set({ documentGroupId: null, updatedBy: userId, updatedAt: new Date() })
        .where(eq(expenses.documentGroupId, id));
      await tx
        .update(donations)
        .set({ documentGroupId: null, updatedBy: userId, updatedAt: new Date() })
        .where(eq(donations.documentGroupId, id));
      await tx.delete(documentGroups).where(eq(documentGroups.id, id));
    });
  }

  private async findRow(id: string, organizationId: string): Promise<GroupRow> {
    const group = await this.db.query.documentGroups.findFirst({
      where: and(eq(documentGroups.id, id), eq(documentGroups.organizationId, organizationId)),
      with: {
        expenses: {
          columns: { id: true },
          where: isNull(expenses.deletedAt),
        },
        donations: {
          columns: { id: true },
          where: isNull(donations.deletedAt),
        },
        createdByUser: { columns: { id: true, fullName: true } },
        updatedByUser: { columns: { id: true, fullName: true } },
      },
    });
    if (!group) throw new NotFoundException(`Document group ${id} not found`);
    return group;
  }

  private async isGroupStatusBound(tx: Tx, groupId: string): Promise<boolean> {
    const ref = await tx
      .select({ id: vehicleStatusHistory.id })
      .from(vehicleStatusHistory)
      .where(
        or(
          eq(vehicleStatusHistory.registrationGroupId, groupId),
          eq(vehicleStatusHistory.stampedRegistrationGroupId, groupId),
          eq(vehicleStatusHistory.customsDeclarationGroupId, groupId),
          eq(vehicleStatusHistory.stampedCustomsDeclarationGroupId, groupId),
          eq(vehicleStatusHistory.transferActDraftGroupId, groupId),
          eq(vehicleStatusHistory.transferActSignedGroupId, groupId),
          eq(vehicleStatusHistory.returnActGroupId, groupId),
        ),
      )
      .limit(1);
    return ref.length > 0;
  }

  private async deleteEmptyGroup(tx: Tx, groupId: string): Promise<void> {
    const group = await tx.query.documentGroups.findFirst({
      where: eq(documentGroups.id, groupId),
    });
    if (!group) return;

    await tx
      .update(documents)
      .set({ groupId: null, vehicleId: group.vehicleId, updatedAt: new Date() })
      .where(eq(documents.groupId, groupId));
    await tx
      .update(expenses)
      .set({ documentGroupId: null, updatedAt: new Date() })
      .where(eq(expenses.documentGroupId, groupId));
    await tx
      .update(donations)
      .set({ documentGroupId: null, updatedAt: new Date() })
      .where(eq(donations.documentGroupId, groupId));
    await tx.delete(documentGroups).where(eq(documentGroups.id, groupId));
  }

  private toResponse(
    group: GroupRow,
    docs: DocumentGroupResponse['documents'],
  ): DocumentGroupResponse {
    return {
      id: group.id,
      vehicleId: group.vehicleId,
      expenseIds: group.expenses?.map((expense) => expense.id) ?? [],
      donationIds: group.donations?.map((donation) => donation.id) ?? [],
      name: group.name,
      documents: docs,
      createdBy: {
        id: group.createdByUser?.id ?? '',
        fullName: group.createdByUser?.fullName ?? '',
      },
      updatedBy: {
        id: group.updatedByUser?.id ?? '',
        fullName: group.updatedByUser?.fullName ?? '',
      },
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    };
  }
}
