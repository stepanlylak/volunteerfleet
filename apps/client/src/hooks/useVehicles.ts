import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  VehicleCreate,
  VehicleListQuery,
  VehicleStatusHistoryEditRequest,
  VehicleTransitionRequest,
  VehicleUpdate,
} from '@volunteerfleet/shared';
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

export function useVehicleTransition(id: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: VehicleTransitionRequest) => vehiclesApi.transition(id!, payload),
    onSuccess: (vehicle) => {
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      void queryClient.invalidateQueries({ queryKey: ['vehicles', vehicle.id] });
      void queryClient.invalidateQueries({ queryKey: ['vehicles', vehicle.id, 'status-history'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });
}

export function useUpdateStatusHistory(vehicleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      historyId,
      payload,
    }: {
      historyId: string;
      payload: VehicleStatusHistoryEditRequest;
    }) => vehiclesApi.patchStatusHistory(vehicleId!, historyId, payload),
    onSuccess: () => {
      // Editing an entry can attach/remove documents, which recomputes alerts.
      // Alerts live on the vehicle detail query, so it must be invalidated too —
      // not just the status-history list.
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      void queryClient.invalidateQueries({ queryKey: ['documents', 'vehicle', vehicleId] });
      void queryClient.invalidateQueries({ queryKey: ['document-groups'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });
}

export function useRollbackLastStatus(vehicleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expectedLastHistoryId: string) =>
      vehiclesApi.rollbackLastStatus(vehicleId!, expectedLastHistoryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      void queryClient.invalidateQueries({ queryKey: ['vehicles', vehicleId] });
      void queryClient.invalidateQueries({ queryKey: ['vehicles', vehicleId, 'status-history'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
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
