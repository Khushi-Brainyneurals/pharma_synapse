import type { AuthSession } from "../api/auth.types";

const AUTH_STORAGE_KEY = "bmr.client.auth.session";

export function getPersistedSession(): AuthSession | null {
  if (!isBrowserStorageAvailable()) {
    return null;
  }

  const rawSession = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as AuthSession;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function persistSession(session: AuthSession) {
  if (!isBrowserStorageAvailable()) {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function getStoredRefreshToken() {
  return getPersistedSession()?.refreshToken ?? null;
}

export function clearPersistedSession() {
  if (!isBrowserStorageAvailable()) {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

function isBrowserStorageAvailable() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}
