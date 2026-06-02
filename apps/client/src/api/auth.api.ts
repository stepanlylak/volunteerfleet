import type {
  AuthUser,
  LoginRequest,
  LoginResponse,
  RefreshResponse,
} from '@volunteerfleet/shared';
import { http } from './client';

export const authApi = {
  async login(data: LoginRequest): Promise<LoginResponse> {
    const res = await http.post<LoginResponse>('/auth/login', data);
    return res.data;
  },

  async refresh(): Promise<RefreshResponse> {
    const res = await http.post<RefreshResponse>('/auth/refresh', {});
    return res.data;
  },

  async logout(): Promise<void> {
    await http.post('/auth/logout');
  },

  async me(): Promise<AuthUser> {
    const res = await http.get<AuthUser>('/auth/me');
    return res.data;
  },
};
