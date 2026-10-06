import { Info } from "lucide-react";
import type { DocumentOption } from "../model/documentSelector.types";

interface SelectionSummaryProps {
  dosageForm?: DocumentOption;
  documentType?: DocumentOption;
  isCreating: boolean;
}

export function SelectionSummary({
  dosageForm,
  documentType,
  isCreating,
}: SelectionSummaryProps) {
  const hasSelection = Boolean(dosageForm && documentType);
  const message = isCreating
    ? "Creating document draft..."
    : hasSelection
      ? `You're creating: ${dosageForm?.label} · ${documentType?.label}`
      : "Select a dosage form and document type to continue";

  return (
    <div className="flex items-start gap-3 rounded-control border border-border bg-muted px-4 py-3 text-small text-subdued">
      <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <p className="font-medium">{message}</p>
    </div>
  );
}
