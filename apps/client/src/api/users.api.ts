import type {
  ResetPasswordResponse,
  UserCreate,
  UserCreateResponse,
  UserListQuery,
  UserListResponse,
  UserResponse,
  UserUpdate,
} from '@volunteerfleet/shared';
import { http } from './client';

export const usersApi = {
  async list(params: Partial<UserListQuery>): Promise<UserListResponse> {
    const res = await http.get<UserListResponse>('/users', { params });
    return res.data;
  },

  async create(payload: UserCreate): Promise<UserCreateResponse> {
    const res = await http.post<UserCreateResponse>('/users', payload);
    return res.data;
  },

  async update(id: string, payload: UserUpdate): Promise<UserResponse> {
    const res = await http.patch<UserResponse>(`/users/${id}`, payload);
    return res.data;
  },

  async resetPassword(id: string): Promise<ResetPasswordResponse> {
    const res = await http.post<ResetPasswordResponse>(`/users/${id}/reset-password`);
    return res.data;
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/users/${id}`);
  },
};
