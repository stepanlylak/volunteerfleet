import type { Currency } from '@volunteerfleet/shared';

export function formatNumber(value: number, fractionDigits = 2): string {
  return new Intl.NumberFormat('uk-UA', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value / 100);
}

export function formatCurrency(value: number, currency: Currency): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatRate(rate: number): string {
  return new Intl.NumberFormat('uk-UA', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(rate);
}
