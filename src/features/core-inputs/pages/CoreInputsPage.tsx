import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Info,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getDocumentCoverBomRoute } from "../../../app/routing/routes";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { useAuthStore } from "../../auth/state/auth.store";
import {
  getCoreInputs,
  getPvpSourceRecords,
  getSourceSlots,
  setCoreInputs,
} from "../../new-document/api/documents.api";
import type {
  BatchType,
  CommercialMode,
  CoreInputsResponse,
  CreateBmrDocumentResponse,
  SourceSlot,
  SourceSlotsResponse,
  SetCoreInputsResponse,
  PvpSourceRecord,
} from "../../new-document/api/documents.types";
import { AppHeader } from "../../new-document/components/AppHeader";
import { AppSidebar } from "../../new-document/components/AppSidebar";
import { DocumentStepper } from "../../new-document/components/DocumentStepper";
import { SelectionStrip } from "../../new-document/components/SelectionStrip";
import { useDocument } from "../../new-document/hooks/useDocument";
import { useDocumentSelectorData } from "../../new-document/hooks/useDocumentSelectorData";
import { useStepNavigation } from "../../new-document/hooks/useStepNavigation";
import { DOCUMENT_SELECTOR_STEPS } from "../../new-document/model/documentSelector.config";
import { FileUploadCard, type FileUploadStatus } from "../components/FileUploadCard";
import {
  clearCoreInputsDraft,
  loadCoreInputsDraft,
  saveCoreInputsDraft,
  type CoreInputsDraft,
} from "../storage/coreInputsDraft";

type CoreInputsLocationState = {
  document?: CreateBmrDocumentResponse;
  pvpMode?: string | null;
};

type FileField = string;

interface CoreInputsFormState {
  batchSize: string;
  batchType: BatchType | "";
  commercialMode: CommercialMode | "";
  sourceDocumentId: string;
  buAvailable: boolean | null;
}

type CoreInputsErrors = Partial<Record<string, string>>;

interface SourceUploadField {
  field: string;
  label: string;
  required: boolean;
  accept: string[];
  maxBytes: number;
  isRepeatable: boolean;
  requiredWhen?: { field: string; equals: string | number | boolean };
}

type FileAttachState = {
  status: FileUploadStatus;
  progress: number;
};

const INITIAL_FORM_STATE: CoreInputsFormState = {
  batchSize: "",
  batchType: "",
  commercialMode: "",
  sourceDocumentId: "",
  buAvailable: null,
};

const BATCH_TYPE_OPTIONS = [
  { value: "exhibit", label: "Exhibit" },
  { value: "scale_up", label: "Scale up" },
  { value: "commercial", label: "Commercial" },
];

const COMMERCIAL_MODE_OPTIONS = [
  { value: "revision", label: "Revision" },
  { value: "validation", label: "Validation" },
];

