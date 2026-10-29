import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AppHeader } from "../../../../../app/layout/AppHeader";
import { AppSidebar } from "../../../../../app/layout/AppSidebar";
import { useAuthStore } from "../../../../auth/state/auth.store";
import { getCoreInputs, getPvpSourceRecords, normalizePvpSourceMode } from "../../../selection/api/documents.api";
import type { CoreInputsResponse, PvpSourceRecord } from "../../../selection/api/documents.types";
import { DocumentStepper } from "../../../selection/components/DocumentStepper";
import { SelectionStrip } from "../../../selection/components/SelectionStrip";
import { useDocument } from "../../../selection/hooks/useDocument";
import { useDocumentSelectorData } from "../../../selection/hooks/useDocumentSelectorData";
import { useStepNavigation } from "../../../selection/hooks/useStepNavigation";
import { PVP_PVR_DOCUMENT_STEPS } from "../../../selection/model/documentSelector.config";

export function CoverDetailsPage() {
  const { documentId = "" } = useParams();
  const user = useAuthStore((state) => state.user);
  const { context, isLoading: isLoadingContext } = useDocumentSelectorData(user);
  const { document, isLoading: isLoadingDocument } = useDocument(documentId);
  const { goToStep } = useStepNavigation(documentId);
  const [coreInputs, setCoreInputs] = useState<CoreInputsResponse | null>(null);
  const [sourceRecord, setSourceRecord] = useState<PvpSourceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!documentId) return;
    setIsLoading(true);
    void getCoreInputs(documentId)
      .then(async (saved) => {
        if (cancelled) return;
        setCoreInputs(saved);
        const rawMode = document?.pvp_mode ?? saved?.pvp_mode;
        const configuredSourceOption = context?.pvpSourceOptions.find(
          (option) => option.key.trim().toLowerCase() === rawMode?.trim().toLowerCase(),
        );
        const mode = normalizePvpSourceMode(rawMode) || normalizePvpSourceMode(configuredSourceOption?.source_doc_type);
        if (!saved?.source_document_id || !mode) return;
        const records = await getPvpSourceRecords(mode);
        if (!cancelled) {
          setSourceRecord(records.find((record) => String(record.job_id) === saved.source_document_id) ?? null);
        }
      })
      .catch(() => { if (!cancelled) setError("Unable to load the selected source document details."); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [context?.pvpSourceOptions, document?.pvp_mode, documentId]);

  const details = [
    { label: "Product", value: sourceRecord?.product_name ?? sourceRecord?.product ?? "—" },
    { label: "Product code", value: sourceRecord?.product_code ?? "—" },
    { label: "Source document type", value: coreInputs?.source_doc_type?.toUpperCase() ?? "—" },
    { label: "Source document number", value: sourceRecord?.document_no ?? sourceRecord?.bmr_number ?? sourceRecord?.draft_id ?? coreInputs?.source_document_id ?? "—" },
    { label: "Batch size", value: sourceRecord?.batch_size != null ? String(sourceRecord.batch_size) : coreInputs?.batch_size == null ? "—" : String(coreInputs.batch_size) },
    { label: "Source version", value: sourceRecord?.version ?? "—" },
    { label: "Source status", value: sourceRecord?.status ?? "—" },
  ];

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader user={user} unit={context?.unit ?? null} isLoadingUnit={isLoadingContext} />
      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />
        <main className="min-w-0 sm:px-6 lg:h-full lg:overflow-y-auto lg:px-8">
          <section className="mx-auto rounded-panel bg-surface shadow-sm">
            <div className="p-5 sm:p-6">
              <DocumentStepper steps={PVP_PVR_DOCUMENT_STEPS} activeStepId="cover-details" onStepClick={goToStep} />
            </div>
            <SelectionStrip dosageForm={document?.dosage_form} docType={document?.doc_type} identifier={document?.bmr_number ?? document?.draft_id} />
            <div className="space-y-6 p-5 sm:p-6">
              <div>
                <p className="text-micro font-semibold uppercase tracking-overline text-primary">Step 3 of 7</p>
                <h1 className="mt-1 text-h1 font-semibold">Cover &amp; basic details</h1>
                <p className="mt-1.5 text-small text-subdued">Review product and batch details carried forward from the selected source document.</p>
              </div>

              {isLoading || isLoadingDocument ? <p className="text-small text-subdued" role="status">Loading source details…</p> : null}
              {error ? <div className="rounded-control border border-danger/20 bg-danger-soft px-4 py-3 text-small text-danger-ink" role="alert">{error}</div> : null}

              <dl className="grid gap-4 rounded-panel border border-border bg-muted p-5 sm:grid-cols-2">
                {details.map((item) => (
                  <div key={item.label}>
                    <dt className="text-micro font-semibold uppercase tracking-overline text-subdued">{item.label}</dt>
                    <dd className="mt-1 text-small font-medium text-text">{item.value}</dd>
                  </div>
                ))}
              </dl>

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between">
                <button type="button" className="rounded-control border border-border px-4 py-2 text-small font-semibold text-subdued" onClick={() => goToStep("select-document")}>Back</button>
                <button type="button" className="rounded-control bg-primary px-4 py-2 text-small font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={isLoading || isLoadingDocument || Boolean(error)} onClick={() => goToStep("process-bom")}>Continue to process flow &amp; BOM</button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
