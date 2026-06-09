import { z } from 'zod';
import { currencySchema, expenseResponseSchema } from './expense.js';
import { documentResponseSchema } from './document.js';
import { minorAmountSchema, uuidSchema } from './common.js';
import { vehicleResponseSchema, vehicleStatusHistorySchema } from './vehicle.js';

export const expenseCurrencyBreakdownSchema = z.object({
  currency: currencySchema,
  totalInCurrencyMinor: minorAmountSchema,
  totalUahMinor: minorAmountSchema,
});
export type ExpenseCurrencyBreakdown = z.infer<typeof expenseCurrencyBreakdownSchema>;

export const financialCategoryBreakdownSchema = z.object({
  category: z.string(),
  totalUahMinor: minorAmountSchema,
});
export type FinancialCategoryBreakdown = z.infer<typeof financialCategoryBreakdownSchema>;

export const vehicleExpenseBreakdownSchema = z.object({
  vehicle: z
    .object({
      id: uuidSchema,
      identifier: z.string(),
      brand: z.string(),
      model: z.string(),
    })
    .nullable(),
  totalUahMinor: minorAmountSchema,
});
export type VehicleExpenseBreakdown = z.infer<typeof vehicleExpenseBreakdownSchema>;

export const vehicleReportResponseSchema = z.object({
  vehicle: vehicleResponseSchema,
  totalUahMinor: minorAmountSchema,
  byCurrency: z.array(expenseCurrencyBreakdownSchema),
  byCategory: z.array(financialCategoryBreakdownSchema),
  statusHistory: z.array(vehicleStatusHistorySchema),
  expenses: z.array(expenseResponseSchema),
  documents: z.array(documentResponseSchema),
});
export type VehicleReportResponse = z.infer<typeof vehicleReportResponseSchema>;
