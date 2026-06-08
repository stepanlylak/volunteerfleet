import { eq, type Column } from 'drizzle-orm';
import { NotFoundException } from '@nestjs/common';

/**
 * Returns a Drizzle condition to filter by active organization.
 */
export function orgScope(table: { organizationId: Column }, orgId: string) {
  return eq(table.organizationId, orgId);
}

/**
 * Ensures that the given entity belongs to the active organization.
 * Throws NotFoundException if the entity is null/undefined or belongs to another organization.
 * Used to enforce Invariant 2 (by-id access to another org returns 404).
 */
export function ensureSameOrg<T extends { organizationId: string }>(
  entity: T | undefined | null,
  activeOrgId: string,
): T {
  if (!entity || entity.organizationId !== activeOrgId) {
    throw new NotFoundException('Entity not found');
  }
  return entity;
}

/**
 * Validates cross-entity references (e.g. attaching an expense to a vehicle).
 * Throws NotFoundException if the referenced entity doesn't exist or belongs to another organization.
 */
export function validateCrossOrgReference<T extends { organizationId: string }>(
  referencedEntity: T | undefined | null,
  activeOrgId: string,
): T {
  if (!referencedEntity || referencedEntity.organizationId !== activeOrgId) {
    // We throw 404 to avoid revealing the existence of cross-org entities
    throw new NotFoundException('Referenced entity not found');
  }
  return referencedEntity;
}
