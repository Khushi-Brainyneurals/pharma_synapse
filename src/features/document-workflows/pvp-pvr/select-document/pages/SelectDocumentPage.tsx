import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, RefreshCcw } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AppHeader } from "../../../../../app/layout/AppHeader";
import { AppSidebar } from "../../../../../app/layout/AppSidebar";
import { getPvpCoverDetailsRoute } from "../../../../../app/routing/routes";
import { getApiErrorMessage } from "../../../../../shared/api/apiError";
import { useAuthStore } from "../../../../auth/state/auth.store";
import { FileUploadCard } from "../../../shared/components/FileUploadCard";
import {
  getCoreInputs,
  getPvpSourceRecords,
  getSourceSlots,
  normalizePvpSourceMode,
  setCoreInputs as saveCoreInputs,
} from "../../../selection/api/documents.api";
import type {
  CoreInputsResponse,
  PvpSourceRecord,
  SetCoreInputsResponse,
  SourceSlot,
  SourceSlotsResponse,
} from "../../../selection/api/documents.types";
import { DocumentStepper } from "../../../selection/components/DocumentStepper";
import { SelectionStrip } from "../../../selection/components/SelectionStrip";
import { useDocument } from "../../../selection/hooks/useDocument";
import { useDocumentSelectorData } from "../../../selection/hooks/useDocumentSelectorData";
import { useStepNavigation } from "../../../selection/hooks/useStepNavigation";
import { PVP_PVR_DOCUMENT_STEPS } from "../../../selection/model/documentSelector.config";

type UploadSlot = {
  field: string;
  label: string;
  required: boolean;
  accept: string[];
  maxBytes: number;
  requiredWhen?: SourceSlot["required_when"];
};

