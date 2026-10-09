import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Loader2,
  Lock,
  Send,
  Share2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { DocumentViewer } from "../../../shared/document/DocumentViewer";
import { DocxViewer } from "../../preview/components/DocxViewer";
import { getApiErrorCode, getApiErrorMessage } from "../../../shared/api/apiError";
import { useAuthStore } from "../../auth/state/auth.store";
import { AppHeader } from "../../new-document/components/AppHeader";
import { AppSidebar } from "../../new-document/components/AppSidebar";
import { WizardHeader } from "../../new-document/components/WizardHeader";
import { useDocument } from "../../new-document/hooks/useDocument";
import { useStepNavigation } from "../../new-document/hooks/useStepNavigation";
import { clearDocumentLocation } from "../../auth/storage/resumeLocation";
import {
  downloadDocument,
  generateDocument,
  getGenerateProgress,
  getDocumentPdf,
  submitDocument,
  type GenerateProgress,
  type GenerationStatus,
} from "../api/generate.api";

const POLL_INTERVAL_MS = 4000;
const SUBMITTED_STATUSES = ["submitted", "qa_review", "pr_review", "in_review", "pending_approval", "approved", "rejected", "cancelled", "superseded"];

export function GenerateSubmitPage() {
  const { documentId = "" } = useParams();
  const user = useAuthStore((state) => state.user);
  const { goToStep } = useStepNavigation(documentId);
  const { document: documentState, reload: reloadDocument } = useDocument(documentId);

  const [state, setState] = useState<GenerationStatus | null>(null);
  const [generationProgress, setGenerationProgress] = useState<GenerateProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [isBlobLoading, setIsBlobLoading] = useState(false);
  const [isBlobDocx, setIsBlobDocx] = useState(true);
  const pollRef = useRef<number | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    mainRef.current?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [documentId, previewBlob]);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // ONE endpoint drives this page: `generate/progress`.
  const loadStatus = useCallback(async () => {
    try {
      const progress = await getGenerateProgress(documentId);
      setGenerationProgress(progress);

      const isDone = Boolean(
        progress.status === "done" ||
        (progress.result && (progress.result as any).docx_path) ||
        (progress.result && (progress.result as any).status === "success"),
      );

      const isError = Boolean(
        progress.status === "error" ||
        progress.error ||
        (progress.result && (progress.result as any).status === "error"),
      );

      const next: GenerationStatus = {
        document_id: progress.document_id || documentId,
        status: isDone ? "generated" : isError ? "generation_failed" : "generating",
        has_artifact: isDone,
        artifact_size: isDone ? 1 : null,
        error_message: progress.error ?? (progress.result as any)?.error_message ?? null,
      };

      setState(next);
      if (progress.status !== "running") stopPolling();
      return progress;
    } catch (caught) {
      stopPolling();
      setError(getApiErrorMessage(caught, "Could not read the generation status."));
      return null;
    }
  }, [documentId, stopPolling]);

  const startPolling = useCallback(async () => {
    const current = await loadStatus();
    stopPolling();
    if (current?.status === "running") {
      pollRef.current = window.setInterval(() => void loadStatus(), POLL_INTERVAL_MS);
    }
  }, [loadStatus, stopPolling]);

  const generate = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    setPreviewBlob(null);
    setGenerationProgress({
      document_id: documentId,
      status: "running",
      percent: 0,
      step: "Starting document generation…",
      result: null,
      error: null,
    });
    setState({
      document_id: documentId,
      status: "generating",
      has_artifact: false,
      artifact_size: null,
      error_message: null,
    });
    try {
      await generateDocument(documentId);
      await startPolling();
    } catch (caught) {
      // "This document is already being generated" is not a failure to show the preparer.
      // It is the thing they asked for, already happening — so WATCH it instead of
      // reporting it.
      //
      // ⚠ This screen auto-starts a build on arrival when nothing is built yet, and the
      // signal it reads for that ("running" at 0% / "Starting…") is also what a build
      // someone else just kicked off looks like for its first moment. So the auto-start
      // raced a real build, the POST 409'd, and the catch below painted a red banner over
      // a document that was building perfectly well — and, because polling never started,
      // the banner then stayed put next to a finished .docx with a Submit button. Exactly
      // what the client screenshotted.
      if (getApiErrorCode(caught) === "GENERATION_IN_PROGRESS") {
        await startPolling();
      } else {
        setError(getApiErrorMessage(caught, "Could not start generation."));
      }
    } finally {
      setIsBusy(false);
    }
  }, [documentId, startPolling]);

  useEffect(() => {
    // Select Stages has already started the build with POST /generate. This page only
    // observes that build; when progress reports `done`, the preview effect below runs.
    void startPolling();
    return stopPolling;
  }, [startPolling, stopPolling]);

  const submit = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    try {
      await submitDocument(documentId);
      await loadStatus();
      await reloadDocument();
      setConfirmSubmit(false);
      // This document is done — forget its remembered step, so "New document" starts a
      // fresh one and the card opens on the review screen the submission moved it to.
      // (Submitting doesn't change the route, so ProtectedRoute won't re-save this page.)
      if (user?.username) {
        clearDocumentLocation(user.username, documentId);
      }
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not submit the document."));
    } finally {
      setIsBusy(false);
    }
  }, [documentId, loadStatus, reloadDocument, user?.username]);

  const status = state?.status;
  const isSubmitted = Boolean(status && SUBMITTED_STATUSES.includes(status));
  const isGenerated = status === "generated" || isSubmitted;
  const filename = `BMR_${documentState?.bmr_number ?? documentId.slice(0, 8)}.docx`;

  useEffect(() => {
    if (!isGenerated || !state?.has_artifact) return;
    let cancelled = false;
    setIsBlobLoading(true);
    getDocumentPdf(documentId)
      .then(async (blob) => {
        if (cancelled) return;
        setPreviewBlob(blob);
        const signature = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
        const text = String.fromCharCode(...signature);
        setIsBlobDocx(text !== "%PDF-");
      })
      .catch((caught) => {
        if (!cancelled) setError(getApiErrorMessage(caught, "Could not load document preview."));
      })
      .finally(() => {
        if (!cancelled) setIsBlobLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, isGenerated, state?.has_artifact]);

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader user={user} unit={user?.unitId ? { id: user.unitId } : null} />

      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />

        <main ref={mainRef} className="min-w-0 min-h-0 lg:h-full lg:overflow-y-auto">
          <div className="mx-auto space-y-5">
            <WizardHeader
              activeStepId="generate-submit"
              completedStepIds={documentState?.completed_steps ?? []}
              onStepClick={goToStep}
              title="Generate & submit"
              description="The generated document, exactly as the AI built it — what you see here is the same file Download saves and reviewers sign. Build it, check it, then submit."
              identifier={documentState?.bmr_number ?? documentState?.draft_id ?? documentId}
              status="DRAFT"
              dosageForm={documentState?.dosage_form}
              docType={documentState?.doc_type}
            />

            {isSubmitted ? (
              <div className="mx-8 flex flex-wrap items-end justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-primary/[0.08] px-3 py-1.5 text-small font-semibold text-primary-dark">
                  <Lock className="size-3.5" aria-hidden="true" />
                  Frozen · in review
                </span>
              </div>
            ) : null}

            {error ? (
              <div className="mx-8 flex items-start gap-2 rounded-panel border border-danger/30 bg-danger-soft p-4">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                <p className="text-small text-danger">{error}</p>
              </div>
            ) : null}

            {status === "generation_failed" ? (
              <div className="mx-8 flex items-start gap-2 rounded-panel border border-danger/30 bg-danger-soft p-4">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                <div>
                  <p className="text-small font-semibold text-danger">Generation failed</p>
                  <p className="mt-1 break-words text-small text-subdued">{state?.error_message}</p>
                </div>
              </div>
            ) : null}

            {/* Filename display (only when preview artifact is not yet loaded) */}
            {!isGenerated || !state?.has_artifact ? (
              <div className="mx-8 flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface p-2.5 shadow-overlay">
                <span className="ml-1 inline-flex items-center gap-2 text-small font-semibold">
                  <FileText className="size-4 text-primary" aria-hidden="true" />
                  {filename}
                </span>
              </div>
            ) : null}

            {isSubmitted ? (
              <div className="mx-8 flex items-start gap-2 rounded-panel border border-primary/30 bg-primary/[0.04] p-4">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-small font-semibold text-primary-dark">Submitted for review</p>
                  <p className="mt-1 text-small text-subdued">
                    QA and Production reviewers can now review it in parallel. The document is frozen.
                  </p>
                </div>
              </div>
            ) : null}

            {/* The REAL generated document */}
            {isGenerated && state?.has_artifact ? (
              isBlobLoading ? (
                <div className="mx-8 flex items-center justify-center gap-2 rounded-panel border border-border bg-surface p-16 text-subdued">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  <span className="text-small">Loading the generated document preview…</span>
                </div>
              ) : previewBlob ? (
                isBlobDocx ? (
                  <DocxViewer
                    file={{ blob: previewBlob, filename, format: "docx" }}
                    reserveBottomActionsSpace
                  />
                ) : (
                  <DocumentViewer
                    docKey={`${documentId}:${state.artifact_size ?? 0}`}
                    load={() => Promise.resolve(previewBlob)}
                    fileName={filename.replace(/\.docx$/, ".pdf")}
                    loadingLabel="Loading the generated document…"
                    errorTitle="Could not load the generated document"
                  />
                )
              ) : null
            ) : status === "generating" ? (
              <GenerationProgressPanel progress={generationProgress} />
            ) : (
              <div className="mx-8 flex flex-col items-center justify-center gap-3 rounded-panel border border-dashed border-border-strong bg-surface p-16 text-center">
                <FileText className="size-8 text-subdued" aria-hidden="true" />
                <div>
                  <p className="text-small font-semibold">No generated document yet</p>
                  <p className="mt-1 max-w-md text-small text-subdued">
                    Press <span className="font-semibold">Build .docx</span> below to generate the
                    BMR from your reviewed inputs. The finished document will appear here — the
                    real file, exactly as it will print.
                  </p>
                </div>
              </div>
            )}

            {/* Sticky Footer matching Cover + BOM Page */}
            <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t bg-surface p-3.5 shadow-auth">
              <button
                type="button"
                onClick={() => goToStep("stages")}
                className="inline-flex items-center gap-2 rounded-control border border-border px-4 py-2 text-small font-semibold transition hover:bg-muted"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back to select stages
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <ToolbarButton onClick={() => setShowShare(true)} icon={<Share2 className="size-4" />}>
                  Share
                </ToolbarButton>
                <ToolbarButton
                  onClick={() =>
                    isGenerated && state?.has_artifact
                      ? void downloadDocument(documentId, filename)
                      : void generate()
                  }
                  disabled={isBusy}
                  icon={
                    status === "generating" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )
                  }
                >
                  {isGenerated && state?.has_artifact ? "Download" : "Build .docx"}
                </ToolbarButton>
                {!isSubmitted ? (
                  <button
                    type="button"
                    onClick={() => setConfirmSubmit(true)}
                    disabled={isBusy || !isGenerated}
                    title={isGenerated ? undefined : "Build the .docx first"}
                    className="inline-flex items-center gap-2 rounded-control bg-primary px-4 py-2 text-small font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-border-strong"
                  >
                    <Send className="size-4" aria-hidden="true" />
                    Submit
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </main>
      </div>

      {showShare ? (
        <ShareDialog documentId={documentId} filename={filename} onClose={() => setShowShare(false)} />
      ) : null}

      {confirmSubmit ? (
        <ConfirmSubmit
          busy={isBusy}
          onConfirm={() => void submit()}
          onCancel={() => setConfirmSubmit(false)}
        />
      ) : null}
    </div>
  );
}

function GenerationProgressPanel({ progress }: { progress: GenerateProgress | null }) {
  const percent = Math.min(100, Math.max(0, Math.round(progress?.percent ?? 0)));
  return (
    <div className="mx-8 rounded-panel border border-border bg-surface p-10 text-center">
      <Loader2 className="mx-auto size-6 animate-spin text-primary" aria-hidden="true" />
      <p className="mt-3 text-small font-semibold">
        {progress?.step || "Building the document…"}
      </p>
      <div className="mx-auto mt-4 flex max-w-xl items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${percent}%` }}
            role="progressbar"
            aria-label="Document generation progress"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <span className="whitespace-nowrap text-small font-semibold text-subdued">
          {percent}%
        </span>
      </div>
    </div>
  );
}

function ToolbarButton({
  children,
  icon,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-control border px-3.5 text-small font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? "border-primary bg-accent-soft text-primary-dark"
          : "border-border-strong bg-surface hover:bg-sunken"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function ShareDialog({
  documentId,
  filename,
  onClose,
}: {
  documentId: string;
  filename: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/documents/${documentId}/cover-bom`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-modal border border-border bg-surface p-5 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-h2 font-semibold">Share {filename}</h2>
          <button type="button" onClick={onClose} className="rounded-control p-1 hover:bg-sunken">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1 text-small text-subdued">
          Anyone with access to this workspace can open the document at this link.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-control border border-border-strong bg-sunken px-3 py-2">
          <span className="min-w-0 flex-1 truncate font-mono text-micro">{link}</span>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(link);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
            className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-1.5 text-small font-semibold text-white transition hover:bg-primary-dark"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmSubmit({
  busy,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-modal border-t bg-surface p-5 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2">
          <Lock className="mt-0.5 size-5 shrink-0 text-draft-fg" aria-hidden="true" />
          <div>
            <h2 className="text-h2 font-semibold">Submit for review?</h2>
            <p className="mt-1 text-small text-subdued">
              This freezes the document — inputs can't change and it can't be regenerated afterwards.
              QA and Production review it in parallel.
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-control border border-border-strong bg-surface px-4 py-2 text-small font-semibold transition hover:bg-sunken disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-control bg-primary px-4 py-2 text-small font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Yes, submit
          </button>
        </div>
      </div>
    </div>
  );
}
// import {
//   AlertCircle,
//   Check,
//   CheckCircle2,
//   Copy,
//   Download,
//   FileText,
//   Loader2,
//   Lock,
//   Send,
//   Share2,
//   X,
// } from "lucide-react";
// import { useCallback, useEffect, useRef, useState } from "react";
// import { useParams } from "react-router-dom";
// import { getApiErrorCode, getApiErrorMessage } from "../../../shared/api/apiError";
// import { DocumentViewer } from "../../../shared/document/DocumentViewer";
// import { useAuthStore } from "../../auth/state/auth.store";
// import { AppHeader } from "../../new-document/components/AppHeader";
// import { AppSidebar } from "../../new-document/components/AppSidebar";
// import { DocumentStepper } from "../../new-document/components/DocumentStepper";
// import { SelectionStrip } from "../../new-document/components/SelectionStrip";
// import { useDocument } from "../../new-document/hooks/useDocument";
// import { useStepNavigation } from "../../new-document/hooks/useStepNavigation";
// import { DOCUMENT_SELECTOR_STEPS } from "../../new-document/model/documentSelector.config";
// import { clearDocumentLocation } from "../../auth/storage/resumeLocation";
// import {
//   downloadDocument,
//   generateDocument,
//   getDocumentPdf,
//   getGenerateProgress,
//   submitDocument,
//   type GenerationStatus,
// } from "../api/generate.api";

// const POLL_INTERVAL_MS = 4000;
// const SUBMITTED_STATUSES = ["submitted", "qa_review", "pr_review", "approved"];

// export function GenerateSubmitPage() {
//   const { documentId = "" } = useParams();
//   const user = useAuthStore((state) => state.user);
//   const { goToStep } = useStepNavigation(documentId);
//   const { document: documentState, reload: reloadDocument } = useDocument(documentId);

//   const [state, setState] = useState<GenerationStatus | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   const [isBusy, setIsBusy] = useState(false);
//   const [showShare, setShowShare] = useState(false);
//   const [confirmSubmit, setConfirmSubmit] = useState(false);
//   const pollRef = useRef<number | null>(null);

//   const stopPolling = useCallback(() => {
//     if (pollRef.current !== null) {
//       window.clearInterval(pollRef.current);
//       pollRef.current = null;
//     }
//   }, []);

//   // ONE endpoint drives this page: `generate/progress`, the same contract the Cover + BOM
//   // step polls and the same one the AI team's service answers with. Its `result` carries
//   // the generation status once the .docx exists, so nothing else is fetched to enable
//   // Download.
//   //
//   // Mapped back onto the document status the rest of this screen already reads
//   // (`generating` / `generated` / `generation_failed` / the submitted states), so the one
//   // change here is where the answer comes from — not what every branch below means.
//   const loadStatus = useCallback(async () => {
//     try {
//       const progress = await getGenerateProgress(documentId);

//       const next: GenerationStatus =
//         progress.result ??
//         {
//           document_id: documentId,
//           status: progress.status === "error" ? "generation_failed" : "generating",
//           has_artifact: false,
//           artifact_size: null,
//           error_message: progress.error,
//         };

//       setState(next);
//       if (progress.status !== "running") stopPolling();
//       // The mount effect decides from the PROGRESS, not the mapped status: "nothing built
//       // yet" and "building right now" both read as `generating` once mapped.
//       return progress;
//     } catch (caught) {
//       stopPolling();
//       setError(getApiErrorMessage(caught, "Could not read the generation status."));
//       return null;
//     }
//   }, [documentId, stopPolling]);

//   const startPolling = useCallback(async () => {
//     await loadStatus();
//     stopPolling();
//     pollRef.current = window.setInterval(() => void loadStatus(), POLL_INTERVAL_MS);
//   }, [loadStatus, stopPolling]);

//   const generate = useCallback(async () => {
//     setIsBusy(true);
//     setError(null);
//     try {
//       await generateDocument(documentId);
//       await startPolling();
//     } catch (caught) {
//       // "This document is already being generated" is not a failure to show the preparer.
//       // It is the thing they asked for, already happening — so WATCH it instead of
//       // reporting it.
//       //
//       // ⚠ This screen auto-starts a build on arrival when nothing is built yet, and the
//       // signal it reads for that ("running" at 0% / "Starting…") is also what a build
//       // someone else just kicked off looks like for its first moment. So the auto-start
//       // raced a real build, the POST 409'd, and the catch below painted a red banner over
//       // a document that was building perfectly well — and, because polling never started,
//       // the banner then stayed put next to a finished .docx with a Submit button. Exactly
//       // what the client screenshotted.
//       if (getApiErrorCode(caught) === "GENERATION_IN_PROGRESS") {
//         await startPolling();
//       } else {
//         setError(getApiErrorMessage(caught, "Could not start generation."));
//       }
//     } finally {
//       setIsBusy(false);
//     }
//   }, [documentId, startPolling]);

//   useEffect(() => {
//     void (async () => {
//       const current = await loadStatus();
//       if (current?.status === "running" && !(current.percent === 0 && current.step === "Starting…")) {
//         pollRef.current = window.setInterval(() => void loadStatus(), POLL_INTERVAL_MS);
//       } else if (current?.status === "running") {
//         // Arriving from Select Stages with everything reviewed but nothing built —
//         // start the build immediately so the user lands on the real document, not an
//         // empty page waiting for a button press. (No AI spend: generation reuses the
//         // stored extraction; only the .docx build runs.) Failed builds are NOT
//         // auto-retried — the error banner shows and the toolbar button retries.
//         void generate();
//       }
//     })();
//     return stopPolling;
//   }, [documentId, loadStatus, stopPolling, generate]);

//   const submit = useCallback(async () => {
//     setIsBusy(true);
//     setError(null);
//     try {
//       await submitDocument(documentId);
//       await loadStatus();
//       await reloadDocument();
//       setConfirmSubmit(false);
//       // This document is done — forget its remembered step, so "New document" starts a
//       // fresh one and the card opens on the review screen the submission moved it to.
//       // (Submitting doesn't change the route, so ProtectedRoute won't re-save this page.)
//       if (user?.username) {
//         clearDocumentLocation(user.username, documentId);
//       }
//     } catch (caught) {
//       setError(getApiErrorMessage(caught, "Could not submit the document."));
//     } finally {
//       setIsBusy(false);
//     }
//   }, [documentId, loadStatus, reloadDocument, user?.username]);

//   const status = state?.status;
//   const isSubmitted = Boolean(status && SUBMITTED_STATUSES.includes(status));
//   const isGenerated = status === "generated" || isSubmitted;
//   const filename = `BMR_${documentState?.bmr_number ?? documentId.slice(0, 8)}.docx`;

//   return (
//     <div className="min-h-screen bg-background text-text">
//       <AppHeader user={user} unit={user?.unitId ? { id: user.unitId } : null} />
//       <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
//         <AppSidebar user={user} />
//         <main className="min-w-0 min-h-0 lg:h-full lg:overflow-y-auto">
//           <div className="mx-auto space-y-5">
//             <div className="overflow-hidden rounded-panel border border-border bg-surface">
//               <div className="p-5">
//                 <DocumentStepper
//                   steps={DOCUMENT_SELECTOR_STEPS}
//                   activeStepId="generate-submit"
//                   completedStepIds={documentState?.completed_steps ?? []}
//                   onStepClick={goToStep}
//                 />
//               </div>
//               <SelectionStrip
//                 dosageForm={documentState?.dosage_form}
//                 docType={documentState?.doc_type}
//                 identifier={documentState?.bmr_number ?? documentState?.draft_id}
//               />
//             </div>

//             <header className="flex flex-wrap items-end justify-between gap-3">
//               <div>
//                 <h1 className="text-h1 font-semibold">Generate &amp; submit</h1>
//                 <p className="mt-1 text-small text-subdued">
//                   The generated document, exactly as the AI built it — what you see here is the
//                   same file Download saves and reviewers sign. Build it, check it, then submit.
//                 </p>
//               </div>
//               {isSubmitted ? (
//                 <span className="inline-flex items-center gap-1.5 rounded-pill bg-primary/[0.08] px-3 py-1.5 text-small font-semibold text-primary-dark">
//                   <Lock className="size-3.5" aria-hidden="true" />
//                   Frozen · in review
//                 </span>
//               ) : null}
//             </header>

//             {error ? (
//               <div className="flex items-start gap-2 rounded-panel border border-danger/30 bg-danger-soft p-4">
//                 <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
//                 <p className="text-small text-danger">{error}</p>
//               </div>
//             ) : null}

//             {status === "generation_failed" ? (
//               <div className="flex items-start gap-2 rounded-panel border border-danger/30 bg-danger-soft p-4">
//                 <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
//                 <div>
//                   <p className="text-small font-semibold text-danger">Generation failed</p>
//                   <p className="mt-1 break-words text-small text-subdued">{state?.error_message}</p>
//                 </div>
//               </div>
//             ) : null}

//             {/* Toolbar — the actions the user asked for. */}
//             <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface/95 p-2.5 shadow-overlay backdrop-blur">
//               <span className="ml-1 inline-flex items-center gap-2 text-small font-semibold">
//                 <FileText className="size-4 text-primary" aria-hidden="true" />
//                 {filename}
//               </span>
//               <div className="ml-auto flex flex-wrap gap-2">
//                 <ToolbarButton onClick={() => setShowShare(true)} icon={<Share2 className="size-4" />}>
//                   Share
//                 </ToolbarButton>
//                 <ToolbarButton
//                   onClick={() =>
//                     isGenerated && state?.has_artifact
//                       ? void downloadDocument(documentId, filename)
//                       : void generate()
//                   }
//                   disabled={isBusy}
//                   icon={
//                     status === "generating" ? (
//                       <Loader2 className="size-4 animate-spin" />
//                     ) : (
//                       <Download className="size-4" />
//                     )
//                   }
//                 >
//                   {isGenerated && state?.has_artifact ? "Download" : "Build .docx"}
//                 </ToolbarButton>
//                 {!isSubmitted ? (
//                   <button
//                     type="button"
//                     onClick={() => setConfirmSubmit(true)}
//                     disabled={isBusy || !isGenerated}
//                     title={isGenerated ? undefined : "Build the .docx first"}
//                     className="inline-flex h-9 items-center gap-1.5 rounded-control bg-primary px-4 text-small font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-border-strong"
//                   >
//                     <Send className="size-4" aria-hidden="true" />
//                     Submit
//                   </button>
//                 ) : null}
//               </div>
//             </div>

//             {isSubmitted ? (
//               <div className="flex items-start gap-2 rounded-panel border border-primary/30 bg-primary/[0.04] p-4">
//                 <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
//                 <div>
//                   <p className="text-small font-semibold text-primary-dark">Submitted for review</p>
//                   <p className="mt-1 text-small text-subdued">
//                     QA and Production reviewers can now review it in parallel. The document is frozen.
//                   </p>
//                 </div>
//               </div>
//             ) : null}

//             {/* The REAL generated document — the ai-built .docx converted to PDF, not a
//                 React re-creation. Only exists once generation has produced an artifact. */}
//             {isGenerated && state?.has_artifact ? (
//               <DocumentViewer
//                 docKey={`${documentId}:${state.artifact_size ?? 0}`}
//                 load={() => getDocumentPdf(documentId)}
//                 fileName={filename.replace(/\.docx$/, ".pdf")}
//                 loadingLabel="Loading the generated document…"
//                 errorTitle="Could not load the generated document"
//               />
//             ) : status === "generating" ? (
//               <div className="flex items-center justify-center gap-2 rounded-panel border border-border bg-surface p-16 text-subdued">
//                 <Loader2 className="size-4 animate-spin" aria-hidden="true" />
//                 <span className="text-small">
//                   Building the document — this usually takes a minute or two…
//                 </span>
//               </div>
//             ) : (
//               <div className="flex flex-col items-center justify-center gap-3 rounded-panel border border-dashed border-border-strong bg-surface p-16 text-center">
//                 <FileText className="size-8 text-subdued" aria-hidden="true" />
//                 <div>
//                   <p className="text-small font-semibold">No generated document yet</p>
//                   <p className="mt-1 max-w-md text-small text-subdued">
//                     Press <span className="font-semibold">Build .docx</span> above to generate the
//                     BMR from your reviewed inputs. The finished document will appear here — the
//                     real file, exactly as it will print.
//                   </p>
//                 </div>
//               </div>
//             )}

//             <button
//               type="button"
//               onClick={() => goToStep("stages")}
//               className="inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-small font-semibold text-subdued transition hover:bg-sunken"
//             >
//               ← Back to select stages
//             </button>
//           </div>
//         </main>
//       </div>

//       {showShare ? (
//         <ShareDialog documentId={documentId} filename={filename} onClose={() => setShowShare(false)} />
//       ) : null}

//       {confirmSubmit ? (
//         <ConfirmSubmit
//           busy={isBusy}
//           onConfirm={() => void submit()}
//           onCancel={() => setConfirmSubmit(false)}
//         />
//       ) : null}
//     </div>
//   );
// }

// function ToolbarButton({
//   children,
//   icon,
//   active,
//   disabled,
//   onClick,
// }: {
//   children: React.ReactNode;
//   icon: React.ReactNode;
//   active?: boolean;
//   disabled?: boolean;
//   onClick: () => void;
// }) {
//   return (
//     <button
//       type="button"
//       disabled={disabled}
//       onClick={onClick}
//       className={`inline-flex h-9 items-center gap-1.5 rounded-control border px-3.5 text-small font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
//         active
//           ? "border-primary bg-accent-soft text-primary-dark"
//           : "border-border-strong bg-surface hover:bg-sunken"
//       }`}
//     >
//       {icon}
//       {children}
//     </button>
//   );
// }

// function ShareDialog({
//   documentId,
//   filename,
//   onClose,
// }: {
//   documentId: string;
//   filename: string;
//   onClose: () => void;
// }) {
//   const [copied, setCopied] = useState(false);
//   const link = `${window.location.origin}/documents/${documentId}/cover-bom`;

//   return (
//     <div
//       className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
//       onClick={onClose}
//     >
//       <div
//         className="w-full max-w-md rounded-modal border border-border bg-surface p-5 shadow-modal"
//         onClick={(e) => e.stopPropagation()}
//       >
//         <div className="flex items-center justify-between">
//           <h2 className="text-h2 font-semibold">Share {filename}</h2>
//           <button type="button" onClick={onClose} className="rounded-control p-1 hover:bg-sunken">
//             <X className="size-4" aria-hidden="true" />
//           </button>
//         </div>
//         <p className="mt-1 text-small text-subdued">
//           Anyone with access to this workspace can open the document at this link.
//         </p>
//         <div className="mt-4 flex items-center gap-2 rounded-control border border-border-strong bg-sunken px-3 py-2">
//           <span className="min-w-0 flex-1 truncate font-mono text-micro">{link}</span>
//           <button
//             type="button"
//             onClick={() => {
//               void navigator.clipboard?.writeText(link);
//               setCopied(true);
//               window.setTimeout(() => setCopied(false), 1500);
//             }}
//             className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-1.5 text-small font-semibold text-white transition hover:bg-primary-dark"
//           >
//             {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
//             {copied ? "Copied" : "Copy"}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// function ConfirmSubmit({
//   busy,
//   onConfirm,
//   onCancel,
// }: {
//   busy: boolean;
//   onConfirm: () => void;
//   onCancel: () => void;
// }) {
//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
//       <div
//         className="w-full max-w-md rounded-modal border border-border bg-surface p-5 shadow-modal"
//         onClick={(e) => e.stopPropagation()}
//       >
//         <div className="flex items-start gap-2">
//           <Lock className="mt-0.5 size-5 shrink-0 text-draft-fg" aria-hidden="true" />
//           <div>
//             <h2 className="text-h2 font-semibold">Submit for review?</h2>
//             <p className="mt-1 text-small text-subdued">
//               This freezes the document — inputs can't change and it can't be regenerated afterwards.
//               QA and Production review it in parallel.
//             </p>
//           </div>
//         </div>
//         <div className="mt-4 flex justify-end gap-2">
//           <button
//             type="button"
//             onClick={onCancel}
//             disabled={busy}
//             className="rounded-control border border-border-strong bg-surface px-4 py-2 text-small font-semibold transition hover:bg-sunken disabled:opacity-60"
//           >
//             Cancel
//           </button>
//           <button
//             type="button"
//             onClick={onConfirm}
//             disabled={busy}
//             className="inline-flex items-center gap-2 rounded-control bg-primary px-4 py-2 text-small font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
//           >
//             {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
//             Yes, submit
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }
