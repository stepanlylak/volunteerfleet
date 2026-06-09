import { z } from 'zod';
import { positiveMinorAmountSchema, uuidSchema } from './common.js';
import { publicVehiclePhotoSchema } from './vehicle-photo.js';

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
  photos: z.array(publicVehiclePhotoSchema),
  createdAt: z.string(),
});
export type PublicVehicleResponse = z.infer<typeof publicVehicleResponseSchema>;
