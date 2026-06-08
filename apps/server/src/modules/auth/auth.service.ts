import { randomUUID } from 'crypto';
import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import type {
  AuthUser,
  JwtPayload,
  LoginRequest,
  LoginResponse,
  RefreshResponse,
  Role,
  OrgRole,
} from '@volunteerfleet/shared';
import type { Env } from '../../config/env.schema.js';
import { UsersService, type UserRecord } from '../users/users.service.js';

type IssueArgs = Pick<UserRecord, 'id' | 'email'> & {
  userRole: Role;
  activeOrgId: string | null;
  orgRole: OrgRole | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService<Env, true>,
  ) {}

  async validateUser(email: string, password: string): Promise<UserRecord> {
    const user = await this.users.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('INVALID_CREDENTIALS');
    return user;
  }

  async login(
    dto: LoginRequest,
  ): Promise<{ response: LoginResponse; refreshToken: string; accessToken: string }> {
    const user = await this.validateUser(dto.email, dto.password);
    const memberships = await this.users.getUserMemberships(user.id);

    let activeOrgId = user.lastActiveOrgId;
    let activeMembership = memberships.find((m) => m.organizationId === activeOrgId);

    if (!activeMembership) {
      activeMembership = memberships[0];
      activeOrgId = activeMembership?.organizationId ?? null;
      if (activeOrgId !== user.lastActiveOrgId) {
        await this.users.setLastActiveOrg(user.id, activeOrgId);
      }
    }

    const orgRole = activeMembership?.role ?? null;
    const issueArgs: IssueArgs = {
      id: user.id,
      email: user.email,
      userRole: user.role,
      activeOrgId,
      orgRole,
    };

    const accessToken = this.signAccess(issueArgs);
    const refreshToken = this.signRefresh(issueArgs);
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      userRole: user.role,
      activeOrgId,
      orgRole,
      memberships,
    };
    return { response: { user: authUser }, refreshToken, accessToken };
  }

  async refresh(refreshToken: string | undefined): Promise<{
    response: RefreshResponse;
    refreshToken: string;
    accessToken: string;
  }> {
    if (!refreshToken) throw new UnauthorizedException('NO_REFRESH_TOKEN');
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(refreshToken, {
        secret: this.cfg.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
    }
    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('USER_INACTIVE');
    }

    const memberships = await this.users.getUserMemberships(user.id);
    let activeOrgId = user.lastActiveOrgId;
    let activeMembership = memberships.find((m) => m.organizationId === activeOrgId);

    if (!activeMembership) {
      activeMembership = memberships[0];
      activeOrgId = activeMembership?.organizationId ?? null;
      if (activeOrgId !== user.lastActiveOrgId) {
        await this.users.setLastActiveOrg(user.id, activeOrgId);
      }
    }

    const orgRole = activeMembership?.role ?? null;
    const issueArgs: IssueArgs = {
      id: user.id,
      email: user.email,
      userRole: user.role,
      activeOrgId,
      orgRole,
    };

    const accessToken = this.signAccess(issueArgs);
    const rotated = this.signRefresh(issueArgs);
    return { response: {}, refreshToken: rotated, accessToken };
  }

  async switchOrg(
    userId: string,
    organizationId: string,
  ): Promise<{ response: RefreshResponse; refreshToken: string; accessToken: string }> {
    const user = await this.users.findById(userId);
    if (!user || !user.isActive) throw new UnauthorizedException('USER_INACTIVE');

    const memberships = await this.users.getUserMemberships(user.id);
    const activeMembership = memberships.find((m) => m.organizationId === organizationId);
    if (!activeMembership) {
      throw new ForbiddenException('NOT_A_MEMBER');
    }

    await this.users.setLastActiveOrg(user.id, organizationId);

    const issueArgs: IssueArgs = {
      id: user.id,
      email: user.email,
      userRole: user.role,
      activeOrgId: organizationId,
      orgRole: activeMembership.role,
    };

    const accessToken = this.signAccess(issueArgs);
    const rotated = this.signRefresh(issueArgs);

    return { response: {}, refreshToken: rotated, accessToken };
  }

  private signAccess(user: IssueArgs): string {
    return this.jwt.sign(
      {
        sub: user.id,
        email: user.email,
        userRole: user.userRole,
        activeOrgId: user.activeOrgId,
        orgRole: user.orgRole,
      },
      {
        secret: this.cfg.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: this.cfg.get('JWT_ACCESS_TTL', { infer: true }),
      },
    );
  }

  private signRefresh(user: IssueArgs): string {
    return this.jwt.sign(
      {
        sub: user.id,
        email: user.email,
        userRole: user.userRole,
        activeOrgId: user.activeOrgId,
        orgRole: user.orgRole,
        jti: randomUUID(),
      },
      {
        secret: this.cfg.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: this.cfg.get('JWT_REFRESH_TTL', { infer: true }),
      },
    );
  }
}
