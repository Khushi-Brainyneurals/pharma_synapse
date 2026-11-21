import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { getApiErrorMessage } from "../../../../../shared/api/apiError";
import {
  getProcedureReferences,
  updateProcedureReferences,
} from "../api/procedureSampling.api";

export function ProcedureReferencesSection({
  documentId,
}: {
  documentId: string;
}) {
  const [references, setReferences] = useState<string[]>([]);
  const [savedReferences, setSavedReferences] = useState<string[]>([]);
  const [sectionNumber, setSectionNumber] = useState("");
  const [sectionTitle, setSectionTitle] = useState("References");
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [validationError, setValidationError] = useState("");
  const dirty = JSON.stringify(references) !== JSON.stringify(savedReferences);

  const loadReferences = useCallback(async () => {
    setIsLoading(true);
    setHasLoaded(false);
    setError(null);
    setSaveMessage("");
    setReferences([]);
    setSavedReferences([]);
    try {
      const result = await getProcedureReferences(documentId);
      const section = result.section;
      const paragraphs = Array.isArray(section?.content?.paragraphs)
        ? section.content.paragraphs.filter(
            (paragraph): paragraph is string => typeof paragraph === "string",
          )
        : [];
      setReferences(paragraphs);
      setSavedReferences(paragraphs);
      setSectionNumber(section?.number ?? "");
      setSectionTitle(section?.title?.trim() || "References");
      setValidationError("");
      setHasLoaded(true);
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Unable to load references."));
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    void loadReferences();
  }, [loadReferences]);

  function updateReference(index: number, value: string) {
    setReferences((current) =>
      current.map((reference, currentIndex) =>
        currentIndex === index ? value : reference,
      ),
    );
    setValidationError("");
    setSaveMessage("");
  }

  function addReference() {
    setReferences((current) => [...current, ""]);
    setValidationError("");
    setSaveMessage("");
  }

  function removeReference(index: number) {
    setReferences((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setValidationError("");
    setSaveMessage("");
  }

  async function saveReferences() {
    if (isSaving || !hasLoaded) return;
    const normalized = references.map((reference) => reference.trim());
    if (normalized.some((reference) => !reference)) {
      setValidationError("Enter text for each reference or remove the empty row before saving.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setValidationError("");
    setSaveMessage("");
    try {
      await updateProcedureReferences(documentId, normalized);
      setReferences(normalized);
      setSavedReferences(normalized);
      setSaveMessage("References saved.");
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Unable to save references. Check the entered values and try again."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section
      aria-label="References"
      className="mt-4 overflow-hidden rounded-card border border-border bg-surface shadow-sm"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-[13px] font-semibold">
            References
          </h2>
          <p className="mt-1 text-micro text-subdued">
            Add and maintain the references for this procedure.
          </p>
        </div>
        {sectionNumber && sectionTitle.toLowerCase() !== "references" ? (
          <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-micro text-subdued">
            References
          </span>
        ) : null}
      </header>

      <div className="p-4 sm:p-5">
        {error ? (
          <div role="alert" className="mb-4 rounded-control border border-danger/30 bg-danger/5 p-3 text-small text-danger">
            {error}
            <button type="button" className="ml-3 font-semibold underline" onClick={() => void loadReferences()}>
              Retry
            </button>
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-control border border-border bg-muted/30 p-6 text-center text-small text-subdued">
            Loading references…
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {references.length ? references.map((reference, index) => (
                <div key={index} className="flex items-start gap-2">
                  <label className="sr-only" htmlFor={`procedure-reference-${index}`}>
                    Reference {index + 1}
                  </label>
                  <input
                    id={`procedure-reference-${index}`}
                    type="text"
                    value={reference}
                    onChange={(event) => updateReference(index, event.target.value)}
                    placeholder={`Reference ${index + 1}`}
                    className="min-h-10 min-w-0 flex-1 rounded-control border border-border bg-surface px-3 py-2 text-small text-text focus:border-primary/50 focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label={`Remove reference ${index + 1}`}
                    title="Remove reference"
                    onClick={() => removeReference(index)}
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-control border border-border bg-surface text-subdued transition-colors hover:border-danger/30 hover:bg-danger-soft hover:text-danger-ink"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              )) : (
                <p className="rounded-control border border-dashed border-border px-3 py-5 text-center text-small text-subdued">
                  No references added yet.
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={!hasLoaded}
              onClick={addReference}
              className="mt-3 inline-flex items-center gap-1.5 rounded-control border border-primary-dark/30 bg-surface px-3 py-1.5 text-[12px] font-semibold text-primary-dark transition-colors hover:bg-primary-dark hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add reference
            </button>

            {validationError ? (
              <p role="alert" className="mt-3 text-small text-danger">{validationError}</p>
            ) : null}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-small text-subdued">
                {saveMessage || (dirty ? "Unsaved changes" : "All changes saved")}
              </p>
              <button
                type="button"
                disabled={!hasLoaded || !dirty || isSaving}
                onClick={() => void saveReferences()}
                className="rounded-control bg-primary px-4 py-2 text-small font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? "Saving…" : "Save references"}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