export function CoreInputsPage() {
  const { documentId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { context, isLoading: isLoadingContext } = useDocumentSelectorData(user);
  const state = location.state as CoreInputsLocationState | null;
  const document = state?.document;
  const { document: saved } = useDocument(documentId);
  const isPvp = (saved?.doc_type ?? document?.doc_type ?? "").toLowerCase() === "pvp";
  const { goToStep } = useStepNavigation(documentId);
  // Start from any autosaved draft (typed-but-not-submitted values from a previous
  // visit — they survive a reload or logout). Files can't be restored; text fields can.
  const [form, setForm] = useState<CoreInputsFormState>(() =>
    mergeDraft(INITIAL_FORM_STATE, loadCoreInputsDraft(documentId)),
  );
  const [sourceFiles, setSourceFiles] = useState<Record<string, File | null>>({});
  const [sourceSlots, setSourceSlots] = useState<SourceSlotsResponse | null>(null);
  const [isLoadingSourceSlots, setIsLoadingSourceSlots] = useState(Boolean(documentId));
  const [sourceSlotsError, setSourceSlotsError] = useState<string | null>(null);
  const [sourceSlotsRequest, setSourceSlotsRequest] = useState(0);
  const [storedCoreInputs, setStoredCoreInputs] = useState<CoreInputsResponse | null>(null);
  const pvpMode = storedPvpMode(state?.pvpMode, storedCoreInputs?.pvp_mode, saved?.pvp_mode);
  const [pvpSourceRecords, setPvpSourceRecords] = useState<PvpSourceRecord[]>([]);
  const [pvpSourceError, setPvpSourceError] = useState<string | null>(null);
  const [isLoadingPvpSources, setIsLoadingPvpSources] = useState(false);
  const [isLoadingCoreInputs, setIsLoadingCoreInputs] = useState(Boolean(documentId));
  const [coreInputsLoadError, setCoreInputsLoadError] = useState<string | null>(null);
  const [coreInputsRequest, setCoreInputsRequest] = useState(0);

  // Files already stored server-side. The browser cannot re-create a File object for
  // them, so they are tracked separately: they satisfy validation, and are only
  // re-uploaded if the user actually picks a replacement.
  const savedFiles = useMemo(
    () =>
      new Map(
        storedCoreInputs?.document_id === documentId
          ? Object.entries(storedCoreInputs.core_input_files)
          : [],
      ),
    [documentId, storedCoreInputs],
  );

  // Repopulate from the dedicated Core Inputs response, not the general document
  // detail. Runs when the saved values load, not on every
  // keystroke — otherwise it would fight the user's typing. A field the user already
  // has a value for (from a restored autosave draft, or their own typing) is left
  // alone: only EMPTY fields are filled from the server, so the local draft wins.
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!storedCoreInputs || prefilledRef.current) {
      return;
    }
    prefilledRef.current = true;

    setForm((current) => ({
      ...current,
      batchSize:
        current.batchSize ||
        (storedCoreInputs.batch_size != null
          ? formatIndianNumber(String(storedCoreInputs.batch_size))
          : ""),
      batchType: current.batchType || ((storedCoreInputs.batch_type as BatchType) ?? ""),
      commercialMode:
        current.commercialMode ||
        ((storedCoreInputs.commercial_mode as CommercialMode) ?? ""),
      sourceDocumentId: current.sourceDocumentId || storedCoreInputs.source_document_id || "",
      buAvailable: current.buAvailable ?? storedCoreInputs.bu_available ?? null,
    }));
  }, [storedCoreInputs]);

  useEffect(() => {
    let cancelled = false;
    if (!isPvp || !pvpMode) {
      setPvpSourceRecords([]);
      setPvpSourceError(null);
      setIsLoadingPvpSources(false);
      return () => { cancelled = true; };
    }
    setIsLoadingPvpSources(true);
    setPvpSourceError(null);
    void getPvpSourceRecords(pvpMode)
      .then((records) => { if (!cancelled) setPvpSourceRecords(records); })
      .catch((error) => {
        if (!cancelled) setPvpSourceError(getApiErrorMessage(error, "Unable to load source BMR/BPR records."));
      })
      .finally(() => { if (!cancelled) setIsLoadingPvpSources(false); });
    return () => { cancelled = true; };
  }, [isPvp, pvpMode]);

  // Autosave the typed values so leaving the flow (or logging out) doesn't lose them.
  // Stops once submitted — at that point the data lives on the server and the draft is
  // cleared. Files are excluded (the browser can't persist a File).
  const submittedRef = useRef(false);
  useEffect(() => {
    if (!documentId || submittedRef.current) {
      return;
    }
    saveCoreInputsDraft(documentId, toDraft(form));
  }, [documentId, form]);
  const [touched, setTouched] = useState<Partial<Record<keyof CoreInputsFormState, boolean>>>({});
  const [fileTouched, setFileTouched] = useState<Record<string, boolean>>({});
  const [fileIssues, setFileIssues] = useState<Partial<Record<FileField, string>>>({});
  const [fileAttachState, setFileAttachState] = useState<Partial<Record<FileField, FileAttachState>>>(
    {},
  );
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SetCoreInputsResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInFlightRef = useRef(false);
  const uploadTimersRef = useRef<Partial<Record<FileField, number>>>({});

  useEffect(() => {
    let cancelled = false;
    prefilledRef.current = false;
    setStoredCoreInputs(null);
    setCoreInputsLoadError(null);

    if (!documentId) {
      setIsLoadingCoreInputs(false);
      return () => {
        cancelled = true;
      };
    }

    setIsLoadingCoreInputs(true);
    void getCoreInputs(documentId)
      .then((response) => {
        if (!cancelled) setStoredCoreInputs(response);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setCoreInputsLoadError(
            getApiErrorMessage(
              requestError,
              "Unable to load the saved core inputs. Please try again.",
            ),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCoreInputs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [coreInputsRequest, documentId]);

  useEffect(() => {
    let cancelled = false;

    Object.values(uploadTimersRef.current).forEach((timerId) => {
      if (timerId) window.clearTimeout(timerId);
    });
    uploadTimersRef.current = {};
    setSourceFiles({});
    setFileTouched({});
    setFileIssues({});
    setFileAttachState({});
    setSourceSlots(null);
    setSourceSlotsError(null);

    if (!documentId) {
      setIsLoadingSourceSlots(false);
      return () => {
        cancelled = true;
      };
    }

    setIsLoadingSourceSlots(true);
    void getSourceSlots(documentId)
      .then((response) => {
        if (!cancelled) setSourceSlots(response);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setSourceSlotsError(
            getApiErrorMessage(
              requestError,
              "Unable to load the required source documents. Please try again.",
            ),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSourceSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [documentId, sourceSlotsRequest]);

  useEffect(() => {
    return () => {
      Object.values(uploadTimersRef.current).forEach((timerId) => {
        if (timerId) {
          window.clearTimeout(timerId);
        }
      });
    };
  }, []);

  const sourceFields = useMemo(
    () => expandSourceSlots(sourceSlots, { bu_available: form.buAvailable }),
    [form.buAvailable, sourceSlots],
  );
  const visibleSourceFields = sourceFields.filter((field) =>
    !(isPvp && field.requiredWhen?.field === "bu_available" && form.buAvailable === true),
  );
  const regularSourceFields = visibleSourceFields.filter((field) => !field.isRepeatable);
  const repeatableSourceFields = visibleSourceFields.filter((field) => field.isRepeatable);
  const errors = useMemo(
    () => validateCoreInputs(form, documentId, fileIssues, savedFiles, sourceFiles, sourceFields, isPvp, sourceSlots),
    [documentId, fileIssues, form, isPvp, savedFiles, sourceFields, sourceFiles, sourceSlots],
  );
  const hasUploadingFile = Object.values(fileAttachState).some(
    (stateValue) => stateValue?.status === "uploading",
  );
  const visibleErrors = getVisibleErrors(errors, { ...touched, ...fileTouched }, submitAttempted);
  const batchSizeWarning = getBatchSizeWarning(form.batchSize);
  const canSubmit =
    Boolean(sourceSlots) &&
    !isLoadingSourceSlots &&
    (!isPvp || (!isLoadingPvpSources && !pvpSourceError)) &&
    !isLoadingCoreInputs &&
    !sourceSlotsError &&
    !coreInputsLoadError &&
    Object.keys(errors).length === 0 &&
    !hasUploadingFile &&
    !isSubmitting &&
    !success;
  const primaryReason = getPrimaryDisabledReason(
    errors,
    hasUploadingFile,
    isLoadingSourceSlots,
    sourceSlotsError,
    isLoadingCoreInputs,
    coreInputsLoadError,
    sourceFields,
    isPvp ? isLoadingPvpSources : false,
    isPvp ? pvpSourceError : null,
  );

  function setFile(field: FileField, file: File | null) {
    window.clearTimeout(uploadTimersRef.current[field]);
    setFileTouched((current) => ({ ...current, [field]: true }));
    setApiError(null);

    if (!file) {
      setSourceFiles((current) => ({ ...current, [field]: null }));
      setFileIssues((current) => ({ ...current, [field]: undefined }));
      setFileAttachState((current) => ({ ...current, [field]: { status: "idle", progress: 0 } }));
      return;
    }

    const sourceField = sourceFields.find((candidate) => candidate.field === field);
    if (!sourceField) {
      return;
    }

    const validationMessage = getFileRejectionMessage(sourceField, file);
    if (validationMessage) {
      setSourceFiles((current) => ({ ...current, [field]: null }));
      setFileIssues((current) => ({ ...current, [field]: validationMessage }));
      setFileAttachState((current) => ({ ...current, [field]: { status: "idle", progress: 0 } }));
      return;
    }

    setSourceFiles((current) => ({ ...current, [field]: file }));
    setFileIssues((current) => ({ ...current, [field]: undefined }));
    setFileAttachState((current) => ({
      ...current,
      [field]: { status: "uploading", progress: 48 },
    }));

    uploadTimersRef.current[field] = window.setTimeout(() => {
      setFileAttachState((current) => ({
        ...current,
        [field]: { status: "attached", progress: 100 },
      }));
    }, 500);
  }

  function handleFieldChange(
    field: keyof Pick<
      CoreInputsFormState,
      "batchSize" | "batchType" | "commercialMode"
    >,
  ) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;

      setForm((current) => ({
        ...current,
        [field]: value,
        ...(field === "batchType" && value !== "commercial" ? { commercialMode: "" } : null),
      }));
      setTouched((current) => ({ ...current, [field]: true }));
      setApiError(null);
    };
  }

  function handleBatchSizeChange(event: ChangeEvent<HTMLInputElement>) {
    const formatted = formatIndianNumber(event.target.value);
    setForm((current) => ({ ...current, batchSize: formatted }));
    setTouched((current) => ({ ...current, batchSize: true }));
    setApiError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);
    setApiError(null);

    const nextErrors = validateCoreInputs(
      form,
      documentId,
      fileIssues,
      savedFiles,
      sourceFiles,
      sourceFields,
      isPvp,
      sourceSlots,
    );
    if (
      !sourceSlots ||
      sourceSlotsError ||
      Object.keys(nextErrors).length > 0 ||
      (isPvp && (isLoadingPvpSources || Boolean(pvpSourceError))) ||
      hasUploadingFile ||
      submitInFlightRef.current
    ) {
      return;
    }

    const batchType = form.batchType;
    const batchSize = parseWholeNumber(form.batchSize);

    if (!isPvp && (!batchType || batchSize === null)) {
      return;
    }

    submitInFlightRef.current = true;
    setIsSubmitting(true);

    try {
      const response = await setCoreInputs({
        documentId,
        sourceFiles,
        multipartFields: sourceSlots.multipart_fields,
        ...(isPvp
          ? { pvp: true, sourceDocumentId: form.sourceDocumentId, buAvailable: form.buAvailable ?? undefined }
          : {
              batchSize: batchSize ?? undefined,
              batchType: batchType || undefined,
              commercialMode: batchType === "commercial" ? form.commercialMode : "",
            }),
        addressId: storedCoreInputs?.address_id,
        user: user?.username ?? user?.id,
      });

      // Saved on the server now — retire the local autosave so it can't shadow the
      // stored values on a later visit.
      submittedRef.current = true;
      clearCoreInputsDraft(documentId);

      setSuccess(response);
      window.setTimeout(() => {
        navigate(getDocumentCoverBomRoute(response.document_id), {
          state: { coreInputs: response, document, startCoverGeneration: true },
        });
      }, 450);
    } catch (requestError) {
      setApiError(getApiErrorMessage(requestError, "Unable to save core inputs. Please try again."));
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  }

    // Returns the active file, or a dummy file representing the one stored on the server
  function getDisplayFile(field: FileField): File | null {
    if (sourceFiles[field]) return sourceFiles[field];
    const savedName = savedFiles.get(field);
    if (savedName) {
      // Adding a space (" ") gives the file a size of 1 byte, preventing UI components 
      // from ignoring it as an "empty" 0-byte file.
      return new File([" "], savedName, { type: "application/pdf" });
    }
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader user={user} unit={context?.unit ?? null} isLoadingUnit={isLoadingContext} />
      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />
        <main className="min-w-0 px-4 py-6 sm:px-6 lg:h-full lg:overflow-y-auto lg:px-8">
          <section className="mx-auto rounded-panel border border-border bg-surface shadow-sm">
            <div className="p-5 sm:p-6">
              <DocumentStepper
                steps={DOCUMENT_SELECTOR_STEPS}
                activeStepId="inputs"
                completedStepIds={saved?.completed_steps ?? []}
                onStepClick={goToStep}
              />
            </div>

            <SelectionStrip
              dosageForm={saved?.dosage_form}
              docType={saved?.doc_type}
              identifier={saved?.bmr_number ?? saved?.draft_id}
            />

            <form onSubmit={handleSubmit} noValidate>
              <div
                className={`px-5 py-5 sm:px-6 ${
                  isSubmitting || isLoadingCoreInputs ? "pointer-events-none opacity-55" : ""
                }`}
                aria-busy={isSubmitting || isLoadingCoreInputs}
              >
                <div className="space-y-5">
                  <div className="flex items-center gap-2 text-small text-subdued">
                    <FileText className="size-4 text-subdued" aria-hidden="true" />
                    <span>New document - working draft - not yet a controlled record.</span>
                  </div>

                  <div className="space-y-3" aria-live="polite">
                    {apiError ? (
                      <StatusBanner
                        tone="error"
                        title="Could not save core inputs"
                        message={apiError}
                      />
                    ) : null}
                    {isLoadingCoreInputs ? (
                      <div
                        className="flex items-center gap-2 rounded-control border border-border bg-muted px-4 py-3 text-small font-semibold text-subdued"
                        role="status"
                      >
                        <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
                        Loading saved core inputs...
                      </div>
                    ) : null}
                    {coreInputsLoadError ? (
                      <div className="space-y-3">
                        <StatusBanner
                          tone="error"
                          title="Could not load saved core inputs"
                          message={coreInputsLoadError}
                        />
                        <button
                          type="button"
                          className="pointer-events-auto inline-flex min-h-10 items-center justify-center rounded-control border border-primary bg-white px-5 py-2.5 text-small font-semibold text-primary-dark transition hover:bg-accent-soft focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                          onClick={() => setCoreInputsRequest((current) => current + 1)}
                        >
                          Try again
                        </button>
                      </div>
                    ) : null}
                    {success ? (
                      <StatusBanner
                        tone="success"
                        title="Core inputs saved"
                        message="Moving to the page-1 preview step."
                      />
                    ) : null}
                    {visibleErrors.form ? (
                      <StatusBanner
                        tone="error"
                        title="Document unavailable"
                        message={visibleErrors.form}
                      />
                    ) : null}
                  </div>

                  {isLoadingSourceSlots ? (
                    <div
                      className="flex min-h-24 items-center justify-center gap-3 rounded-control border border-border bg-muted text-small font-semibold text-subdued"
                      role="status"
                    >
                      <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
                      Loading source document requirements...
                    </div>
                  ) : sourceSlotsError ? (
                    <div className="space-y-3">
                      <StatusBanner
                        tone="error"
                        title="Could not load source document requirements"
                        message={sourceSlotsError}
                      />
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center justify-center rounded-control border border-primary bg-white px-5 py-2.5 text-small font-semibold text-primary-dark transition hover:bg-accent-soft focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        onClick={() => setSourceSlotsRequest((current) => current + 1)}
                      >
                        Try again
                      </button>
                    </div>
                  ) : (
                    <>
                      {isPvp ? (
                        <PvpReferenceInputs
                          slots={sourceSlots?.slots ?? []}
                          records={pvpSourceRecords}
                          sourceDocumentId={form.sourceDocumentId}
                          sourceDocType={storedCoreInputs?.source_doc_type ?? ""}
                          buAvailable={form.buAvailable}
                          errors={visibleErrors}
                          disabled={isSubmitting || Boolean(success)}
                          loading={isLoadingPvpSources}
                          loadError={pvpSourceError}
                          onSourceDocumentChange={(value) => {
                            setForm((current) => ({ ...current, sourceDocumentId: value }));
                            setFileTouched((current) => ({ ...current, source_document_id: true }));
                            setApiError(null);
                          }}
                          onBuAvailableChange={(value) => {
                            setForm((current) => ({ ...current, buAvailable: value }));
                            if (value) {
                              setSourceFiles((current) => ({ ...current, bu: null }));
                              setFileIssues((current) => ({ ...current, bu: undefined }));
                              setFileAttachState((current) => ({ ...current, bu: { status: "idle", progress: 0 } }));
                            }
                            setFileTouched((current) => ({ ...current, bu_available: true }));
                            setApiError(null);
                          }}
                        />
                      ) : null}
                      {regularSourceFields.map((sourceField) => (
                        <SourceFileUpload
                          key={sourceField.field}
                          sourceField={sourceField}
                          file={getDisplayFile(sourceField.field)}
                          error={visibleErrors[sourceField.field]}
                          disabled={isSubmitting || Boolean(success)}
                          state={fileAttachState[sourceField.field]}
                          onChange={(file) => setFile(sourceField.field, file)}
                        />
                      ))}

                      {repeatableSourceFields.length > 0 ? (
                        <OptionalDocuments
                          fields={repeatableSourceFields}
                          visibleErrors={visibleErrors}
                          disabled={isSubmitting || Boolean(success)}
                          fileAttachState={fileAttachState}
                          setFile={setFile}
                          getDisplayFile={getDisplayFile}
                        />
                      ) : null}
                    </>
                  )}

                  {!isPvp ? <TextField
                    id="batch-size"
                    label="Batch size"
                    value={form.batchSize}
                    error={visibleErrors.batchSize}
                    placeholder="1,80,000"
                    isRequired
                    disabled={isSubmitting || Boolean(success)}
                    helper="Everything scales to this in numbers."
                    onBlur={() => setTouched((current) => ({ ...current, batchSize: true }))}
                    onChange={handleBatchSizeChange}   // ← changed
                  /> : null}

                  {!isPvp ? <SelectField
                    id="batch-type"
                    label="Batch type"
                    value={form.batchType}
                    options={BATCH_TYPE_OPTIONS}
                    placeholder="Select a batch type..."
                    error={visibleErrors.batchType}
                    isRequired
                    disabled={isSubmitting || Boolean(success)}
                    helper="Sample values - list is per-client configuration."
                    onBlur={() => setTouched((current) => ({ ...current, batchType: true }))}
                    onChange={handleFieldChange("batchType")}
                  /> : null}

                  {!isPvp && form.batchType === "commercial" ? (
                    <SelectField
                      id="commercial-mode"
                      label="Commercial mode"
                      value={form.commercialMode}
                      options={COMMERCIAL_MODE_OPTIONS}
                      placeholder="Select commercial mode..."
                      error={visibleErrors.commercialMode}
                      isRequired
                      disabled={isSubmitting || Boolean(success)}
                      helper="Required for commercial batches only."
                      onBlur={() =>
                        setTouched((current) => ({ ...current, commercialMode: true }))
                      }
                      onChange={handleFieldChange("commercialMode")}
                    />
                  ) : null}

                  {!isPvp && batchSizeWarning ? (
                    <StatusBanner tone="warning" title="Batch size check" message={batchSizeWarning} />
                  ) : null}
                </div>
              </div>

              <div className="border-t border-border rounded-panel bg-surface px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-3">
                  {isSubmitting ? (
                    <div
                      className="inline-flex min-h-10 items-center gap-3 text-small font-semibold text-text"
                      role="status"
                    >
                      <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
                      Saving core inputs... Do not close this tab.
                    </div>
                  ) : (
                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
                      <button
                        type="submit"
                        className="inline-flex min-h-10 items-center justify-center rounded-control bg-primary px-5 py-2.5 text-small font-semibold text-white transition hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-muted disabled:text-subdued"
                        disabled={!canSubmit}
                      >
                        {success ? "Saved" : "Generate Cover page"}
                      </button>
                      <Link
                        className="inline-flex min-h-10 items-center justify-center rounded-control border border-primary bg-white px-5 py-2.5 text-small font-semibold text-primary-dark transition hover:bg-accent-soft focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        to="/"
                      >
                        Save & exit
                      </Link>
                    </div>
                  )}

                  {primaryReason && !success ? (
                    <p className="inline-flex items-start gap-2 text-small text-subdued">
                      <Info className="mt-0.5 size-4 shrink-0 text-subdued" aria-hidden="true" />
                      {primaryReason}
                    </p>
                  ) : null}
                </div>
              </div>
            </form>
          </section>
        </main>
      </div>
    </div>
  );
}

function SourceFileUpload({
  sourceField,
  file,
  error,
  disabled,
  state,
  onChange,
}: {
  sourceField: SourceUploadField;
  file: File | null;
  error?: string;
  disabled: boolean;
  state?: FileAttachState;
  onChange: (file: File | null) => void;
}) {
  return (
    <FileUploadCard
      label={sourceField.label}
      description={sourceField.required ? "Required source document." : "Optional source document."}
      file={file}
      error={error}
      isRequired={sourceField.required}
      disabled={disabled}
      status={getUploadStatus(state, file)}
      progress={state?.progress}
      accept={sourceField.accept}
      maxBytes={sourceField.maxBytes}
      onChange={onChange}
    />
  );
}

function PvpReferenceInputs({
  slots,
  records,
  sourceDocumentId,
  sourceDocType,
  buAvailable,
  errors,
  disabled,
  loading,
  loadError,
  onSourceDocumentChange,
  onBuAvailableChange,
}: {
  slots: SourceSlot[];
  records: PvpSourceRecord[];
  sourceDocumentId: string;
  sourceDocType: string;
  buAvailable: boolean | null;
  errors: CoreInputsErrors;
  disabled: boolean;
  loading: boolean;
  loadError: string | null;
  onSourceDocumentChange: (value: string) => void;
  onBuAvailableChange: (value: boolean | null) => void;
}) {
  return <>
    {slots.filter((slot) => slot.input === "document_reference").map((slot) => (
      <div className="space-y-2" key={"field" in slot ? slot.field : slot.kind}>
        <label className="block text-sm font-semibold text-text" htmlFor="source-document-id">
          {slot.label}{slot.required ? <span className="ml-1 text-danger">*</span> : null}
        </label>
        <select
          id="source-document-id"
          value={sourceDocumentId}
          disabled={disabled || loading}
          aria-invalid={Boolean(errors.source_document_id)}
          onBlur={() => {}}
          onChange={(event) => onSourceDocumentChange(event.target.value)}
          className={`min-h-10 w-full rounded-control border bg-surface px-3 py-2 text-sm text-text shadow-sm ${errors.source_document_id ? "border-danger" : "border-border"}`}
        >
          <option value="">{loading ? "Loading source documents..." : "Select a source BMR or BPR..."}</option>
          {sourceDocumentId && !records.some((record) => String(record.job_id) === sourceDocumentId) ? (
            <option value={sourceDocumentId}>{`${sourceDocType ? `${sourceDocType.toUpperCase()} · ` : "Saved source · "}${sourceDocumentId}`}</option>
          ) : null}
          {records.filter((record) => !slot.allowed_doc_types?.length || slot.allowed_doc_types.includes(String(record.source_doc_type ?? record.doc_type ?? "").toLowerCase())).map((record) => (
            <option key={record.job_id} value={record.job_id}>{formatPvpSourceLabel(record)}</option>
          ))}
        </select>
        {loadError ? <p className="text-small text-danger-ink">{loadError}</p> : null}
        {errors.source_document_id ? <p className="text-small text-danger-ink">{errors.source_document_id}</p> : null}
      </div>
    ))}
    {slots.filter((slot) => slot.input === "boolean").map((slot) => (
      <div key={"field" in slot ? slot.field : slot.kind}>
        <label className="block text-sm font-semibold text-text" htmlFor="bu-available">
          {slot.label}{slot.required ? <span className="ml-1 text-danger">*</span> : null}
        </label>
        <select
          id="bu-available"
          value={buAvailable == null ? "" : String(buAvailable)}
          disabled={disabled}
          aria-invalid={Boolean(errors.bu_available)}
          onChange={(event) => onBuAvailableChange(event.target.value === "" ? null : event.target.value === "true")}
          className={`mt-2 min-h-10 w-full rounded-control border bg-surface px-3 py-2 text-sm text-text shadow-sm ${errors.bu_available ? "border-danger" : "border-border"}`}
        >
          <option value="">Select an option...</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
        {errors.bu_available ? <p className="mt-1 text-small text-danger-ink">{errors.bu_available}</p> : null}
      </div>
    ))}
  </>;
}

function formatPvpSourceLabel(record: PvpSourceRecord) {
  const title = record.document_no ?? record.bmr_number ?? record.draft_id ?? record.job_id;
  const product = record.product_name ?? record.product;
  const type = record.source_doc_type ?? record.doc_type;
  return [title, product, type ? String(type).toUpperCase() : null, record.batch_size != null ? `Batch ${record.batch_size}` : null]
    .filter(Boolean).join(" · ");
}

function OptionalDocuments({
  fields,
  visibleErrors,
  disabled,
  fileAttachState,
  setFile,
  getDisplayFile,
}: {
  fields: SourceUploadField[];
  visibleErrors: CoreInputsErrors;
  disabled: boolean;
  fileAttachState: Partial<Record<FileField, FileAttachState>>;
  setFile: (field: FileField, file: File | null) => void;
  getDisplayFile: (field: FileField) => File | null;
}) {
  return (
    <details className="rounded-control border border-dashed border-border bg-muted/60 p-4">
      <summary className="cursor-pointer text-small font-semibold text-text">
        {fields[0]?.label ?? "Other supporting documents"}
      </summary>
      <div className="mt-4 grid gap-4">
        {fields.map((sourceField, index) => {
          const file = getDisplayFile(sourceField.field);
          return (
            <SourceFileUpload
              key={sourceField.field}
              sourceField={{ ...sourceField, label: `${sourceField.label} ${index + 1}` }}
              file={file}
              error={visibleErrors[sourceField.field]}
              disabled={disabled}
              state={fileAttachState[sourceField.field]}
              onChange={(nextFile) => setFile(sourceField.field, nextFile)}
            />
          );
        })}
      </div>
    </details>
  );
}

function TextField({
  id,
  label,
  value,
  error,
  helper,
  placeholder,
  isRequired,
  disabled,
  onBlur,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  helper: string;
  placeholder?: string;
  isRequired?: boolean;
  disabled?: boolean;
  onBlur: () => void;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-text">
        {label}
        {isRequired ? <span className="ml-1 text-danger">*</span> : null}
      </label>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        className={`min-h-10 w-full rounded-control border bg-surface px-3 py-2 text-sm text-text shadow-sm transition placeholder:text-subdued/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:text-subdued ${
          error ? "border-danger focus:border-danger focus:ring-danger/20" : "border-border"
        }`}
        onBlur={onBlur}
        onChange={onChange}
      />
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-small text-danger-ink">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-danger" aria-hidden="true" />
          {error}
        </p>
      ) : (
        <p className="text-micro leading-5 text-subdued">{helper}</p>
      )}
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  options,
  placeholder,
  error,
  helper,
  isRequired,
  disabled,
  onBlur,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  error?: string;
  helper: string;
  isRequired?: boolean;
  disabled?: boolean;
  onBlur: () => void;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-text">
        {label}
        {isRequired ? <span className="ml-1 text-danger">*</span> : null}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        className={`min-h-10 w-full rounded-control border bg-surface px-3 py-2 text-sm text-text shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:text-subdued ${
          error ? "border-danger focus:border-danger focus:ring-danger/20" : "border-border"
        }`}
        onBlur={onBlur}
        onChange={onChange}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-small text-danger-ink">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-danger" aria-hidden="true" />
          {error}
        </p>
      ) : (
        <p className="text-micro leading-5 text-subdued">{helper}</p>
      )}
    </div>
  );
}

function StatusBanner({
  tone,
  title,
  message,
}: {
  tone: "success" | "error" | "warning";
  title: string;
  message: string;
}) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "error" ? AlertCircle : ShieldCheck;
  const classes = {
    success: "border-success/25 bg-approved-bg text-approved-fg",
    error: "border-danger/20 bg-danger-soft text-danger-ink",
    warning: "border-draft-fg/25 bg-draft-bg text-draft-fg",
  }[tone];

  return (
    <div className={`flex items-start gap-3 rounded-control border px-4 py-3 ${classes}`} role="status">
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="text-small leading-5">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5">{message}</p>
      </div>
    </div>
  );
}

