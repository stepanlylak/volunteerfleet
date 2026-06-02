import type {
  ExpenseCreate,
  ExpenseListResponse,
  ExpenseResponse,
  ExpenseUpdate,
  VehicleExpensesQuery,
} from '@volunteerfleet/shared';
import { http } from './client';

export interface ExpensesListParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  vehicleId?: string;
  categoryId?: string;
  fundingSourceId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const expensesApi = {
  async list(params?: ExpensesListParams): Promise<ExpenseListResponse> {
    const res = await http.get<ExpenseListResponse>('/expenses', { params });
    return res.data;
  },

  async listByVehicle(
    vehicleId: string,
    params?: Partial<VehicleExpensesQuery>,
  ): Promise<ExpenseListResponse> {
    const res = await http.get<ExpenseListResponse>(`/vehicles/${vehicleId}/expenses`, { params });
    return res.data;
  },

  async create(payload: ExpenseCreate): Promise<ExpenseResponse> {
    const res = await http.post<ExpenseResponse>('/expenses', payload);
    return res.data;
  },

  async update(id: string, payload: ExpenseUpdate): Promise<ExpenseResponse> {
    const res = await http.patch<ExpenseResponse>(`/expenses/${id}`, payload);
    return res.data;
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/expenses/${id}`);
  },
};
