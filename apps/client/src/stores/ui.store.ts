import { create } from 'zustand';

export type UIState = {
  vehicleModal: { open: boolean; vehicleId?: string };
  openVehicleModal: (id?: string) => void;
  closeVehicleModal: () => void;

  expenseModal: { open: boolean; vehicleId: string; expenseId?: string };
  openExpenseModal: (vehicleId: string, expenseId?: string) => void;
  closeExpenseModal: () => void;

  documentModal: { open: boolean; vehicleId: string };
  openDocumentModal: (vehicleId: string) => void;
  closeDocumentModal: () => void;
};

export const useUI = create<UIState>((set) => ({
  vehicleModal: { open: false },
  openVehicleModal: (id) => set({ vehicleModal: { open: true, vehicleId: id } }),
  closeVehicleModal: () => set({ vehicleModal: { open: false } }),

  expenseModal: { open: false, vehicleId: '' },
  openExpenseModal: (vehicleId, expenseId) =>
    set({ expenseModal: { open: true, vehicleId, expenseId } }),
  closeExpenseModal: () => set({ expenseModal: { open: false, vehicleId: '' } }),

  documentModal: { open: false, vehicleId: '' },
  openDocumentModal: (vehicleId) => set({ documentModal: { open: true, vehicleId } }),
  closeDocumentModal: () => set({ documentModal: { open: false, vehicleId: '' } }),
}));
