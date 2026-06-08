import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcrypt';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../../config/env.schema.js';
import type { UsersService, UserRecord } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

const ACCESS_SECRET = 'a'.repeat(32);
const REFRESH_SECRET = 'r'.repeat(32);

function makeCfg(): ConfigService<Env, true> {
  const values: Partial<Record<keyof Env, unknown>> = {
    JWT_ACCESS_SECRET: ACCESS_SECRET,
    JWT_REFRESH_SECRET: REFRESH_SECRET,
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '30d',
    NODE_ENV: 'test',
  };
  return {
    get: vi.fn((key: string) => values[key as keyof Env]),
  } as unknown as ConfigService<Env, true>;
}

function makeUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@example.com',
    passwordHash: '',
    fullName: 'Admin',
    role: 'superuser',
    isActive: true,
    lastActiveOrgId: null,
    ...overrides,
  };
}

describe('AuthService', () => {
  let users: { findByEmail: ReturnType<typeof vi.fn>; findById: ReturnType<typeof vi.fn> };
  let jwt: JwtService;
  let svc: AuthService;
  let passwordHash: string;

  beforeEach(async () => {
    passwordHash = await bcrypt.hash('correct-horse', 4);
    users = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
    };
    jwt = new JwtService({});
    svc = new AuthService(users as unknown as UsersService, jwt, makeCfg());
  });

  describe('validateUser', () => {
    it('returns user on correct password', async () => {
      users.findByEmail.mockResolvedValue(makeUser({ passwordHash }));
      const user = await svc.validateUser('admin@example.com', 'correct-horse');
      expect(user.email).toBe('admin@example.com');
    });

    it('throws on wrong password', async () => {
      users.findByEmail.mockResolvedValue(makeUser({ passwordHash }));
      await expect(svc.validateUser('admin@example.com', 'wrong')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws on missing user', async () => {
      users.findByEmail.mockResolvedValue(null);
      await expect(svc.validateUser('nope@example.com', 'x')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws on inactive user', async () => {
      users.findByEmail.mockResolvedValue(makeUser({ passwordHash, isActive: false }));
      await expect(svc.validateUser('admin@example.com', 'correct-horse')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('login', () => {
    it('returns access token and rotated refresh', async () => {
      users.findByEmail.mockResolvedValue(makeUser({ passwordHash }));
      const result = await svc.login({ email: 'admin@example.com', password: 'correct-horse' });
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      const verified = jwt.verify(result.accessToken, { secret: ACCESS_SECRET });
      expect(verified.sub).toBe('00000000-0000-0000-0000-000000000001');
      expect(verified.userRole).toBe('superuser');
    });
  });

  describe('refresh', () => {
    it('rotates refresh and issues new access', async () => {
      const user = makeUser({ passwordHash });
      users.findById.mockResolvedValue(user);
      const refreshToken = jwt.sign(
        { sub: user.id, email: user.email, userRole: user.role },
        { secret: REFRESH_SECRET, expiresIn: '30d' },
      );
      const result = await svc.refresh(refreshToken);
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      expect(result.refreshToken).not.toBe(refreshToken);
    });

    it('throws without token', async () => {
      await expect(svc.refresh(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws on invalid signature', async () => {
      const bogus = jwt.sign(
        { sub: 'x', email: 'x@x', userRole: 'superuser' },
        { secret: 'other-secret-aaaaaaaaaaaaaaaa' },
      );
      await expect(svc.refresh(bogus)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws when user is inactive', async () => {
      const user = makeUser({ passwordHash, isActive: false });
      users.findById.mockResolvedValue(user);
      const refreshToken = jwt.sign(
        { sub: user.id, email: user.email, userRole: user.role },
        { secret: REFRESH_SECRET, expiresIn: '30d' },
      );
      await expect(svc.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
