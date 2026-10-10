import { USER_ROLES, type UserRole } from "../auth/model/roles";

/** Reviewer QA and Admins can edit company-standard configuration. */
export function canEditCompanyInfo(role: UserRole | string | null | undefined): boolean {
  if (!role) return false;
  return (
    role === USER_ROLES.REVIEWER_QA ||
    role === "reviewer" ||
    role === "reviewer_qa" ||
    role === USER_ROLES.ADMIN ||
    role === USER_ROLES.SUPER_ADMIN
  );
}

/** Approvers and Admins can decide (approve/reject) company standard submissions. */
export function canDecideCompanyApproval(role: UserRole | string | null | undefined): boolean {
  if (!role) return false;
  return (
    role === USER_ROLES.APPROVED_BY ||
    role === "approver" ||
    role === "approvedby" ||
    role === USER_ROLES.ADMIN ||
    role === USER_ROLES.SUPER_ADMIN
  );
}

