import type {
  VehicleCreate,
  VehicleListQuery,
  VehicleListResponse,
  VehiclePhotoListResponse,
  VehiclePhotoOrderUpdate,
  VehiclePhotoResponse,
  VehicleResponse,
  VehicleStatusHistoryEditRequest,
  VehicleStatusHistoryListResponse,
  VehicleTransitionRequest,
  VehicleUpdate,
} from '@volunteerfleet/shared';
import { http } from './client';

export const vehiclesApi = {
  async list(params: Partial<VehicleListQuery>): Promise<VehicleListResponse> {
    const res = await http.get<VehicleListResponse>('/vehicles', { params });
    return res.data;
  },

  async get(id: string, includeDeleted = false): Promise<VehicleResponse> {
    const res = await http.get<VehicleResponse>(`/vehicles/${id}`, {
      params: includeDeleted ? { includeDeleted: true } : undefined,
    });
    return res.data;
  },

  async create(payload: VehicleCreate): Promise<VehicleResponse> {
    const res = await http.post<VehicleResponse>('/vehicles', payload);
    return res.data;
  },

  async update(id: string, payload: VehicleUpdate): Promise<VehicleResponse> {
    const res = await http.patch<VehicleResponse>(`/vehicles/${id}`, payload);
    return res.data;
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/vehicles/${id}`);
  },

  async restore(id: string): Promise<VehicleResponse> {
    const res = await http.post<VehicleResponse>(`/vehicles/${id}/restore`);
    return res.data;
  },

  async transition(id: string, payload: VehicleTransitionRequest): Promise<VehicleResponse> {
    const res = await http.post<VehicleResponse>(`/vehicles/${id}/transition`, payload);
    return res.data;
  },

  async getStatusHistory(id: string): Promise<VehicleStatusHistoryListResponse> {
    const res = await http.get<VehicleStatusHistoryListResponse>(`/vehicles/${id}/status-history`);
    return res.data;
  },

  async patchStatusHistory(
    vehicleId: string,
    historyId: string,
    payload: VehicleStatusHistoryEditRequest,
  ): Promise<void> {
    await http.patch(`/vehicles/${vehicleId}/status-history/${historyId}`, payload);
  },

  async rollbackLastStatus(vehicleId: string, expectedLastHistoryId: string): Promise<void> {
    await http.delete(`/vehicles/${vehicleId}/status-history/last`, {
      params: { expectedLastHistoryId },
    });
  },

  async listPhotos(id: string): Promise<VehiclePhotoListResponse> {
    const res = await http.get<VehiclePhotoListResponse>(`/vehicles/${id}/photos`);
    return res.data;
  },

  async uploadPhoto(id: string, formData: FormData): Promise<VehiclePhotoResponse> {
    const res = await http.post<VehiclePhotoResponse>(`/vehicles/${id}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async reorderPhotos(
    id: string,
    payload: VehiclePhotoOrderUpdate,
  ): Promise<VehiclePhotoListResponse> {
    const res = await http.patch<VehiclePhotoListResponse>(`/vehicles/${id}/photos/order`, payload);
    return res.data;
  },

  async removePhoto(id: string, photoId: string): Promise<void> {
    await http.delete(`/vehicles/${id}/photos/${photoId}`);
  },

  getPhotoDownloadUrl(id: string, photoId: string): string {
    const base = import.meta.env.VITE_API_URL || '/api/v1';
    return `${base}/vehicles/${id}/photos/${photoId}/download`;
  },
};
