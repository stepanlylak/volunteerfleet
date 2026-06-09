import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DocumentLinkCreate,
  DocumentUpdate,
  VehicleDocumentsQuery,
} from '@volunteerfleet/shared';
import { documentsApi } from '../api/documents.api';

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: ['documents', id],
    queryFn: () => documentsApi.getById(id!),
    enabled: !!id,
  });
}

export function useVehicleDocuments(
  vehicleId: string | undefined,
  params?: Partial<VehicleDocumentsQuery>,
) {
  return useQuery({
    queryKey: ['documents', 'vehicle', vehicleId, params],
    queryFn: () => documentsApi.listByVehicle(vehicleId!, params),
    enabled: !!vehicleId,
  });
}

export function useUploadDocument(vehicleId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => documentsApi.upload(formData),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents', 'vehicle', vehicleId] });
    },
  });
}

export function useLinkDocument(vehicleId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DocumentLinkCreate) => documentsApi.link(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents', 'vehicle', vehicleId] });
    },
  });
}

export function useUpdateDocument(vehicleId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: DocumentUpdate }) =>
      documentsApi.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents', 'vehicle', vehicleId] });
    },
  });
}

export function useReplaceUploadDocument(vehicleId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
      documentsApi.replaceUpload(id, formData),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents', 'vehicle', vehicleId] });
    },
  });
}

export function useDeleteDocument(vehicleId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => documentsApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents', 'vehicle', vehicleId] });
    },
  });
}
