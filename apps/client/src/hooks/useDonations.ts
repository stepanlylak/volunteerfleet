import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DonationCreate, DonationUpdate } from '@volunteerfleet/shared';
import { donationsApi, type DonationsListParams } from '../api/donations.api';

export function useDonationsList(params?: DonationsListParams) {
  return useQuery({
    queryKey: ['donations', 'list', params],
    queryFn: () => donationsApi.list(params),
  });
}

export function useCreateDonation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DonationCreate) => donationsApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['donations', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['financial-entries'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });
}

export function useUpdateDonation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: DonationUpdate }) =>
      donationsApi.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['donations', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['financial-entries'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });
}

export function useDeleteDonation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => donationsApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['donations', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['financial-entries'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });
}
