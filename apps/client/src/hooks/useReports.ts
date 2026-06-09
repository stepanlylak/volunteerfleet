import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../api/reports.api';

export function useVehicleReport(id: string | undefined) {
  return useQuery({
    queryKey: ['reports', 'vehicle', id],
    queryFn: () => reportsApi.getVehicleReport(id!),
    enabled: Boolean(id),
  });
}
