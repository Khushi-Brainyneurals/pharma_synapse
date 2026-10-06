import type { UserRole } from "../../features/auth/model/roles";

/** Documents resume from their cards; signing in opens the dashboard. */
export function getPostLoginPath(_role: UserRole) {
  return "/";
}
