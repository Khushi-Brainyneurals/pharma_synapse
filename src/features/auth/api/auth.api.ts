import { httpClient } from "../../../shared/api/httpClient";
import { env } from "../../../shared/config/env";
import { USER_ROLE_LABELS, USER_ROLES, type UserRole } from "../model/roles";
import type {
  AuthSession,
  AuthenticatedUser,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  UserFeatures,
} from "./auth.types";

type BackendLoginResponse = Partial<LoginResponse> & {
  access_token?: string;
  refresh_token?: string;
  token?: string;
  data?: Partial<LoginResponse> & { access?: LoginAccess };
  access?: LoginAccess;
};

/** The `access` block of the login response: what this user may do in the module. */
interface LoginAccess {
  access_type?: string;
  document_types?: string[];
  features?: UserFeatures;
}

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
  const addressId = payload.addressId ?? payload.address_id ?? response.addressId ?? response.address_id;
  const address = payload.address ?? response.address;
  // The backend sends the flags as `access.features`; older shapes put them at the top or on the user.
  const features = pickFeatures(
    payload.access?.features,
    response.access?.features,
    payload.features,
    payload.user?.features,
    response.features,
  );

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
      addressId: payload.user?.addressId ?? addressId,
      address: payload.user?.address ?? address,
      features,
    },
  };
}

/** The first feature-flag object the login response carries, keeping only boolean flags. */
function pickFeatures(...candidates: unknown[]): UserFeatures {
  const source = candidates.find(
    (value): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value),
  );
  if (!source) return {};
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => typeof value === "boolean"),
  ) as UserFeatures;
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
