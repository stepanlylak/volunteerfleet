import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExpenseCreate, ExpenseUpdate, VehicleExpensesQuery } from '@volunteerfleet/shared';
import { expensesApi, type ExpensesListParams } from '../api/expenses.api';

export function useExpensesList(params?: ExpensesListParams) {
  return useQuery({
    queryKey: ['expenses', 'list', params],
    queryFn: () => expensesApi.list(params),
  });
}

export function useVehicleExpenses(
  vehicleId: string | undefined,
  params?: Partial<VehicleExpensesQuery>,
) {
  return useQuery({
    queryKey: ['expenses', 'vehicle', vehicleId, params],
    queryFn: () => expensesApi.listByVehicle(vehicleId!, params),
    enabled: !!vehicleId,
  });
}

export function useCreateExpense(vehicleId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ExpenseCreate) => expensesApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['expenses', 'vehicle', vehicleId] });
      void queryClient.invalidateQueries({ queryKey: ['financial-entries'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });
}

export function useUpdateExpense(vehicleId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ExpenseUpdate }) =>
      expensesApi.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['expenses', 'vehicle', vehicleId] });
      void queryClient.invalidateQueries({ queryKey: ['financial-entries'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });
}

export function useDeleteExpense(vehicleId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['expenses', 'vehicle', vehicleId] });
      void queryClient.invalidateQueries({ queryKey: ['financial-entries'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });
}
