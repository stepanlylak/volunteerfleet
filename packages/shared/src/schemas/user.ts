import { z } from 'zod';
import { roleSchema } from './auth.js';
import { nonEmptyString, uuidSchema } from './common.js';
import { pageQuerySchema, pageResultSchema } from './pagination.js';

export const userResponseSchema = z.object({
  id: uuidSchema,
  email: z.string().email(),
  fullName: nonEmptyString,
  role: roleSchema,
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});
export type UserResponse = z.infer<typeof userResponseSchema>;

export const userCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  fullName: nonEmptyString.max(255),
  role: roleSchema.default('volunteer'),
  password: z.string().min(8).max(128).optional(),
  isActive: z.boolean().default(true),
});
export type UserCreate = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  fullName: nonEmptyString.max(255).optional(),
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
});
export type UserUpdate = z.infer<typeof userUpdateSchema>;

export const userListQuerySchema = pageQuerySchema.extend({
  role: roleSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  includeDeleted: z.coerce.boolean().default(false),
});
export type UserListQuery = z.infer<typeof userListQuerySchema>;

export const userListResponseSchema = pageResultSchema(userResponseSchema);
export type UserListResponse = z.infer<typeof userListResponseSchema>;

export const userCreateResponseSchema = z.object({
  user: userResponseSchema,
  generatedPassword: z.string().optional(),
});
export type UserCreateResponse = z.infer<typeof userCreateResponseSchema>;

export const resetPasswordResponseSchema = z.object({
  userId: uuidSchema,
  generatedPassword: z.string(),
});
export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>;
