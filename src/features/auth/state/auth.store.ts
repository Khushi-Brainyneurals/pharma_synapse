import { create } from "zustand";
import type { AuthSession, AuthenticatedUser } from "../api/auth.types";
import {
  clearPersistedSession,
  getPersistedSession,
  persistSession,
} from "../storage/auth.storage";

interface AuthState {
  user: AuthenticatedUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
}

const persistedSession = getPersistedSession();

export const useAuthStore = create<AuthState>((set) => ({
  user: persistedSession?.user ?? null,
  accessToken: persistedSession?.accessToken ?? null,
  refreshToken: persistedSession?.refreshToken ?? null,
  isAuthenticated: Boolean(persistedSession?.accessToken),
  setSession: (session) => {
    persistSession(session);
    set({
      user: session.user,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken ?? null,
      isAuthenticated: true,
    });
  },
  clearSession: () => {
    clearPersistedSession();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },
}));
