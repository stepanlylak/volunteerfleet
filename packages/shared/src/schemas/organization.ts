import { z } from 'zod';
import { ORG_ROLES } from '../types/roles.js';
import { nonEmptyString, uuidSchema } from './common.js';

export const orgRoleSchema = z.enum(ORG_ROLES);

export const organizationResponseSchema = z.object({
  id: uuidSchema,
  name: nonEmptyString,
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdBy: uuidSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});
export type OrganizationResponse = z.infer<typeof organizationResponseSchema>;

export const organizationCreateSchema = z.object({
  name: nonEmptyString.max(255),
  description: nonEmptyString.optional(),
  isActive: z.boolean().default(true),
});
export type OrganizationCreate = z.infer<typeof organizationCreateSchema>;

export const organizationUpdateSchema = z.object({
  name: nonEmptyString.max(255).optional(),
  description: nonEmptyString.nullable().optional(),
  isActive: z.boolean().optional(),
});
export type OrganizationUpdate = z.infer<typeof organizationUpdateSchema>;

export const organizationMemberResponseSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  userId: uuidSchema,
  role: orgRoleSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type OrganizationMemberResponse = z.infer<typeof organizationMemberResponseSchema>;

export const organizationMemberCreateSchema = z.object({
  userId: uuidSchema,
  role: orgRoleSchema,
});
export type OrganizationMemberCreate = z.infer<typeof organizationMemberCreateSchema>;

export const organizationMemberUpdateSchema = z.object({
  role: orgRoleSchema,
});
export type OrganizationMemberUpdate = z.infer<typeof organizationMemberUpdateSchema>;
