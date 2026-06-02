import type { AuthUser } from '@volunteerfleet/shared';
import { create } from 'zustand';

const AUTH_SESSION_HINT_KEY = 'volunteerfleet.authSession';

function readAuthSessionHint(): boolean {
  return (
    typeof window !== 'undefined' && window.localStorage.getItem(AUTH_SESSION_HINT_KEY) === '1'
  );
}

function writeAuthSessionHint(value: boolean): void {
  if (typeof window === 'undefined') return;
  if (value) window.localStorage.setItem(AUTH_SESSION_HINT_KEY, '1');
  else window.localStorage.removeItem(AUTH_SESSION_HINT_KEY);
}

export type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  hasSessionHint: boolean;
  setAuth: (data: { user: AuthUser; accessToken: string }) => void;
  setToken: (accessToken: string) => void;
  clear: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  hasSessionHint: readAuthSessionHint(),
  setAuth: ({ user, accessToken }) => {
    writeAuthSessionHint(true);
    set({ user, accessToken, hasSessionHint: true });
  },
  setToken: (accessToken) => {
    writeAuthSessionHint(true);
    set({ accessToken, hasSessionHint: true });
  },
  clear: () => {
    writeAuthSessionHint(false);
    set({ user: null, accessToken: null, hasSessionHint: false });
  },
}));
