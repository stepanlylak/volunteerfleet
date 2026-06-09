import { z } from 'zod';
import { nonEmptyString, uuidSchema } from './common.js';

export const FUNDING_SOURCE_TYPES = ['donor', 'fundraiser', 'initiative', 'other'] as const;
export type FundingSourceType = (typeof FUNDING_SOURCE_TYPES)[number];

const sortOrderSchema = z.number().int().min(0).max(32767);

// expense_categories
export const expenseCategoryCreateSchema = z.object({
  name: nonEmptyString.max(128),
  sortOrder: sortOrderSchema.default(0),
});
export type ExpenseCategoryCreate = z.infer<typeof expenseCategoryCreateSchema>;

export const expenseCategoryUpdateSchema = expenseCategoryCreateSchema.partial();
export type ExpenseCategoryUpdate = z.infer<typeof expenseCategoryUpdateSchema>;

export const expenseCategorySchema = z.object({
  id: uuidSchema,
  name: z.string(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ExpenseCategory = z.infer<typeof expenseCategorySchema>;

// funding_sources
export const fundingSourceTypeSchema = z.enum(FUNDING_SOURCE_TYPES);

export const fundingSourceCreateSchema = z.object({
  name: nonEmptyString.max(128),
  type: fundingSourceTypeSchema,
  description: z.string().trim().max(2000).optional().nullable(),
  organizationId: uuidSchema,
});
export type FundingSourceCreate = z.infer<typeof fundingSourceCreateSchema>;

export const fundingSourceUpdateSchema = fundingSourceCreateSchema.partial();
export type FundingSourceUpdate = z.infer<typeof fundingSourceUpdateSchema>;

export const fundingSourceSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  type: fundingSourceTypeSchema,
  description: z.string().nullable(),
  organizationId: uuidSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type FundingSource = z.infer<typeof fundingSourceSchema>;
