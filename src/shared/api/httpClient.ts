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

// Token expired mid-session → sign out cleanly rather than leaving the user staring at
// a screen that only throws auth errors. Clearing the session flips `isAuthenticated`,
// so the route guard redirects to /login; their place in the wizard was saved and the
// next sign-in resumes it. Login/refresh 401s (bad credentials) are left to the caller.
httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url ?? "";
    const isAuthEndpoint = url.includes("/login") || url.includes("/refresh");

    if (status === 401 && !isAuthEndpoint) {
      const { isAuthenticated, clearSession } = useAuthStore.getState();
      if (isAuthenticated) clearSession();
    }

    return Promise.reject(error);
  },
);
