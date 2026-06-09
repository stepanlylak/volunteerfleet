import { z } from 'zod';
import { nonEmptyString, uuidSchema } from './common.js';

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
