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
  hasSessionHint: boolean;
  setAuth: (data: { user: AuthUser }) => void;
  clear: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  hasSessionHint: readAuthSessionHint(),
  setAuth: ({ user }) => {
    writeAuthSessionHint(true);
    set({ user, hasSessionHint: true });
  },
  clear: () => {
    writeAuthSessionHint(false);
    set({ user: null, hasSessionHint: false });
  },
}));
