import type { UserRole } from "../model/roles";

export interface LoginRequest {
  username: string;
  password: string;
  role: UserRole;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  displayName?: string;
  role: UserRole;
  unitId?: string | null;
  unitName?: string | null;
}

export interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  access_token?: string;
  refresh_token?: string;
  token?: string;
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
