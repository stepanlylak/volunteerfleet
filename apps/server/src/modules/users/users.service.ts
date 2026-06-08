import { randomInt } from 'crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { and, desc, eq, ilike, isNull, or, SQL, sql } from 'drizzle-orm';
import type {
  ResetPasswordResponse,
  Role,
  UserCreate,
  UserCreateResponse,
  UserListQuery,
  UserListResponse,
  UserResponse,
  UserUpdate,
} from '@volunteerfleet/shared';
import { DB } from '../../db/db.module.js';
import type { Database } from '../../db/client.js';
import { organizationMembers, organizations, users } from '../../db/schema/index.js';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  lastActiveOrgId: string | null;
}

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async list(query: UserListQuery): Promise<UserListResponse> {
    const { page, pageSize, search, role, isActive, includeDeleted } = query;
    const conditions: SQL<unknown>[] = [];

    if (!includeDeleted) conditions.push(isNull(users.deletedAt));
    if (role) conditions.push(eq(users.role, role));
    if (isActive !== undefined) conditions.push(eq(users.isActive, isActive));
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(or(ilike(users.email, pattern), ilike(users.fullName, pattern))!);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(whereClause);
    const total = countResult[0]?.count ?? 0;

    const rows = await this.db.query.users.findMany({
      where: whereClause,
      orderBy: [desc(users.createdAt)],
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

  async create(input: UserCreate): Promise<UserCreateResponse> {
    const generatedPassword = input.password ? undefined : generatePassword();
    const passwordHash = await bcrypt.hash(input.password ?? generatedPassword!, 12);
    const rows = await this.db
      .insert(users)
      .values({
        email: input.email.trim().toLowerCase(),
        fullName: input.fullName,
        role: input.role,
        isActive: input.isActive,
        passwordHash,
      })
      .returning();

    const row = rows[0];
    if (!row) throw new Error('Insert returned no rows');
    return { user: toResponse(row), ...(generatedPassword ? { generatedPassword } : {}) };
  }

  async update(id: string, input: UserUpdate): Promise<UserResponse> {
    const rows = await this.db
      .update(users)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning();

    const row = rows[0];
    if (!row) throw new NotFoundException(`User ${id} not found`);
    return toResponse(row);
  }

  async resetPassword(id: string): Promise<ResetPasswordResponse> {
    const generatedPassword = generatePassword();
    const passwordHash = await bcrypt.hash(generatedPassword, 12);
    const rows = await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning({ id: users.id });

    if (rows.length === 0) throw new NotFoundException(`User ${id} not found`);
    return { userId: id, generatedPassword };
  }

  async softDelete(id: string): Promise<void> {
    const rows = await this.db
      .update(users)
      .set({ isActive: false, deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning({ id: users.id });

    if (rows.length === 0) throw new NotFoundException(`User ${id} not found`);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const normalized = email.trim().toLowerCase();
    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
        lastActiveOrgId: users.lastActiveOrgId,
      })
      .from(users)
      .where(and(eq(users.email, normalized), isNull(users.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
        lastActiveOrgId: users.lastActiveOrgId,
      })
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async getUserMemberships(userId: string) {
    return this.db
      .select({
        organizationId: organizationMembers.organizationId,
        name: organizations.name,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(eq(organizationMembers.userId, userId));
  }

  async setLastActiveOrg(userId: string, orgId: string | null): Promise<void> {
    await this.db
      .update(users)
      .set({ lastActiveOrgId: orgId, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }
}

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%';

function generatePassword(length = 12): string {
  return Array.from({ length }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join(
    '',
  );
}

function toResponse(row: typeof users.$inferSelect): UserResponse {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}
