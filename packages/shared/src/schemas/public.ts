import { z } from 'zod';
import { positiveMinorAmountSchema, uuidSchema } from './common.js';
import { publicVehicleGallerySchema } from './vehicle-gallery.js';

export const publicVehicleParamsSchema = z.object({
  orgId: uuidSchema,
  vehicleId: uuidSchema,
});
export type PublicVehicleParams = z.infer<typeof publicVehicleParamsSchema>;

export const publicVehicleResponseSchema = z.object({
  identifier: z.string(),
  brand: z.string(),
  model: z.string(),
  year: z.number().int().nullable(),
  status: z.object({ name: z.string() }),
  publicSummary: z.string().nullable(),
  publicCollectedAmountUahMinor: positiveMinorAmountSchema.nullable(),
  publicGoalAmountUahMinor: positiveMinorAmountSchema.nullable(),
  galleries: z.array(publicVehicleGallerySchema),
  createdAt: z.string(),
});
export type PublicVehicleResponse = z.infer<typeof publicVehicleResponseSchema>;