/** The autosave-able (serializable) slice of the form — files are excluded. */
function toDraft(form: CoreInputsFormState): CoreInputsDraft {
  return {
    batchSize: form.batchSize,
    batchType: form.batchType,
    commercialMode: form.commercialMode,
    sourceDocumentId: form.sourceDocumentId,
    buAvailable: form.buAvailable,
  };
}

/** Overlay a restored draft onto the blank form (files stay null — not persistable). */
function mergeDraft(base: CoreInputsFormState, draft: CoreInputsDraft | null): CoreInputsFormState {
  if (!draft) {
    return base;
  }
  return {
    ...base,
    batchSize: draft.batchSize,
    batchType: draft.batchType as BatchType | "",
    commercialMode: draft.commercialMode as CommercialMode | "",
    sourceDocumentId: draft.sourceDocumentId ?? "",
    buAvailable: draft.buAvailable ?? null,
  };
}

function validateCoreInputs(
  form: CoreInputsFormState,
  documentId: string,
  fileIssues: Partial<Record<FileField, string>>,
  savedFiles: Map<string, string>,
  sourceFiles: Record<string, File | null>,
  sourceFields: SourceUploadField[],
  isPvp = false,
  sourceSlots: SourceSlotsResponse | null = null,
): CoreInputsErrors {
  const errors: CoreInputsErrors = {};

  if (!documentId.trim()) {
    errors.form = "Document ID is missing. Return to New document and create or select a draft.";
  }

  sourceFields.forEach((sourceField) => {
    const conditionMet = sourceField.requiredWhen
      ? formFieldValue(form, sourceField.requiredWhen.field) === sourceField.requiredWhen.equals
      : false;
    const required = sourceField.required || conditionMet;
    if (fileIssues[sourceField.field]) {
      errors[sourceField.field] = fileIssues[sourceField.field];
    } else if (
      required &&
      !sourceFiles[sourceField.field] &&
      !savedFiles.has(sourceField.field)
    ) {
      errors[sourceField.field] = `Attach ${sourceField.label}.`;
    }
  });

  if (isPvp) {
    const referenceRequired = findSlot(sourceSlots, "source_document_id")?.required ?? true;
    const booleanRequired = findSlot(sourceSlots, "bu_available")?.required ?? true;
    if (referenceRequired && !form.sourceDocumentId) errors.source_document_id = "Select a source BMR or BPR.";
    if (booleanRequired && form.buAvailable == null) errors.bu_available = "Select whether the BU is already available.";
    return errors;
  }

  const batchSize = parseWholeNumber(form.batchSize);
  if (!form.batchSize.trim()) {
    errors.batchSize = "Enter the production batch size.";
  } else if (batchSize === null) {
    errors.batchSize = "Batch size must be a whole number of tablets - no decimals.";
  }

  if (!form.batchType) {
    errors.batchType = "Select a batch type.";
  }

  if (form.batchType === "commercial" && !form.commercialMode) {
    errors.commercialMode = "Select a commercial mode.";
  }

  return errors;
}

