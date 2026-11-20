import type { AuthenticatedUser } from "../../features/auth/api/auth.types";
import { dashboardAccess } from "../../features/dashboard/access";
import { ROUTES } from "./routes";

/**
 * Where a signed-in user lands: the Dashboard when their login features grant one,
 * otherwise admins open employees and everyone else opens Documents.
 */
export function getPostLoginPath(user: Pick<AuthenticatedUser, "role" | "features">) {
  if (dashboardAccess(user as AuthenticatedUser).canView) {
    return ROUTES.dashboard;
  }
  if (user.role === "admin" || user.role === "superadmin") {
    return ROUTES.employees;
  }
  return ROUTES.documents;
}
