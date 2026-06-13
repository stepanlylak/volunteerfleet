import { z } from 'zod';
import { nonEmptyString, positiveMinorAmountSchema, uuidSchema } from './common.js';
import { donorSummarySchema } from './donor.js';
import { financialCategorySchema } from './dictionary.js';
import {
  currencySchema,
  expenseUserInfoSchema,
  expenseVehicleSummarySchema,
  rateSourceSchema,
} from './expense.js';
import { pageQuerySchema, pageResultSchema } from './pagination.js';

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const descriptionSchema = z.string().trim().max(2000).optional().nullable();

const donationMutableFields = {
  vehicleId: uuidSchema,
  donationDate: dateOnlySchema,
  amountMinor: positiveMinorAmountSchema,
  currency: currencySchema,
  rate: z.number().positive().optional(),
  categoryId: uuidSchema.optional().nullable(),
  description: descriptionSchema,
};

const donationCreateBaseSchema = z.object(donationMutableFields);

export const donationCreateSchema = z.union([
  donationCreateBaseSchema.extend({ donorId: uuidSchema }).strict(),
  donationCreateBaseSchema.extend({ newDonorName: nonEmptyString.max(255) }).strict(),
]);
export type DonationCreate = z.infer<typeof donationCreateSchema>;

const donationUpdateBaseSchema = z.object(donationMutableFields).partial();

export const donationUpdateSchema = z
  .union([
    donationUpdateBaseSchema.strict(),
    donationUpdateBaseSchema.extend({ donorId: uuidSchema }).strict(),
    donationUpdateBaseSchema.extend({ newDonorName: nonEmptyString.max(255) }).strict(),
  ])
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });
export type DonationUpdate = z.infer<typeof donationUpdateSchema>;

export const donationResponseSchema = z.object({
  id: uuidSchema,
  donorId: uuidSchema,
  donor: donorSummarySchema,
  vehicleId: uuidSchema,
  vehicle: expenseVehicleSummarySchema,
  documentGroupId: uuidSchema.nullable(),
  categoryId: uuidSchema.nullable(),
  category: financialCategorySchema.nullable(),
  donationDate: dateOnlySchema,
  amountMinor: positiveMinorAmountSchema,
  currency: currencySchema,
  rate: z.number().positive(),
  rateSource: rateSourceSchema,
  description: z.string().nullable(),
  createdBy: expenseUserInfoSchema,
  updatedBy: expenseUserInfoSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  deletedBy: expenseUserInfoSchema.nullable(),
});
export type DonationResponse = z.infer<typeof donationResponseSchema>;

export const donationListQuerySchema = pageQuerySchema.extend({
  donorId: uuidSchema.optional(),
  vehicleId: uuidSchema.optional(),
  categoryId: uuidSchema.optional(),
  dateFrom: dateOnlySchema.optional(),
  dateTo: dateOnlySchema.optional(),
  currency: currencySchema.optional(),
  includeDeleted: z.coerce.boolean().default(false),
});
export type DonationListQuery = z.infer<typeof donationListQuerySchema>;

export const donationListResponseSchema = pageResultSchema(donationResponseSchema);
export type DonationListResponse = z.infer<typeof donationListResponseSchema>;
