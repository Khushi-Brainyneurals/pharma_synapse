import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { Select } from "../../../shared/ui/Select";
import {
  getModuleRoles,
  getModules,
  type ModuleItem,
  type ModuleRole,
} from "../../modules/api/modules.api";
import type { ModuleRoleAssignment } from "../api/employees.api";

interface ModuleRolesFieldProps {
  value: ModuleRoleAssignment[];
  onChange: (next: ModuleRoleAssignment[]) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * Module-wise role picker: choose a module, then assign its roles and set each
 * assigned role active or inactive. Assignments for every module are kept, so
 * switching modules does not lose earlier picks.
 */
export function ModuleRolesField({ value, onChange, error, disabled }: ModuleRolesFieldProps) {
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [modulesError, setModulesError] = useState<string | null>(null);

  const [selectedModule, setSelectedModule] = useState("");
  const [roles, setRoles] = useState<ModuleRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getModules()
      .then((response) => {
        if (cancelled) return;
        // Same rule as the module map: disabled modules are not offered.
        setModules(
          response.module_login_available
            ? response.sections
                .flatMap((section) => section.modules)
                .filter((module) => module.login_available)
            : [],
        );
      })
      .catch((caught) => {
        if (!cancelled) setModulesError(getApiErrorMessage(caught, "Could not load modules."));
      })
      .finally(() => {
        if (!cancelled) setModulesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedModule) {
      setRoles([]);
      setRolesError(null);
      return;
    }
    let cancelled = false;
    setRolesLoading(true);
    setRolesError(null);
    getModuleRoles(selectedModule)
      .then((response) => {
        if (!cancelled) setRoles(response.roles);
      })
      .catch((caught) => {
        if (!cancelled) {
          setRoles([]);
          setRolesError(getApiErrorMessage(caught, "Could not load roles for this module."));
        }
      })
      .finally(() => {
        if (!cancelled) setRolesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedModule]);

  const moduleLabel = useMemo(
    () => new Map(modules.map((module) => [module.key, module.label])),
    [modules],
  );

  const current = value.find((entry) => entry.module === selectedModule);

  function updateModule(roleList: ModuleRoleAssignment["roles"]) {
    const others = value.filter((entry) => entry.module !== selectedModule);
    onChange(roleList.length ? [...others, { module: selectedModule, roles: roleList }] : others);
  }

  function toggleAssigned(roleKey: string) {
    const list = current?.roles ?? [];
    updateModule(
      list.some((entry) => entry.role === roleKey)
        ? list.filter((entry) => entry.role !== roleKey)
        : [...list, { role: roleKey, active: true }],
    );
  }

  function toggleActive(roleKey: string) {
    updateModule(
      (current?.roles ?? []).map((entry) =>
        entry.role === roleKey ? { ...entry, active: !entry.active } : entry,
      ),
    );
  }

  function removeModule(moduleKey: string) {
    onChange(value.filter((entry) => entry.module !== moduleKey));
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-small font-semibold">
        Module roles <span className="text-danger">*</span>
      </legend>

      {modulesError ? <p className="text-micro text-danger">{modulesError}</p> : null}

      {value.length ? (
        <div className="flex flex-wrap gap-2">
          {value.map((entry) => {
            const activeCount = entry.roles.filter((r) => r.active).length;
            return (
              <span
                key={entry.module}
                className={`inline-flex items-center gap-2 rounded-control border px-2.5 py-1 text-micro ${
                  entry.module === selectedModule
                    ? "border-primary bg-accent-soft"
                    : "border-border bg-surface"
                }`}
              >
                <button
                  type="button"
                  className="font-semibold hover:underline"
                  onClick={() => setSelectedModule(entry.module)}
                  disabled={disabled}
                >
                  {moduleLabel.get(entry.module) ?? entry.module}
                </button>
                <span className="text-subdued">
                  {entry.roles.length} role{entry.roles.length === 1 ? "" : "s"} · {activeCount} active
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${moduleLabel.get(entry.module) ?? entry.module}`}
                  className="text-subdued hover:text-danger"
                  onClick={() => removeModule(entry.module)}
                  disabled={disabled}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      <Select
        id="employee-module"
        label="Module"
        value={selectedModule}
        disabled={disabled || modulesLoading}
        placeholder={modulesLoading ? "Loading modules…" : "Select a module"}
        options={modules.map((module) => ({ value: module.key, label: module.label }))}
        onChange={(event) => setSelectedModule(event.target.value)}
      />

      {selectedModule ? (
        <div className="rounded-control border border-border">
          {rolesLoading ? (
            <p className="flex items-center gap-2 p-3 text-small text-subdued">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading roles…
            </p>
          ) : rolesError ? (
            <p className="p-3 text-small text-danger">{rolesError}</p>
          ) : roles.length === 0 ? (
            <p className="p-3 text-small text-subdued">No roles are defined for this module.</p>
          ) : (
            <ul className="divide-y divide-border">
              {roles.map((role) => {
                const assignment = current?.roles.find((entry) => entry.role === role.key);
                const assigned = Boolean(assignment);
                const active = assignment?.active ?? false;
                return (
                  <li key={role.key} className="flex items-center justify-between gap-3 px-3 py-2">
                    <label className="flex min-w-0 cursor-pointer items-center gap-2 text-small">
                      <input
                        type="checkbox"
                        checked={assigned}
                        disabled={disabled}
                        onChange={() => toggleAssigned(role.key)}
                        className="size-4 accent-primary"
                      />
                      <span className="truncate">{role.label}</span>
                      {role.access ? (
                        <span className="text-micro text-subdued">· {role.access}</span>
                      ) : null}
                    </label>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={active}
                      aria-label={`${role.label} ${active ? "active" : "inactive"}`}
                      disabled={disabled || !assigned}
                      onClick={() => toggleActive(role.key)}
                      className="inline-flex flex-none items-center gap-2 text-micro text-subdued disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="w-12 text-right">{active ? "Active" : "Inactive"}</span>
                      <span
                        aria-hidden="true"
                        className={`relative h-5 w-9 rounded-full transition-colors ${
                          active ? "bg-primary" : "bg-border"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left] ${
                            active ? "left-[18px]" : "left-0.5"
                          }`}
                        />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {error ? <p className="text-micro text-danger">{error}</p> : null}
    </fieldset>
  );
}
