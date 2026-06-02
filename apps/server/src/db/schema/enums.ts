import { pgEnum } from 'drizzle-orm/pg-core';

export const vehicleStatusKindEnum = pgEnum('vehicle_status_kind', [
  'in_work',
  'final',
  'other',
]);

export const userRoleEnum = pgEnum('user_role', [
  'admin',
  'volunteer',
  'guest',
]);

export const documentKindEnum = pgEnum('document_kind', ['upload', 'link']);

export const currencyCodeEnum = pgEnum('currency_code', ['UAH', 'USD', 'EUR']);

export const rateSourceEnum = pgEnum('rate_source', ['default', 'manual']);

export const fundingSourceTypeEnum = pgEnum('funding_source_type', [
  'donor',
  'fundraiser',
  'initiative',
  'other',
]);
