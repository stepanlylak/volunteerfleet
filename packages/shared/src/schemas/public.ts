import { z } from 'zod';
import { fundingSourceSchema, fundingSourceTypeSchema } from './dictionary.js';
import { expenseCategoryBreakdownSchema, vehicleExpenseBreakdownSchema } from './report.js';
import { uuidSchema } from './common.js';
import { publicVehiclePhotoSchema } from './vehicle-photo.js';

export const publicVehicleParamsSchema = z.object({
  orgId: uuidSchema,
  vehicleId: uuidSchema,
});
export type PublicVehicleParams = z.infer<typeof publicVehicleParamsSchema>;

export const publicReportParamsSchema = z.object({
  orgId: uuidSchema,
  id: uuidSchema,
});
export type PublicReportParams = z.infer<typeof publicReportParamsSchema>;

export const publicVehicleResponseSchema = z.object({
  identifier: z.string(),
  brand: z.string(),
  model: z.string(),
  year: z.number().int().nullable(),
  status: z.object({ name: z.string() }),
  publicSummary: z.string().nullable(),
  publicCollectedAmountUah: z.number().nullable(),
  publicGoalAmountUah: z.number().nullable(),
  photos: z.array(publicVehiclePhotoSchema),
  createdAt: z.string(),
});
export type PublicVehicleResponse = z.infer<typeof publicVehicleResponseSchema>;

export const publicFundingReportResponseSchema = z.object({
  fundingSource: fundingSourceSchema.pick({
    id: true,
    name: true,
    type: true,
    description: true,
  }),
  dateFrom: z.string().nullable(),
  dateTo: z.string().nullable(),
  totalUah: z.number(),
  byCategory: z.array(expenseCategoryBreakdownSchema),
  byVehicle: z.array(vehicleExpenseBreakdownSchema),
});
export type PublicFundingReportResponse = z.infer<typeof publicFundingReportResponseSchema>;

export const publicFundingSourceSummarySchema = z.object({
  id: uuidSchema,
  name: z.string(),
  type: fundingSourceTypeSchema,
  description: z.string().nullable(),
});
export type PublicFundingSourceSummary = z.infer<typeof publicFundingSourceSummarySchema>;
