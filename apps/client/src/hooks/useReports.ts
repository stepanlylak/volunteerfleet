import { useQuery } from '@tanstack/react-query';
import type { FundingSourceReportQuery } from '@volunteerfleet/shared';
import { reportsApi } from '../api/reports.api';

export function useVehicleReport(id: string | undefined) {
  return useQuery({
    queryKey: ['reports', 'vehicle', id],
    queryFn: () => reportsApi.getVehicleReport(id!),
    enabled: Boolean(id),
  });
}

export function useFundingSourceReport(id: string | undefined, query: FundingSourceReportQuery) {
  return useQuery({
    queryKey: ['reports', 'funding-source', id, query],
    queryFn: () => reportsApi.getFundingSourceReport(id!, query),
    enabled: Boolean(id),
  });
}
