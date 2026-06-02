import { z } from 'zod';
import { currencySchema, expenseResponseSchema } from './expense.js';
import { documentResponseSchema } from './document.js';
import { fundingSourceSchema } from './dictionary.js';
import { uuidSchema } from './common.js';
import { vehicleResponseSchema, vehicleStatusHistorySchema } from './vehicle.js';

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const expenseCurrencyBreakdownSchema = z.object({
  currency: currencySchema,
  totalInCurrency: z.number(),
  totalUah: z.number(),
});
export type ExpenseCurrencyBreakdown = z.infer<typeof expenseCurrencyBreakdownSchema>;

export const expenseCategoryBreakdownSchema = z.object({
  category: z.string(),
  totalUah: z.number(),
});
export type ExpenseCategoryBreakdown = z.infer<typeof expenseCategoryBreakdownSchema>;

export const vehicleExpenseBreakdownSchema = z.object({
  vehicle: z
    .object({
      id: uuidSchema,
      identifier: z.string(),
      brand: z.string(),
      model: z.string(),
      publicSlug: z.string().nullable().optional(),
    })
    .nullable(),
  totalUah: z.number(),
});
export type VehicleExpenseBreakdown = z.infer<typeof vehicleExpenseBreakdownSchema>;

export const vehicleReportResponseSchema = z.object({
  vehicle: vehicleResponseSchema,
  totalUah: z.number(),
  byCurrency: z.array(expenseCurrencyBreakdownSchema),
  byCategory: z.array(expenseCategoryBreakdownSchema),
  statusHistory: z.array(vehicleStatusHistorySchema),
  expenses: z.array(expenseResponseSchema),
  documents: z.array(documentResponseSchema),
});
export type VehicleReportResponse = z.infer<typeof vehicleReportResponseSchema>;

export const fundingSourceReportQuerySchema = z
  .object({
    dateFrom: dateOnlySchema.optional(),
    dateTo: dateOnlySchema.optional(),
  })
  .refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, {
    message: 'dateFrom must be before or equal to dateTo',
    path: ['dateFrom'],
  });
export type FundingSourceReportQuery = z.infer<typeof fundingSourceReportQuerySchema>;

export const fundingSourceReportResponseSchema = z.object({
  fundingSource: fundingSourceSchema,
  dateFrom: dateOnlySchema.nullable(),
  dateTo: dateOnlySchema.nullable(),
  totalUah: z.number(),
  byCategory: z.array(expenseCategoryBreakdownSchema),
  byVehicle: z.array(vehicleExpenseBreakdownSchema),
  expenses: z.array(expenseResponseSchema),
});
export type FundingSourceReportResponse = z.infer<typeof fundingSourceReportResponseSchema>;
