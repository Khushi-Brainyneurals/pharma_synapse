import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { Dialog } from "../../../shared/ui/Dialog";
import { PasswordInput } from "../../../shared/ui/PasswordInput";
import { changeEmployeePassword } from "../api/employees.api";

interface ChangePasswordDialogProps {
  employeeId: string;
  employeeLabel?: string;
  isAdminAction?: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function ChangePasswordDialog({
  employeeId,
  employeeLabel,
  isAdminAction = false,
  onClose,
  onChanged,
}: ChangePasswordDialogProps) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function validate() {
    const next: Record<string, string> = {};
    if (!oldPassword) next.oldPassword = "Current password is required by the API.";
    if (!newPassword) next.newPassword = "Enter a new password.";
    if (!confirmPassword) next.confirmPassword = "Confirm the new password.";
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      next.confirmPassword = "The passwords do not match.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (isSaving || !validate()) return;

    setIsSaving(true);
    setRequestError(null);
    try {
      await changeEmployeePassword(employeeId, {
        old_password: oldPassword,
        new_password: newPassword,
      });
      onChanged();
    } catch (caught) {
      setRequestError(getApiErrorMessage(caught, "Could not change the password."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog title="Change password" busy={isSaving} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-panel border border-border bg-sunken p-3 text-small text-subdued">
          Changing password for <span className="font-semibold text-text">{employeeLabel ?? employeeId}</span>.
          {isAdminAction ? (
            <p className="mt-1">
              The backend contract requires <code>old_password</code> but does not state whose
              password an administrator must enter. Enter the credential required by your backend.
            </p>
          ) : (
            <p className="mt-1">The backend enforces the employee 90-day eligibility rule.</p>
          )}
        </div>

        {requestError ? (
          <p className="rounded-panel border border-danger/30 bg-danger-soft p-3 text-small text-danger">
            {requestError}
          </p>
        ) : null}

        <PasswordInput
          id="change-current-password"
          label={isAdminAction ? "Old password (required by backend)" : "Current password"}
          required
          autoComplete="current-password"
          value={oldPassword}
          error={errors.oldPassword}
          onChange={(event) => {
            setOldPassword(event.target.value);
            setErrors((current) => ({ ...current, oldPassword: "" }));
          }}
        />
        <PasswordInput
          id="change-new-password"
          label="New password"
          required
          autoComplete="new-password"
          value={newPassword}
          error={errors.newPassword}
          onChange={(event) => {
            setNewPassword(event.target.value);
            setErrors((current) => ({ ...current, newPassword: "" }));
          }}
        />
        <PasswordInput
          id="change-confirm-password"
          label="Confirm new password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          error={errors.confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            setErrors((current) => ({ ...current, confirmPassword: "" }));
          }}
        />

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
            Change password
          </button>
        </div>
      </form>
    </Dialog>
  );
}
