import type { VehicleReportResponse } from '@volunteerfleet/shared';
import { http } from './client';

export const reportsApi = {
  async getVehicleReport(id: string): Promise<VehicleReportResponse> {
    const res = await http.get<VehicleReportResponse>(`/reports/vehicle/${id}`);
    return res.data;
  },
};
