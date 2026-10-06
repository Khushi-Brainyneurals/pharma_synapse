import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export interface FieldChange {
  label: string;
  from: string;
  to: string;
}

interface ReasonForChangeModalProps {
  changes: FieldChange[];
  error?: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

/**
 * Reason-for-change — screen #10, File B.
 *
 * Editing a letterhead that is already in use alters what prints on every future
 * document. That is a controlled change, so it shows a before → after diff and demands a
 * reason before it commits. First-time setup never sees this dialog — only an effective
 * letterhead does.
 */
export function ReasonForChangeModal({
  changes,
  error,
  onCancel,
  onConfirm,
}: ReasonForChangeModalProps) {
  const [reason, setReason] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  async function confirm() {
    setIsBusy(true);
    try {
      await onConfirm(reason.trim());
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
          <h2 className="text-h3 font-semibold">Editing an effective letterhead</h2>
          <p className="mt-1 text-small text-subdued">
            This changes what prints on every future document.
          </p>
        </header>

        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="text-overline font-semibold uppercase tracking-overline text-subdued">
              What is changing
            </p>
            <ul className="mt-2 space-y-1.5">
              {changes.map((change) => (
                <li key={change.label} className="text-small">
                  <span className="font-medium">{change.label}:</span>{" "}
                  <span className="text-subdued line-through">{change.from || "—"}</span>
                  <span className="mx-1.5 text-subdued">→</span>
                  <span className="font-semibold">{change.to || "—"}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label
              htmlFor="reason"
              className="text-overline font-semibold uppercase tracking-overline text-subdued"
            >
              Reason for change <span className="text-danger">*</span>
            </label>
            <textarea
              id="reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Brand refresh — new logo per marketing SOP"
              className="mt-1.5 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-small focus:border-primary focus:outline-none"
            />
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger-soft p-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
              <p className="text-small text-danger">{error}</p>
            </div>
          ) : null}
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
            disabled={reason.trim().length === 0 || isBusy}
            className="inline-flex h-[34px] items-center gap-1.5 rounded-control bg-primary px-3.5 text-small font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
          >
            {isBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Confirm &amp; save
          </button>
        </footer>
      </div>
    </div>
  );
}
