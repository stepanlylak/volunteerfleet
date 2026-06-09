import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  VehicleGalleryCreate,
  VehicleGalleryItemMove,
  VehicleGalleryItemOrderUpdate,
  VehicleGalleryItemUpdate,
  VehicleGallerySetCover,
  VehicleGalleryUpdate,
} from '@volunteerfleet/shared';
import { vehicleGalleriesApi } from '../api/vehicle-galleries.api';

const galleryKeys = {
  all: (vehicleId: string) => ['vehicles', vehicleId, 'galleries'] as const,
};

export function useVehicleGalleries(vehicleId: string | undefined) {
  return useQuery({
    queryKey: galleryKeys.all(vehicleId!),
    queryFn: () => vehicleGalleriesApi.list(vehicleId!),
    enabled: Boolean(vehicleId),
  });
}

export function useCreateVehicleGallery(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: VehicleGalleryCreate) => vehicleGalleriesApi.create(vehicleId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: galleryKeys.all(vehicleId) });
    },
  });
}

export function useUpdateVehicleGallery(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ galleryId, payload }: { galleryId: string; payload: VehicleGalleryUpdate }) =>
      vehicleGalleriesApi.update(vehicleId, galleryId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: galleryKeys.all(vehicleId) });
    },
  });
}

export function useDeleteVehicleGallery(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (galleryId: string) => vehicleGalleriesApi.remove(vehicleId, galleryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: galleryKeys.all(vehicleId) });
    },
  });
}

export function useUploadGalleryItem(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ galleryId, formData }: { galleryId: string; formData: FormData }) =>
      vehicleGalleriesApi.uploadItem(vehicleId, galleryId, formData),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: galleryKeys.all(vehicleId) });
    },
  });
}

export function useUpdateGalleryItemCaption(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      galleryId,
      itemId,
      payload,
    }: {
      galleryId: string;
      itemId: string;
      payload: VehicleGalleryItemUpdate;
    }) => vehicleGalleriesApi.updateItemCaption(vehicleId, galleryId, itemId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: galleryKeys.all(vehicleId) });
    },
  });
}

export function useReorderGalleryItems(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      galleryId,
      payload,
    }: {
      galleryId: string;
      payload: VehicleGalleryItemOrderUpdate;
    }) => vehicleGalleriesApi.reorderItems(vehicleId, galleryId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: galleryKeys.all(vehicleId) });
    },
  });
}

export function useSetGalleryCover(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ galleryId, payload }: { galleryId: string; payload: VehicleGallerySetCover }) =>
      vehicleGalleriesApi.setCover(vehicleId, galleryId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: galleryKeys.all(vehicleId) });
    },
  });
}

export function useMoveGalleryItem(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      galleryId,
      itemId,
      payload,
    }: {
      galleryId: string;
      itemId: string;
      payload: VehicleGalleryItemMove;
    }) => vehicleGalleriesApi.moveItem(vehicleId, galleryId, itemId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: galleryKeys.all(vehicleId) });
    },
  });
}

export function useDeleteGalleryItem(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ galleryId, itemId }: { galleryId: string; itemId: string }) =>
      vehicleGalleriesApi.removeItem(vehicleId, galleryId, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: galleryKeys.all(vehicleId) });
    },
  });
}
