import type {
  DonorCreate,
  DonorLink,
  DonorListResponse,
  DonorResolveResponse,
  DonorResponse,
} from '@volunteerfleet/shared';
import { http } from './client';

export interface DonorsListParams {
  page?: number;
  pageSize?: number;
  isActive?: boolean;
}

export const donorsApi = {
  async list(params?: DonorsListParams): Promise<DonorListResponse> {
    const res = await http.get<DonorListResponse>('/donors', { params });
    return res.data;
  },

  async create(dto: DonorCreate): Promise<DonorResponse> {
    const res = await http.post<DonorResponse>('/donors', dto);
    return res.data;
  },

  async resolve(id: string): Promise<DonorResolveResponse> {
    const res = await http.get<DonorResolveResponse>(`/donors/resolve/${id}`);
    return res.data;
  },

  async link(dto: DonorLink): Promise<DonorResponse> {
    const res = await http.post<DonorResponse>('/donors/link', dto);
    return res.data;
  },

  async unlink(donorId: string): Promise<void> {
    await http.delete(`/donors/${donorId}/link`);
  },
};
