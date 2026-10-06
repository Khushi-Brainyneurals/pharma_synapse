import { Lock } from "lucide-react";
import { DOCUMENT_TYPE_OPTIONS, DOSAGE_FORM_OPTIONS } from "../model/documentSelector.config";

function dosageLabel(value?: string | null): string {
  const found = DOSAGE_FORM_OPTIONS.find((o) => o.backendValue === value)?.label;
  return found ?? (value ? value.charAt(0).toUpperCase() + value.slice(1) : "—");
}
function docLabel(value?: string | null): string {
  const opt = DOCUMENT_TYPE_OPTIONS.find((o) => o.backendValue === value);
  return opt?.shortLabel ?? opt?.label ?? (value ? value.toUpperCase() : "—");
}

/**
 * The "Selection" band carried across the New-Document wizard from Core inputs onward:
 * the locked-in dosage form + document type, and — once it exists — the document's unique
 * ID. Reused by every step so the context never disappears as the user moves forward.
 */
export function SelectionStrip({
  dosageForm,
  docType,
  identifier,
}: {
  dosageForm?: string | null;
  docType?: string | null;
  /** The unique document ID (BMR no. / draft id). Omitted on steps that show it elsewhere. */
  identifier?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-y border-border bg-surface px-5 py-3 sm:px-6">
      <span className="text-micro font-semibold uppercase tracking-overline text-subdued">
        Selection
      </span>
      <span className="inline-flex items-center gap-2 rounded-pill border border-border bg-muted px-3 py-1.5 font-mono text-micro font-medium text-text">
        <Lock className="size-3.5 text-subdued" aria-hidden="true" />
        Dosage form: {dosageLabel(dosageForm)} - Document: {docLabel(docType)}
      </span>
      {identifier ? (
        <span
          className="inline-flex items-center gap-1.5 rounded-pill border border-primary/25 bg-accent-soft px-3 py-1.5 font-mono text-micro font-semibold text-primary-dark"
          title="Document unique ID"
        >
          {identifier}
        </span>
      ) : null}
      <span
        className="inline-flex items-center gap-2 rounded-pill border border-dashed border-border bg-surface px-3 py-1.5 text-micro text-subdued opacity-80"
        title="Planned for a future release. This version supports Tablet BMR only."
      >
        Other dosage forms - BPR - PV - not in this release
      </span>
    </div>
  );
}
