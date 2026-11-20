import type { UseFormRegisterReturn } from "react-hook-form";
import { labelClass } from "../../../shared/ps/Field";
import { Radio } from "../../../shared/ps/Radio";
import type { LoginRoleGroup } from "../model/loginRoles";

interface RoleFieldsetProps {
  groups: LoginRoleGroup[];
  field: UseFormRegisterReturn;
  error?: string;
  disabled?: boolean;
}

/** Role picker: "Work here" and "View only" groups of radios, two columns each. */
export function RoleFieldset({ groups, field, error, disabled }: RoleFieldsetProps) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className={`${labelClass} p-0`}>Role</legend>
      <div className="mt-2 flex flex-col gap-3.5 rounded-lg border border-border px-4 pb-4 pt-3.5">
        {groups.map((group, gi) => (
          <div key={group.key} role="group" aria-label={group.label} className="flex flex-col gap-3">
            {gi > 0 ? <div aria-hidden="true" className="-mx-4 mb-0.5 border-t border-border" /> : null}
            <span className="font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-text-2">{group.label}</span>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {group.roles.map((role) => (
                <Radio key={role.key} {...field} value={role.key} label={role.label} disabled={disabled} />
              ))}
            </div>
          </div>
        ))}
      </div>
      {error ? (
        <p role="alert" className="mb-0 mt-1.5 text-[12.5px] leading-[18px] text-danger-text">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** Keeps the role picker footprint steady while the module's roles are loading. */
export function RoleFieldsetSkeleton() {
  const skeletonGroup = (count: number, labelWidth: string, key: string) => (
    <div key={key} className="flex flex-col gap-3">
      {key === "view" ? <div aria-hidden="true" className="-mx-4 mb-0.5 border-t border-border" /> : null}
      <span className={`h-4 animate-pulse rounded bg-sunken ${labelWidth}`} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {Array.from({ length: count }, (_, index) => (
          <span key={index} className="inline-flex min-h-7 items-center gap-2.5" aria-hidden="true">
            <span className={`h-3.5 animate-pulse rounded bg-sunken ${index % 2 ? "w-24" : "w-20"}`} />
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0" aria-busy="true">
      <legend className={`${labelClass} p-0`}>Role</legend>
      <div className="mt-2 flex flex-col gap-3.5 rounded-lg border border-border px-4 pb-4 pt-3.5" role="status" aria-label="Loading available roles">
        <span className="sr-only">Loading available roles…</span>
        {skeletonGroup(4, "w-20", "work")}
        {skeletonGroup(3, "w-16", "view")}
      </div>
    </fieldset>
  );
}