function getFileRejectionMessage(sourceField: SourceUploadField, file: File) {
  if (!isAcceptedFile(file, sourceField.accept)) {
    return `${file.name} is not an accepted file type for ${sourceField.label}.`;
  }

  if (file.size > sourceField.maxBytes) {
    return `${file.name} is ${formatRoundedMb(file.size)} MB. The limit is ${formatRoundedMb(sourceField.maxBytes)} MB - compress or re-scan and try again.`;
  }

  return null;
}

function isAcceptedFile(file: File, acceptedTypes: string[]) {
  if (acceptedTypes.length === 0) return true;

  const fileName = file.name.toLowerCase().trim();
  return acceptedTypes.some((acceptedType) => {
    const normalized = acceptedType.toLowerCase().trim();
    if (normalized.startsWith(".")) return fileName.endsWith(normalized);
    if (normalized.endsWith("/*")) return file.type.toLowerCase().startsWith(normalized.slice(0, -1));
    if (file.type.toLowerCase() === normalized) return true;
    return normalized === "application/pdf" && fileName.endsWith(".pdf");
  });
}

function parseWholeNumber(value: string) {
  const normalized = value.replace(/,/g, "").trim();

  if (!normalized) {
    return null;
  }

  const numberValue = Number(normalized);
  if (!Number.isFinite(numberValue) || numberValue <= 0 || !Number.isInteger(numberValue)) {
    return null;
  }

  return numberValue;
}

function formatIndianNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";

  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);

  if (rest) {
    // Group the leading part in pairs (right-to-left) for lakhs/crores.
    const groupedRest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    return `${groupedRest},${lastThree}`;
  }

  return lastThree;
}

function getBatchSizeWarning(value: string) {
  const parsed = parseWholeNumber(value);

  if (parsed !== null && parsed >= 5_000_000) {
    return `Batch size ${parsed.toLocaleString()} is unusually large - confirm this is correct.`;
  }

  return null;
}

function getUploadStatus(state: FileAttachState | undefined, file: File | null): FileUploadStatus {
  if (state?.status) {
    return state.status;
  }

  return file ? "attached" : "idle";
}

function getVisibleErrors(
  errors: CoreInputsErrors,
  touched: Record<string, boolean | undefined>,
  submitAttempted: boolean,
) {
  if (submitAttempted) {
    return errors;
  }

  return Object.fromEntries(
    Object.entries(errors).filter(
      ([field]) => field === "form" || touched[field],
    ),
  ) as CoreInputsErrors;
}

function getPrimaryDisabledReason(
  errors: CoreInputsErrors,
  hasUploadingFile: boolean,
  isLoadingSourceSlots: boolean,
  sourceSlotsError: string | null,
  isLoadingCoreInputs: boolean,
  coreInputsLoadError: string | null,
  sourceFields: SourceUploadField[],
  isLoadingPvpSources = false,
  pvpSourceError: string | null = null,
) {
  if (isLoadingSourceSlots) {
    return "Loading source document requirements.";
  }

  if (isLoadingPvpSources) return "Loading source BMR/BPR records.";
  if (pvpSourceError) return "Source BMR/BPR records must load before you can continue.";

  if (sourceSlotsError) {
    return "Source document requirements must load before you can continue.";
  }

  if (isLoadingCoreInputs) {
    return "Loading saved core inputs.";
  }

  if (coreInputsLoadError) {
    return "Retry loading the saved core inputs before continuing.";
  }

  if (hasUploadingFile) {
    return "Finish attaching the selected PDF before continuing.";
  }

  if (errors.form) {
    return errors.form;
  }

  if (errors.source_document_id || errors.bu_available) {
    return "Complete the required PVP fields to continue.";
  }

  const sourceFileWithError = sourceFields.find((field) => errors[field.field]);
  if (sourceFileWithError) {
    return errors[sourceFileWithError.field] ?? "Attach the required source documents to continue.";
  }

  if (
    errors.batchSize ||
    errors.batchType ||
    errors.commercialMode
  ) {
    return "Complete the required fields to continue.";
  }

  return null;
}

