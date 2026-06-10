import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, isNull, lte, SQL, sql } from 'drizzle-orm';
import { BASE_CURRENCY, minorAmountSchema, type Currency } from '@volunteerfleet/shared';
import type {
  DonationCreate,
  DonationListQuery,
  DonationListResponse,
  DonationResponse,
  DonationUpdate,
  ExpenseUserInfo,
  OrgRole,
} from '@volunteerfleet/shared';
import type { Database } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import {
  donations,
  donors,
  financialCategories,
  organizationDonors,
  users,
  vehicles,
} from '../../db/schema/index.js';
import { normalizeDonorName } from '../../common/utils/normalize-donor-name.js';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service.js';

const DONATION_SORT_WHITELIST = [
  'donationDate',
  'amountMinor',
  'currency',
  'createdAt',
  'updatedAt',
] as const;
type DonationSortField = (typeof DONATION_SORT_WHITELIST)[number];

interface SortItem {
  field: DonationSortField;
  dir: 'asc' | 'desc';
}

type DonationRow = typeof donations.$inferSelect & {
  donor?: Pick<typeof donors.$inferSelect, 'id' | 'name'>;
  vehicle?: Pick<typeof vehicles.$inferSelect, 'id' | 'identifier' | 'brand' | 'model'> | null;
  category?: typeof financialCategories.$inferSelect | null;
  createdByUser?: Pick<typeof users.$inferSelect, 'id' | 'fullName'>;
  updatedByUser?: Pick<typeof users.$inferSelect, 'id' | 'fullName'>;
  deletedByUser?: Pick<typeof users.$inferSelect, 'id' | 'fullName'> | null;
};

