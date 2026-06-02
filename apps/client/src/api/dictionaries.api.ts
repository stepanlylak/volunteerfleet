import type {
  ExpenseCategory,
  ExpenseCategoryCreate,
  ExpenseCategoryUpdate,
  FundingSource,
  FundingSourceCreate,
  FundingSourceUpdate,
  VehicleStatus,
  VehicleStatusCreate,
  VehicleStatusUpdate,
} from '@volunteerfleet/shared';
import { http } from './client';

export type DictionaryType = 'vehicle-statuses' | 'expense-categories' | 'funding-sources';

export interface DictionariesSnapshot {
  vehicleStatuses: VehicleStatus[];
  expenseCategories: ExpenseCategory[];
  fundingSources: FundingSource[];
}

type DictionaryPayload<T extends DictionaryType> = T extends 'vehicle-statuses'
  ? VehicleStatusCreate | VehicleStatusUpdate
  : T extends 'expense-categories'
    ? ExpenseCategoryCreate | ExpenseCategoryUpdate
    : FundingSourceCreate | FundingSourceUpdate;

type DictionaryItem<T extends DictionaryType> = T extends 'vehicle-statuses'
  ? VehicleStatus
  : T extends 'expense-categories'
    ? ExpenseCategory
    : FundingSource;

export const dictionariesApi = {
  async getVehicleStatuses(): Promise<VehicleStatus[]> {
    const res = await http.get<VehicleStatus[]>('/dictionaries/vehicle-statuses');
    return res.data;
  },

  async getExpenseCategories(): Promise<ExpenseCategory[]> {
    const res = await http.get<ExpenseCategory[]>('/dictionaries/expense-categories');
    return res.data;
  },

  async getFundingSources(): Promise<FundingSource[]> {
    const res = await http.get<FundingSource[]>('/dictionaries/funding-sources');
    return res.data;
  },

  async getAll(): Promise<DictionariesSnapshot> {
    const [vehicleStatuses, expenseCategories, fundingSources] = await Promise.all([
      this.getVehicleStatuses(),
      this.getExpenseCategories(),
      this.getFundingSources(),
    ]);
    return { vehicleStatuses, expenseCategories, fundingSources };
  },

  async create<T extends DictionaryType>(
    type: T,
    payload: DictionaryPayload<T>,
  ): Promise<DictionaryItem<T>> {
    const res = await http.post<DictionaryItem<T>>(`/dictionaries/${type}`, payload);
    return res.data;
  },

  async update<T extends DictionaryType>(
    type: T,
    id: string,
    payload: DictionaryPayload<T>,
  ): Promise<DictionaryItem<T>> {
    const res = await http.patch<DictionaryItem<T>>(`/dictionaries/${type}/${id}`, payload);
    return res.data;
  },

  async remove(type: DictionaryType, id: string): Promise<void> {
    await http.delete(`/dictionaries/${type}/${id}`);
  },
};
