import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { and, desc, eq, isNull, asc } from 'drizzle-orm';
import {
  isValidTransition,
  type VehicleTransitionRequest,
  type VehicleResponse,
  type VehicleStatusHistoryEditRequest,
} from '@volunteerfleet/shared';
import { DB } from '../../db/db.module.js';
import type { Database } from '../../db/client.js';
import { vehicles, vehicleStatusHistory, documents } from '../../db/schema/index.js';
import { VehiclesService } from './vehicles.service.js';

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

      // Verify documents if present
      const docChecks: { id: string; type: string }[] = [];
      if ('registrationDocId' in dto && dto.registrationDocId) {
        docChecks.push({ id: dto.registrationDocId, type: 'registration_certificate' });
      }
      if ('stampedRegistrationDocId' in dto && dto.stampedRegistrationDocId) {
        docChecks.push({ id: dto.stampedRegistrationDocId, type: 'registration_certificate' });
      }
      if ('customsDeclarationDocId' in dto && dto.customsDeclarationDocId) {
        docChecks.push({ id: dto.customsDeclarationDocId, type: 'customs_declaration' });
      }
      if ('stampedCustomsDeclarationDocId' in dto && dto.stampedCustomsDeclarationDocId) {
        docChecks.push({
          id: dto.stampedCustomsDeclarationDocId,
          type: 'stamped_customs_declaration',
        });
      }
      if ('transferActDraftDocId' in dto && dto.transferActDraftDocId) {
        docChecks.push({ id: dto.transferActDraftDocId, type: 'transfer_act_draft' });
      }
      if ('transferActSignedDocId' in dto && dto.transferActSignedDocId) {
        docChecks.push({ id: dto.transferActSignedDocId, type: 'transfer_act_signed' });
      }
      if ('returnActDocId' in dto && dto.returnActDocId) {
        docChecks.push({ id: dto.returnActDocId, type: 'return_act' });
      }

      for (const check of docChecks) {
        const doc = await tx.query.documents.findFirst({
          where: and(
            eq(documents.id, check.id),
            eq(documents.organizationId, organizationId),
            eq(documents.vehicleId, vehicleId),
            isNull(documents.deletedAt),
            eq(documents.documentType, check.type as 'other'),
          ),
        });
        if (!doc) {
          throw new BadRequestException(
            `Document ${check.id} not found, deleted, or invalid type/vehicle`,
          );
        }
      }

      // Special rule: paid -> arrived
      if (expectedCurrentStatus === 'paid' && targetStatus === 'arrived') {
        if (!lastHistory?.isLocalPurchase) {
          throw new BadRequestException('Can only transition paid -> arrived for local purchases');
        }
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
          'transferActSignedDocId' in dto &&
          dto.transferActSignedDocId &&
          dto.transferActSignedDocId === prevTransfer.transferActSignedDocId
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
        historyValues.registrationDocId = d.registrationDocId || null;
      } else if (dto.targetStatus === 'in_transit') {
        historyValues.customsDeclarationDocId = dto.customsDeclarationDocId || null;
      } else if (dto.targetStatus === 'arrived') {
        historyValues.stampedRegistrationDocId = dto.stampedRegistrationDocId || null;
        historyValues.stampedCustomsDeclarationDocId = dto.stampedCustomsDeclarationDocId || null;
      } else if (dto.targetStatus === 'ready') {
        historyValues.transferActDraftDocId = dto.transferActDraftDocId || null;
      } else if (dto.targetStatus === 'transferred') {
        historyValues.transferActSignedDocId = dto.transferActSignedDocId || null;
        historyValues.isRegisteredAtServiceCenter = dto.isRegisteredAtServiceCenter ?? false;
      } else if (dto.targetStatus === 'returned') {
        historyValues.returnActDocId = dto.returnActDocId || null;
      } else if (dto.targetStatus === 'lost') {
        historyValues.lostReason = dto.lostReason;
      }

      // Compare-and-swap update vehicle status (also updating borderCrossingDate if arrived)
      const updatePayload: Partial<typeof vehicles.$inferInsert> = {
        status: targetStatus,
        updatedBy: userId,
        updatedAt: new Date(),
      };

      if (dto.targetStatus === 'arrived' && dto.borderCrossingDate) {
        updatePayload.borderCrossingDate = dto.borderCrossingDate;
      }

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

      const docChecks: { id: string; type: string }[] = [];
      if ('registrationDocId' in dto && dto.registrationDocId) {
        docChecks.push({ id: dto.registrationDocId, type: 'registration_certificate' });
      }
      if ('stampedRegistrationDocId' in dto && dto.stampedRegistrationDocId) {
        docChecks.push({ id: dto.stampedRegistrationDocId, type: 'registration_certificate' });
      }
      if ('customsDeclarationDocId' in dto && dto.customsDeclarationDocId) {
        docChecks.push({ id: dto.customsDeclarationDocId, type: 'customs_declaration' });
      }
      if ('stampedCustomsDeclarationDocId' in dto && dto.stampedCustomsDeclarationDocId) {
        docChecks.push({
          id: dto.stampedCustomsDeclarationDocId,
          type: 'stamped_customs_declaration',
        });
      }
      if ('transferActDraftDocId' in dto && dto.transferActDraftDocId) {
        docChecks.push({ id: dto.transferActDraftDocId, type: 'transfer_act_draft' });
      }
      if ('transferActSignedDocId' in dto && dto.transferActSignedDocId) {
        docChecks.push({ id: dto.transferActSignedDocId, type: 'transfer_act_signed' });
      }
      if ('returnActDocId' in dto && dto.returnActDocId) {
        docChecks.push({ id: dto.returnActDocId, type: 'return_act' });
      }

      for (const check of docChecks) {
        const doc = await tx.query.documents.findFirst({
          where: and(
            eq(documents.id, check.id),
            eq(documents.organizationId, organizationId),
            eq(documents.vehicleId, vehicleId),
            isNull(documents.deletedAt),
            eq(documents.documentType, check.type as 'other'),
          ),
        });
        if (!doc) {
          throw new BadRequestException(
            `Document ${check.id} not found, deleted, or invalid type/vehicle`,
          );
        }
      }

      if (history.oldStatus === 'returned' && dto.targetStatus === 'transferred') {
        const prevTransfer = allHistories
          .slice(0, historyIndex)
          .reverse()
          .find((h) => h.newStatus === 'transferred');
        if (
          prevTransfer &&
          'transferActSignedDocId' in dto &&
          dto.transferActSignedDocId &&
          dto.transferActSignedDocId === prevTransfer.transferActSignedDocId
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
        updateValues.registrationDocId = dto.registrationDocId || null;
      } else if (dto.targetStatus === 'in_transit') {
        updateValues.customsDeclarationDocId =
          (dto as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */
            .customsDeclarationDocId || null;
      } else if (dto.targetStatus === 'arrived') {
        updateValues.stampedRegistrationDocId =
          (dto as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */
            .stampedRegistrationDocId || null;
        updateValues.stampedCustomsDeclarationDocId =
          (dto as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */
            .stampedCustomsDeclarationDocId || null;
      } else if (dto.targetStatus === 'ready') {
        updateValues.transferActDraftDocId =
          (dto as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */
            .transferActDraftDocId || null;
      } else if (dto.targetStatus === 'transferred') {
        updateValues.transferActSignedDocId =
          (dto as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */
            .transferActSignedDocId || null;
        updateValues.isRegisteredAtServiceCenter =
          (dto as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */
            .isRegisteredAtServiceCenter ?? false;
      } else if (dto.targetStatus === 'returned') {
        updateValues.returnActDocId =
          (dto as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */
            .returnActDocId || null;
      } else if (dto.targetStatus === 'lost') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updateValues.lostReason = (dto as any).lostReason;
      }

      await tx
        .update(vehicleStatusHistory)
        .set(updateValues)
        .where(eq(vehicleStatusHistory.id, historyId));
    });
  }
}
