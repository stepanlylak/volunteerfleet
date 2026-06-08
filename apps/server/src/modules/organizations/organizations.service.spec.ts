import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service.js';
import { UsersService } from '../users/users.service.js';

describe('OrganizationsService', () => {
  let svc: OrganizationsService;
  let db: any;
  let usersService: any;

  beforeEach(() => {
    db = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      query: {
        organizations: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        organizationMembers: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
      },
    };
    usersService = {
      findByEmail: vi.fn(),
    };
    svc = new OrganizationsService(db, usersService as unknown as UsersService);
  });

  describe('ensureNotLastCoordinator', () => {
    const orgId = 'org-1';
    const userId = 'user-1';

    it('allows if user is not a coordinator', async () => {
      db.query.organizationMembers.findFirst.mockResolvedValue(null);
      // Should not throw
      await (svc as any).ensureNotLastCoordinator(orgId, userId);
    });

    it('allows if there are other coordinators', async () => {
      db.query.organizationMembers.findFirst.mockResolvedValue({
        organizationId: orgId,
        userId,
        role: 'coordinator',
      });
      db.returning.mockResolvedValue([{ count: 2 }]);
      // Simulating the count query
      db.where.mockReturnValue([{ count: 2 }]);

      await (svc as any).ensureNotLastCoordinator(orgId, userId);
    });

    it('throws if it is the last coordinator', async () => {
      db.query.organizationMembers.findFirst.mockResolvedValue({
        organizationId: orgId,
        userId,
        role: 'coordinator',
      });
      // The count query in ensureNotLastCoordinator
      db.where.mockResolvedValue([{ count: 1 }]);

      await expect(
        (svc as any).ensureNotLastCoordinator(orgId, userId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeMember', () => {
    const orgId = 'org-1';
    const userId = 'user-1';

    it('calls delete if not last coordinator', async () => {
      // Mock ensureNotLastCoordinator indirectly
      db.query.organizationMembers.findFirst.mockResolvedValue(null);
      db.returning.mockResolvedValue([{ organizationId: orgId, userId }]);

      await svc.removeMember(orgId, userId);
      expect(db.delete).toHaveBeenCalled();
    });

    it('throws NotFoundException if member not found', async () => {
      db.query.organizationMembers.findFirst.mockResolvedValue(null);
      db.returning.mockResolvedValue([]);

      await expect(svc.removeMember(orgId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
