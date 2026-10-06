import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Identifier } from "../../../shared/ui/Identifier";
import type { NewCorrection } from "../api/corrections.api";

export interface CorrectionTarget {
  /** "BOM · Dry mixing · Sr 01 · Qty" */
  target: string;
  target_kind: "cover" | "bom";
  target_key?: string | null;
  row_index?: number | null;
  current_value?: string | null;
}

interface CorrectionDialogProps {
  target: CorrectionTarget;
  onCancel: () => void;
  onAdd: (correction: NewCorrection) => Promise<void> | void;
}

/**
 * "Add correction" — screen #20, state 03.
 *
 * The author clicks a field; this captures the field reference, what it should say,
 * and WHY. The reason is mandatory: a correction without one records that someone
 * disagreed but not what they knew, which is useless to an auditor.
 */
export function CorrectionDialog({ target, onCancel, onAdd }: CorrectionDialogProps) {
  const [proposed, setProposed] = useState("");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Escape must always get you out of a dialog.
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const canAdd = reason.trim().length > 0 && !isSaving;

  async function add() {
    setIsSaving(true);

    try {
      await onAdd({
        target: target.target,
        target_kind: target.target_kind,
        target_key: target.target_key ?? null,
        row_index: target.row_index ?? null,
        current_value: target.current_value ?? null,
        proposed_value: proposed.trim() || null,
        reason: reason.trim(),
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--scrim)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Add correction"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-modal border border-border bg-surface shadow-modal">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-h3 font-semibold">Add correction</h2>
            {/* The field reference is an identifier — mono, per the DS. */}
            <p className="mt-1 truncate text-small text-subdued">
              <Identifier>{target.target}</Identifier>
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

        <div className="space-y-4 px-5 py-4">
          {target.current_value ? (
            <div>
              <p className="text-overline font-semibold uppercase tracking-overline text-subdued">
                Current value
              </p>
              <p className="mt-1 text-small">
                <Identifier>{target.current_value}</Identifier>
              </p>
            </div>
          ) : null}

          <div>
            <label
              htmlFor="proposed"
              className="text-overline font-semibold uppercase tracking-overline text-subdued"
            >
              Proposed value
            </label>
            <input
              id="proposed"
              type="text"
              value={proposed}
              onChange={(event) => setProposed(event.target.value)}
              placeholder="e.g. Store below 30 °C"
              className={inputClass}
            />
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
              ref={reasonRef}
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Aligns to approved stability statement"
              className={inputClass}
            />
            <p className="mt-1 text-micro text-subdued">
              Required. A correction without a reason cannot be audited.
            </p>
          </div>
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
            onClick={() => void add()}
            disabled={!canAdd}
            className="h-[34px] rounded-control bg-primary px-3.5 text-small font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
          >
            Add
          </button>
        </footer>
      </div>
    </div>
  );
}

const inputClass =
  "mt-1.5 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-small focus:border-primary focus:outline-none";
