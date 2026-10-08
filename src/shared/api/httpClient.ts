import axios from "axios";
import { useAuthStore } from "../../features/auth/state/auth.store";
import { getPersistedSession } from "../../features/auth/storage/auth.storage";
import { env } from "../config/env";

export const httpClient = axios.create({
  baseURL: env.apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

httpClient.interceptors.request.use((config) => {
  const accessToken = getPersistedSession()?.accessToken;

  if (config.data instanceof FormData) {
    config.headers.delete("Content-Type");
  }

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function doRefreshToken(): Promise<string | null> {
  const session = getPersistedSession();
  const refreshToken = session?.refreshToken;
  if (!refreshToken) return null;

  try {
    const res = await axios.post<{
      access_token?: string;
      accessToken?: string;
      refresh_token?: string;
      refreshToken?: string;
    }>(`${env.apiBaseUrl}/refresh`, {
      refresh_token: refreshToken,
    });

    const newAccessToken = res.data.access_token ?? res.data.accessToken;
    const newRefreshToken = res.data.refresh_token ?? res.data.refreshToken ?? refreshToken;

    if (newAccessToken && session.user) {
      useAuthStore.getState().setSession({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: session.user,
      });
      return newAccessToken;
    }
    return null;
  } catch {
    return null;
  }
}

// Token expired mid-session → attempt silent refresh using the refresh token.
// If refresh succeeds, the failed request is transparently retried with the new token.
// If refresh fails or token is missing, sign out cleanly and clear the session.
httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config;
    const url: string = originalRequest?.url ?? "";
    const isAuthEndpoint = url.includes("/login") || url.includes("/refresh");

    if (status === 401 && !isAuthEndpoint && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!refreshPromise) {
        refreshPromise = doRefreshToken().finally(() => {
          refreshPromise = null;
        });
      }

      const newAccessToken = await refreshPromise;
      if (newAccessToken) {
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return httpClient(originalRequest);
      }

      const { isAuthenticated, clearSession } = useAuthStore.getState();
      if (isAuthenticated) clearSession();
    }

    return Promise.reject(error);
  },
);

