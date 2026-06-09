import { z } from 'zod';
import { nonEmptyString, uuidSchema } from './common.js';

export const VEHICLE_GALLERY_KINDS = ['main', 'custom'] as const;
export type VehicleGalleryKind = (typeof VEHICLE_GALLERY_KINDS)[number];
export const vehicleGalleryKindSchema = z.enum(VEHICLE_GALLERY_KINDS);

export const VEHICLE_GALLERY_ITEM_TYPES = ['image'] as const;
export type VehicleGalleryItemType = (typeof VEHICLE_GALLERY_ITEM_TYPES)[number];
export const vehicleGalleryItemTypeSchema = z.enum(VEHICLE_GALLERY_ITEM_TYPES);

export const VEHICLE_GALLERY_MAX_ITEMS = 30;

const emptyToNull = (value: string): string | null => (value === '' ? null : value);

const optionalNormalizedText = (max: number) =>
  z.string().trim().max(max).transform(emptyToNull).nullable().optional();

export const vehicleGalleryNameSchema = nonEmptyString.max(255);
const galleryDescriptionSchema = optionalNormalizedText(2000);
const itemCaptionSchema = optionalNormalizedText(2000);

export const vehicleGalleryCreateSchema = z
  .object({
    name: vehicleGalleryNameSchema,
    description: galleryDescriptionSchema,
    isPublic: z.boolean().default(false),
  })
  .strict();
export type VehicleGalleryCreate = z.infer<typeof vehicleGalleryCreateSchema>;

export const vehicleGalleryUpdateSchema = z
  .object({
    name: vehicleGalleryNameSchema.optional(),
    description: galleryDescriptionSchema,
    isPublic: z.boolean().optional(),
  })
  .strict();
export type VehicleGalleryUpdate = z.infer<typeof vehicleGalleryUpdateSchema>;

export const vehicleGallerySetCoverSchema = z
  .object({
    itemId: uuidSchema.nullable(),
  })
  .strict();
export type VehicleGallerySetCover = z.infer<typeof vehicleGallerySetCoverSchema>;

export const vehicleGalleryItemUploadMetadataSchema = z
  .object({
    caption: itemCaptionSchema,
  })
  .strict();
export type VehicleGalleryItemUploadMetadata = z.infer<
  typeof vehicleGalleryItemUploadMetadataSchema
>;

export const vehicleGalleryItemUpdateSchema = z
  .object({
    caption: itemCaptionSchema,
  })
  .strict();
export type VehicleGalleryItemUpdate = z.infer<typeof vehicleGalleryItemUpdateSchema>;

export const vehicleGalleryItemOrderUpdateSchema = z
  .object({
    itemIds: z
      .array(uuidSchema)
      .min(1)
      .max(VEHICLE_GALLERY_MAX_ITEMS)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'Item IDs must be unique',
      }),
  })
  .strict();
export type VehicleGalleryItemOrderUpdate = z.infer<typeof vehicleGalleryItemOrderUpdateSchema>;

export const vehicleGalleryItemMoveSchema = z
  .object({
    targetGalleryId: uuidSchema,
  })
  .strict();
export type VehicleGalleryItemMove = z.infer<typeof vehicleGalleryItemMoveSchema>;

export const vehicleGalleryItemResponseSchema = z
  .object({
    id: uuidSchema,
    vehicleId: uuidSchema,
    galleryId: uuidSchema,
    type: vehicleGalleryItemTypeSchema,
    originalName: z.string(),
    mimeType: z.string(),
    sizeBytes: z.number().int().min(0),
    caption: z.string().nullable(),
    sortOrder: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();
export type VehicleGalleryItemResponse = z.infer<typeof vehicleGalleryItemResponseSchema>;

export const vehicleGalleryResponseSchema = z
  .object({
    id: uuidSchema,
    vehicleId: uuidSchema,
    kind: vehicleGalleryKindSchema,
    name: z.string().nullable(),
    description: z.string().nullable(),
    isPublic: z.boolean(),
    sortOrder: z.number().int(),
    explicitCoverItemId: uuidSchema.nullable(),
    effectiveCoverItemId: uuidSchema.nullable(),
    items: z.array(vehicleGalleryItemResponseSchema),
    maxItems: z.literal(VEHICLE_GALLERY_MAX_ITEMS),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();
export type VehicleGalleryResponse = z.infer<typeof vehicleGalleryResponseSchema>;

export const vehicleGalleryListResponseSchema = z
  .object({
    items: z.array(vehicleGalleryResponseSchema),
    total: z.number().int().min(0),
  })
  .strict();
export type VehicleGalleryListResponse = z.infer<typeof vehicleGalleryListResponseSchema>;

export const vehicleMainGalleryCoverSchema = z
  .object({
    itemId: uuidSchema,
    mimeType: z.string(),
  })
  .strict();
export type VehicleMainGalleryCover = z.infer<typeof vehicleMainGalleryCoverSchema>;

export const publicVehicleGalleryItemSchema = z
  .object({
    id: uuidSchema,
    type: vehicleGalleryItemTypeSchema,
    mimeType: z.string(),
    caption: z.string().nullable(),
    sortOrder: z.number().int(),
  })
  .strict();
export type PublicVehicleGalleryItem = z.infer<typeof publicVehicleGalleryItemSchema>;

export const publicVehicleGallerySchema = z
  .object({
    id: uuidSchema,
    kind: vehicleGalleryKindSchema,
    name: z.string().nullable(),
    description: z.string().nullable(),
    sortOrder: z.number().int(),
    coverItemId: uuidSchema.nullable(),
    items: z.array(publicVehicleGalleryItemSchema),
  })
  .strict();
export type PublicVehicleGallery = z.infer<typeof publicVehicleGallerySchema>;
