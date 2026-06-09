import { z } from 'zod';
import { minorAmountSchema, positiveMinorAmountSchema, uuidSchema } from './common.js';
import { donorSummarySchema } from './donor.js';
import { financialCategorySummarySchema } from './dictionary.js';
import { currencySchema, expenseVehicleSummarySchema } from './expense.js';
import { pageQuerySchema } from './pagination.js';

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const entryTypeSchema = z.enum(['expense', 'donation']);
const signedExpenseAmountSchema = minorAmountSchema.refine((value) => value < 0);
const signedDonationAmountSchema = positiveMinorAmountSchema;

const financialEntryBaseFields = {
  id: uuidSchema,
  entryDate: dateOnlySchema,
  amountMinor: positiveMinorAmountSchema,
  currency: currencySchema,
  rate: z.number().positive(),
  amountUahMinor: positiveMinorAmountSchema,
  vehicle: expenseVehicleSummarySchema,
  description: z.string().nullable(),
  createdAt: z.string(),
};

export const expenseFinancialEntrySchema = z
  .object({
    ...financialEntryBaseFields,
    type: z.literal('expense'),
    signedAmountMinor: signedExpenseAmountSchema,
    signedAmountUahMinor: signedExpenseAmountSchema,
    category: financialCategorySummarySchema,
    donor: z.null(),
    documentCount: z.number().int().min(0),
  })
  .strict();
export type ExpenseFinancialEntry = z.infer<typeof expenseFinancialEntrySchema>;

export const donationFinancialEntrySchema = z
  .object({
    ...financialEntryBaseFields,
    type: z.literal('donation'),
    signedAmountMinor: signedDonationAmountSchema,
    signedAmountUahMinor: signedDonationAmountSchema,
    category: financialCategorySummarySchema.nullable(),
    donor: donorSummarySchema,
  })
  .strict();
export type DonationFinancialEntry = z.infer<typeof donationFinancialEntrySchema>;

export const financialEntrySchema = z.discriminatedUnion('type', [
  expenseFinancialEntrySchema,
  donationFinancialEntrySchema,
]);
export type FinancialEntry = z.infer<typeof financialEntrySchema>;

export const financialEntryListQuerySchema = pageQuerySchema.extend({
  type: entryTypeSchema.optional(),
  vehicleId: uuidSchema.optional(),
  categoryId: uuidSchema.optional(),
  donorId: uuidSchema.optional(),
  dateFrom: dateOnlySchema.optional(),
  dateTo: dateOnlySchema.optional(),
  currency: currencySchema.optional(),
});
export type FinancialEntryListQuery = z.infer<typeof financialEntryListQuerySchema>;

export const financialCurrencySummarySchema = z.object({
  currency: currencySchema,
  expensesMinor: minorAmountSchema.refine((value) => value >= 0),
  donationsMinor: minorAmountSchema.refine((value) => value >= 0),
  balanceMinor: minorAmountSchema,
});
export type FinancialCurrencySummary = z.infer<typeof financialCurrencySummarySchema>;

export const financialSummarySchema = z.object({
  expensesUahMinor: minorAmountSchema.refine((value) => value >= 0),
  donationsUahMinor: minorAmountSchema.refine((value) => value >= 0),
  balanceUahMinor: minorAmountSchema,
  byCurrency: z.array(financialCurrencySummarySchema),
});
export type FinancialSummary = z.infer<typeof financialSummarySchema>;

export const financialEntryListResponseSchema = z.object({
  items: z.array(financialEntrySchema),
  summary: financialSummarySchema,
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});
export type FinancialEntryListResponse = z.infer<typeof financialEntryListResponseSchema>;
