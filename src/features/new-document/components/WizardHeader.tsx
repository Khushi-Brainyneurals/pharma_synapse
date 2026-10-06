import { DocumentStepper } from "./DocumentStepper";
import { SelectionStrip } from "./SelectionStrip";
import { DOCUMENT_SELECTOR_STEPS } from "../model/documentSelector.config";

interface WizardHeaderProps {
  activeStepId: string;
  completedStepIds: string[];
  onStepClick: (stepId: string) => void;
  title: string;
  description?: string;
  /** Right-side reference pill — BMR number or short document id. */
  identifier?: string | null;
  /** Right-side lifecycle badge, e.g. "DRAFT". */
  status?: string | null;
  /** The selected dosage form + document type — shown in the Selection band. */
  dosageForm?: string | null;
  docType?: string | null;
}

/**
 * The top band every wizard step shares: the clickable stepper, then a "STEP n OF 7"
 * overline + title + description on the left and the document's reference/status badges
 * on the right — one panel, matching the designed screens.
 */
export function WizardHeader({
  activeStepId,
  completedStepIds,
  onStepClick,
  title,
  description,
  identifier,
  status,
  dosageForm,
  docType,
}: WizardHeaderProps) {
  const total = DOCUMENT_SELECTOR_STEPS.length;
  const stepNumber = DOCUMENT_SELECTOR_STEPS.findIndex((step) => step.id === activeStepId) + 1;

  return (
    <div className="rounded-panel bg-surface">
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <DocumentStepper
          steps={DOCUMENT_SELECTOR_STEPS}
          activeStepId={activeStepId}
          completedStepIds={completedStepIds}
          onStepClick={onStepClick}
        />
      </div>

      {/* The unique ID keeps its dedicated pill on the right, so it is left out of the strip here. */}
      <SelectionStrip dosageForm={dosageForm} docType={docType} />

      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
        <div className="min-w-0">
          {stepNumber > 0 ? (
            <p className="text-micro font-semibold uppercase tracking-overline text-primary">
              Step {stepNumber} of {total}
            </p>
          ) : null}
          <h1 className="mt-1 text-h1 font-semibold">{title}</h1>
          {description ? (
            <p className="mt-1.5 text-small text-subdued">{description}</p>
          ) : null}
        </div>

        {identifier || status ? (
          <div className="flex shrink-0 items-center gap-2">
            {identifier ? (
              <span className="rounded-pill border border-border bg-muted px-3 py-1 font-mono text-mono-sm text-subdued">
                {identifier}
              </span>
            ) : null}
            {status ? (
              <span className="rounded-pill bg-draft-bg px-3 py-1 text-micro font-semibold uppercase tracking-overline text-draft-fg">
                {status}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
