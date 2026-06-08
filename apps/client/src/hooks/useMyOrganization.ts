import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddMemberByEmail,
  OrganizationMemberUpdate,
  OrganizationUpdate,
} from '@volunteerfleet/shared';
import { myOrganizationApi } from '../api/organizations.api';

export const myOrganizationKeys = {
  all: ['my-organization'] as const,
  detail: () => [...myOrganizationKeys.all, 'detail'] as const,
  members: () => [...myOrganizationKeys.all, 'members'] as const,
};

export function useMyOrganization() {
  return useQuery({
    queryKey: myOrganizationKeys.detail(),
    queryFn: () => myOrganizationApi.get(),
  });
}

export function useUpdateMyOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: OrganizationUpdate) => myOrganizationApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myOrganizationKeys.detail() });
    },
  });
}

export function useMyOrganizationMembers() {
  return useQuery({
    queryKey: myOrganizationKeys.members(),
    queryFn: () => myOrganizationApi.listMembers(),
  });
}

export function useAddMyOrganizationMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddMemberByEmail) => myOrganizationApi.addMember(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myOrganizationKeys.detail() });
      queryClient.invalidateQueries({ queryKey: myOrganizationKeys.members() });
    },
  });
}

export function useUpdateMyOrganizationMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: OrganizationMemberUpdate }) =>
      myOrganizationApi.updateMemberRole(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myOrganizationKeys.detail() });
      queryClient.invalidateQueries({ queryKey: myOrganizationKeys.members() });
    },
  });
}

export function useRemoveMyOrganizationMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => myOrganizationApi.removeMember(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myOrganizationKeys.detail() });
      queryClient.invalidateQueries({ queryKey: myOrganizationKeys.members() });
    },
  });
}
