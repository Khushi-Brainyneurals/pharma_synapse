import { USER_ROLES, type UserRole } from "./roles";

/** Role names as the sign-in screen shows them. */
export const LOGIN_ROLE_LABELS: Partial<Record<UserRole, string>> = {
  [USER_ROLES.PREPARED_BY]: "Preparer",
  [USER_ROLES.REVIEWER_PRODUCTION]: "Reviewer, Production",
  [USER_ROLES.REVIEWER_QA]: "Reviewer, QA",
  [USER_ROLES.REVIEWER_QC]: "Reviewer, QC",
  [USER_ROLES.APPROVED_BY]: "Approver",
  [USER_ROLES.PRODUCTION_HEAD]: "Production Head",
  [USER_ROLES.QA_HEAD]: "QA Head",
  [USER_ROLES.QC_HEAD]: "QC Head",
  [USER_ROLES.RND_HEAD]: "R&D Head",
  [USER_ROLES.PLANT_HEAD]: "Plant head",
  [USER_ROLES.DIRECTOR]: "Director",
  [USER_ROLES.REQUESTOR]: "Requestor",
  [USER_ROLES.ISSUER]: "Issuer",
  [USER_ROLES.ADMIN]: "Company admin",
};

export interface LoginRoleGroup {
  key: "work" | "view";
  label: string;
  roles: UserRole[];
}

/** The Administration module on the module map. */
export const ADMIN_MODULE_KEY = "ADMIN_ACCESS_901";

const R = USER_ROLES;

function groups(work: UserRole[], view: UserRole[]): LoginRoleGroup[] {
  return [
    { key: "work", label: "Work here", roles: work },
    { key: "view", label: "View only", roles: view },
  ];
}

/** Batch documents roles; also the default for modules without their own list. */
const BATCH_DOC_GROUPS = groups(
  [R.PREPARED_BY, R.REVIEWER_PRODUCTION, R.REVIEWER_QA, R.APPROVED_BY],
  [R.PRODUCTION_HEAD, R.PLANT_HEAD, R.DIRECTOR],
);

const TRENDING_GROUPS = groups(
  [R.PREPARED_BY, R.REVIEWER_QA, R.QC_HEAD, R.PRODUCTION_HEAD, R.RND_HEAD, R.APPROVED_BY],
  [R.PLANT_HEAD, R.DIRECTOR],
);

/** Role groups per module key, from the sign-in designs. */
const MODULE_ROLE_GROUPS: Record<string, LoginRoleGroup[]> = {
  BATCH_DOC_101: BATCH_DOC_GROUPS,
  ELOGBOOK_104: BATCH_DOC_GROUPS,
  ISSUANCE_102: groups(
    [R.PRODUCTION_HEAD, R.REQUESTOR, R.ISSUER],
    [
      R.PREPARED_BY,
      R.REVIEWER_PRODUCTION,
      R.REVIEWER_QA,
      R.REVIEWER_QC,
      R.QA_HEAD,
      R.QC_HEAD,
      R.PLANT_HEAD,
      R.DIRECTOR,
    ],
  ),
  PROC_VALID_201: groups(
    [R.PREPARED_BY, R.REVIEWER_PRODUCTION, R.REVIEWER_QA, R.REVIEWER_QC, R.APPROVED_BY],
    [R.PRODUCTION_HEAD, R.QC_HEAD, R.PLANT_HEAD, R.DIRECTOR],
  ),
  CPV_202: TRENDING_GROUPS,
  APQR_203: TRENDING_GROUPS,
  // Company admin is the Admin role, so employee management stays reachable.
  [ADMIN_MODULE_KEY]: groups(
    [R.ADMIN, R.APPROVED_BY],
    [R.QA_HEAD, R.QC_HEAD, R.PRODUCTION_HEAD, R.PLANT_HEAD, R.DIRECTOR],
  ),
};

/** Role groups for a sign-in, based on the module chosen on the module map. */
export function getLoginRoleGroups(moduleKey?: string): LoginRoleGroup[] {
  return (moduleKey && MODULE_ROLE_GROUPS[moduleKey]) || BATCH_DOC_GROUPS;
}
