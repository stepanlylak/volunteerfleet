import type {
  VehicleGalleryCreate,
  VehicleGalleryItemMove,
  VehicleGalleryItemOrderUpdate,
  VehicleGalleryItemResponse,
  VehicleGalleryItemUpdate,
  VehicleGalleryListResponse,
  VehicleGalleryResponse,
  VehicleGallerySetCover,
  VehicleGalleryUpdate,
} from '@volunteerfleet/shared';
import { http } from './client';

export const vehicleGalleriesApi = {
  async list(vehicleId: string): Promise<VehicleGalleryListResponse> {
    const res = await http.get<VehicleGalleryListResponse>(`/vehicles/${vehicleId}/galleries`);
    return res.data;
  },

  async create(vehicleId: string, payload: VehicleGalleryCreate): Promise<VehicleGalleryResponse> {
    const res = await http.post<VehicleGalleryResponse>(
      `/vehicles/${vehicleId}/galleries`,
      payload,
    );
    return res.data;
  },

  async update(
    vehicleId: string,
    galleryId: string,
    payload: VehicleGalleryUpdate,
  ): Promise<VehicleGalleryResponse> {
    const res = await http.patch<VehicleGalleryResponse>(
      `/vehicles/${vehicleId}/galleries/${galleryId}`,
      payload,
    );
    return res.data;
  },

  async remove(vehicleId: string, galleryId: string): Promise<void> {
    await http.delete(`/vehicles/${vehicleId}/galleries/${galleryId}`);
  },

  async uploadItem(
    vehicleId: string,
    galleryId: string,
    formData: FormData,
  ): Promise<VehicleGalleryItemResponse> {
    const res = await http.post<VehicleGalleryItemResponse>(
      `/vehicles/${vehicleId}/galleries/${galleryId}/items`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data;
  },

  async updateItemCaption(
    vehicleId: string,
    galleryId: string,
    itemId: string,
    payload: VehicleGalleryItemUpdate,
  ): Promise<VehicleGalleryItemResponse> {
    const res = await http.patch<VehicleGalleryItemResponse>(
      `/vehicles/${vehicleId}/galleries/${galleryId}/items/${itemId}`,
      payload,
    );
    return res.data;
  },

  async reorderItems(
    vehicleId: string,
    galleryId: string,
    payload: VehicleGalleryItemOrderUpdate,
  ): Promise<VehicleGalleryItemResponse[]> {
    const res = await http.patch<VehicleGalleryItemResponse[]>(
      `/vehicles/${vehicleId}/galleries/${galleryId}/items/order`,
      payload,
    );
    return res.data;
  },

  async setCover(
    vehicleId: string,
    galleryId: string,
    payload: VehicleGallerySetCover,
  ): Promise<VehicleGalleryResponse> {
    const res = await http.patch<VehicleGalleryResponse>(
      `/vehicles/${vehicleId}/galleries/${galleryId}/cover`,
      payload,
    );
    return res.data;
  },

  async moveItem(
    vehicleId: string,
    galleryId: string,
    itemId: string,
    payload: VehicleGalleryItemMove,
  ): Promise<VehicleGalleryItemResponse> {
    const res = await http.post<VehicleGalleryItemResponse>(
      `/vehicles/${vehicleId}/galleries/${galleryId}/items/${itemId}/move`,
      payload,
    );
    return res.data;
  },

  async removeItem(vehicleId: string, galleryId: string, itemId: string): Promise<void> {
    await http.delete(`/vehicles/${vehicleId}/galleries/${galleryId}/items/${itemId}`);
  },

  getItemDownloadUrl(vehicleId: string, galleryId: string, itemId: string): string {
    const base = import.meta.env.VITE_API_URL || '/api/v1';
    return `${base}/vehicles/${vehicleId}/galleries/${galleryId}/items/${itemId}/download`;
  },
};
