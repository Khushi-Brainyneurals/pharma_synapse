import axios, {
  AxiosHeaders,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { useAuthStore } from "../../features/auth/state/auth.store";
import {
  getPersistedSession,
  getStoredRefreshToken,
} from "../../features/auth/storage/auth.storage";
import { env } from "../config/env";

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

interface RefreshResponse {
  access_token?: string;
  accessToken?: string;
  refresh_token?: string | null;
  refreshToken?: string | null;
  data?: Omit<RefreshResponse, "data">;
}

class InvalidRefreshResponseError extends Error {
  constructor() {
    super("REFRESH_RESPONSE_INVALID");
    this.name = "InvalidRefreshResponseError";
  }
}

export const httpClient = axios.create({
  baseURL: env.apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

// Refresh calls deliberately use a client without the auth response interceptor. A
// rejected /refresh request must never recursively attempt another refresh.
const refreshClient = axios.create({
  baseURL: env.apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

let refreshPromise: Promise<string> | null = null;

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

httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config as RetryableRequestConfig | undefined;

    if (
      status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      isRefreshExcludedEndpoint(originalRequest.url)
    ) {
      return Promise.reject(error);
    }

    const failedAccessToken = getBearerToken(originalRequest);
    const authState = useAuthStore.getState();

    // A public/anonymous 401 is not evidence that an access token expired.
    if (!authState.isAuthenticated || !failedAccessToken) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    // The response may have arrived after another request already refreshed the
    // session. Retry with that token instead of performing a second refresh.
    if (authState.accessToken && authState.accessToken !== failedAccessToken) {
      setAuthorizationHeader(originalRequest, authState.accessToken);
      return httpClient(originalRequest);
    }

    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
      authState.clearSession();
      return Promise.reject(error);
    }

    try {
      const accessToken = await getOrStartRefresh(refreshToken);
      setAuthorizationHeader(originalRequest, accessToken);
      return httpClient(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);

function getOrStartRefresh(refreshToken: string): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken(refreshToken).finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  try {
    const response = await refreshClient.post<RefreshResponse>("/refresh", {
      refresh_token: refreshToken,
    });
    const payload = response.data?.data ?? response.data;
    const accessToken = payload?.accessToken ?? payload?.access_token;
    const rotatedRefreshToken = payload?.refreshToken ?? payload?.refresh_token;

    if (!isNonEmptyToken(accessToken)) {
      throw new InvalidRefreshResponseError();
    }

    const authState = useAuthStore.getState();

    // Manual logout (or a new login) may have happened while /refresh was in flight.
    // Never restore or overwrite a session that is no longer the one being refreshed.
    if (
      !authState.isAuthenticated ||
      !authState.user ||
      authState.refreshToken !== refreshToken
    ) {
      throw new Error("AUTH_SESSION_ENDED");
    }

    authState.setSession({
      user: authState.user,
      accessToken,
      refreshToken: isNonEmptyToken(rotatedRefreshToken)
        ? rotatedRefreshToken
        : refreshToken,
    });

    return accessToken;
  } catch (error) {
    if (isRejectedRefresh(error)) {
      useAuthStore.getState().clearSession();
    }

    throw error;
  }
}

function isRejectedRefresh(error: unknown): boolean {
  if (error instanceof InvalidRefreshResponseError) {
    return true;
  }

  if (!axios.isAxiosError(error)) {
    return false;
  }

  const status = error.response?.status;
  return status === 400 || status === 401 || status === 403 || status === 422;
}

function isRefreshExcludedEndpoint(url?: string): boolean {
  if (!url) {
    return false;
  }

  const path = url.split(/[?#]/, 1)[0].replace(/\/+$/, "");
  return ["/login", "/refresh", "/logout", "/password/change-expired"].some(
    (endpoint) => path.endsWith(endpoint),
  );
}

function getBearerToken(config: AxiosRequestConfig): string | null {
  const headers = config.headers;
  const authorization =
    headers instanceof AxiosHeaders
      ? headers.get("Authorization")
      : headers?.Authorization ?? headers?.authorization;

  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length);
}

function setAuthorizationHeader(config: AxiosRequestConfig, accessToken: string) {
  if (config.headers instanceof AxiosHeaders) {
    config.headers.set("Authorization", `Bearer ${accessToken}`);
    return;
  }

  config.headers = {
    ...config.headers,
    Authorization: `Bearer ${accessToken}`,
  };
}

function isNonEmptyToken(token: string | null | undefined): token is string {
  return typeof token === "string" && token.trim().length > 0;
}
