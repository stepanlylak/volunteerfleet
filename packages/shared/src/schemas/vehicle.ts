import { z } from 'zod';
import { nonEmptyString, uuidSchema } from './common.js';
import { pageQuerySchema, pageResultSchema } from './pagination.js';
import { vehicleAlertSchema, vehicleStatusSchema } from './vehicle-status.js';

// Base fields for vehicle
const vehicleYearSchema = z.number().int().min(1900).max(2100).optional().nullable();
const vehicleVinSchema = z.string().trim().max(64).optional().nullable();
const vehicleDescriptionSchema = z.string().trim().max(2000).optional().nullable();
const startDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Public fields
const publicSummarySchema = z.string().trim().max(5000).optional().nullable();
const publicAmountSchema = z.number().positive().optional().nullable();

// Create schema
export const vehicleCreateSchema = z.object({
  identifier: nonEmptyString.max(64),
  brand: nonEmptyString.max(128),
  model: nonEmptyString.max(128),
  year: vehicleYearSchema,
  vin: vehicleVinSchema,
  startDate: startDateSchema,
  description: vehicleDescriptionSchema,
});
export type VehicleCreate = z.infer<typeof vehicleCreateSchema>;

// Update schema (partial, all fields optional)
export const vehicleUpdateSchema = z.object({
  identifier: nonEmptyString.max(64).optional(),
  brand: nonEmptyString.max(128).optional(),
  model: nonEmptyString.max(128).optional(),
  year: vehicleYearSchema,
  vin: vehicleVinSchema,
  startDate: startDateSchema.optional(),
  description: vehicleDescriptionSchema,
  // Public fields (admin only in controller)
  isPublic: z.boolean().optional(),
  publicSummary: publicSummarySchema,
  publicCollectedAmountUah: publicAmountSchema,
  publicGoalAmountUah: publicAmountSchema,
});
export type VehicleUpdate = z.infer<typeof vehicleUpdateSchema>;

// Creator/Updater info (embedded in response)
export const vehicleUserInfoSchema = z.object({
  id: uuidSchema,
  fullName: z.string(),
});
export type VehicleUserInfo = z.infer<typeof vehicleUserInfoSchema>;

// Vehicle response schema
export const vehicleResponseSchema = z.object({
  id: uuidSchema,
  identifier: z.string(),
  brand: z.string(),
  model: z.string(),
  year: z.number().int().nullable(),
  vin: z.string().nullable(),
  startDate: z.string(),
  borderCrossingDate: z.string().nullable(),
  status: vehicleStatusSchema,
  description: z.string().nullable(),
  isPublic: z.boolean(),
  publicSummary: z.string().nullable(),
  publicCollectedAmountUah: z.number().nullable(),
  publicGoalAmountUah: z.number().nullable(),
  createdBy: vehicleUserInfoSchema,
  updatedBy: vehicleUserInfoSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  deletedBy: vehicleUserInfoSchema.nullable(),
  alerts: z.array(vehicleAlertSchema),
});
export type VehicleResponse = z.infer<typeof vehicleResponseSchema>;

// List query schema (pagination + filters)
export const vehicleListQuerySchema = pageQuerySchema.extend({
  status: vehicleStatusSchema.optional(),
  statuses: z
    .preprocess(
      (val) => (Array.isArray(val) ? val : val !== undefined ? [val] : undefined),
      z.array(vehicleStatusSchema).optional(),
    )
    .optional(),
  search: z.string().optional(),
  hasAlerts: z.coerce.boolean().optional(),
  includeDeleted: z.coerce.boolean().default(false),
});
export type VehicleListQuery = z.infer<typeof vehicleListQuerySchema>;

// List response schema
export const vehicleListResponseSchema = pageResultSchema(vehicleResponseSchema);
export type VehicleListResponse = z.infer<typeof vehicleListResponseSchema>;

// Status history entry
export const vehicleStatusHistorySchema = z.object({
  id: uuidSchema,
  vehicleId: uuidSchema,
  oldStatus: vehicleStatusSchema.nullable(),
  newStatus: vehicleStatusSchema,
  changedBy: vehicleUserInfoSchema,
  note: z.string().nullable(),
  changedAt: z.string(),
  transitionDate: z.string(),

  purchasePrice: z.number().nullable(),
  purchaseCurrency: z.enum(['UAH', 'USD', 'EUR']).nullable(),
  purchaseRate: z.number().nullable(),
  purchaseRateSource: z.enum(['default', 'manual']).nullable(),
  isLocalPurchase: z.boolean().nullable(),

  isRegisteredAtServiceCenter: z.boolean().nullable(),
  lostReason: z.string().nullable(),

  registrationDocId: uuidSchema.nullable(),
  stampedRegistrationDocId: uuidSchema.nullable(),
  customsDeclarationDocId: uuidSchema.nullable(),
  stampedCustomsDeclarationDocId: uuidSchema.nullable(),
  transferActDraftDocId: uuidSchema.nullable(),
  transferActSignedDocId: uuidSchema.nullable(),
  returnActDocId: uuidSchema.nullable(),
});
export type VehicleStatusHistory = z.infer<typeof vehicleStatusHistorySchema>;

// Status history list response
export const vehicleStatusHistoryListResponseSchema = z.object({
  items: z.array(vehicleStatusHistorySchema),
  total: z.number().int(),
});
export type VehicleStatusHistoryListResponse = z.infer<
  typeof vehicleStatusHistoryListResponseSchema
>;
