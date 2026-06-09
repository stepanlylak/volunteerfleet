import type {
  DocumentLinkCreate,
  DocumentListResponse,
  DocumentResponse,
  DocumentUpdate,
  VehicleDocumentsQuery,
} from '@volunteerfleet/shared';
import { http } from './client';

export const documentsApi = {
  async getById(id: string): Promise<DocumentResponse> {
    const res = await http.get<DocumentResponse>(`/documents/${id}`);
    return res.data;
  },

  async listByVehicle(
    vehicleId: string,
    params?: Partial<VehicleDocumentsQuery>,
  ): Promise<DocumentListResponse> {
    const res = await http.get<DocumentListResponse>(`/vehicles/${vehicleId}/documents`, {
      params,
    });
    return res.data;
  },

  async upload(formData: FormData): Promise<DocumentResponse> {
    const res = await http.post<DocumentResponse>('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async link(payload: DocumentLinkCreate): Promise<DocumentResponse> {
    const res = await http.post<DocumentResponse>('/documents/link', payload);
    return res.data;
  },

  async update(id: string, payload: DocumentUpdate): Promise<DocumentResponse> {
    const res = await http.patch<DocumentResponse>(`/documents/${id}`, payload);
    return res.data;
  },

  async replaceUpload(id: string, formData: FormData): Promise<DocumentResponse> {
    const res = await http.patch<DocumentResponse>(`/documents/${id}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/documents/${id}`);
  },

  getDownloadUrl(id: string, cacheKey?: string, disposition?: 'inline' | 'attachment'): string {
    const base = import.meta.env.VITE_API_URL || '/api/v1';
    const url = `${base}/documents/${id}/download`;
    const params: string[] = [];
    if (cacheKey) {
      params.push(`v=${encodeURIComponent(cacheKey)}`);
    }
    if (disposition) {
      params.push(`disposition=${encodeURIComponent(disposition)}`);
    }
    return params.length > 0 ? `${url}?${params.join('&')}` : url;
  },
};
