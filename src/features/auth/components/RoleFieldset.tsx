import type { UseFormRegisterReturn } from "react-hook-form";
import { labelClass } from "../../../shared/ps/Field";
import { Radio } from "../../../shared/ps/Radio";
import { LOGIN_ROLE_LABELS, type LoginRoleGroup } from "../model/loginRoles";

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
                <Radio key={role} {...field} value={role} label={LOGIN_ROLE_LABELS[role] ?? role} disabled={disabled} />
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
