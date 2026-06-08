import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddMemberByEmail,
  OrganizationCreate,
  OrganizationListQuery,
  OrganizationMemberUpdate,
  OrganizationUpdate,
} from '@volunteerfleet/shared';
import { organizationsApi } from '../api/organizations.api';

export const organizationsKeys = {
  all: ['organizations'] as const,
  lists: () => [...organizationsKeys.all, 'list'] as const,
  list: (filters: Partial<OrganizationListQuery>) =>
    [...organizationsKeys.lists(), filters] as const,
  details: () => [...organizationsKeys.all, 'detail'] as const,
  detail: (id: string) => [...organizationsKeys.details(), id] as const,
};

export function useOrganizations(filters: Partial<OrganizationListQuery>) {
  return useQuery({
    queryKey: organizationsKeys.list(filters),
    queryFn: () => organizationsApi.list(filters),
  });
}

export function useOrganization(id: string) {
  return useQuery({
    queryKey: organizationsKeys.detail(id),
    queryFn: () => organizationsApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: OrganizationCreate) => organizationsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationsKeys.lists() });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: OrganizationUpdate }) =>
      organizationsApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: organizationsKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: organizationsKeys.lists() });
    },
  });
}

export function useAddOrganizationMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AddMemberByEmail }) =>
      organizationsApi.addMember(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: organizationsKeys.detail(id) });
    },
  });
}

export function useUpdateOrganizationMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      userId,
      data,
    }: {
      id: string;
      userId: string;
      data: OrganizationMemberUpdate;
    }) => organizationsApi.updateMemberRole(id, userId, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: organizationsKeys.detail(id) });
    },
  });
}

export function useRemoveOrganizationMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      organizationsApi.removeMember(id, userId),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: organizationsKeys.detail(id) });
    },
  });
}
