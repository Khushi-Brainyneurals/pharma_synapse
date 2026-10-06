import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Identifier } from "../../../shared/ui/Identifier";
import { useAuthStore } from "../../auth/state/auth.store";

interface StepUpModalProps {
  /** What is about to happen, in the user's words: "create this user". */
  action: string;
  /** Who or what it happens to: "E-1042 · Reviewer QA". */
  subject?: string;
  /** Set when the action also needs a reason — disable, edit. */
  reasonLabel?: string;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (password: string, reason: string) => Promise<void> | void;
}

/**
 * Step-up re-authentication — screen #9.
 *
 * The admin re-enters their OWN password before any act that changes another person's
 * access. Without it an unattended session is enough to mint or disable an account, and
 * the audit entry would name an admin who wasn't there. This is the non-repudiation
 * control, not a confirmation dialog — the password is the point.
 */
export function StepUpModal({
  action,
  subject,
  reasonLabel,
  error,
  onCancel,
  onConfirm,
}: StepUpModalProps) {
  const user = useAuthStore((state) => state.user);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const canConfirm =
    password.length > 0 && (!reasonLabel || reason.trim().length > 0) && !isBusy;

  async function confirm() {
    setIsBusy(true);
    try {
      await onConfirm(password, reason.trim());
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--scrim)" }}
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-modal border border-border bg-surface shadow-modal">
        <header className="border-b border-border px-5 py-4">
          <p className="flex items-center gap-1.5 text-overline font-semibold uppercase tracking-overline text-subdued">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Step-up re-auth
          </p>
          <h2 className="mt-1.5 text-h3 font-semibold">
            Re-enter your password to {action}
          </h2>
          {subject ? (
            <p className="mt-1 text-small text-subdued">
              <Identifier>{subject}</Identifier>
            </p>
          ) : null}
        </header>

        <div className="space-y-4 px-5 py-4">
          {error ? (
            <div className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger-soft p-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
              <p className="text-small text-danger">{error}</p>
            </div>
          ) : null}

          {reasonLabel ? (
            <div>
              <label
                htmlFor="stepup-reason"
                className="text-overline font-semibold uppercase tracking-overline text-subdued"
              >
                {reasonLabel} <span className="text-danger">*</span>
              </label>
              <textarea
                id="stepup-reason"
                rows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className={controlClass}
              />
              <p className="mt-1 text-micro text-subdued">
                Goes on the record. Required.
              </p>
            </div>
          ) : null}

          <div>
            <label
              htmlFor="stepup-password"
              className="text-overline font-semibold uppercase tracking-overline text-subdued"
            >
              Your password <span className="text-danger">*</span>
            </label>
            <input
              id="stepup-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canConfirm) void confirm();
              }}
              className={controlClass}
            />
          </div>

          <p className="text-micro text-subdued">
            Signing as{" "}
            <Identifier>
              {user?.username}
              {user?.displayName ? ` · ${user.displayName}` : null}
            </Identifier>
          </p>
        </div>

        <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="h-[34px] rounded-control px-3.5 text-small font-semibold text-subdued transition hover:bg-sunken"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={!canConfirm}
            className="inline-flex h-[34px] items-center gap-1.5 rounded-control bg-primary px-3.5 text-small font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
          >
            {isBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Confirm
          </button>
        </footer>
      </div>
    </div>
  );
}

const controlClass =
  "mt-1.5 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-small focus:border-primary focus:outline-none";
