import { ConfigProvider } from 'antd';
import ukUA from 'antd/locale/uk_UA';
import dayjs from 'dayjs';
import 'dayjs/locale/uk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { authApi } from './api/auth.api';
import { router } from './router';
import { useAuth } from './stores/auth.store';
import './styles/print.css';
import { theme } from './styles/theme';

dayjs.locale('uk');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppBootstrap() {
  const [isLoading, setIsLoading] = useState(true);
  const hasSessionHint = useAuth((s) => s.hasSessionHint);
  const setAuth = useAuth((s) => s.setAuth);
  const setToken = useAuth((s) => s.setToken);
  const clearAuth = useAuth((s) => s.clear);

  useEffect(() => {
    if (!hasSessionHint) {
      setIsLoading(false);
      return;
    }

    authApi
      .refresh()
      .then(async (data) => {
        setToken(data.accessToken);
        const user = await authApi.me();
        setAuth({ user, accessToken: data.accessToken });
      })
      .catch(() => {
        clearAuth();
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [hasSessionHint, setAuth, setToken, clearAuth]);

  if (isLoading) {
    return null; // Or a minimal loading spinner
  }

  return <RouterProvider router={router} />;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <ConfigProvider locale={ukUA} theme={theme}>
      <QueryClientProvider client={queryClient}>
        <AppBootstrap />
      </QueryClientProvider>
    </ConfigProvider>
  </StrictMode>,
);
