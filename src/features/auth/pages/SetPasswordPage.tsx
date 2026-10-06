import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ROUTES } from "../../../app/routing/routes";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { changeExpiredPassword } from "../../employees/api/employees.api";

const MIN_LENGTH = 8;

/**
 * Set a new password when the old one is expired or was issued by an admin.
 *
 * Reached from the login screen, which is where the user is told their password has
 * expired. They have no session here — login refuses an expired password — so this
 * posts the current (temporary) password alongside the new one.
 */
export function SetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = (location.state as { username?: string } | null)?.username ?? "";

  const [username, setUsername] = useState(prefill);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const tooShort = newPassword.length > 0 && newPassword.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== newPassword;
  const canSubmit =
    username.trim() !== "" &&
    currentPassword !== "" &&
    newPassword.length >= MIN_LENGTH &&
    confirm === newPassword &&
    !isSaving;

  async function submit() {
    setIsSaving(true);
    setError(null);

    try {
      await changeExpiredPassword(username.trim(), currentPassword, newPassword);
      setDone(true);
      window.setTimeout(() => navigate(ROUTES.login, { replace: true }), 1200);
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not set your password."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-text">
      <section className="w-full max-w-md rounded-panel border border-border bg-surface p-8 shadow-auth">
        <h1 className="text-h1 font-semibold">Set a new password</h1>
        <p className="mt-2 text-small text-subdued">
          Your password has expired, or an administrator issued you a temporary one. Set
          your own before signing in.
        </p>

        {done ? (
          <div className="mt-6 flex items-start gap-2 rounded-panel border border-primary/30 bg-primary/[0.04] p-4">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-small text-primary-dark">
              Password set. Taking you to sign in…
            </p>
          </div>
        ) : (
          <>
            {error ? (
              <div className="mt-5 flex items-start gap-2 rounded-panel border border-danger/30 bg-danger-soft p-3">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                <p className="text-small text-danger">{error}</p>
              </div>
            ) : null}

            <div className="mt-5 space-y-4">
              <Field label="User ID">
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  className={inputClass}
                />
              </Field>

              <Field label="Current / temporary password">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  className={inputClass}
                />
              </Field>

              <Field label={`New password (at least ${MIN_LENGTH} characters)`}>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  className={inputClass}
                />
                {tooShort ? (
                  <p className="mt-1 text-micro text-danger">
                    Must be at least {MIN_LENGTH} characters.
                  </p>
                ) : null}
              </Field>

              <Field label="Confirm new password">
                <input
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  autoComplete="new-password"
                  className={inputClass}
                />
                {mismatch ? (
                  <p className="mt-1 text-micro text-danger">These don&apos;t match.</p>
                ) : null}
              </Field>
            </div>

            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-control bg-primary px-4 py-2.5 text-small font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Set password
            </button>

            <button
              type="button"
              onClick={() => navigate(ROUTES.login)}
              className="mt-3 w-full text-small font-semibold text-subdued transition hover:text-text"
            >
              Back to sign in
            </button>
          </>
        )}
      </section>
    </main>
  );
}

const inputClass =
  "mt-1.5 w-full rounded-control border border-border bg-surface px-3 py-2 text-small focus:outline-none focus:ring-2 focus:ring-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-small font-semibold">{label}</label>
      {children}
    </div>
  );
}
