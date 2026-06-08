import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, ilike, isNull, or, sql, SQL } from 'drizzle-orm';
import {
  AddMemberByEmail,
  OrganizationCreate,
  OrganizationListQuery,
  OrganizationListResponse,
  OrganizationResponse,
  OrganizationUpdate,
  OrganizationWithMembersResponse,
} from '@volunteerfleet/shared';
import { Database } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { organizationMembers, organizations, users } from '../../db/schema/index.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly usersService: UsersService,
  ) {}

  async list(query: OrganizationListQuery): Promise<OrganizationListResponse> {
    const { page, pageSize, search, isActive } = query;
    const conditions: SQL<unknown>[] = [isNull(organizations.deletedAt)];

    if (isActive !== undefined) {
      conditions.push(eq(organizations.isActive, isActive));
    }

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(ilike(organizations.name, pattern));
    }

    const whereClause = and(...conditions);

    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(organizations)
      .where(whereClause);
    const total = countResult[0]?.count ?? 0;

    const rows = await this.db.query.organizations.findMany({
      where: whereClause,
      orderBy: [desc(organizations.createdAt)],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return {
      items: rows.map(toResponse),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async create(input: OrganizationCreate, creatorId: string): Promise<OrganizationResponse> {
    try {
      const rows = await this.db
        .insert(organizations)
        .values({
          name: input.name,
          description: input.description,
          isActive: input.isActive,
          createdBy: creatorId,
        })
        .returning();

      const row = rows[0];
      if (!row) throw new Error('Insert failed');
      return toResponse(row);
    } catch (e: any) {
      if (e.code === '23505') {
        throw new ConflictException('ORGANIZATION_ALREADY_EXISTS');
      }
      throw e;
    }
  }

  async update(id: string, input: OrganizationUpdate): Promise<OrganizationResponse> {
    const rows = await this.db
      .update(organizations)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(and(eq(organizations.id, id), isNull(organizations.deletedAt)))
      .returning();

    const row = rows[0];
    if (!row) throw new NotFoundException('ORGANIZATION_NOT_FOUND');
    return toResponse(row);
  }

  async findById(id: string): Promise<OrganizationWithMembersResponse> {
    const org = await this.db.query.organizations.findFirst({
      where: and(eq(organizations.id, id), isNull(organizations.deletedAt)),
      with: {
        members: {
          with: {
            user: true,
          },
        },
      },
    });

    if (!org) throw new NotFoundException('ORGANIZATION_NOT_FOUND');

    return {
      ...toResponse(org),
      members: (org as any).members.map((m: any) => ({
        id: m.id,
        organizationId: m.organizationId,
        userId: m.userId,
        role: m.role,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
        user: {
          id: m.user.id,
          email: m.user.email,
          fullName: m.user.fullName,
        },
      })),
    };
  }

  async addMember(orgId: string, input: AddMemberByEmail) {
    const user = await this.usersService.findByEmail(input.email);
    if (!user) {
      throw new BadRequestException('USER_NOT_FOUND');
    }

    try {
      await this.db.insert(organizationMembers).values({
        organizationId: orgId,
        userId: user.id,
        role: input.role,
      });
    } catch (e: any) {
      if (e.code === '23505') {
        throw new ConflictException('MEMBER_ALREADY_EXISTS');
      }
      throw e;
    }
  }

  async updateMemberRole(orgId: string, userId: string, role: any) {
    const rows = await this.db
      .update(organizationMembers)
      .set({ role, updatedAt: new Date() })
      .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, userId)))
      .returning();

    if (rows.length === 0) {
      throw new NotFoundException('MEMBER_NOT_FOUND');
    }
  }

  async removeMember(orgId: string, userId: string) {
    const result = await this.db
      .delete(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, userId)))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException('MEMBER_NOT_FOUND');
    }
  }
}

function toResponse(row: any): OrganizationResponse {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}
