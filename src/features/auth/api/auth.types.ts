import type { UserRole } from "../model/roles";

export interface LoginRequest {
  username: string;
  password: string;
  role: UserRole;
  module: string;
}

/** Feature flags from the login response, e.g. `personal_dashboard`, `company_dashboard`. */
export type UserFeatures = Record<string, boolean>;

export interface AuthenticatedUser {
  id: string;
  username: string;
  displayName?: string;
  role: UserRole;
  unitId?: string | null;
  unitName?: string | null;
  addressId?: number | null;
  address?: string | null;
  features?: UserFeatures;
}

export interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  access_token?: string;
  refresh_token?: string;
  token?: string;
  addressId?: number | null;
  address_id?: number | null;
  address?: string | null;
  features?: UserFeatures;
  user: AuthenticatedUser;
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  user: AuthenticatedUser;
}

export interface LogoutRequest {
  refresh_token: string;
}
