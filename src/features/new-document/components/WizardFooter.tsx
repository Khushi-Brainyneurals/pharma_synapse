import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

interface WizardFooterProps {
  onBack?: () => void;
  backLabel?: string;
  onNext?: () => void;
  nextLabel?: string;
  isNextDisabled?: boolean;
  isBusy?: boolean;
  /** Shown next to the buttons — why Next is unavailable, or what happens next. */
  hint?: string;
}

/** The Back / Next bar every wizard step shares, so navigation is in one place. */
export function WizardFooter({
  onBack,
  backLabel = "Back",
  onNext,
  nextLabel = "Continue",
  isNextDisabled = false,
  isBusy = false,
  hint,
}: WizardFooterProps) {
  return (
    <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t bg-surface p-3.5 shadow-auth">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={isBusy}
          className="inline-flex items-center gap-2 rounded-control border border-border px-4 py-2 text-small font-semibold transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {backLabel}
        </button>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-3">
        {hint ? <p className="text-small text-subdued">{hint}</p> : null}

        {onNext ? (
          <button
            type="button"
            onClick={onNext}
            disabled={isNextDisabled || isBusy}
            className="inline-flex items-center gap-2 rounded-control bg-primary px-4 py-2 text-small font-semibold text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBusy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {nextLabel}
            {!isBusy ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
          </button>
        ) : null}
      </div>
    </div>
  );
}
