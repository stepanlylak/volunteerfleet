import type {
  FundingSourceReportQuery,
  PublicFundingReportResponse,
  PublicVehicleResponse,
} from '@volunteerfleet/shared';
import { http } from './client';

export const publicApi = {
  async getVehicle(slug: string): Promise<PublicVehicleResponse> {
    const res = await http.get<PublicVehicleResponse>(`/public/vehicles/${slug}`);
    return res.data;
  },

  async getFundingReport(
    id: string,
    params: FundingSourceReportQuery,
  ): Promise<PublicFundingReportResponse> {
    const res = await http.get<PublicFundingReportResponse>(`/public/reports/funding/${id}`, {
      params,
    });
    return res.data;
  },

  getVehiclePhotoUrl(photoId: string): string {
    const base = import.meta.env.VITE_API_URL || '/api/v1';
    return `${base}/public/vehicle-photos/${photoId}/download`;
  },
};
