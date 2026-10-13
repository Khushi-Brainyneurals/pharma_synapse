import { Loader2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { Dialog } from "../../../shared/ui/Dialog";
import { Input } from "../../../shared/ui/Input";
import { PasswordInput } from "../../../shared/ui/PasswordInput";
import { LOGIN_ROLE_OPTIONS } from "../../auth/model/roles";
import {
  createEmployee,
  updateEmployee,
  type Employee,
  type EmployeeCreate,
  type EmployeeUpdate,
} from "../api/employees.api";

interface EmployeeFormDialogProps {
  employee?: Employee;
  onClose: () => void;
  onSaved: (message: string) => Promise<void> | void;
}

interface FormState {
  user_id: string;
  roles: string[];
  department: string;
  unit: string;
  address_id: string;
  password: string;
  status: string;
}

export function EmployeeFormDialog({ employee, onClose, onSaved }: EmployeeFormDialogProps) {
  const isEditing = Boolean(employee);
  const [form, setForm] = useState<FormState>(() => ({
    user_id: employee?.user_id ?? "",
    roles: employee?.roles ?? [],
    department: employee?.department ?? "",
    unit: employee?.unit ?? "",
    address_id: employee ? String(employee.address_id) : "",
    password: "",
    status: employee?.status ?? "active",
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const roleOptions = useMemo(() => {
    const known = new Set<string>(LOGIN_ROLE_OPTIONS.map((option) => option.value));
    const extra = form.roles
      .filter((role) => !known.has(role))
      .map((role) => ({ value: role, label: role }));
    return [...LOGIN_ROLE_OPTIONS, ...extra];
  }, [form.roles]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function toggleRole(role: string) {
    set(
      "roles",
      form.roles.includes(role)
        ? form.roles.filter((value) => value !== role)
        : [...form.roles, role],
    );
  }

  function validate() {
    const next: typeof errors = {};
    if (!form.user_id.trim()) next.user_id = "User ID is required.";
    if (form.roles.length === 0) next.roles = "Select at least one role.";
    if (!form.department.trim()) next.department = "Department is required.";
    if (!form.unit.trim()) next.unit = "Unit is required.";
    if (!/^\d+$/.test(form.address_id)) next.address_id = "Enter a numeric address ID.";
    if (!isEditing && !form.password) next.password = "Password is required.";
    if (!form.status.trim()) next.status = "Status is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (isSaving || !validate()) return;

    setIsSaving(true);
    setRequestError(null);
    const common: EmployeeUpdate = {
      user_id: form.user_id.trim(),
      roles: form.roles,
      department: form.department.trim(),
      unit: form.unit.trim(),
      address_id: Number(form.address_id),
      status: form.status.trim(),
    };

    try {
      if (employee) {
        // The route key stays the original ID even when user_id is edited in the payload.
        await updateEmployee(employee.user_id, common);
        await onSaved(`Employee ${common.user_id} updated.`);
      } else {
        await createEmployee({ ...common, password: form.password } as EmployeeCreate);
        await onSaved(`Employee ${common.user_id} added.`);
      }
    } catch (caught) {
      setRequestError(
        getApiErrorMessage(
          caught,
          isEditing ? "Could not update this employee." : "Could not add this employee.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      title={isEditing ? `Edit ${employee?.user_id}` : "Add employee"}
      busy={isSaving}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-5">
        {requestError ? (
          <p className="rounded-panel border border-danger/30 bg-danger-soft p-3 text-small text-danger">
            {requestError}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="employee-user-id"
            label="User ID"
            required
            value={form.user_id}
            error={errors.user_id}
            onChange={(event) => set("user_id", event.target.value)}
            autoComplete="off"
          />
          <Input
            id="employee-status"
            label="Status"
            required
            value={form.status}
            error={errors.status}
            onChange={(event) => set("status", event.target.value)}
          />
          <Input
            id="employee-department"
            label="Department"
            required
            value={form.department}
            error={errors.department}
            onChange={(event) => set("department", event.target.value)}
          />
          <Input
            id="employee-unit"
            label="Unit"
            required
            value={form.unit}
            error={errors.unit}
            onChange={(event) => set("unit", event.target.value)}
          />
          <Input
            id="employee-address-id"
            label="Address ID"
            required
            type="number"
            min="0"
            step="1"
            value={form.address_id}
            error={errors.address_id}
            onChange={(event) => set("address_id", event.target.value)}
          />
          {!isEditing ? (
            <PasswordInput
              id="employee-password"
              label="Password"
              required
              value={form.password}
              error={errors.password}
              onChange={(event) => set("password", event.target.value)}
              autoComplete="new-password"
            />
          ) : null}
        </div>

        <fieldset>
          <legend className="text-small font-semibold">
            Roles <span className="text-danger">*</span>
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {roleOptions.map((role) => (
              <label
                key={role.value}
                className={`flex cursor-pointer items-center gap-2 rounded-control border px-3 py-2 text-small ${
                  form.roles.includes(role.value)
                    ? "border-primary bg-accent-soft"
                    : "border-border bg-surface"
                }`}
              >
                <input
                  type="checkbox"
                  checked={form.roles.includes(role.value)}
                  onChange={() => toggleRole(role.value)}
                  className="size-4 accent-primary"
                />
                {role.label}
              </label>
            ))}
          </div>
          {errors.roles ? <p className="mt-1 text-micro text-danger">{errors.roles}</p> : null}
        </fieldset>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="h-9 rounded-control px-4 text-small font-semibold text-subdued hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex h-9 items-center gap-2 rounded-control bg-primary px-4 text-small font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {isEditing ? "Save changes" : "Add employee"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
