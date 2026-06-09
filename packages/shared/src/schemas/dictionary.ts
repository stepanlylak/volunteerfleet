import { z } from 'zod';
import { nonEmptyString, uuidSchema } from './common.js';

export const FUNDING_SOURCE_TYPES = ['donor', 'fundraiser', 'initiative', 'other'] as const;
export type FundingSourceType = (typeof FUNDING_SOURCE_TYPES)[number];

const sortOrderSchema = z.number().int().min(0).max(32767);

export const financialCategoryCreateSchema = z.object({
  name: nonEmptyString.max(128),
  sortOrder: sortOrderSchema.default(0),
});
export type FinancialCategoryCreate = z.infer<typeof financialCategoryCreateSchema>;

export const financialCategoryUpdateSchema = financialCategoryCreateSchema.partial();
export type FinancialCategoryUpdate = z.infer<typeof financialCategoryUpdateSchema>;

export const financialCategorySchema = z.object({
  id: uuidSchema,
  name: z.string(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type FinancialCategory = z.infer<typeof financialCategorySchema>;

export const financialCategorySummarySchema = financialCategorySchema.pick({
  id: true,
  name: true,
});
export type FinancialCategorySummary = z.infer<typeof financialCategorySummarySchema>;

// Compatibility aliases until the dictionary API is renamed in FIN-4.
export const expenseCategoryCreateSchema = financialCategoryCreateSchema;
export type ExpenseCategoryCreate = FinancialCategoryCreate;
export const expenseCategoryUpdateSchema = financialCategoryUpdateSchema;
export type ExpenseCategoryUpdate = FinancialCategoryUpdate;
export const expenseCategorySchema = financialCategorySchema;
export type ExpenseCategory = FinancialCategory;

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
