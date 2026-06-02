import { randomUUID } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
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
} from '@volunteerfleet/shared';
import type { Env } from '../../config/env.schema.js';
import { UsersService, type UserRecord } from '../users/users.service.js';

type IssueArgs = Pick<UserRecord, 'id' | 'email' | 'role'>;

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

  async login(dto: LoginRequest): Promise<{ response: LoginResponse; refreshToken: string }> {
    const user = await this.validateUser(dto.email, dto.password);
    const accessToken = this.signAccess(user);
    const refreshToken = this.signRefresh(user);
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
    return { response: { accessToken, user: authUser }, refreshToken };
  }

  async refresh(refreshToken: string | undefined): Promise<{
    response: RefreshResponse;
    refreshToken: string;
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
    const accessToken = this.signAccess(user);
    const rotated = this.signRefresh(user);
    return { response: { accessToken }, refreshToken: rotated };
  }

  private signAccess(user: IssueArgs): string {
    return this.jwt.sign(
      { sub: user.id, email: user.email, role: user.role as Role },
      {
        secret: this.cfg.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: this.cfg.get('JWT_ACCESS_TTL', { infer: true }),
      },
    );
  }

  private signRefresh(user: IssueArgs): string {
    return this.jwt.sign(
      { sub: user.id, email: user.email, role: user.role as Role, jti: randomUUID() },
      {
        secret: this.cfg.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: this.cfg.get('JWT_REFRESH_TTL', { infer: true }),
      },
    );
  }
}