function expandSourceSlots(
  response: SourceSlotsResponse | null,
  values: Record<string, string | number | boolean | null> = {},
): SourceUploadField[] {
  if (!response) return [];

  const allowedFields = new Set(response.multipart_fields);
  const fields: SourceUploadField[] = [];

  response.slots.forEach((slot) => {
    if (isRepeatableSlot(slot)) {
      for (let index = 1; index <= slot.max; index += 1) {
        const field = slot.repeat_field.replace("{n}", String(index));
        if (allowedFields.has(field)) {
          fields.push({
            field,
            label: slot.label,
            required: (Boolean(slot.required) || requiredWhenMatches(slot.required_when, values)) && index === 1,
            accept: slot.accept ?? [],
            maxBytes: slot.max_bytes ?? Number.MAX_SAFE_INTEGER,
            isRepeatable: true,
            requiredWhen: slot.required_when,
          });
        }
      }
      return;
    }

    if (allowedFields.has(slot.field)) {
      fields.push({
        field: slot.field,
        label: slot.label,
        required: Boolean(slot.required) || requiredWhenMatches(slot.required_when, values),
        accept: slot.accept ?? [],
        maxBytes: slot.max_bytes ?? Number.MAX_SAFE_INTEGER,
        isRepeatable: false,
        requiredWhen: slot.required_when,
      });
    }
  });

  return fields;
}

function isRepeatableSlot(slot: SourceSlot): slot is Extract<SourceSlot, { repeat_field: string }> {
  return "repeat_field" in slot;
}

function formatRoundedMb(bytes: number) {
  return Math.round(bytes / (1024 * 1024)).toLocaleString();
}

function requiredWhenMatches(
  condition: SourceSlot["required_when"],
  values: Record<string, string | number | boolean | null>,
) {
  return Boolean(condition) && values[condition!.field] === condition!.equals;
}

function findSlot(response: SourceSlotsResponse | null, field: string) {
  return response?.slots.find((slot) => "field" in slot && slot.field === field);
}

function formFieldValue(form: CoreInputsFormState, field: string) {
  if (field === "bu_available") return form.buAvailable;
  if (field === "source_document_id") return form.sourceDocumentId;
  return undefined;
}

function storedPvpMode(...values: Array<string | null | undefined>) {
  const value = values.find((candidate) => Boolean(candidate?.trim()));
  if (!value) return "";
  const normalized = value.toLowerCase();
  if (normalized.includes("pack")) return "packing";
  if (normalized.includes("manufact")) return "manufacturing";
  return value;
}
