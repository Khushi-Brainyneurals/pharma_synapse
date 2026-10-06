import { Check, Circle } from "lucide-react";
import type { DocumentStep } from "../model/documentSelector.types";

interface DocumentStepperProps {
  steps: DocumentStep[];
  activeStepId: string;
  /**
   * Step ids the user has already completed (from the document's server state).
   * These become clickable — a ticked step jumps back to that step, with the data
   * that was saved there.
   */
  completedStepIds?: string[];
  onStepClick?: (stepId: string) => void;
}

export function DocumentStepper({
  steps,
  activeStepId,
  completedStepIds = [],
  onStepClick,
}: DocumentStepperProps) {
  const activeIndex = steps.findIndex((step) => step.id === activeStepId);
  const completed = new Set(completedStepIds);

  return (
    <div aria-label="Document creation progress">
      <ol className="hidden items-center gap-2 md:flex">
        {steps.map((step, index) => {
          const isActive = step.id === activeStepId;
          // Green = you've walked past it. In a linear wizard every step BEFORE the
          // current one is done, regardless of the coarse document status — Preview,
          // for instance, has no status of its own, so a status-only check left it
          // white even after you'd moved on. Position is the source of truth here; the
          // server's completed_steps is kept as an extra allow-list for direct links.
          const isComplete =
            !isActive && (index < activeIndex || completed.has(step.id));
          const isNavigable = Boolean(onStepClick) && isComplete;

          const marker = (
            <>
              <span
                className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-small font-semibold transition ${
                  isActive || isComplete
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-muted text-subdued"
                } ${isNavigable ? "group-hover:opacity-80" : ""}`}
                aria-current={isActive ? "step" : undefined}
              >
                {isComplete ? <Check className="size-3.5" strokeWidth="3.5" aria-hidden="true" /> : index + 1}
              </span>
              <span
                className={`truncate text-micro font-medium ${
                  isActive ? "text-primary-dark" : "text-subdued"
                } ${isNavigable ? "group-hover:text-primary-dark group-hover:underline" : ""}`}
              >
                {step.label}
              </span>
            </>
          );

          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-center gap-2">
              {isNavigable ? (
                <button
                  type="button"
                  onClick={() => onStepClick?.(step.id)}
                  title={`Back to ${step.label}`}
                  className="group flex min-w-0 items-center gap-2 rounded-control focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  {marker}
                </button>
              ) : (
                <span className="flex min-w-0 items-center gap-2">{marker}</span>
              )}

              {index < steps.length - 1 ? (
                <span className="h-px min-w-3 flex-1 bg-border" aria-hidden="true" />
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="flex items-center gap-3 rounded-control border border-border bg-muted px-3 py-2 md:hidden">
        <Circle className="size-4 fill-primary text-primary" aria-hidden="true" />
        <span className="text-small font-semibold text-text">
          Step {activeIndex >= 0 ? activeIndex + 1 : 1} of {steps.length}
        </span>
        <span className="text-small text-subdued">
          {steps[activeIndex]?.label ?? steps[0]?.label ?? "Step"}
        </span>
      </div>
    </div>
  );
}
