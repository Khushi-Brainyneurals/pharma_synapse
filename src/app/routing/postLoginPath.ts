import type { UserRole } from "../../features/auth/model/roles";
import { ROUTES } from "./routes";

/** Documents resume from their cards; signing in opens the dashboard, admins open employees. */
export function getPostLoginPath(role: UserRole | string) {
  if (role === "admin" || role === "superadmin") {
    return ROUTES.employees;
  }
  return "/";
}
