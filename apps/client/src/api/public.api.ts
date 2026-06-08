import type {
  FundingSourceReportQuery,
  PublicFundingReportResponse,
  PublicVehicleResponse,
} from '@volunteerfleet/shared';
import { http } from './client';

export const publicApi = {
  async getVehicle(orgId: string, vehicleId: string): Promise<PublicVehicleResponse> {
    const res = await http.get<PublicVehicleResponse>(`/public/${orgId}/vehicles/${vehicleId}`);
    return res.data;
  },

  async getFundingReport(
    orgId: string,
    id: string,
    params: FundingSourceReportQuery,
  ): Promise<PublicFundingReportResponse> {
    const res = await http.get<PublicFundingReportResponse>(`/public/${orgId}/reports/funding/${id}`, {
      params,
    });
    return res.data;
  },

  getVehiclePhotoUrl(photoId: string): string {
    const base = import.meta.env.VITE_API_URL || '/api/v1';
    return `${base}/public/vehicle-photos/${photoId}/download`;
  },
};
