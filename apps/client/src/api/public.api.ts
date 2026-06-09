import type { PublicVehicleResponse } from '@volunteerfleet/shared';
import { http } from './client';

export const publicApi = {
  async getVehicle(orgId: string, vehicleId: string): Promise<PublicVehicleResponse> {
    const res = await http.get<PublicVehicleResponse>(`/public/${orgId}/vehicles/${vehicleId}`);
    return res.data;
  },
  getGalleryItemDownloadUrl(itemId: string): string {
    const base = import.meta.env.VITE_API_URL || '/api/v1';
    return `${base}/public/gallery-items/${itemId}/download`;
  },
};
