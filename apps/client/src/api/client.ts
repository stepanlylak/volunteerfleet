import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import axios from 'axios';
import { useAuth } from '../stores/auth.store';
import { authApi } from './auth.api';

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
  paramsSerializer: (params) => {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
        }
      } else {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
      }
    }
    return parts.join('&');
  },
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