export function SelectDocumentPage() {
  const { documentId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { context, isLoading: isLoadingContext } = useDocumentSelectorData(user);
  const { document, isLoading: isLoadingDocument } = useDocument(documentId);
  const [coreInputs, setCoreInputs] = useState<CoreInputsResponse | null>(null);
  const routeState = location.state as { pvpMode?: string | null } | null;
  const rawPvpMode = routeState?.pvpMode ?? document?.pvp_mode ?? coreInputs?.pvp_mode;
  const configuredSourceOption = context?.pvpSourceOptions.find(
    (option) => option.key.trim().toLowerCase() === rawPvpMode?.trim().toLowerCase(),
  );
  const pvpMode = normalizePvpSourceMode(rawPvpMode) || normalizePvpSourceMode(configuredSourceOption?.source_doc_type);
  const { goToStep } = useStepNavigation(documentId);
  const [sourceSlots, setSourceSlots] = useState<SourceSlotsResponse | null>(null);
  const [sourceRecords, setSourceRecords] = useState<PvpSourceRecord[]>([]);
  const [selectedSourceRecord, setSelectedSourceRecord] = useState<PvpSourceRecord | null>(null);
  const [isSourceListOpen, setIsSourceListOpen] = useState(false);
  const [sourceSearch, setSourceSearch] = useState("");
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [sourceDocumentId, setSourceDocumentId] = useState("");
  const [buAvailable, setBuAvailable] = useState<boolean | null>(null);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [fileIssues, setFileIssues] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState<SetCoreInputsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!documentId) return;
    setIsLoading(true);
    Promise.all([getSourceSlots(documentId), getCoreInputs(documentId)])
      .then(([slots, saved]) => {
        if (cancelled) return;
        setSourceSlots(slots);
        setCoreInputs(saved);
        setSourceDocumentId(saved?.source_document_id ?? "");
        setBuAvailable(saved?.bu_available ?? null);
        setError(null);
      })
      .catch((requestError) => {
        if (!cancelled) setError(getApiErrorMessage(requestError, "Unable to load document requirements."));
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [documentId]);

  useEffect(() => {
    let cancelled = false;
    const mode = pvpMode;
    if (!mode) {
      setSourceRecords([]);
      setIsLoadingRecords(false);
      return () => { cancelled = true; };
    }
    setIsLoadingRecords(true);
    const timer = window.setTimeout(() => {
      void getPvpSourceRecords(mode, sourceSearch)
        .then((records) => { if (!cancelled) setSourceRecords(records); })
        .catch((requestError) => {
          if (!cancelled) setError(getApiErrorMessage(requestError, "Unable to load source documents."));
        })
        .finally(() => { if (!cancelled) setIsLoadingRecords(false); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [pvpMode, sourceSearch]);

  const uploadSlots = useMemo(() => expandUploadSlots(sourceSlots, buAvailable), [buAvailable, sourceSlots]);
  const visibleUploadSlots = uploadSlots.filter(
    (slot) => !(slot.requiredWhen?.field === "bu_available" && buAvailable === true),
  );
  const requiredSourceType = pvpMode === "packing" ? "bpr" : "bmr";
  const sourceDocumentSlot = sourceSlots?.slots.find((slot) => slot.input === "document_reference");
  const buAvailableSlot = sourceSlots?.slots.find((slot) => slot.input === "boolean");
  const visibleRecords = sourceRecords.filter((record) =>
    String(record.source_doc_type ?? record.doc_type ?? "").trim().toLowerCase() === requiredSourceType,
  );
  useEffect(() => {
    if (!sourceDocumentId) {
      setSelectedSourceRecord(null);
      return;
    }
    const record = visibleRecords.find((candidate) => String(candidate.job_id) === sourceDocumentId);
    if (record) setSelectedSourceRecord(record);
  }, [sourceDocumentId, sourceRecords]);
  const errors = useMemo(() => {
    const next: Record<string, string> = {};
    if (!sourceDocumentId && slotRequired(sourceSlots, "document_reference")) {
      next.source_document_id = "Select a source BMR or BPR.";
    }
    if (buAvailable == null && slotRequired(sourceSlots, "boolean")) {
      next.bu_available = "Select whether the BU is already available.";
    }
    for (const field of visibleUploadSlots) {
      if (fileIssues[field.field]) {
        next[field.field] = fileIssues[field.field]!;
      } else if (field.required && !files[field.field] && !coreInputs?.core_input_files[field.field]) {
        next[field.field] = `Attach ${field.label}.`;
      }
    }
    return next;
  }, [buAvailable, coreInputs, fileIssues, files, sourceDocumentId, sourceSlots, visibleUploadSlots]);

  function setSourceFile(slot: UploadSlot, file: File | null) {
    if (file && !isAcceptedFile(file, slot.accept)) {
      setFiles((current) => ({ ...current, [slot.field]: null }));
      setFileIssues((current) => ({ ...current, [slot.field]: `${file.name} is not an accepted file type for ${slot.label}.` }));
      return;
    }
    if (file && file.size > slot.maxBytes) {
      setFiles((current) => ({ ...current, [slot.field]: null }));
      setFileIssues((current) => ({ ...current, [slot.field]: `${file.name} exceeds the ${Math.round(slot.maxBytes / (1024 * 1024))} MB limit.` }));
      return;
    }
    setFiles((current) => ({ ...current, [slot.field]: file }));
    setFileIssues((current) => ({ ...current, [slot.field]: undefined }));
  }

  async function handleContinue() {
    if (Object.keys(errors).length || !sourceSlots || isSaving || isLoadingRecords) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await saveCoreInputs({
        documentId,
        sourceFiles: Object.fromEntries(
          Object.entries(files).filter(([field]) => visibleUploadSlots.some((slot) => slot.field === field)),
        ),
        multipartFields: sourceSlots.multipart_fields,
        sourceDocumentId,
        buAvailable: buAvailable ?? undefined,
        batchSize: parseDerivedBatchSize(selectedSourceRecord?.batch_size),
        pvp: true,
      });
      setSuccess(response);
      navigate(getPvpCoverDetailsRoute(response.document_id), { state: { startGeneration: true } });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Unable to save source document details."));
    } finally {
      setIsSaving(false);
    }
  }

  const savedFiles = coreInputs?.core_input_files ?? {};
  function getDisplayFile(field: string) {
    if (files[field]) return files[field];
    const savedName = savedFiles[field];
    return savedName ? new File([" "], savedName, { type: "application/pdf" }) : null;
  }

  return (
    <div className="min-h-screen bg-background text-text lg:fixed lg:inset-0 lg:grid lg:grid-rows-[auto_minmax(0,1fr)]">
      <AppHeader user={user} unit={context?.unit ?? null} isLoadingUnit={isLoadingContext} />
      <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)]">
        <AppSidebar user={user} />
        <main className="min-h-0 min-w-0 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6 lg:px-8">
          <section className="mx-auto rounded-panel border border-border bg-surface shadow-sm">
            <div className="p-5 sm:p-6">
              <DocumentStepper steps={PVP_PVR_DOCUMENT_STEPS} activeStepId="select-document" onStepClick={goToStep} />
            </div>
            <SelectionStrip dosageForm={document?.dosage_form} docType={document?.doc_type} identifier={document?.bmr_number ?? document?.draft_id} />
            <div className="flex flex-col items-start justify-between border-b border-border p-5 pb-5">
              <p className="text-micro font-semibold uppercase tracking-overline text-primary">Step 2 of 7</p>
              <h1 className="mt-1 text-h1 font-semibold">Select Source Document</h1>
              <p className="mt-1.5 text-small text-subdued">Choose the source document for your PVP/PVR request.</p>
            </div>
            <div className="space-y-6 p-5 sm:p-6">
              {error ? <div className="rounded-control border border-danger/20 bg-danger-soft px-4 py-3 text-small text-danger-ink" role="alert">{error}</div> : null}
              {!pvpMode && !isLoading && !isLoadingDocument ? <div className="rounded-control border border-danger/20 bg-danger-soft px-4 py-3 text-small text-danger-ink" role="alert">The PVP mode is missing, so source documents cannot be loaded. Return to the type step and select manufacturing or packing.</div> : null}

              {isLoading || isLoadingDocument ? <p className="text-small text-subdued" role="status">Loading source document requirements…</p> : null}

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-text">{sourceDocumentSlot?.label ?? `Source ${requiredSourceType.toUpperCase()} document`}<span className="ml-1 text-danger">*</span></label>
                  {sourceDocumentId && !isSourceListOpen ? (
                    <button type="button" className="mt-2 flex w-full items-center justify-between gap-4 rounded-control border border-border bg-accent-soft/40 p-4 text-left" onClick={() => setIsSourceListOpen(true)} aria-label="Change selected source document">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-small font-semibold text-text">{selectedSourceRecord?.product_name ?? selectedSourceRecord?.product ?? `Selected ${requiredSourceType.toUpperCase()} document`}</span>
                        <span className="mt-1 block break-all font-mono text-micro text-subdued">{selectedSourceRecord?.document_no ?? sourceDocumentId}{` · ${requiredSourceType.toUpperCase()}`}</span>
                        {/* <span className="mt-1 block text-micro text-subdued">{selectedSourceRecord?.version ? ` · ${selectedSourceRecord.version}` : ""}{selectedSourceRecord?.product_code ? ` · Product code ${selectedSourceRecord.product_code}` : ""}</span> */}
                      </span>
                      <div className="flex items-center gap-1 text-primary-dark">
                        <RefreshCcw className="size-4 shrink-0" aria-hidden="true" />
                        <span className="shrink-0 text-small font-semibold">Change</span>
                      </div>
                    </button>
                  ) : (
                    <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(0,1.2fr)]">
                      <button type="button" className="flex min-h-10 items-center justify-between gap-3 rounded-control border border-border bg-surface px-3 py-2 text-left text-small font-medium text-subdued hover:border-primary/50" onClick={() => setIsSourceListOpen((open) => !open)} aria-expanded={isSourceListOpen} aria-controls="pvp-source-document-list">
                        <span>{isSourceListOpen ? "Close documents list" : "Select a source document"}</span>
                        {isSourceListOpen ? <ChevronUp className="size-4 shrink-0" aria-hidden="true" /> : <ChevronDown className="size-4 shrink-0" aria-hidden="true" />}
                      </button>
                      <input id="pvp-source-search" type="search" maxLength={200} value={sourceSearch} onChange={(event) => setSourceSearch(event.target.value)} placeholder={`Search ${requiredSourceType.toUpperCase()} by product, code, or document number`} className="min-h-10 w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text shadow-sm focus:border-primary/50 focus:outline-none" aria-label="Search source documents" />
                    </div>
                  )}
                  {isSourceListOpen ? (
                    <div id="pvp-source-document-list" className="mt-3 max-h-80 space-y-2 overflow-y-auto rounded-control border border-border p-2" role="radiogroup" aria-label={`Available finalized ${requiredSourceType.toUpperCase()} documents`}>
                      {visibleRecords.map((record) => (
                        <label key={record.job_id} className={`flex cursor-pointer items-start gap-3 rounded-control border p-4 transition ${sourceDocumentId === String(record.job_id) ? "border-primary bg-accent-soft/40" : "border-border bg-surface hover:border-primary/40"}`}>
                          <input type="radio" name="pvp-source-document" value={record.job_id} checked={sourceDocumentId === String(record.job_id)} disabled={isSaving || isLoadingRecords} onChange={() => { setSourceDocumentId(String(record.job_id)); setSelectedSourceRecord(record); setSourceSearch(""); setIsSourceListOpen(false); }} className="mt-1 accent-primary" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-small font-semibold text-text">{record.product_name ?? record.product ?? "Untitled product"}</span>
                            <span className="mt-1 block break-all font-mono text-micro text-subdued">{record.document_no ?? record.job_id}{` · ${requiredSourceType.toUpperCase()}`}</span>
                            {/* <span className="mt-1 block text-micro text-subdued">{selectedSourceRecord?.version ? ` · ${selectedSourceRecord.version}` : ""}{record.product_code ? ` · Product code ${record.product_code}` : ""}</span> */}
                          </span>
                        </label>
                      ))}
                      {isLoadingRecords ? <p className="p-3 text-small text-subdued" role="status">Loading finalized source documents…</p> : null}
                      {!isLoadingRecords && visibleRecords.length === 0 ? <p className="p-3 text-small text-subdued">No finalized {requiredSourceType.toUpperCase()} documents match this search.</p> : null}
                    </div>
                  ) : null}
                  {errors.source_document_id ? <p className="mt-1 text-small text-danger-ink">{errors.source_document_id}</p> : null}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text" htmlFor="pvp-bu-available">{buAvailableSlot?.label ?? "Is the BU already available?"}{slotRequired(sourceSlots, "boolean") ? <span className="ml-1 text-danger">*</span> : null}</label>
                  <div id="pvp-bu-available" className="mt-3 flex flex-wrap gap-3" role="radiogroup" aria-label={buAvailableSlot?.label ?? "Is the BU already available?"}>
                    {[{ label: "Yes", value: true }, { label: "No", value: false }].map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        role="radio"
                        aria-checked={buAvailable === option.value}
                        disabled={isSaving || isLoading}
                        onClick={() => setBuAvailable(option.value)}
                        className={`rounded-control border px-10 py-3 text-small font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${buAvailable === option.value ? "border-primary bg-accent-soft text-primary-dark" : "border-border bg-surface text-subdued hover:border-primary/50"}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {errors.bu_available ? <p className="mt-1 text-small text-danger-ink">{errors.bu_available}</p> : null}
                </div>

                {visibleUploadSlots.map((slot) => (
                  <FileUploadCard key={slot.field} label={slot.label} description={slot.required ? "Required source document." : "Optional source document."} file={getDisplayFile(slot.field)} error={errors[slot.field]} isRequired={slot.required} disabled={isSaving || isLoading} accept={slot.accept} maxBytes={slot.maxBytes} onChange={(file) => setSourceFile(slot, file)} />
                ))}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-start">
                <button type="button" className="rounded-control border border-border px-4 py-2 text-small font-semibold text-subdued" disabled={isSaving} onClick={() => navigate("/")}>Save & exit</button>
                <button type="button" className="rounded-control bg-primary px-4 py-2 text-small font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={isSaving || isLoading || isLoadingDocument || isLoadingRecords || !pvpMode || !sourceSlots || Object.keys(errors).length > 0 || Boolean(success)} onClick={() => void handleContinue()}>{isSaving ? "Saving source document details…" : success ? "Saved" : "Continue to cover page"}</button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function expandUploadSlots(response: SourceSlotsResponse | null, buAvailable: boolean | null): UploadSlot[] {
  if (!response) return [];
  const allowed = new Set(response.multipart_fields);
  const fields: UploadSlot[] = [];
  for (const slot of response.slots) {
    if (slot.input !== "file") continue;
    const add = (field: string, required: boolean) => {
      if (allowed.has(field)) fields.push({ field, label: slot.label, required, accept: slot.accept ?? ["application/pdf"], maxBytes: slot.max_bytes ?? Number.MAX_SAFE_INTEGER, requiredWhen: slot.required_when });
    };
    if ("repeat_field" in slot) {
      const conditionMet = Boolean(slot.required_when) && buAvailable === slot.required_when?.equals;
      for (let index = 1; index <= slot.max; index += 1) add(slot.repeat_field.replace("{n}", String(index)), (Boolean(slot.required) || conditionMet) && index === 1);
    } else {
      const conditionMet = Boolean(slot.required_when) && buAvailable === slot.required_when?.equals;
      add(slot.field, Boolean(slot.required) || conditionMet);
    }
  }
  return fields;
}

function slotRequired(response: SourceSlotsResponse | null, input: string): boolean {
  const slot = response?.slots.find((candidate) => candidate.input === input);
  return slot ? slot.required !== false : true;
}

function parseDerivedBatchSize(value: number | string | undefined): number | undefined {
  if (value == null || String(value).trim() === "") return undefined;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function isAcceptedFile(file: File, acceptedTypes: string[]) {
  if (!acceptedTypes.length) return true;
  const filename = file.name.toLowerCase().trim();
  return acceptedTypes.some((acceptedType) => {
    const type = acceptedType.toLowerCase().trim();
    if (type.startsWith(".")) return filename.endsWith(type);
    if (type.endsWith("/*")) return file.type.toLowerCase().startsWith(type.slice(0, -1));
    if (file.type.toLowerCase() === type) return true;
    return type === "application/pdf" && filename.endsWith(".pdf");
  });
}
