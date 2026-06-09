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

export const documentTypeEnum = pgEnum('document_type', [
  'registration_certificate',
  'customs_declaration',
  'stamped_customs_declaration',
  'transfer_act_draft',
  'transfer_act_signed',
  'return_act',
  'other',
]);

export const userRoleEnum = pgEnum('user_role', ['superuser', 'user']);

export const orgRoleEnum = pgEnum('org_role', ['coordinator', 'volunteer', 'viewer']);

export const documentKindEnum = pgEnum('document_kind', ['upload', 'link']);

export const currencyCodeEnum = pgEnum('currency_code', ['UAH', 'USD', 'EUR']);

export const rateSourceEnum = pgEnum('rate_source', ['default', 'manual']);

export const fundingSourceTypeEnum = pgEnum('funding_source_type', [
  'donor',
  'fundraiser',
  'initiative',
  'other',
]);
