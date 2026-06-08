import { describe, it, expect, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from '@volunteerfleet/shared';
import { TenantContext } from './tenant-context.provider.js';

describe('TenantContext', () => {
  let context: TenantContext;
  let mockRequest: Partial<Request>;

  beforeEach(() => {
    mockRequest = {};
    context = new TenantContext(mockRequest as Request);
  });

  describe('activeOrgId', () => {
    it('should throw UnauthorizedException if user is not in request', () => {
      expect(() => context.activeOrgId).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if activeOrgId is not present', () => {
      mockRequest.user = { sub: 'user1' } as unknown as JwtPayload;
      expect(() => context.activeOrgId).toThrow(UnauthorizedException);
    });

    it('should return activeOrgId if present in request user', () => {
      mockRequest.user = { activeOrgId: 'org1' } as unknown as JwtPayload;
      expect(context.activeOrgId).toBe('org1');
    });
  });

  describe('orgRole', () => {
    it('should return null if user is not in request', () => {
      expect(context.orgRole).toBeNull();
    });

    it('should return null if orgRole is not present', () => {
      mockRequest.user = { activeOrgId: 'org1' } as unknown as JwtPayload;
      expect(context.orgRole).toBeNull();
    });

    it('should return orgRole if present in request user', () => {
      mockRequest.user = { orgRole: 'coordinator' } as unknown as JwtPayload;
      expect(context.orgRole).toBe('coordinator');
    });
  });

  describe('hasActiveOrg', () => {
    it('should return false if user is not in request', () => {
      expect(context.hasActiveOrg).toBe(false);
    });

    it('should return false if activeOrgId is not present', () => {
      mockRequest.user = { sub: 'user1' } as unknown as JwtPayload;
      expect(context.hasActiveOrg).toBe(false);
    });

    it('should return true if activeOrgId is present', () => {
      mockRequest.user = { activeOrgId: 'org1' } as unknown as JwtPayload;
      expect(context.hasActiveOrg).toBe(true);
    });
  });
});
