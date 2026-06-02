import { useQuery } from '@tanstack/react-query';
import type { Currency } from '@volunteerfleet/shared';
import { exchangeRatesApi } from '../api/exchange-rates.api';

export function useExchangeRate(date: string | undefined, currency: Currency | undefined) {
  return useQuery({
    queryKey: ['exchange-rate', date, currency],
    queryFn: () => exchangeRatesApi.getRate(date!, currency!),
    enabled: !!date && !!currency && currency !== 'UAH',
    staleTime: 10 * 60_000,
  });
}
