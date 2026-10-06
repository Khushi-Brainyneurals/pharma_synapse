import { AlertCircle, Lock, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import {
  createEmployee,
  getAssignableRoles,
  ROLE_LABELS,
  type TempPasswordResponse,
} from "../api/employees.api";
import { StepUpModal } from "./StepUpModal";

const ALL_ROLES = ["preparer", "reviewer_qa", "reviewer_pr", "approvedby", "admin", "superadmin"];

interface CreateEmployeeDrawerProps {
  onCancel: () => void;
  onCreated: (response: TempPasswordResponse) => void | Promise<void>;
}

/**
 * Add employee — screen #9, a drawer over the dimmed list.
 *
 * Roles an Admin cannot assign are SHOWN but disabled, labelled "Managed by the Super
 * Admin". Hiding them would leave an admin wondering whether the capability exists;
 * showing them greyed answers the question and names who can.
 *
 * Commit goes through step-up re-auth — see StepUpModal.
 */
export function CreateEmployeeDrawer({ onCancel, onCreated }: CreateEmployeeDrawerProps) {
  const [assignable, setAssignable] = useState<string[]>([]);
  const [form, setForm] = useState({
    username: "",
    name: "",
    role: "",
    department: "",
    designation: "",
    unit_id: "",
    unit_name: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stepUp, setStepUp] = useState(false);
  const [stepUpError, setStepUpError] = useState<string | null>(null);

  useEffect(() => {
    void getAssignableRoles().then(setAssignable).catch(() => setAssignable([]));
  }, []);

  /** Inline validation — every rule its own message, as the design specifies. */
  function validate(): boolean {
    const next: Record<string, string> = {};

    if (!form.username.trim()) {
      next.username = "User ID is required.";
    } else if (form.username.trim().length < 3) {
      next.username = "User ID must be at least 3 characters.";
    } else if (!/^[A-Za-z0-9._-]+$/.test(form.username.trim())) {
      next.username = "Use letters, numbers, dot, dash or underscore only.";
    }

    if (!form.role) {
      next.role = "Select a role.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function commit(password: string) {
    setStepUpError(null);

    try {
      const payload = {
        ...Object.fromEntries(
          Object.entries(form).filter(([, value]) => value.trim() !== ""),
        ),
        username: form.username.trim(),
        role: form.role,
        step_up_password: password,
      } as Parameters<typeof createEmployee>[0];

      await onCreated(await createEmployee(payload));
    } catch (caught) {
      setStepUpError(getApiErrorMessage(caught, "Could not create this employee."));
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex justify-end"
        style={{ background: "var(--scrim)" }}
        onClick={(event) => {
          if (event.target === event.currentTarget) onCancel();
        }}
      >
        <aside
          className="flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Add employee"
        >
          <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 className="text-h2 font-semibold">Add employee</h2>
              <p className="mt-1 text-small text-subdued">
                The User ID is unique and immutable — every audit entry hangs on it.
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Cancel"
              className="shrink-0 rounded-sm p-1 text-subdued transition hover:bg-sunken"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            <Field label="User ID" required error={errors.username}>
              <input
                type="text"
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                placeholder="E-1042"
                className={`${controlClass} font-mono ${
                  errors.username ? "border-danger" : ""
                }`}
              />
            </Field>

            <Field label="Full name">
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className={controlClass}
              />
            </Field>

            <Field label="Role" required error={errors.role}>
              <div className="mt-1.5 space-y-1.5">
                {ALL_ROLES.map((role) => {
                  const canAssign = assignable.includes(role);

                  return (
                    <label
                      key={role}
                      className={`flex items-center gap-2.5 rounded-control border px-3 py-2 text-small transition ${
                        form.role === role
                          ? "border-primary bg-accent-soft"
                          : "border-border bg-surface"
                      } ${canAssign ? "cursor-pointer hover:bg-sunken" : "cursor-not-allowed opacity-60"}`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={role}
                        checked={form.role === role}
                        disabled={!canAssign}
                        onChange={() => setForm({ ...form, role })}
                        className="size-4 shrink-0 text-primary focus:ring-primary"
                      />
                      <span className="flex-1 font-medium">{ROLE_LABELS[role]}</span>

                      {!canAssign ? (
                        <span className="inline-flex items-center gap-1 text-micro text-subdued">
                          <Lock className="size-3" aria-hidden="true" />
                          Managed by the Super Admin
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Department">
                <input
                  type="text"
                  value={form.department}
                  onChange={(event) => setForm({ ...form, department: event.target.value })}
                  className={controlClass}
                />
              </Field>
              <Field label="Designation">
                <input
                  type="text"
                  value={form.designation}
                  onChange={(event) => setForm({ ...form, designation: event.target.value })}
                  className={controlClass}
                />
              </Field>
              <Field label="Unit">
                <input
                  type="text"
                  value={form.unit_id}
                  onChange={(event) => setForm({ ...form, unit_id: event.target.value })}
                  placeholder="Unit-02"
                  className={`${controlClass} font-mono`}
                />
              </Field>
              <Field label="Unit name">
                <input
                  type="text"
                  value={form.unit_name}
                  onChange={(event) => setForm({ ...form, unit_name: event.target.value })}
                  className={controlClass}
                />
              </Field>
            </div>

            {/* On and locked — the admin must not be able to skip it. */}
            <div className="flex items-start gap-2 rounded-control border border-border bg-sunken p-3">
              <input
                type="checkbox"
                checked
                disabled
                readOnly
                className="mt-0.5 size-4 shrink-0"
                aria-label="Must change password at first sign-in"
              />
              <div>
                <p className="text-small font-medium">
                  Must change password at first sign-in
                </p>
                <p className="mt-0.5 text-micro text-subdued">
                  Always on. A one-time password is generated — you never choose it, so
                  nothing this user does is deniable.
                </p>
              </div>
            </div>
          </div>

          <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
            <button
              type="button"
              onClick={onCancel}
              className="h-[36px] rounded-control px-4 text-small font-semibold text-subdued transition hover:bg-sunken"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (validate()) setStepUp(true);
              }}
              className="h-[36px] rounded-control bg-primary px-4 text-small font-semibold text-white transition hover:bg-primary-dark"
            >
              Create employee
            </button>
          </footer>
        </aside>
      </div>

      {stepUp ? (
        <StepUpModal
          action="create this user"
          subject={`${form.username} · ${ROLE_LABELS[form.role] ?? form.role}`}
          error={stepUpError}
          onCancel={() => {
            setStepUp(false);
            setStepUpError(null);
          }}
          onConfirm={(password) => commit(password)}
        />
      ) : null}
    </>
  );
}

const controlClass =
  "mt-1.5 h-[36px] w-full rounded-control border border-border-strong bg-surface px-3 text-small focus:border-primary focus:outline-none";

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-small font-semibold">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1 flex items-center gap-1 text-micro text-danger">
          <AlertCircle className="size-3" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
