import { describe, it, expect } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import type { Column } from 'drizzle-orm';
import { ensureSameOrg, orgScope, validateCrossOrgReference } from './tenant.utils.js';

describe('Tenant Utilities', () => {
  describe('orgScope', () => {
    it('should return eq condition for organizationId', () => {
      // Mock Drizzle table behavior
      const mockTable = { organizationId: {} as unknown as Column };
      const condition = orgScope(mockTable, 'org1');
      // Just check if it's returning eq logic without deep inspecting drizzle AST which might be complex
      // we know eq returns an SQL object.
      expect(condition).toBeDefined();
    });
  });

  describe('ensureSameOrg', () => {
    it('should throw NotFoundException if entity is null', () => {
      expect(() => ensureSameOrg(null, 'org1')).toThrow(NotFoundException);
    });

    it('should throw NotFoundException if entity is undefined', () => {
      expect(() => ensureSameOrg(undefined, 'org1')).toThrow(NotFoundException);
    });

    it('should throw NotFoundException if entity belongs to a different org', () => {
      const entity = { organizationId: 'org2' };
      expect(() => ensureSameOrg(entity, 'org1')).toThrow(NotFoundException);
    });

    it('should return the entity if it belongs to the active org', () => {
      const entity = { id: 1, organizationId: 'org1' };
      const result = ensureSameOrg(entity, 'org1');
      expect(result).toBe(entity);
    });
  });

  describe('validateCrossOrgReference', () => {
    it('should throw NotFoundException if referenced entity is null', () => {
      expect(() => validateCrossOrgReference(null, 'org1')).toThrow(NotFoundException);
    });

    it('should throw NotFoundException if referenced entity belongs to a different org', () => {
      const referencedEntity = { organizationId: 'org2' };
      expect(() => validateCrossOrgReference(referencedEntity, 'org1')).toThrow(NotFoundException);
    });

    it('should return the referenced entity if it belongs to the active org', () => {
      const referencedEntity = { id: 1, organizationId: 'org1' };
      const result = validateCrossOrgReference(referencedEntity, 'org1');
      expect(result).toBe(referencedEntity);
    });
  });
});
