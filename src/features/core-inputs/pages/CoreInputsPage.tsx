import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Info,
  Loader2,
  Lock,
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
import { getDocumentPreviewRoute, ROUTES } from "../../../app/routing/routes";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { useAuthStore } from "../../auth/state/auth.store";
import {
  getCoreInputs,
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
};

type FileField = string;

interface CoreInputsFormState {
  batchSize: string;
  batchType: BatchType | "";
  commercialMode: CommercialMode | "";
  headerFooterSize: string;   // header size (inches)
  footerSize: string;          // footer size (inches)
  footerTemplateNo: string;
}

type CoreInputsErrors = Partial<Record<string, string>>;

interface SourceUploadField {
  field: string;
  label: string;
  required: boolean;
  accept: string[];
  maxBytes: number;
  isRepeatable: boolean;
}

type FileAttachState = {
  status: FileUploadStatus;
  progress: number;
};

const INITIAL_FORM_STATE: CoreInputsFormState = {
  batchSize: "",
  batchType: "",
  commercialMode: "",
  headerFooterSize: "",
  footerSize: "",
  footerTemplateNo: "",
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

// Header/footer size in INCHES — the same unit Word uses for the header/footer
// distance from the page edge. The preview and the generated .docx both read this.
const HEADER_FOOTER_SIZE_OPTIONS = [
  { value: "0.5", label: '0.5" (compact)' },
  { value: "1.0", label: '1.0" (standard)' },
  { value: "1.5", label: '1.5" (large)' },
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
      headerFooterSize:
        current.headerFooterSize ||
        (storedCoreInputs.header_size != null ? String(storedCoreInputs.header_size) : ""),
      footerSize:
        current.footerSize ||
        (storedCoreInputs.footer_size != null
          ? String(storedCoreInputs.footer_size)
          : storedCoreInputs.header_size != null
            ? String(storedCoreInputs.header_size)
            : ""),
      footerTemplateNo:
        current.footerTemplateNo || (storedCoreInputs.footer_template_no ?? ""),
    }));
  }, [storedCoreInputs]);

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

  const sourceFields = useMemo(() => expandSourceSlots(sourceSlots), [sourceSlots]);
  const regularSourceFields = sourceFields.filter((field) => !field.isRepeatable);
  const repeatableSourceFields = sourceFields.filter((field) => field.isRepeatable);
  const errors = useMemo(
    () => validateCoreInputs(form, documentId, fileIssues, savedFiles, sourceFiles, sourceFields),
    [documentId, fileIssues, form, savedFiles, sourceFields, sourceFiles],
  );
  const hasUploadingFile = Object.values(fileAttachState).some(
    (stateValue) => stateValue?.status === "uploading",
  );
  const visibleErrors = getVisibleErrors(errors, { ...touched, ...fileTouched }, submitAttempted);
  const batchSizeWarning = getBatchSizeWarning(form.batchSize);
  const canSubmit =
    Boolean(sourceSlots) &&
    !isLoadingSourceSlots &&
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
      "batchSize" | "batchType" | "commercialMode" | "headerFooterSize" | "footerSize" | "footerTemplateNo"
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
    );
    if (
      !sourceSlots ||
      sourceSlotsError ||
      Object.keys(nextErrors).length > 0 ||
      hasUploadingFile ||
      submitInFlightRef.current
    ) {
      return;
    }

    const batchType = form.batchType;
    const batchSize = parseWholeNumber(form.batchSize);
    const headerFooterSize = parseDecimal(form.headerFooterSize);
    const footerSize = parseDecimal(form.footerSize);

    if (!batchType || batchSize === null || headerFooterSize === null || footerSize === null) {
      return;
    }

    submitInFlightRef.current = true;
    setIsSubmitting(true);

    try {
      const response = await setCoreInputs({
        documentId,
        sourceFiles,
        multipartFields: sourceSlots.multipart_fields,
        batchSize,
        batchType,
        commercialMode: batchType === "commercial" ? form.commercialMode : "",
        headerFooterSize,
        footerSize,
        footerTemplateNo: form.footerTemplateNo.trim(),
        addressId: storedCoreInputs?.address_id,
        user: user?.username ?? user?.id,
      });

      // Saved on the server now — retire the local autosave so it can't shadow the
      // stored values on a later visit.
      submittedRef.current = true;
      clearCoreInputsDraft(documentId);

      setSuccess(response);
      window.setTimeout(() => {
        navigate(getDocumentPreviewRoute(response.document_id), {
          state: { coreInputs: response, document },
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

                  <TextField
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
                  />

                  <SelectField
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
                  />

                  {form.batchType === "commercial" ? (
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

                  <div className="grid gap-5 sm:grid-cols-2">
                    <SelectField
                      id="header-size"
                      label="Header size"
                      value={form.headerFooterSize}
                      options={HEADER_FOOTER_SIZE_OPTIONS}
                      placeholder="Select a size..."
                      error={visibleErrors.headerFooterSize}
                      isRequired
                      disabled={isSubmitting || Boolean(success)}
                      helper="Distance the header sits from the top edge, in inches."
                      onBlur={() =>
                        setTouched((current) => ({ ...current, headerFooterSize: true }))
                      }
                      onChange={handleFieldChange("headerFooterSize")}
                    />

                    <SelectField
                      id="footer-size"
                      label="Footer size"
                      value={form.footerSize}
                      options={HEADER_FOOTER_SIZE_OPTIONS}
                      placeholder="Select a size..."
                      error={visibleErrors.footerSize}
                      isRequired
                      disabled={isSubmitting || Boolean(success)}
                      helper="Distance the footer sits from the bottom edge, in inches."
                      onBlur={() =>
                        setTouched((current) => ({ ...current, footerSize: true }))
                      }
                      onChange={handleFieldChange("footerSize")}
                    />
                  </div>

                  <TextField
                    id="footer-template-no"
                    label="Footer template no."
                    value={form.footerTemplateNo}
                    error={visibleErrors.footerTemplateNo}
                    placeholder="F-QA-014"
                    isRequired
                    disabled={isSubmitting || Boolean(success)}
                    helper="The controlled footer template stamped on every page."
                    onBlur={() =>
                      setTouched((current) => ({ ...current, footerTemplateNo: true }))
                    }
                    onChange={handleFieldChange("footerTemplateNo")}
                  />

                  {/* <DisabledTemplateBlock /> */}

                  {batchSizeWarning ? (
                    <StatusBanner tone="warning" title="Batch size check" message={batchSizeWarning} />
                  ) : null}
                </div>
              </div>

              <div className="border-t border-border bg-surface px-5 py-4 sm:px-6">
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
                        {success ? "Saved" : "Generate page-1 preview"}
                      </button>
                      <Link
                        className="inline-flex min-h-10 items-center justify-center rounded-control border border-primary bg-white px-5 py-2.5 text-small font-semibold text-primary-dark transition hover:bg-accent-soft focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        to={ROUTES.statusBoard}
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
                  ) : (
                    <p className="inline-flex items-start gap-2 text-small text-subdued">
                      <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                      Core inputs are saved here; OCR is not run on this screen.
                    </p>
                  )}
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

function DisabledTemplateBlock() {
  return (
    <div className="rounded-control border border-dashed border-border bg-surface p-4 opacity-75 cursor-not-allowed" title="Planned for a future release. This version supports Tablet BMR only.">
      <p className="inline-flex items-center gap-2 text-micro font-semibold uppercase tracking-overline text-subdued">
        <Lock className="size-3.5" aria-hidden="true" />
        Not in this release - richer header/footer template
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {["Document no.", "Effective date", "Page x of y", "Supersedes"].map((label) => (
          <label key={label} className="space-y-1 text-micro font-medium text-subdued">
            <span>{label}</span>
            <input
              disabled
              className="min-h-10 w-full rounded-control border border-border bg-muted px-3 py-2"
            />
          </label>
        ))}
      </div>
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
    headerFooterSize: form.headerFooterSize,
    footerSize: form.footerSize,
    footerTemplateNo: form.footerTemplateNo,
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
    headerFooterSize: draft.headerFooterSize,
    footerSize: draft.footerSize,
    footerTemplateNo: draft.footerTemplateNo,
  };
}

function validateCoreInputs(
  form: CoreInputsFormState,
  documentId: string,
  fileIssues: Partial<Record<FileField, string>>,
  savedFiles: Map<string, string>,
  sourceFiles: Record<string, File | null>,
  sourceFields: SourceUploadField[],
): CoreInputsErrors {
  const errors: CoreInputsErrors = {};

  if (!documentId.trim()) {
    errors.form = "Document ID is missing. Return to New document and create or select a draft.";
  }

  sourceFields.forEach((sourceField) => {
    if (fileIssues[sourceField.field]) {
      errors[sourceField.field] = fileIssues[sourceField.field];
    } else if (
      sourceField.required &&
      !sourceFiles[sourceField.field] &&
      !savedFiles.has(sourceField.field)
    ) {
      errors[sourceField.field] = `Attach ${sourceField.label}.`;
    }
  });

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

  if (!form.headerFooterSize) {
    errors.headerFooterSize = "Select the header size.";
  } else if (parseDecimal(form.headerFooterSize) === null) {
    // Sizes are in inches (0.5 / 1.0 / 1.5) — decimals, not whole numbers.
    errors.headerFooterSize = "Enter a valid header size.";
  }

  if (!form.footerSize) {
    errors.footerSize = "Select the footer size.";
  } else if (parseDecimal(form.footerSize) === null) {
    errors.footerSize = "Enter a valid footer size.";
  }

  if (!form.footerTemplateNo.trim()) {
    errors.footerTemplateNo = "Enter the footer template number (e.g. F-QA-014).";
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

function parseDecimal(value: string): number | null {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
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
) {
  if (isLoadingSourceSlots) {
    return "Loading source document requirements.";
  }

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

  const sourceFileWithError = sourceFields.find((field) => errors[field.field]);
  if (sourceFileWithError) {
    return errors[sourceFileWithError.field] ?? "Attach the required source documents to continue.";
  }

  if (
    errors.batchSize ||
    errors.batchType ||
    errors.commercialMode ||
    errors.headerFooterSize ||
    errors.footerTemplateNo
  ) {
    return "Complete the required fields to continue.";
  }

  return null;
}

function expandSourceSlots(response: SourceSlotsResponse | null): SourceUploadField[] {
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
            required: slot.required && index === 1,
            accept: slot.accept,
            maxBytes: slot.max_bytes,
            isRepeatable: true,
          });
        }
      }
      return;
    }

    if (allowedFields.has(slot.field)) {
      fields.push({
        field: slot.field,
        label: slot.label,
        required: slot.required,
        accept: slot.accept,
        maxBytes: slot.max_bytes,
        isRepeatable: false,
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
