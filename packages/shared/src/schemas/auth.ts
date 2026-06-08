import { z } from 'zod';
import { ORG_ROLES, ROLES } from '../types/roles.js';
import { nonEmptyString, uuidSchema } from './common.js';

export const roleSchema = z.enum(ROLES);

export const loginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: nonEmptyString,
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const authUserSchema = z.object({
  id: uuidSchema,
  email: z.string().email(),
  fullName: nonEmptyString,
  role: roleSchema,
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const loginResponseSchema = z.object({
  accessToken: nonEmptyString,
  user: authUserSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const refreshResponseSchema = z.object({
  accessToken: nonEmptyString,
});
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

export const meResponseSchema = authUserSchema;
export type MeResponse = z.infer<typeof meResponseSchema>;

export const jwtPayloadSchema = z.object({
  sub: uuidSchema,
  email: z.string().email(),
  role: roleSchema,
  activeOrgId: uuidSchema.nullable().optional(),
  orgRole: z.enum(ORG_ROLES).nullable().optional(),
  iat: z.number().int(),
  exp: z.number().int(),
});
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;
