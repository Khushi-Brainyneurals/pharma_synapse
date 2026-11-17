import { USER_ROLES, type UserRole } from "./roles";

/** Role names as the sign-in screen shows them. */
export const LOGIN_ROLE_LABELS: Partial<Record<UserRole, string>> = {
  [USER_ROLES.PREPARED_BY]: "Preparer",
  [USER_ROLES.REVIEWER_PRODUCTION]: "Reviewer, Production",
  [USER_ROLES.REVIEWER_QA]: "Reviewer, QA",
  [USER_ROLES.APPROVED_BY]: "Approver",
  [USER_ROLES.PRODUCTION_HEAD]: "Production Head",
  [USER_ROLES.PLANT_HEAD]: "Plant head",
  [USER_ROLES.COMPANY_MANAGEMENT]: "Company management",
  [USER_ROLES.ADMIN]: "Admin",
};

export interface LoginRoleGroup {
  key: "work" | "view" | "admin";
  label: string;
  roles: UserRole[];
}

/** The role groups on the sign-in screen, from the landing design. */
const BASE_GROUPS: LoginRoleGroup[] = [
  {
    key: "work",
    label: "Work here",
    roles: [USER_ROLES.PREPARED_BY, USER_ROLES.REVIEWER_PRODUCTION, USER_ROLES.REVIEWER_QA, USER_ROLES.APPROVED_BY],
  },
  {
    key: "view",
    label: "View only",
    roles: [USER_ROLES.PRODUCTION_HEAD, USER_ROLES.PLANT_HEAD, USER_ROLES.COMPANY_MANAGEMENT],
  },
];

/** The Administration module on the module map. */
export const ADMIN_MODULE_KEY = "adm";

/**
 * Role groups for a sign-in. Admins sign in through the Administration module, which
 * adds the Admin role, so employee management stays reachable.
 */
export function getLoginRoleGroups(moduleKey?: string): LoginRoleGroup[] {
  if (moduleKey === ADMIN_MODULE_KEY) {
    return [...BASE_GROUPS, { key: "admin", label: "Administration", roles: [USER_ROLES.ADMIN] }];
  }
  return BASE_GROUPS;
}
