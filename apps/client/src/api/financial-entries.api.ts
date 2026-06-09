import type { FinancialEntryListResponse } from '@volunteerfleet/shared';
import { http } from './client';

export interface FinancialEntriesListParams {
  page?: number;
  pageSize?: number;
  type?: 'expense' | 'donation';
  vehicleId?: string;
  categoryId?: string;
  donorId?: string;
  dateFrom?: string;
  dateTo?: string;
  currency?: string;
}

export const financialEntriesApi = {
  async list(params?: FinancialEntriesListParams): Promise<FinancialEntryListResponse> {
    const res = await http.get<FinancialEntryListResponse>('/financial-entries', { params });
    return res.data;
  },
};
