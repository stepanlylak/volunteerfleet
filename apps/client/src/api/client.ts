import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import axios from 'axios';
import { useAuth } from '../stores/auth.store';
import { authApi } from './auth.api';

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
});

http.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as InternalAxiosRequestConfig & { _retry?: boolean };

    const isRefreshEndpoint = original.url?.includes('/auth/refresh');
    if (err.response?.status === 401 && !original._retry && !isRefreshEndpoint) {
      original._retry = true;
      try {
        await authApi.refresh();
        const user = await authApi.me();
        useAuth.getState().setAuth({ user });
        return http(original);
      } catch {
        useAuth.getState().clear();
        window.location.assign('/login');
        return Promise.reject(err);
      }
    }

    return Promise.reject(err);
  },
);
