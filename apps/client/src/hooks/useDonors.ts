import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DonorCreate, DonorLink } from '@volunteerfleet/shared';
import { donorsApi, type DonorsListParams } from '../api/donors.api';

export function useDonorsList(params?: DonorsListParams) {
  return useQuery({
    queryKey: ['donors', 'list', params],
    queryFn: () => donorsApi.list(params),
  });
}

export function useCreateDonor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DonorCreate) => donorsApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['donors', 'list'] });
    },
  });
}

export function useLinkDonor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DonorLink) => donorsApi.link(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['donors', 'list'] });
    },
  });
}

export function useUnlinkDonor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (donorId: string) => donorsApi.unlink(donorId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['donors', 'list'] });
    },
  });
}