@Injectable()
export class DonationsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly exchangeRates: ExchangeRatesService,
  ) {}

  async list(
    query: DonationListQuery,
    orgRole: OrgRole | null | undefined,
    organizationId: string,
  ): Promise<DonationListResponse> {
    const {
      page,
      pageSize,
      sort,
      donorId,
      vehicleId,
      categoryId,
      dateFrom,
      dateTo,
      currency,
      includeDeleted,
    } = query;

    if (includeDeleted && orgRole !== 'coordinator') {
      throw new ForbiddenException('Only coordinator can view deleted donations');
    }

    const conditions: SQL<unknown>[] = [eq(donations.organizationId, organizationId)];
    if (!includeDeleted) {
      conditions.push(isNull(donations.deletedAt), this.hasJoinedActiveVehicle());
    }
    if (donorId) conditions.push(eq(donations.donorId, donorId));
    if (vehicleId) conditions.push(eq(donations.vehicleId, vehicleId));
    if (categoryId) conditions.push(eq(donations.categoryId, categoryId));
    if (dateFrom) conditions.push(gte(donations.donationDate, dateFrom));
    if (dateTo) conditions.push(lte(donations.donationDate, dateTo));
    if (currency) conditions.push(eq(donations.currency, currency));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(donations)
      .leftJoin(vehicles, eq(vehicles.id, donations.vehicleId))
      .where(whereClause);
    const total = countResult[0]?.count ?? 0;

    const orderBy = this.parseSort(sort).map((s) =>
      s.dir === 'asc' ? asc(donations[s.field]) : desc(donations[s.field]),
    );
    if (orderBy.length === 0) orderBy.push(desc(donations.donationDate));

    const pageRows = await this.db
      .select({ id: donations.id })
      .from(donations)
      .leftJoin(vehicles, eq(vehicles.id, donations.vehicleId))
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const ids = pageRows.map((row) => row.id);

    const rows =
      ids.length > 0
        ? await this.db.query.donations.findMany({
            where: inArray(donations.id, ids),
            with: this.responseRelations(),
          })
        : [];
    const rowsById = new Map(rows.map((row) => [row.id, row]));

    return {
      items: ids.flatMap((id) => {
        const row = rowsById.get(id);
        return row ? [this.toResponse(row)] : [];
      }),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findById(
    id: string,
    organizationId: string,
    includeDeleted = false,
  ): Promise<DonationResponse> {
    if (!includeDeleted) {
      const visibleRows = await this.db
        .select({ id: donations.id })
        .from(donations)
        .leftJoin(vehicles, eq(vehicles.id, donations.vehicleId))
        .where(
          and(
            eq(donations.id, id),
            eq(donations.organizationId, organizationId),
            isNull(donations.deletedAt),
            this.hasJoinedActiveVehicle(),
          ),
        )
        .limit(1);
      if (!visibleRows[0]) throw new NotFoundException(`Donation ${id} not found`);
    }

    const row = await this.db.query.donations.findFirst({
      where: and(eq(donations.id, id), eq(donations.organizationId, organizationId)),
      with: this.responseRelations(),
    });

    if (!row) throw new NotFoundException(`Donation ${id} not found`);
    return this.toResponse(row);
  }

  async create(
    input: DonationCreate,
    userId: string,
    organizationId: string,
  ): Promise<DonationResponse> {
    // Validate vehicle belongs to organization and is active
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

    // Validate category if provided (global dictionary - just check existence)
    if (input.categoryId) {
      const category = await this.db.query.financialCategories.findFirst({
        where: eq(financialCategories.id, input.categoryId),
      });
      if (!category) {
        throw new NotFoundException(`Category ${input.categoryId} not found`);
      }
    }

    const rateInfo = this.resolveCreateRate(input);

    // Handle donor: either use existing or create new with organization link
    const result = await this.db.transaction(async (tx) => {
      let donorId: string;

      if ('donorId' in input && input.donorId) {
        // Use existing donor - verify it exists and link to org if needed
        const donor = await tx.query.donors.findFirst({
          where: eq(donors.id, input.donorId),
        });
        if (!donor) {
          throw new NotFoundException(`Donor ${input.donorId} not found`);
        }

        // Check if already linked to this organization
        const existingLink = await tx.query.organizationDonors.findFirst({
          where: and(
            eq(organizationDonors.organizationId, organizationId),
            eq(organizationDonors.donorId, input.donorId),
          ),
        });

        if (!existingLink) {
          // Create link to organization
          await tx.insert(organizationDonors).values({
            organizationId,
            donorId: input.donorId,
            isActive: true,
            addedBy: userId,
            updatedBy: userId,
          });
        } else if (!existingLink.isActive) {
          // Reactivate inactive link
          await tx
            .update(organizationDonors)
            .set({
              isActive: true,
              updatedBy: userId,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(organizationDonors.organizationId, organizationId),
                eq(organizationDonors.donorId, input.donorId),
              ),
            );
        }

        donorId = input.donorId;
      } else if ('newDonorName' in input && input.newDonorName) {
        // Create new donor
        const normalizedName = normalizeDonorName(input.newDonorName);
        const insertedDonors = await tx
          .insert(donors)
          .values({
            name: input.newDonorName,
            normalizedName,
            createdBy: userId,
          })
          .returning({ id: donors.id });

        const donor = insertedDonors[0];
        if (!donor) {
          throw new Error('Failed to create donor');
        }

        // Link to organization
        await tx.insert(organizationDonors).values({
          organizationId,
          donorId: donor.id,
          isActive: true,
          addedBy: userId,
          updatedBy: userId,
        });

        donorId = donor.id;
      } else {
        throw new Error('Either donorId or newDonorName must be provided');
      }

      // Create donation
      const inserted = await tx
        .insert(donations)
        .values({
          organizationId,
          donorId,
          vehicleId: input.vehicleId,
          donationDate: input.donationDate,
          amountMinor: input.amountMinor,
          currency: input.currency,
          rate: rateInfo.rate.toFixed(6),
          rateSource: rateInfo.rateSource,
          categoryId: input.categoryId ?? null,
          description: input.description ?? null,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning({ id: donations.id });

      const donation = inserted[0];
      if (!donation) throw new Error('Insert returned no rows');

      return donation.id;
    });

    return this.findById(result, organizationId);
  }

  async update(
    id: string,
    input: DonationUpdate,
    userId: string,
    organizationId: string,
  ): Promise<DonationResponse> {
    const existing = await this.db.query.donations.findFirst({
      where: and(
        eq(donations.id, id),
        eq(donations.organizationId, organizationId),
        isNull(donations.deletedAt),
      ),
    });
    if (!existing) throw new NotFoundException(`Donation ${id} not found`);

    const updateValues: Record<string, unknown> = {
      updatedBy: userId,
      updatedAt: new Date(),
    };

    // Handle donor update
    if ('donorId' in input && input.donorId) {
      // Verify donor exists and link to org if needed
      const donor = await this.db.query.donors.findFirst({
        where: eq(donors.id, input.donorId),
      });
      if (!donor) {
        throw new NotFoundException(`Donor ${input.donorId} not found`);
      }

      const existingLink = await this.db.query.organizationDonors.findFirst({
        where: and(
          eq(organizationDonors.organizationId, organizationId),
          eq(organizationDonors.donorId, input.donorId),
        ),
      });

      if (!existingLink) {
        await this.db.insert(organizationDonors).values({
          organizationId,
          donorId: input.donorId,
          isActive: true,
          addedBy: userId,
          updatedBy: userId,
        });
      } else if (!existingLink.isActive) {
        await this.db
          .update(organizationDonors)
          .set({
            isActive: true,
            updatedBy: userId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(organizationDonors.organizationId, organizationId),
              eq(organizationDonors.donorId, input.donorId),
            ),
          );
      }

      updateValues.donorId = input.donorId;
    } else if ('newDonorName' in input && input.newDonorName) {
      // Create new donor
      const normalizedName = normalizeDonorName(input.newDonorName);
      const insertedDonors = await this.db
        .insert(donors)
        .values({
          name: input.newDonorName,
          normalizedName,
          createdBy: userId,
        })
        .returning({ id: donors.id });

      const donor = insertedDonors[0];
      if (!donor) {
        throw new Error('Failed to create donor');
      }

      await this.db.insert(organizationDonors).values({
        organizationId,
        donorId: donor.id,
        isActive: true,
        addedBy: userId,
        updatedBy: userId,
      });

      updateValues.donorId = donor.id;
    }

    // Validate vehicle if provided
    if (input.vehicleId !== undefined && input.vehicleId !== null) {
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
      updateValues.vehicleId = input.vehicleId;
    }

    // Validate category if provided (global dictionary - just check existence)
    if (input.categoryId !== undefined && input.categoryId !== null) {
      const category = await this.db.query.financialCategories.findFirst({
        where: eq(financialCategories.id, input.categoryId),
      });
      if (!category) {
        throw new NotFoundException(`Category ${input.categoryId} not found`);
      }
      updateValues.categoryId = input.categoryId;
    } else if (input.categoryId === null) {
      updateValues.categoryId = null;
    }

    if (input.donationDate !== undefined) updateValues.donationDate = input.donationDate;
    if (input.amountMinor !== undefined) updateValues.amountMinor = input.amountMinor;
    if (input.currency !== undefined) updateValues.currency = input.currency;
    if (input.description !== undefined) updateValues.description = input.description;

    // Rate resolution
    if (input.currency !== undefined && input.currency !== existing.currency) {
      if (input.currency === BASE_CURRENCY) {
        updateValues.rate = '1.000000';
        updateValues.rateSource = 'default';
      } else if (input.rate !== undefined) {
        updateValues.rate = input.rate.toFixed(6);
        updateValues.rateSource = 'manual';
      } else {
        const date = input.donationDate ?? existing.donationDate;
        updateValues.rate = this.exchangeRates
          .getRate(new Date(date), input.currency as Currency)
          .toFixed(6);
        updateValues.rateSource = 'default';
      }
    } else if (input.rate !== undefined) {
      updateValues.rate = input.rate.toFixed(6);
      updateValues.rateSource = 'manual';
    }

    const updated = await this.db
      .update(donations)
      .set(updateValues)
      .where(and(eq(donations.id, id), eq(donations.organizationId, organizationId)))
      .returning({ id: donations.id });

    if (!updated[0]) throw new NotFoundException(`Donation ${id} not found`);
    return this.findById(id, organizationId);
  }

  async softDelete(id: string, userId: string, organizationId: string): Promise<void> {
    const existing = await this.db.query.donations.findFirst({
      where: and(
        eq(donations.id, id),
        eq(donations.organizationId, organizationId),
        isNull(donations.deletedAt),
      ),
    });
    if (!existing) throw new NotFoundException(`Donation ${id} not found`);

    await this.db
      .update(donations)
      .set({ deletedAt: new Date(), deletedBy: userId, updatedBy: userId, updatedAt: new Date() })
      .where(and(eq(donations.id, id), eq(donations.organizationId, organizationId)));
  }

  async restore(id: string, userId: string, organizationId: string): Promise<DonationResponse> {
    const existing = await this.db.query.donations.findFirst({
      where: and(
        eq(donations.id, id),
        eq(donations.organizationId, organizationId),
        sql`${donations.deletedAt} IS NOT NULL`,
      ),
    });
    if (!existing) throw new NotFoundException(`Deleted donation ${id} not found`);

    await this.db
      .update(donations)
      .set({ deletedAt: null, deletedBy: null, updatedBy: userId, updatedAt: new Date() })
      .where(and(eq(donations.id, id), eq(donations.organizationId, organizationId)));

    return this.findById(id, organizationId, true);
  }

  private resolveCreateRate(input: DonationCreate): {
    rate: number;
    rateSource: 'default' | 'manual';
  } {
    if (input.currency === BASE_CURRENCY) {
      return { rate: 1, rateSource: 'default' };
    }
    if (input.rate !== undefined) {
      return { rate: input.rate, rateSource: 'manual' };
    }
    return {
      rate: this.exchangeRates.getRate(new Date(input.donationDate), input.currency as Currency),
      rateSource: 'default',
    };
  }

  private parseSort(sort: string | undefined): SortItem[] {
    if (!sort) return [];
    return sort.split(',').flatMap((part) => {
      const [field, dir] = part.split(':') as [string, string | undefined];
      if (!DONATION_SORT_WHITELIST.includes(field as DonationSortField)) return [];
      if (dir !== 'asc' && dir !== 'desc') return [];
      return [{ field: field as DonationSortField, dir }];
    });
  }

  private responseRelations() {
    return {
      donor: { columns: { id: true, name: true } },
      vehicle: { columns: { id: true, identifier: true, brand: true, model: true } },
      category: true,
      createdByUser: { columns: { id: true, fullName: true } },
      updatedByUser: { columns: { id: true, fullName: true } },
      deletedByUser: { columns: { id: true, fullName: true } },
    } as const;
  }

  private hasJoinedActiveVehicle(): SQL<unknown> {
    return isNull(vehicles.deletedAt);
  }

  private toUserInfo(row: { id: string; fullName: string } | null | undefined): ExpenseUserInfo {
    return { id: row?.id ?? '', fullName: row?.fullName ?? '' };
  }

  private toResponse(row: DonationRow): DonationResponse {
    if (!row.vehicleId || !row.vehicle) {
      throw new Error(`Donation ${row.id} is missing its required vehicle`);
    }
    if (!row.donorId || !row.donor) {
      throw new Error(`Donation ${row.id} is missing its required donor`);
    }

    return {
      id: row.id,
      donorId: row.donorId,
      donor: {
        id: row.donor.id,
        name: row.donor.name,
      },
      vehicleId: row.vehicleId,
      vehicle: {
        id: row.vehicle.id,
        identifier: row.vehicle.identifier,
        brand: row.vehicle.brand,
        model: row.vehicle.model,
      },
      categoryId: row.categoryId,
      category: row.category
        ? {
            id: row.category.id,
            name: row.category.name,
            sortOrder: row.category.sortOrder,
            createdAt: row.category.createdAt.toISOString(),
            updatedAt: row.category.updatedAt.toISOString(),
          }
        : null,
      donationDate: row.donationDate,
      amountMinor: minorAmountSchema.parse(row.amountMinor),
      currency: row.currency,
      rate: Number(row.rate),
      rateSource: row.rateSource,
      description: row.description,
      createdBy: this.toUserInfo(row.createdByUser),
      updatedBy: this.toUserInfo(row.updatedByUser),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      deletedBy: row.deletedByUser ? this.toUserInfo(row.deletedByUser) : null,
    };
  }
}
