import { useEffect, useMemo, useState } from "react";
import { getModuleRoles, getModules } from "../../modules/api/modules.api";
import type { Employee } from "../api/employees.api";

export interface ModuleLabels {
  /** module key → module label */
  modules: Map<string, string>;
  /** module key → (role key → role label) */
  roles: Map<string, Map<string, string>>;
}

/**
 * Loads display names for the modules and roles the given employees use.
 * Falls back silently to raw keys if a lookup fails.
 */
export function useModuleLabels(employees: Employee[]): ModuleLabels {
  const [modules, setModules] = useState<Map<string, string>>(new Map());
  const [roles, setRoles] = useState<Map<string, Map<string, string>>>(new Map());

  useEffect(() => {
    let cancelled = false;
    getModules()
      .then((response) => {
        if (cancelled) return;
        setModules(
          new Map(
            response.sections.flatMap((section) =>
              section.modules.map((module) => [module.key, module.label] as const),
            ),
          ),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const moduleKeys = useMemo(
    () =>
      [...new Set(employees.flatMap((e) => (e.module_roles ?? []).map((m) => m.module)))].sort(),
    [employees],
  );
  const moduleKeysSignature = moduleKeys.join("|");

  useEffect(() => {
    let cancelled = false;
    const missing = moduleKeys.filter((key) => !roles.has(key));
    if (missing.length === 0) return;
    Promise.allSettled(missing.map((key) => getModuleRoles(key))).then((results) => {
      if (cancelled) return;
      setRoles((current) => {
        const next = new Map(current);
        results.forEach((result, index) => {
          next.set(
            missing[index],
            result.status === "fulfilled"
              ? new Map(result.value.roles.map((role) => [role.key, role.label]))
              : new Map(),
          );
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKeysSignature]);

  return { modules, roles };
}

/** Text used by the page search so module and role names are searchable. */
export function moduleRolesSearchText(employee: Employee, labels: ModuleLabels): string {
  return (employee.module_roles ?? [])
    .flatMap((entry) => [
      entry.module,
      labels.modules.get(entry.module) ?? "",
      ...entry.roles.map((role) => {
        const key = typeof role === "string" ? role : role.role;
        return `${key} ${labels.roles.get(entry.module)?.get(key) ?? ""}`;
      }),
    ])
    .join(" ");
}

/** Modules shown per row before "+N more". */
const COLLAPSED_MODULES = 3;

/** Roles column: one line per module, "<Module>: role, role" (comma separated), coloured by active state. */
export function EmployeeModuleRoles({
  employee,
  labels,
}: {
  employee: Employee;
  labels: ModuleLabels;
}) {
  const moduleRoles = employee.module_roles ?? [];
  const [expanded, setExpanded] = useState(false);

  if (moduleRoles.length === 0) {
    // Older records without module assignments: show the flat role list.
    return employee.roles.length ? (
      <p className="m-0 text-micro leading-5">{employee.roles.join(", ")}</p>
    ) : (
      <>—</>
    );
  }

  const visible = expanded ? moduleRoles : moduleRoles.slice(0, COLLAPSED_MODULES);
  const hidden = moduleRoles.length - visible.length;

  return (
    <div className="space-y-1 text-micro leading-5">
      {visible.map((entry) => {
        const roleLabels = labels.roles.get(entry.module);
        return (
          <p key={entry.module} className="m-0">
            <span className="font-semibold text-text">
              {labels.modules.get(entry.module) ?? entry.module}:
            </span>{" "}
            {entry.roles.map((role, index) => {
              const key = typeof role === "string" ? role : role.role;
              const active = typeof role === "string" ? true : role.active;
              return (
                <span key={key}>
                  <span
                    title={active ? "Active" : "Inactive"}
                    className={active ? "font-medium text-success" : "text-subdued/70 line-through"}
                  >
                    {roleLabels?.get(key) ?? key}
                  </span>
                  {index < entry.roles.length - 1 ? ", " : null}
                </span>
              );
            })}
          </p>
        );
      })}
      {moduleRoles.length > COLLAPSED_MODULES ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="font-semibold text-primary hover:underline"
        >
          {expanded ? "Show less" : `+${hidden} more module${hidden === 1 ? "" : "s"}`}
        </button>
      ) : null}
    </div>
  );
}
