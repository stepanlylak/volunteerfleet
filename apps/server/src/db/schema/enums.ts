import { pgEnum } from 'drizzle-orm/pg-core';

export const vehicleStatusEnum = pgEnum('vehicle_status', [
  'new',
  'paid',
  'in_transit',
  'arrived',
  'in_repair',
  'ready',
  'transferred',
  'returned',
  'lost',
]);

export const userRoleEnum = pgEnum('user_role', ['superuser', 'user']);

export const orgRoleEnum = pgEnum('org_role', ['coordinator', 'volunteer', 'viewer']);

export const documentKindEnum = pgEnum('document_kind', ['upload', 'link']);

export const vehicleGalleryKindEnum = pgEnum('vehicle_gallery_kind', ['main', 'custom']);

export const vehicleGalleryItemTypeEnum = pgEnum('vehicle_gallery_item_type', ['image']);

export const currencyCodeEnum = pgEnum('currency_code', ['UAH', 'USD', 'EUR']);

export const rateSourceEnum = pgEnum('rate_source', ['default', 'manual']);
