import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import {
  isValidTransition,
  type VehicleTransitionRequest,
  type VehicleResponse,
} from '@volunteerfleet/shared';
import { DB } from '../../db/db.module.js';
import type { Database } from '../../db/client.js';
import { vehicles, vehicleStatusHistory, documents } from '../../db/schema/index.js';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service.js';
import { VehiclesService } from './vehicles.service.js';

@Injectable()
export class VehicleTransitionService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly exchangeRatesService: ExchangeRatesService,
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

    return await this.db.transaction(async (tx) => {
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
        if (d.purchasePrice) {
          historyValues.purchasePrice = d.purchasePrice.toString();
          historyValues.purchaseCurrency = d.purchaseCurrency;
          historyValues.purchaseRateSource = d.purchaseRateSource;

          if (d.purchaseRateSource === 'default' && d.purchaseCurrency !== 'UAH') {
            const defaultRate = this.exchangeRatesService.getRate(
              new Date(d.transitionDate),
              d.purchaseCurrency,
            );
            historyValues.purchaseRate = defaultRate.toString();
          } else if (d.purchaseCurrency === 'UAH') {
            historyValues.purchaseRate = '1';
          } else {
            historyValues.purchaseRate = d.purchaseRate.toString();
          }
        }
        historyValues.isLocalPurchase = d.isLocalPurchase ?? false;
        historyValues.registrationDocId = d.registrationDocId || null;
      } else if (dto.targetStatus === 'in_transit') {
        historyValues.customsDeclarationDocId = dto.customsDeclarationDocId || null;
      } else if (dto.targetStatus === 'arrived') {
        historyValues.registrationDocId = dto.registrationDocId || null;
        historyValues.stampedCustomsDeclarationDocId = dto.stampedCustomsDeclarationDocId || null;
      } else if (dto.targetStatus === 'in_repair') {
        historyValues.repairNote = dto.repairNote || null;
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

      // Return the updated vehicle using findById
      return this.vehiclesService.findById(vehicleId, organizationId);
    });
  }
}
