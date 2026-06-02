import type {
  FundingSourceReportQuery,
  FundingSourceReportResponse,
  VehicleReportResponse,
} from '@volunteerfleet/shared';
import { http } from './client';

export const reportsApi = {
  async getVehicleReport(id: string): Promise<VehicleReportResponse> {
    const res = await http.get<VehicleReportResponse>(`/reports/vehicle/${id}`);
    return res.data;
  },

  async getFundingSourceReport(
    id: string,
    params: FundingSourceReportQuery,
  ): Promise<FundingSourceReportResponse> {
    const res = await http.get<FundingSourceReportResponse>(`/reports/funding-source/${id}`, {
      params,
    });
    return res.data;
  },
};
