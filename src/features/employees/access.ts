import { USER_ROLES } from "../auth/model/roles";

/** Keep the same admin definition everywhere employee management is exposed. */
export function canManageEmployees(role: string | null | undefined) {
  return role === USER_ROLES.ADMIN;
}
