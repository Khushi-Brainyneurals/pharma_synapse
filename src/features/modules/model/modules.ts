import type { ModuleItem, ModuleSection } from "../api/modules.api";
import type { Family } from "../../../shared/ps/IconTile";

interface ModuleVisual {
  icon: string;
  family: Family;
}

/** Presentation only: module identity, labels, descriptions, and availability come from the API. */
const MODULE_VISUALS: Record<string, ModuleVisual> = {
  BATCH_DOC_101: { icon: "description", family: "clay" },
  ISSUANCE_102: { icon: "assignment_turned_in", family: "honey" },
  EBMR_EXEC_103: { icon: "edit_document", family: "sage" },
  ELOGBOOK_104: { icon: "menu_book", family: "iris" },
  MFC_MPC_301: { icon: "receipt_long", family: "harbor" },
  SPEC_MOA_302: { icon: "biotech", family: "iris" },
  SOP_PREP_303: { icon: "school", family: "sage" },
  MASTER_HISTORY_304: { icon: "history", family: "rose" },
  MASTER_DATA_305: { icon: "inventory_2", family: "harbor" },
  ASSET_COMPLIANCE_104: { icon: "menu_book", family: "iris" },
  PROC_VALID_201: { icon: "science", family: "iris" },
  CPV_202: { icon: "monitoring", family: "harbor" },
  APQR_203: { icon: "fact_check", family: "sage" },
  STABILITY_204: { icon: "thermostat", family: "clay" },
  QMS_401: { icon: "report_problem", family: "clay" },
  ADMIN_ACCESS_901: { icon: "manage_accounts", family: "harbor" },
};

export function getModuleVisual(moduleKey: string): ModuleVisual {
  return MODULE_VISUALS[moduleKey] ?? { icon: "apps", family: "clay" };
}

/** Module data rendered on the public map, adapted directly from the API. */
export interface AppModule extends ModuleItem {
  name: string;
  group: string;
  line: string;
  icon: string;
  family: Family;
  disabled: boolean;
  detail: string;
  status: "built" | "plan";
}

export function modulesByGroup(sections: ModuleSection[], loginEnabled = true) {
  const groups = sections
    .map(({ name, modules }) => ({
      group: name,
      modules: modules.map((module): AppModule => {
      const visual = getModuleVisual(module.key);
      return {
        ...module,
        name: module.label,
        group: name,
        line: module.description,
        ...visual,
        disabled: !loginEnabled || !module.login_available,
        detail: module.description,
        status: loginEnabled && module.login_available ? "built" : "plan",
      };
      }),
    }))
    .filter(({ modules }) => modules.length > 0);

  return groups;
}
