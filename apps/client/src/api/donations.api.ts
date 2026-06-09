import type {
  DonationCreate,
  DonationListResponse,
  DonationResponse,
  DonationUpdate,
} from '@volunteerfleet/shared';
import { http } from './client';

export interface DonationsListParams {
  page?: number;
  pageSize?: number;
  vehicleId?: string;
  donorId?: string;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  currency?: string;
}

export const donationsApi = {
  async list(params?: DonationsListParams): Promise<DonationListResponse> {
    const res = await http.get<DonationListResponse>('/donations', { params });
    return res.data;
  },

  async create(payload: DonationCreate): Promise<DonationResponse> {
    const res = await http.post<DonationResponse>('/donations', payload);
    return res.data;
  },

  async get(id: string): Promise<DonationResponse> {
    const res = await http.get<DonationResponse>(`/donations/${id}`);
    return res.data;
  },

  async update(id: string, payload: DonationUpdate): Promise<DonationResponse> {
    const res = await http.patch<DonationResponse>(`/donations/${id}`, payload);
    return res.data;
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/donations/${id}`);
  },
};
