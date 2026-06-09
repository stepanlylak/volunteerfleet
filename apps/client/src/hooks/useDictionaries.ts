import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExpenseCategory, FundingSource } from '@volunteerfleet/shared';
import { dictionariesApi, type DictionaryType } from '../api/dictionaries.api';

export type DictionaryItem = ExpenseCategory | FundingSource;

export function useDictionaries() {
  return useQuery({
    queryKey: ['dictionaries'],
    queryFn: () => dictionariesApi.getAll(),
  });
}

export function useDictionary(type: DictionaryType) {
  return useQuery<DictionaryItem[]>({
    queryKey: ['dictionaries', type],
    queryFn: async () => {
      if (type === 'expense-categories') return dictionariesApi.getExpenseCategories();
      return dictionariesApi.getFundingSources();
    },
  });
}

export function useCreateDictionaryItem(type: DictionaryType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof dictionariesApi.create>[1]) =>
      dictionariesApi.create(type, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dictionaries'] });
    },
  });
}

export function useUpdateDictionaryItem(type: DictionaryType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof dictionariesApi.update>[2];
    }) => dictionariesApi.update(type, id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dictionaries'] });
    },
  });
}

export function useDeleteDictionaryItem(type: DictionaryType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dictionariesApi.remove(type, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dictionaries'] });
    },
  });
}
