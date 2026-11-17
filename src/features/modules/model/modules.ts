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
  "Quality oversight",
  "Administration",
] as const;

export type ModuleGroup = (typeof MODULE_GROUPS)[number];

// The module table from the design handoff (data/19-modules.js), in map order.
export const MODULES: AppModule[] = [
  { key: "bd", name: "Batch documents", group: "Batch records", departments: ["Production", "QA"], status: "built", line: "BMRs and BPRs, from draft to effective.", icon: "description", family: "clay" },
  { key: "iss", name: "Issuance", group: "Batch records", departments: ["QA", "Production"], status: "built", line: "Controlled copies, receipts and reconciliation.", icon: "assignment_turned_in", family: "honey" },
  { key: "ebmr", name: "eBMR execution", group: "Batch records", departments: ["Production"], status: "plan", line: "The issued record, filled on the floor.", icon: "edit_document", family: "sage", disabled: true },
  { key: "elog", name: "eLogBook", group: "Batch records", departments: ["Production", "Engineering"], status: "plan", line: "Equipment, cleaning and area logbooks.", icon: "menu_book", family: "iris" },
  { key: "pv", name: "Process validation", group: "Validation and trending", departments: ["QA", "Production", "QC"], status: "built", line: "Protocols, executed readings and reports.", icon: "science", family: "iris" },
  { key: "cpv", name: "CPV (Continued process verification)", group: "Validation and trending", departments: ["QA", "Production"], status: "plan", line: "Watch parameters trended batch over batch.", icon: "monitoring", family: "harbor" },
  { key: "apqr", name: "Annual product quality review", group: "Validation and trending", departments: ["QA"], status: "plan", line: "The yearly review, assembled from evidence.", icon: "fact_check", family: "sage" },
  { key: "stab", name: "Stability", group: "Validation and trending", departments: ["QC"], status: "plan", line: "Studies, pull schedules and trends.", icon: "thermostat", family: "clay", disabled: true },
  { key: "md", name: "Master data", group: "Master documents and data", departments: ["QA", "Engineering"], status: "built", line: "Products, equipment, materials and review chains.", icon: "database", family: "honey" },
  { key: "mfc", name: "MFC and MPC", group: "Master documents and data", departments: ["QA", "Production"], status: "plan", line: "Master formula and packing cards, versioned.", icon: "receipt_long", family: "clay", disabled: true },
  { key: "spec", name: "Specifications and MoA", group: "Master documents and data", departments: ["QC"], status: "plan", line: "QC specifications and methods of analysis.", icon: "biotech", family: "iris", disabled: true },
  { key: "sop", name: "SOP preparation", group: "Master documents and data", departments: ["QA"], status: "plan", line: "Controlled copy distribution and training management.", icon: "school", family: "sage", disabled: true },
  { key: "dash", name: "Dashboards", group: "Quality oversight", departments: ["Management"], status: "built", line: "How documentation is keeping up.", icon: "dashboard", family: "harbor" },
  { key: "rep", name: "Reports", group: "Quality oversight", departments: ["All departments"], status: "built", line: "Numbered runs, schedules and the archive.", icon: "bar_chart", family: "sage" },
  { key: "qms", name: "Quality Management System (QMS)", group: "Quality oversight", departments: ["QA"], status: "plan", line: "Deviation, changes, QRM, investigation etc. linked records.", detail: "Quality compliance, deviations, investigations, CAPA, change management, risk assessment, audits, complaints and recall management.", icon: "report_problem", family: "clay", disabled: true },
  { key: "adm", name: "Company admin", group: "Administration", departments: ["IT"], status: "built", line: "People, roles, settings and access reviews.", icon: "manage_accounts", family: "harbor" },
];

export function findModule(key: string | null | undefined): AppModule | undefined {
  return key ? MODULES.find((m) => m.key === key) : undefined;
}

export function modulesByGroup() {
  return MODULE_GROUPS.map((group) => ({ group, modules: MODULES.filter((m) => m.group === group) })).filter(
    (g) => g.modules.length > 0,
  );
}
