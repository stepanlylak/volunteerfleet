import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { and, desc, eq, isNull, asc, sql } from 'drizzle-orm';
import {
  isValidTransition,
  type VehicleTransitionRequest,
  type VehicleResponse,
  type VehicleStatusHistoryEditRequest,
} from '@volunteerfleet/shared';
import { DB } from '../../db/db.module.js';
import type { Database } from '../../db/client.js';
import {
  vehicles,
  vehicleStatusHistory,
  documents,
  documentGroups,
} from '../../db/schema/index.js';
import { VehiclesService } from './vehicles.service.js';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

@Injectable()
export class VehicleTransitionService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly vehiclesService: VehiclesService,
  ) {}

  async transition(
    vehicleId: string,
    userId: string,
    organizationId: string,
    dto: VehicleTransitionRequest,
  ): Promise<VehicleResponse> {
    const { expectedCurrentStatus, targetStatus, note } = dto;

    // Validate transition matrix
    if (!isValidTransition(expectedCurrentStatus, targetStatus)) {
      throw new BadRequestException(
        `Invalid transition from ${expectedCurrentStatus} to ${targetStatus}`,
      );
    }

    await this.db.transaction(async (tx) => {
      // Find vehicle
      const vehicle = await tx.query.vehicles.findFirst({
        where: and(
          eq(vehicles.id, vehicleId),
          eq(vehicles.organizationId, organizationId),
          isNull(vehicles.deletedAt),
        ),
      });

      if (!vehicle) {
        throw new NotFoundException(`Vehicle ${vehicleId} not found`);
      }

      // Check current status against expected
      if (vehicle.status !== expectedCurrentStatus) {
        throw new ConflictException(
          `Vehicle status changed to ${vehicle.status}, expected ${expectedCurrentStatus}`,
        );
      }

      // Check chronological order (transitionDate >= last transitionDate)
      const lastHistory = await tx.query.vehicleStatusHistory.findFirst({
        where: eq(vehicleStatusHistory.vehicleId, vehicleId),
        orderBy: [desc(vehicleStatusHistory.changedAt)],
      });

      if (lastHistory && dto.transitionDate < lastHistory.transitionDate) {
        throw new BadRequestException(
          'Transition date cannot be earlier than previous transition date',
        );
      }

      // Verify document groups if present (each referenced group must belong to
      // this vehicle/org and hold at least one active document).
      for (const groupId of this.collectGroupIds(dto)) {
        await this.assertGroupHasDocuments(tx, groupId, vehicleId, organizationId);
      }

      // Special rule: returned -> transferred (new signed act required)
      if (expectedCurrentStatus === 'returned' && targetStatus === 'transferred') {
        const prevTransfer = await tx.query.vehicleStatusHistory.findFirst({
          where: and(
            eq(vehicleStatusHistory.vehicleId, vehicleId),
            eq(vehicleStatusHistory.newStatus, 'transferred'),
          ),
          orderBy: [desc(vehicleStatusHistory.changedAt)],
        });

        if (
          prevTransfer &&
          'transferActSignedGroupId' in dto &&
          dto.transferActSignedGroupId &&
          dto.transferActSignedGroupId === prevTransfer.transferActSignedGroupId
        ) {
          throw new BadRequestException('Cannot reuse previous transfer act for a new transfer');
        }
      }

      // Prepare history payload
      const historyValues: typeof vehicleStatusHistory.$inferInsert = {
        organizationId,
        vehicleId,
        oldStatus: expectedCurrentStatus,
        newStatus: targetStatus,
        changedBy: userId,
        note: note || null,
        transitionDate: dto.transitionDate,
      };

      // Handle specific status fields
      if (dto.targetStatus === 'paid') {
        const d = dto;
        historyValues.isLocalPurchase = d.isLocalPurchase ?? false;
        historyValues.registrationGroupId = d.registrationGroupId || null;
      } else if (dto.targetStatus === 'in_transit') {
        historyValues.customsDeclarationGroupId = dto.customsDeclarationGroupId || null;
      } else if (dto.targetStatus === 'arrived') {
        historyValues.borderCrossingDate = dto.borderCrossingDate || null;
        historyValues.stampedRegistrationGroupId = dto.stampedRegistrationGroupId || null;
        historyValues.stampedCustomsDeclarationGroupId =
          dto.stampedCustomsDeclarationGroupId || null;
      } else if (dto.targetStatus === 'ready') {
        historyValues.transferActDraftGroupId = dto.transferActDraftGroupId || null;
      } else if (dto.targetStatus === 'transferred') {
        historyValues.transferActSignedGroupId = dto.transferActSignedGroupId || null;
        historyValues.isRegisteredAtServiceCenter = dto.isRegisteredAtServiceCenter ?? false;
      } else if (dto.targetStatus === 'returned') {
        historyValues.returnActGroupId = dto.returnActGroupId || null;
      }

      // Compare-and-swap update vehicle status
      const updatePayload: Partial<typeof vehicles.$inferInsert> = {
        status: targetStatus,
        updatedBy: userId,
        updatedAt: new Date(),
      };

      const updatedVehicles = await tx
        .update(vehicles)
        .set(updatePayload)
        .where(and(eq(vehicles.id, vehicleId), eq(vehicles.status, expectedCurrentStatus)))
        .returning();

      if (updatedVehicles.length === 0) {
        throw new ConflictException('Status update conflict (already changed)');
      }

      // Insert history
      await tx.insert(vehicleStatusHistory).values(historyValues);
    });

    // Read after the transaction commits so the response reflects the new
    // status and recomputed alerts (findById reads via the pool, not tx).
    return this.vehiclesService.findById(vehicleId, organizationId);
  }

  async rollbackLastStatus(
    vehicleId: string,
    expectedLastHistoryId: string,
    organizationId: string,
    userId: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const vehicle = await tx.query.vehicles.findFirst({
        where: and(
          eq(vehicles.id, vehicleId),
          eq(vehicles.organizationId, organizationId),
          isNull(vehicles.deletedAt),
        ),
      });

      if (!vehicle) {
        throw new NotFoundException(`Vehicle ${vehicleId} not found`);
      }

      const lastHistory = await tx.query.vehicleStatusHistory.findFirst({
        where: eq(vehicleStatusHistory.vehicleId, vehicleId),
        orderBy: [desc(vehicleStatusHistory.changedAt)],
      });

      if (!lastHistory) {
        throw new BadRequestException('No history to rollback');
      }

      if (lastHistory.id !== expectedLastHistoryId) {
        throw new ConflictException('Newer transition exists, cannot rollback');
      }

      if (lastHistory.newStatus === 'new' && !lastHistory.oldStatus) {
        throw new BadRequestException('Cannot rollback initial status');
      }

      const updatePayload: Partial<typeof vehicles.$inferInsert> = {
        status: lastHistory.oldStatus!,
        updatedBy: userId,
        updatedAt: new Date(),
      };

      const updatedVehicles = await tx
        .update(vehicles)
        .set(updatePayload)
        .where(and(eq(vehicles.id, vehicleId), eq(vehicles.status, vehicle.status)))
        .returning();

      if (updatedVehicles.length === 0) {
        throw new ConflictException('Status update conflict');
      }

      await tx.delete(vehicleStatusHistory).where(eq(vehicleStatusHistory.id, lastHistory.id));
    });
  }

  async editStatusHistory(
    vehicleId: string,
    historyId: string,
    dto: VehicleStatusHistoryEditRequest,
    organizationId: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const vehicle = await tx.query.vehicles.findFirst({
        where: and(
          eq(vehicles.id, vehicleId),
          eq(vehicles.organizationId, organizationId),
          isNull(vehicles.deletedAt),
        ),
      });

      if (!vehicle) {
        throw new NotFoundException(`Vehicle ${vehicleId} not found`);
      }

      const history = await tx.query.vehicleStatusHistory.findFirst({
        where: eq(vehicleStatusHistory.id, historyId),
      });

      if (!history || history.vehicleId !== vehicleId) {
        throw new NotFoundException(`History ${historyId} not found`);
      }

      if (history.newStatus !== dto.targetStatus) {
        throw new BadRequestException(
          `targetStatus must match existing new_status (${history.newStatus})`,
        );
      }

      const allHistories = await tx.query.vehicleStatusHistory.findMany({
        where: eq(vehicleStatusHistory.vehicleId, vehicleId),
        orderBy: [asc(vehicleStatusHistory.changedAt)],
      });

      const historyIndex = allHistories.findIndex((h) => h.id === historyId);
      if (historyIndex > 0) {
        const prev = allHistories[historyIndex - 1];
        if (prev && dto.transitionDate < prev.transitionDate) {
          throw new BadRequestException(
            'Transition date cannot be earlier than previous transition date',
          );
        }
      }
      if (historyIndex < allHistories.length - 1) {
        const next = allHistories[historyIndex + 1];
        if (next && dto.transitionDate > next.transitionDate) {
          throw new BadRequestException(
            'Transition date cannot be later than next transition date',
          );
        }
      }

      for (const groupId of this.collectGroupIds(dto)) {
        await this.assertGroupHasDocuments(tx, groupId, vehicleId, organizationId);
      }

      if (history.oldStatus === 'returned' && dto.targetStatus === 'transferred') {
        const prevTransfer = allHistories
          .slice(0, historyIndex)
          .reverse()
          .find((h) => h.newStatus === 'transferred');
        if (
          prevTransfer &&
          'transferActSignedGroupId' in dto &&
          dto.transferActSignedGroupId &&
          dto.transferActSignedGroupId === prevTransfer.transferActSignedGroupId
        ) {
          throw new BadRequestException('Cannot reuse previous transfer act for a new transfer');
        }
      }

      const updateValues: Partial<typeof vehicleStatusHistory.$inferInsert> = {
        note: dto.note || null,
        transitionDate: dto.transitionDate,
      };

      if (dto.targetStatus === 'paid') {
        updateValues.isLocalPurchase = dto.isLocalPurchase ?? false;
        updateValues.registrationGroupId = dto.registrationGroupId || null;
      } else if (dto.targetStatus === 'in_transit') {
        updateValues.customsDeclarationGroupId =
          (dto as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */
            .customsDeclarationGroupId || null;
      } else if (dto.targetStatus === 'arrived') {
        updateValues.borderCrossingDate =
          (dto as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */
            .borderCrossingDate || null;
        updateValues.stampedRegistrationGroupId =
          (dto as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */
            .stampedRegistrationGroupId || null;
        updateValues.stampedCustomsDeclarationGroupId =
          (dto as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */
            .stampedCustomsDeclarationGroupId || null;
      } else if (dto.targetStatus === 'ready') {
        updateValues.transferActDraftGroupId =
          (dto as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */
            .transferActDraftGroupId || null;
      } else if (dto.targetStatus === 'transferred') {
        updateValues.transferActSignedGroupId =
          (dto as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */
            .transferActSignedGroupId || null;
        updateValues.isRegisteredAtServiceCenter =
          (dto as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */
            .isRegisteredAtServiceCenter ?? false;
      } else if (dto.targetStatus === 'returned') {
        updateValues.returnActGroupId =
          (dto as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */
            .returnActGroupId || null;
      }

      await tx
        .update(vehicleStatusHistory)
        .set(updateValues)
        .where(eq(vehicleStatusHistory.id, historyId));
    });
  }

  private collectGroupIds(
    dto: VehicleTransitionRequest | VehicleStatusHistoryEditRequest,
  ): string[] {
    const slots = [
      'registrationGroupId',
      'stampedRegistrationGroupId',
      'customsDeclarationGroupId',
      'stampedCustomsDeclarationGroupId',
      'transferActDraftGroupId',
      'transferActSignedGroupId',
      'returnActGroupId',
    ] as const;
    const ids: string[] = [];
    for (const slot of slots) {
      const value = (dto as Record<string, unknown>)[slot];
      if (typeof value === 'string' && value) ids.push(value);
    }
    return ids;
  }

  private async assertGroupHasDocuments(
    tx: Tx,
    groupId: string,
    vehicleId: string,
    organizationId: string,
  ): Promise<void> {
    const group = await tx.query.documentGroups.findFirst({
      where: and(
        eq(documentGroups.id, groupId),
        eq(documentGroups.organizationId, organizationId),
        eq(documentGroups.vehicleId, vehicleId),
      ),
    });
    if (!group) {
      throw new BadRequestException(`Document group ${groupId} not found or not in this vehicle`);
    }

    const counted = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(documents)
      .where(and(eq(documents.groupId, groupId), isNull(documents.deletedAt)));
    if ((counted[0]?.count ?? 0) === 0) {
      throw new BadRequestException(`Document group ${groupId} has no documents`);
    }
  }
}
