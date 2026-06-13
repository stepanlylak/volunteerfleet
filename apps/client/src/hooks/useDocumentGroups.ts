import { useQuery } from '@tanstack/react-query';
import { documentGroupsApi } from '../api/documentGroups.api';

export function useDocumentGroup(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['document-groups', id],
    queryFn: () => documentGroupsApi.getById(id!),
    enabled: !!id && enabled,
  });
}
