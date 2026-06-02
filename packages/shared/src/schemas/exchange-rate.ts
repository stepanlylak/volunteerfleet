import { z } from 'zod';
import { CURRENCIES } from '../constants/currencies.js';

export const exchangeRateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  currency: z.enum(CURRENCIES),
});
export type ExchangeRateQuery = z.infer<typeof exchangeRateQuerySchema>;

export const exchangeRateResponseSchema = z.object({
  date: z.string(),
  currency: z.enum(CURRENCIES),
  rate: z.number(),
  source: z.literal('default'),
});
export type ExchangeRateResponse = z.infer<typeof exchangeRateResponseSchema>;
