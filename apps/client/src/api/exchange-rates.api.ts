import type { Currency, ExchangeRateResponse } from '@volunteerfleet/shared';
import { http } from './client';

export const exchangeRatesApi = {
  async getRate(date: string, currency: Currency): Promise<ExchangeRateResponse> {
    const res = await http.get<ExchangeRateResponse>('/exchange-rates', {
      params: { date, currency },
    });
    return res.data;
  },
};
