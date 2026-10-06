import { httpClient } from "../../../shared/api/httpClient";
import { env } from "../../../shared/config/env";
import { USER_ROLE_LABELS, USER_ROLES, type UserRole } from "../model/roles";
import type {
  AuthSession,
  AuthenticatedUser,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
} from "./auth.types";

type BackendLoginResponse = Partial<LoginResponse> & {
  access_token?: string;
  refresh_token?: string;
  token?: string;
  data?: Partial<LoginResponse>;
};

export async function login(request: LoginRequest): Promise<AuthSession> {
  if (env.useMockApi) {
    return mockLogin(request);
  }

  const response = await httpClient.post<BackendLoginResponse>("/login", request);
  return transformLoginResponse(response.data, request);
}

export async function logout(request: LogoutRequest): Promise<void> {
  if (env.useMockApi) {
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    return;
  }

  await httpClient.post("/logout", request);
}

function transformLoginResponse(
  response: BackendLoginResponse,
  request: LoginRequest,
): AuthSession {
  const payload = response.data ?? response;
  const accessToken =
    payload.accessToken ?? payload.access_token ?? response.access_token ?? payload.token ?? response.token;
  const refreshToken = payload.refreshToken ?? payload.refresh_token ?? response.refresh_token;

  if (!accessToken) {
    throw new Error("LOGIN_RESPONSE_INVALID");
  }

  const fallbackUser: AuthenticatedUser = {
    id: request.username,
    username: request.username,
    displayName: request.username,
    role: request.role,
  };

  return {
    accessToken,
    refreshToken,
    user: {
      ...fallbackUser,
      ...payload.user,
      role: payload.user?.role ?? request.role,
    },
  };
}

async function mockLogin(request: LoginRequest): Promise<AuthSession> {
  await new Promise((resolve) => window.setTimeout(resolve, 500));

  return {
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
    user: {
      id: request.username,
      username: request.username,
      displayName: USER_ROLE_LABELS[request.role],
      role: request.role,
      unitId: request.role === USER_ROLES.PREPARED_BY ? "UNIT-03" : null,
    },
  };
}
