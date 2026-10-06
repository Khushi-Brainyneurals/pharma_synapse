import { USER_ROLES, type UserRole } from "../auth/model/roles";

/** Only QA reviewers own company-standard configuration changes. */
export function canEditCompanyInfo(role: UserRole | null | undefined): boolean {
  return role === USER_ROLES.REVIEWER_QA;
}
