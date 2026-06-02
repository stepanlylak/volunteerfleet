import type { DashboardStats } from '@volunteerfleet/shared';
import { http } from './client';

export const dashboardApi = {
  async getStats(): Promise<DashboardStats> {
    const res = await http.get<DashboardStats>('/dashboard/stats');
    return res.data;
  },
};
