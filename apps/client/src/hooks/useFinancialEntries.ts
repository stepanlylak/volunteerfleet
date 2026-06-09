import { useQuery } from '@tanstack/react-query';
import { financialEntriesApi, type FinancialEntriesListParams } from '../api/financial-entries.api';

export function useFinancialEntries(params?: FinancialEntriesListParams) {
  return useQuery({
    queryKey: ['financial-entries', 'list', params],
    queryFn: () => financialEntriesApi.list(params),
  });
}
