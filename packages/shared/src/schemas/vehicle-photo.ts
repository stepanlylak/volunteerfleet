import { z } from 'zod';
import { uuidSchema } from './common.js';

export const vehiclePhotoUploadMetadataSchema = z.object({
  sortOrder: z.coerce.number().int().min(0).max(9).optional(),
});
export type VehiclePhotoUploadMetadata = z.infer<typeof vehiclePhotoUploadMetadataSchema>;

export const vehiclePhotoOrderUpdateSchema = z.object({
  photoIds: z.array(uuidSchema).min(1).max(10),
});
export type VehiclePhotoOrderUpdate = z.infer<typeof vehiclePhotoOrderUpdateSchema>;

export const vehiclePhotoResponseSchema = z.object({
  id: uuidSchema,
  vehicleId: uuidSchema,
  fileKey: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type VehiclePhotoResponse = z.infer<typeof vehiclePhotoResponseSchema>;

export const vehiclePhotoListResponseSchema = z.object({
  items: z.array(vehiclePhotoResponseSchema),
  total: z.number().int().min(0),
  maxPhotos: z.literal(10),
});
export type VehiclePhotoListResponse = z.infer<typeof vehiclePhotoListResponseSchema>;

export const publicVehiclePhotoSchema = vehiclePhotoResponseSchema.pick({
  id: true,
  mimeType: true,
  sortOrder: true,
});
export type PublicVehiclePhoto = z.infer<typeof publicVehiclePhotoSchema>;
