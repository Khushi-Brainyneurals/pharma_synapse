export const USER_ROLES = {
  SUPER_ADMIN: "superadmin",
  ADMIN: "admin",
  PREPARED_BY: "preparer",
  REVIEWER_QA: "reviewer_qa",
  REVIEWER_PR: "reviewer_pr",
  APPROVED_BY: "approver",
  // Roles from the sign-in design. Sent to the API as-is.
  REVIEWER_PRODUCTION: "reviewer_production",
  PRODUCTION_HEAD: "production_head",
  PLANT_HEAD: "plant_head",
  DIRECTOR: "director",
  // Module-specific sign-in roles. Sent to the API as-is.
  REVIEWER_QC: "reviewer_qc",
  QA_HEAD: "qa_head",
  QC_HEAD: "qc_head",
  RND_HEAD: "rnd_head",
  REQUESTOR: "requestor",
  ISSUER: "issuer",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [USER_ROLES.SUPER_ADMIN]: "Super Admin",
  [USER_ROLES.ADMIN]: "Admin",
  [USER_ROLES.PREPARED_BY]: "Prepared By",
  [USER_ROLES.REVIEWER_QA]: "Reviewer — QA",
  [USER_ROLES.REVIEWER_PR]: "Reviewer — Production",
  [USER_ROLES.APPROVED_BY]: "Approved By",
  [USER_ROLES.REVIEWER_PRODUCTION]: "Reviewer — Production",
  [USER_ROLES.PRODUCTION_HEAD]: "Production Head",
  [USER_ROLES.PLANT_HEAD]: "Plant head",
  [USER_ROLES.DIRECTOR]: "Director",
  [USER_ROLES.REVIEWER_QC]: "Reviewer — QC",
  [USER_ROLES.QA_HEAD]: "QA Head",
  [USER_ROLES.QC_HEAD]: "QC Head",
  [USER_ROLES.RND_HEAD]: "R&D Head",
  [USER_ROLES.REQUESTOR]: "Requestor",
  [USER_ROLES.ISSUER]: "Issuer",
};

export const USER_ROLE_OPTIONS = Object.values(USER_ROLES).map((value) => ({
  value,
  label: USER_ROLE_LABELS[value],
}));

// Role choices used by employee administration; login role choices come from the module API.
export const LOGIN_ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: USER_ROLES.PREPARED_BY, label: "Prepared By" },
  { value: USER_ROLES.REVIEWER_QA, label: "Reviewer QA" },
  { value: USER_ROLES.REVIEWER_PR, label: "Reviewer PR" },
  { value: USER_ROLES.APPROVED_BY, label: "Approved By" },
];

