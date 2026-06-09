import { z } from 'zod';
import { nonEmptyString, uuidSchema } from './common.js';
import { pageQuerySchema, pageResultSchema } from './pagination.js';

export const donorCreateSchema = z
  .object({
    name: nonEmptyString.max(255),
    allowDuplicateName: z.boolean().optional().default(false),
  })
  .strict();
export type DonorCreate = z.infer<typeof donorCreateSchema>;

export const donorResponseSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DonorResponse = z.infer<typeof donorResponseSchema>;

export const donorSummarySchema = donorResponseSchema.pick({
  id: true,
  name: true,
});
export type DonorSummary = z.infer<typeof donorSummarySchema>;

export const donorListQuerySchema = pageQuerySchema.extend({
  isActive: z.coerce.boolean().default(true),
});
export type DonorListQuery = z.infer<typeof donorListQuerySchema>;

export const donorListResponseSchema = pageResultSchema(donorResponseSchema);
export type DonorListResponse = z.infer<typeof donorListResponseSchema>;

export const donorLinkSchema = z.object({ donorId: uuidSchema }).strict();
export type DonorLink = z.infer<typeof donorLinkSchema>;

export const donorResolveResponseSchema = donorSummarySchema.extend({
  alreadyLinked: z.boolean(),
});
export type DonorResolveResponse = z.infer<typeof donorResolveResponseSchema>;
