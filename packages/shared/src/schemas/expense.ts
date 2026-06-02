import { z } from 'zod';
import { CURRENCIES } from '../constants/currencies.js';
import { uuidSchema } from './common.js';
import { expenseCategorySchema, fundingSourceSchema } from './dictionary.js';
import { pageQuerySchema, pageResultSchema } from './pagination.js';

export const currencySchema = z.enum(CURRENCIES);
export const rateSourceSchema = z.enum(['default', 'manual']);

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const moneySchema = z.number().positive();
const rateSchema = z.number().positive();
const nullableUuidSchema = uuidSchema.optional().nullable();

const expenseMutableFields = {
  vehicleId: nullableUuidSchema,
  expenseDate: dateOnlySchema,
  amount: moneySchema,
  currency: currencySchema,
  rate: rateSchema.optional(),
  categoryId: uuidSchema,
  fundingSourceId: uuidSchema,
  description: z.string().trim().max(2000).optional().nullable(),
};

export const expenseCreateSchema = z.object(expenseMutableFields);
export type ExpenseCreate = z.infer<typeof expenseCreateSchema>;

export const expenseUpdateSchema = z.object(expenseMutableFields).partial();
export type ExpenseUpdate = z.infer<typeof expenseUpdateSchema>;

export const expenseUserInfoSchema = z.object({
  id: uuidSchema,
  fullName: z.string(),
});
export type ExpenseUserInfo = z.infer<typeof expenseUserInfoSchema>;

export const expenseVehicleSummarySchema = z.object({
  id: uuidSchema,
  identifier: z.string(),
  brand: z.string(),
  model: z.string(),
});
export type ExpenseVehicleSummary = z.infer<typeof expenseVehicleSummarySchema>;

export const expenseResponseSchema = z.object({
  id: uuidSchema,
  vehicleId: uuidSchema.nullable(),
  vehicle: expenseVehicleSummarySchema.optional().nullable(),
  expenseDate: dateOnlySchema,
  amount: z.number(),
  currency: currencySchema,
  rate: z.number(),
  rateSource: rateSourceSchema,
  categoryId: uuidSchema,
  category: expenseCategorySchema,
  fundingSourceId: uuidSchema,
  fundingSource: fundingSourceSchema,
  description: z.string().nullable(),
  createdBy: expenseUserInfoSchema,
  updatedBy: expenseUserInfoSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  deletedBy: expenseUserInfoSchema.nullable(),
});
export type ExpenseResponse = z.infer<typeof expenseResponseSchema>;

export const expenseListQuerySchema = pageQuerySchema.extend({
  vehicleId: uuidSchema.optional(),
  categoryId: uuidSchema.optional(),
  fundingSourceId: uuidSchema.optional(),
  dateFrom: dateOnlySchema.optional(),
  dateTo: dateOnlySchema.optional(),
  currency: currencySchema.optional(),
  includeDeleted: z.coerce.boolean().default(false),
});
export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;

export const expenseListResponseSchema = pageResultSchema(expenseResponseSchema);
export type ExpenseListResponse = z.infer<typeof expenseListResponseSchema>;

export const vehicleExpensesQuerySchema = expenseListQuerySchema.omit({ vehicleId: true });
export type VehicleExpensesQuery = z.infer<typeof vehicleExpensesQuerySchema>;
