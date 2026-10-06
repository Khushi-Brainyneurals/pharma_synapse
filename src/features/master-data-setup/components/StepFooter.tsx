import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * The bottom bar every step shares: an autosave/progress note on the left and Back /
 * Continue on the right. Continue can be gated (disabled with the reason inline) while a
 * step is incomplete — matching the "Continue unlocks at N/N" rule.
 */
export function StepFooter({
  note,
  backTo,
  backLabel,
  continueTo,
  continueLabel,
  disabled,
  disabledReason,
}: {
  note?: React.ReactNode;
  backTo?: string;
  backLabel?: string;
  continueTo: string;
  continueLabel: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-micro text-subdued">{note}</p>
      <div className="flex items-center gap-3">
        {disabled && disabledReason ? (
          <span className="hidden text-micro text-subdued sm:block">{disabledReason}</span>
        ) : null}
        {backTo ? (
          <Link
            to={backTo}
            className="inline-flex h-9 items-center gap-1.5 rounded-control border border-border px-3 text-small font-semibold text-subdued transition hover:bg-muted"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {backLabel ?? "Back"}
          </Link>
        ) : null}
        {disabled ? (
          <span
            className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-control bg-primary/40 px-4 text-small font-semibold text-white"
            aria-disabled="true"
            title={disabledReason}
          >
            {continueLabel}
            <ArrowRight className="size-4" aria-hidden="true" />
          </span>
        ) : (
          <Link
            to={continueTo}
            className="inline-flex h-9 items-center gap-1.5 rounded-control bg-primary px-4 text-small font-semibold text-white transition hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {continueLabel}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}
