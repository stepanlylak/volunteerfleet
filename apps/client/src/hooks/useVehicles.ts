import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { VehicleCreate, VehicleListQuery, VehicleUpdate } from '@volunteerfleet/shared';
import { vehiclesApi } from '../api/vehicles.api';

export function useVehicles(params: Partial<VehicleListQuery>) {
  return useQuery({
    queryKey: ['vehicles', params],
    queryFn: () => vehiclesApi.list(params),
  });
}

export function useVehicle(id: string | undefined, includeDeleted = false) {
  return useQuery({
    queryKey: ['vehicles', id, { includeDeleted }],
    queryFn: () => vehiclesApi.get(id!, includeDeleted),
    enabled: Boolean(id),
  });
}

export function useVehicleStatusHistory(id: string | undefined) {
  return useQuery({
    queryKey: ['vehicles', id, 'status-history'],
    queryFn: () => vehiclesApi.getStatusHistory(id!),
    enabled: Boolean(id),
  });
}

export function useVehiclePhotos(id: string | undefined) {
  return useQuery({
    queryKey: ['vehicles', id, 'photos'],
    queryFn: () => vehiclesApi.listPhotos(id!),
    enabled: Boolean(id),
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: VehicleCreate) => vehiclesApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: VehicleUpdate }) =>
      vehiclesApi.update(id, payload),
    onSuccess: (vehicle) => {
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      void queryClient.invalidateQueries({ queryKey: ['vehicles', vehicle.id] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vehiclesApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });
}

export function useRestoreVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vehiclesApi.restore(id),
    onSuccess: (vehicle) => {
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      void queryClient.invalidateQueries({ queryKey: ['vehicles', vehicle.id] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });
}

export function useUploadVehiclePhoto(vehicleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => vehiclesApi.uploadPhoto(vehicleId!, formData),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vehicles', vehicleId, 'photos'] });
    },
  });
}

export function useUploadVehiclePhotoForVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ vehicleId, formData }: { vehicleId: string; formData: FormData }) =>
      vehiclesApi.uploadPhoto(vehicleId, formData),
    onSuccess: (_photo, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['vehicles', variables.vehicleId, 'photos'] });
    },
  });
}

export function useReorderVehiclePhotos(vehicleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photoIds: string[]) => vehiclesApi.reorderPhotos(vehicleId!, { photoIds }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vehicles', vehicleId, 'photos'] });
    },
  });
}

export function useDeleteVehiclePhoto(vehicleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => vehiclesApi.removePhoto(vehicleId!, photoId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vehicles', vehicleId, 'photos'] });
    },
  });
}

export function useDeleteVehiclePhotoForVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ vehicleId, photoId }: { vehicleId: string; photoId: string }) =>
      vehiclesApi.removePhoto(vehicleId, photoId),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['vehicles', variables.vehicleId, 'photos'] });
    },
  });
}
