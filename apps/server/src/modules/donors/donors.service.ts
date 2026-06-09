import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type {
  DonorCreate,
  DonorLink,
  DonorListQuery,
  DonorListResponse,
  DonorResolveResponse,
  DonorResponse,
} from '@volunteerfleet/shared';
import type { Database } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { donors, organizationDonors } from '../../db/schema/index.js';
import { normalizeDonorName } from '../../common/utils/normalize-donor-name.js';

interface DonorDuplicateMatch {
  id: string;
  name: string;
}

@Injectable()
export class DonorsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async list(query: DonorListQuery, organizationId: string): Promise<DonorListResponse> {
    const { page, pageSize, isActive } = query;

    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(organizationDonors)
      .innerJoin(donors, eq(donors.id, organizationDonors.donorId))
      .where(
        and(
          eq(organizationDonors.organizationId, organizationId),
          eq(organizationDonors.isActive, isActive),
        ),
      );
    const total = countResult[0]?.count ?? 0;

    const rows = await this.db
      .select({
        id: donors.id,
        name: donors.name,
        createdAt: donors.createdAt,
        updatedAt: donors.updatedAt,
      })
      .from(organizationDonors)
      .innerJoin(donors, eq(donors.id, organizationDonors.donorId))
      .where(
        and(
          eq(organizationDonors.organizationId, organizationId),
          eq(organizationDonors.isActive, isActive),
        ),
      )
      .orderBy(donors.name)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return {
      items: rows.map((row) => this.toResponse(row)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async create(input: DonorCreate, userId: string, organizationId: string): Promise<DonorResponse> {
    const normalizedName = normalizeDonorName(input.name);

    // Check for duplicates within the organization
    if (!input.allowDuplicateName) {
      const duplicates = await this.findDuplicatesInOrg(normalizedName, organizationId);
      if (duplicates.length > 0) {
        throw new ConflictException({
          code: 'DONOR_NAME_ALREADY_EXISTS',
          matches: duplicates,
        });
      }
    }

    // Transaction: create donor + link to organization
    const result = await this.db.transaction(async (tx) => {
      const insertedDonors = await tx
        .insert(donors)
        .values({
          name: input.name,
          normalizedName,
          createdBy: userId,
        })
        .returning({
          id: donors.id,
          name: donors.name,
          createdAt: donors.createdAt,
          updatedAt: donors.updatedAt,
        });

      const donor = insertedDonors[0];
      if (!donor) {
        throw new Error('Failed to create donor');
      }

      await tx.insert(organizationDonors).values({
        organizationId,
        donorId: donor.id,
        isActive: true,
        addedBy: userId,
        updatedBy: userId,
      });

      return donor;
    });

    return this.toResponse(result);
  }

  async resolve(donorId: string, organizationId: string): Promise<DonorResolveResponse> {
    // Resolve works only by full valid UUID - exact match
    const donor = await this.db.query.donors.findFirst({
      where: eq(donors.id, donorId),
    });

    if (!donor) {
      throw new NotFoundException('Donor not found');
    }

    // Check if already linked to this organization
    const existingLink = await this.db.query.organizationDonors.findFirst({
      where: and(
        eq(organizationDonors.organizationId, organizationId),
        eq(organizationDonors.donorId, donorId),
      ),
    });

    return {
      id: donor.id,
      name: donor.name,
      alreadyLinked: !!existingLink && existingLink.isActive,
    };
  }

  async link(input: DonorLink, userId: string, organizationId: string): Promise<DonorResponse> {
    // Verify donor exists (exact UUID match only)
    const donor = await this.db.query.donors.findFirst({
      where: eq(donors.id, input.donorId),
    });

    if (!donor) {
      throw new NotFoundException('Donor not found');
    }

    // Check for existing link
    const existingLink = await this.db.query.organizationDonors.findFirst({
      where: and(
        eq(organizationDonors.organizationId, organizationId),
        eq(organizationDonors.donorId, input.donorId),
      ),
    });

    if (existingLink) {
      if (existingLink.isActive) {
        // Already linked and active - return existing
        return this.toResponse({
          id: donor.id,
          name: donor.name,
          createdAt: donor.createdAt,
          updatedAt: donor.updatedAt,
        });
      }
      // Reactivate the inactive link
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
    } else {
      // Create new link
      await this.db.insert(organizationDonors).values({
        organizationId,
        donorId: input.donorId,
        isActive: true,
        addedBy: userId,
        updatedBy: userId,
      });
    }

    return this.toResponse({
      id: donor.id,
      name: donor.name,
      createdAt: donor.createdAt,
      updatedAt: donor.updatedAt,
    });
  }

  async unlink(donorId: string, userId: string, organizationId: string): Promise<void> {
    // Verify the link exists and belongs to this organization
    const existingLink = await this.db.query.organizationDonors.findFirst({
      where: and(
        eq(organizationDonors.organizationId, organizationId),
        eq(organizationDonors.donorId, donorId),
        eq(organizationDonors.isActive, true),
      ),
    });

    if (!existingLink) {
      throw new NotFoundException('Donor link not found');
    }

    // Deactivate the link (soft delete)
    await this.db
      .update(organizationDonors)
      .set({
        isActive: false,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(organizationDonors.organizationId, organizationId),
          eq(organizationDonors.donorId, donorId),
        ),
      );
  }

  private async findDuplicatesInOrg(
    normalizedName: string,
    organizationId: string,
  ): Promise<DonorDuplicateMatch[]> {
    const rows = await this.db
      .select({
        id: donors.id,
        name: donors.name,
      })
      .from(organizationDonors)
      .innerJoin(donors, eq(donors.id, organizationDonors.donorId))
      .where(
        and(
          eq(organizationDonors.organizationId, organizationId),
          eq(organizationDonors.isActive, true),
          eq(donors.normalizedName, normalizedName),
        ),
      )
      .limit(10);

    return rows;
  }

  private toResponse(row: {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
  }): DonorResponse {
    return {
      id: row.id,
      name: row.name,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
