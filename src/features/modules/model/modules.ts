import type { Family } from "../../../shared/ps/IconTile";

export type ModuleStatus = "built" | "plan";

export interface AppModule {
  key: string;
  name: string;
  group: ModuleGroup;
  departments: string[];
  status: ModuleStatus;
  line: string;
  icon: string;
  family: Family;
  /** Shown on the map but not openable yet. */
  disabled?: boolean;
  /** Longer description, shown as the card tooltip. */
  detail?: string;
}

export const MODULE_GROUPS = [
  "Batch records",
  "Validation and trending",
  "Master documents and data",
  "Quality Events Management",
  "Administration",
] as const;

export type ModuleGroup = (typeof MODULE_GROUPS)[number];

// The module table from the design handoff (data/19-modules.js), in map order.
export const MODULES: AppModule[] = [
  { key: "BATCH_DOC_101", name: "Batch documents", group: "Batch records", departments: ["Production", "QA"], status: "built", line: "BMRs and BPRs, from draft to effective.", icon: "description", family: "clay" },
  { key: "ISSUANCE_102", name: "Issuance", group: "Batch records", departments: ["QA", "Production"], status: "built", line: "Controlled copies, receipts and reconciliation.", icon: "assignment_turned_in", family: "honey" },
  { key: "EBMR_EXEC_103", name: "eBMR execution", group: "Batch records", departments: ["Production"], status: "plan", line: "The issued record, filled on the floor.", icon: "edit_document", family: "sage", disabled: true },
  { key: "ELOGBOOK_104", name: "eLogBook", group: "Batch records", departments: ["Production", "Engineering"], status: "plan", line: "Equipment, cleaning and area logbooks.", icon: "menu_book", family: "iris" },
  { key: "PROC_VALID_201", name: "Process validation", group: "Validation and trending", departments: ["QA", "Production", "QC"], status: "built", line: "Protocols, executed readings and reports.", icon: "science", family: "iris" },
  { key: "CPV_202", name: "CPV (Continued process verification)", group: "Validation and trending", departments: ["QA", "Production"], status: "plan", line: "Watch parameters trended batch over batch.", icon: "monitoring", family: "harbor" },
  { key: "APQR_203", name: "Annual product quality review", group: "Validation and trending", departments: ["QA"], status: "plan", line: "The yearly review, assembled from evidence.", icon: "fact_check", family: "sage" },
  { key: "STABILITY_204", name: "Stability", group: "Validation and trending", departments: ["QC"], status: "plan", line: "Studies, pull schedules and trends.", icon: "thermostat", family: "clay", disabled: true },
  { key: "MFC_MPC_301", name: "MFC and MPC", group: "Master documents and data", departments: ["QA", "Production"], status: "plan", line: "Master formula and packing cards, versioned.", icon: "receipt_long", family: "clay", disabled: true },
  { key: "SPEC_MOA_302", name: "Specifications and MoA", group: "Master documents and data", departments: ["QC"], status: "plan", line: "QC specifications and methods of analysis.", icon: "biotech", family: "iris", disabled: true },
  { key: "SOP_PREP_303", name: "SOP preparation", group: "Master documents and data", departments: ["QA"], status: "plan", line: "Controlled copy distribution and training management.", icon: "school", family: "sage", disabled: true },
  { key: "QMS_401", name: "Quality Management System (QMS)", group: "Quality Events Management", departments: ["QA"], status: "plan", line: "Deviation, changes, QRM, investigation etc. linked records.", detail: "Quality compliance, deviations, investigations, CAPA, change management, risk assessment, audits, complaints and recall management.", icon: "report_problem", family: "clay", disabled: true },
  { key: "ADMIN_ACCESS_901", name: "Admin and Access Control ", group: "Administration", departments: ["IT", "QA"], status: "built", line: "Manage users, roles, permissions and company settings.", detail: "Add and manage employees, assign roles and access, review permissions and maintain company and plant settings.", icon: "manage_accounts", family: "harbor" },
];

export function findModule(key: string | null | undefined): AppModule | undefined {
  return key ? MODULES.find((m) => m.key === key) : undefined;
}

export function modulesByGroup() {
  return MODULE_GROUPS.map((group) => ({ group, modules: MODULES.filter((m) => m.group === group) })).filter(
    (g) => g.modules.length > 0,
  );
}