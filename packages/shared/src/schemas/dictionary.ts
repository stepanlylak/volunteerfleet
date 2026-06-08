import { z } from 'zod';
import { nonEmptyString, uuidSchema } from './common.js';

export const FUNDING_SOURCE_TYPES = ['donor', 'fundraiser', 'initiative', 'other'] as const;
export type FundingSourceType = (typeof FUNDING_SOURCE_TYPES)[number];

export const VEHICLE_STATUS_KINDS = ['in_work', 'final', 'other'] as const;
export type VehicleStatusKind = (typeof VEHICLE_STATUS_KINDS)[number];

const sortOrderSchema = z.number().int().min(0).max(32767);
const colorHexSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Колір має бути у форматі #RRGGBB');

// vehicle_statuses
export const vehicleStatusCreateSchema = z.object({
  name: nonEmptyString.max(64),
  sortOrder: sortOrderSchema.default(0),
  isDefault: z.boolean().default(false),
  kind: z.enum(VEHICLE_STATUS_KINDS).default('other'),
  color: colorHexSchema.default('#8c8c8c'),
});
export type VehicleStatusCreate = z.infer<typeof vehicleStatusCreateSchema>;

export const vehicleStatusUpdateSchema = vehicleStatusCreateSchema.partial();
export type VehicleStatusUpdate = z.infer<typeof vehicleStatusUpdateSchema>;

export const vehicleStatusSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  sortOrder: z.number().int(),
  isDefault: z.boolean(),
  kind: z.enum(VEHICLE_STATUS_KINDS),
  color: colorHexSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type VehicleStatus = z.infer<typeof vehicleStatusSchema>;

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
