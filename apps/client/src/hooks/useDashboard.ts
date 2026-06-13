import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard.api';

export function useDashboardStats() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.getStats(),
  });

  return {
    totalVehicles: data?.totalVehicles,
    inWorkVehicles: data?.inWorkVehicles,
    transferredVehicles: data?.transferredVehicles,
    monthlyExpenseUahMinor: data?.monthlyExpenseUahMinor,
    monthlyDonationsUahMinor: data?.monthlyDonationsUahMinor,
    documentsTotal: data?.documentsTotal,
    documentsThisMonth: data?.documentsThisMonth,
    statusCounts: data?.statusCounts,
    isLoading,
    isError,
  };
}
