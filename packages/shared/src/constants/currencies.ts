export const CURRENCIES = ['UAH', 'USD', 'EUR'] as const;

export type Currency = (typeof CURRENCIES)[number];

export const BASE_CURRENCY: Currency = 'UAH';
