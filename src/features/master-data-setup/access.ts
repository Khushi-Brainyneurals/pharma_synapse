import type { UserRole } from "../auth/model/roles";

/**
 * Master-data access:
 *   Reviewer (QA)  — Upload / edit (proposes the set for approval)
 *   Approver       — VIEW and Approve/Reject only (no editing; a rejection must state a reason)
 *   Prepared-by    — VIEW only (see which files are uploaded and their content — the preview)
 *   Admin / PR / Super Admin — no master-data access
 *
 * Nothing goes live until the Approver signs off; edits by QA are staged as a proposal.
 */
export interface MasterDataAccess {
  canView: boolean;
  canEdit: boolean;
  canApprove: boolean;
}

const NONE: MasterDataAccess = { canView: false, canEdit: false, canApprove: false };

export function masterDataAccess(role: UserRole | string | null | undefined): MasterDataAccess {
  switch (role) {
    case "reviewer_qa":
    case "reviewer":
      return { canView: true, canEdit: true, canApprove: false };
    case "approver":
      return { canView: true, canEdit: false, canApprove: true };
    case "preparer":
      return { canView: true, canEdit: false, canApprove: false };
    default:
      // admin, reviewer_pr, superadmin — the rights matrix leaves master data blank.
      return NONE;
  }
}
