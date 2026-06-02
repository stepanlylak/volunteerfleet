import { z } from 'zod';
import { nonEmptyString, uuidSchema } from './common.js';
import { pageQuerySchema, pageResultSchema } from './pagination.js';

export const documentKindSchema = z.enum(['upload', 'link']);

const attachmentFields = {
  vehicleId: uuidSchema.optional().nullable(),
  expenseId: uuidSchema.optional().nullable(),
};

function requireAttachment<T extends { vehicleId?: string | null; expenseId?: string | null }>(
  value: T,
  ctx: z.RefinementCtx,
): void {
  if (!value.vehicleId && !value.expenseId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'vehicleId or expenseId is required',
      path: ['vehicleId'],
    });
  }
}

export const documentUploadMetadataSchema = z
  .object({
    name: nonEmptyString.max(255),
    ...attachmentFields,
  })
  .superRefine(requireAttachment);
export type DocumentUploadMetadata = z.infer<typeof documentUploadMetadataSchema>;

export const documentUploadReplaceMetadataSchema = z.object({
  name: nonEmptyString.max(255),
});
export type DocumentUploadReplaceMetadata = z.infer<typeof documentUploadReplaceMetadataSchema>;

export const documentLinkCreateSchema = z
  .object({
    name: nonEmptyString.max(255),
    url: z.string().url().max(2048),
    ...attachmentFields,
  })
  .superRefine(requireAttachment);
export type DocumentLinkCreate = z.infer<typeof documentLinkCreateSchema>;

export const documentUpdateSchema = z
  .object({
    name: nonEmptyString.max(255).optional(),
    url: z.string().url().max(2048).optional(),
    ...attachmentFields,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });
export type DocumentUpdate = z.infer<typeof documentUpdateSchema>;

export const documentUserInfoSchema = z.object({
  id: uuidSchema,
  fullName: z.string(),
});
export type DocumentUserInfo = z.infer<typeof documentUserInfoSchema>;

export const documentVehicleSummarySchema = z.object({
  id: uuidSchema,
  identifier: z.string(),
  brand: z.string(),
  model: z.string(),
});
export type DocumentVehicleSummary = z.infer<typeof documentVehicleSummarySchema>;

export const documentExpenseSummarySchema = z.object({
  id: uuidSchema,
  expenseDate: z.string(),
  amount: z.number(),
  currency: z.string(),
});
export type DocumentExpenseSummary = z.infer<typeof documentExpenseSummarySchema>;

export const documentResponseSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  kind: documentKindSchema,
  fileKey: z.string().nullable(),
  url: z.string().nullable(),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().nullable(),
  vehicleId: uuidSchema.nullable(),
  vehicle: documentVehicleSummarySchema.optional().nullable(),
  expenseId: uuidSchema.nullable(),
  expense: documentExpenseSummarySchema.optional().nullable(),
  createdBy: documentUserInfoSchema,
  updatedBy: documentUserInfoSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  deletedBy: documentUserInfoSchema.nullable(),
});
export type DocumentResponse = z.infer<typeof documentResponseSchema>;

export const documentListQuerySchema = pageQuerySchema.extend({
  vehicleId: uuidSchema.optional(),
  expenseId: uuidSchema.optional(),
  kind: documentKindSchema.optional(),
  includeDeleted: z.coerce.boolean().default(false),
});
export type DocumentListQuery = z.infer<typeof documentListQuerySchema>;

export const documentListResponseSchema = pageResultSchema(documentResponseSchema);
export type DocumentListResponse = z.infer<typeof documentListResponseSchema>;

export const vehicleDocumentsQuerySchema = documentListQuerySchema.omit({ vehicleId: true });
export type VehicleDocumentsQuery = z.infer<typeof vehicleDocumentsQuerySchema>;
