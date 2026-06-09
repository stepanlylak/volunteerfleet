import type {
  FinancialCategory,
  FinancialCategoryCreate,
  FinancialCategoryUpdate,
} from '@volunteerfleet/shared';
import { http } from './client';

export type DictionaryType = 'financial-categories';

export interface DictionariesSnapshot {
  financialCategories: FinancialCategory[];
}

type DictionaryPayload = FinancialCategoryCreate | FinancialCategoryUpdate;

export const dictionariesApi = {
  async getFinancialCategories(): Promise<FinancialCategory[]> {
    const res = await http.get<FinancialCategory[]>('/dictionaries/financial-categories');
    return res.data;
  },

  async getAll(): Promise<DictionariesSnapshot> {
    return { financialCategories: await this.getFinancialCategories() };
  },

  async create(type: DictionaryType, payload: DictionaryPayload): Promise<FinancialCategory> {
    const res = await http.post<FinancialCategory>(`/dictionaries/${type}`, payload);
    return res.data;
  },

  async update(
    type: DictionaryType,
    id: string,
    payload: DictionaryPayload,
  ): Promise<FinancialCategory> {
    const res = await http.patch<FinancialCategory>(`/dictionaries/${type}/${id}`, payload);
    return res.data;
  },

  async remove(type: DictionaryType, id: string): Promise<void> {
    await http.delete(`/dictionaries/${type}/${id}`);
  },
};
