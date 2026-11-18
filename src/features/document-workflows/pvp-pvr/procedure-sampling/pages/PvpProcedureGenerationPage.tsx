import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { AppHeader } from "../../../../../app/layout/AppHeader";
import { AppSidebar } from "../../../../../app/layout/AppSidebar";
import { getPvpProcedureSamplingRoute } from "../../../../../app/routing/routes";
import { getApiErrorMessage, isGenerationInProgressError } from "../../../../../shared/api/apiError";
import { useAuthStore } from "../../../../auth/state/auth.store";
import { useDocument } from "../../../selection/hooks/useDocument";
import { useDocumentSelectorData } from "../../../selection/hooks/useDocumentSelectorData";
import { ProcedureSamplingPreview } from "../components/ProcedureSamplingPreview";
import {
  generateProcedureStage,
  getProcedureGenerationProgress,
  getProcedureStage,
  getProcedureStagePreview,
  type GenerationProgress,
  type JsonRecord,
  type ProcedureStage,
} from "../api/procedureSampling.api";

const POLL_MS = 4000;
const FAILURE_STATUSES = ["error", "failed", "failure", "worker_error", "worker-error", "worker error", "timeout", "timed_out", "timed-out"];
const SUCCESS_STATUSES = ["done", "complete", "completed", "success", "succeeded"];

export function PvpProcedureGenerationPage() {
  const { documentId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sectionKey = searchParams.get("section_key") ?? "";
  const mode = searchParams.get("mode");
  const regenerate = mode === "regenerate";
  const validRequest = Boolean(documentId && sectionKey && ["generate", "regenerate"].includes(mode ?? ""));
  const user = useAuthStore((state) => state.user);
  const { context, isLoading: isLoadingContext } = useDocumentSelectorData(user);
  const { document } = useDocument(documentId);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [stage, setStage] = useState<ProcedureStage | null>(null);
  const [preview, setPreview] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!validRequest || startedRef.current) return;
    startedRef.current = true;
    const controller = new AbortController();
    void runGeneration({
      documentId,
      sectionKey,
      regenerate,
      signal: controller.signal,
      onProgress: setProgress,
      onStage: setStage,
      onPreview: setPreview,
      onError: setError,
      onRunning: setIsRunning,
      onComplete: setIsComplete,
    });
    return () => {
      controller.abort();
      startedRef.current = false;
    };
  }, [documentId, sectionKey, regenerate, validRequest]);

  const back = () =>
    navigate(`${getPvpProcedureSamplingRoute(documentId)}?section_key=${encodeURIComponent(sectionKey)}`);
  const rawPercent = progress?.percent == null ? null : Number(progress.percent);
  const percent = rawPercent == null || !Number.isFinite(rawPercent) ? null : Math.max(0, Math.min(100, rawPercent));
  const status = String(progress?.status ?? (isRunning ? "running" : "starting"));
  const shownPreview = preview ?? (stage?.procedure?.length ? stage.procedure : null);

  return (
    <div className="min-h-screen bg-background text-text lg:fixed lg:inset-0 lg:flex lg:flex-col lg:overflow-hidden">
      <AppHeader user={user} unit={context?.unit ?? null} isLoadingUnit={isLoadingContext} />
      <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <div className="lg:h-full lg:min-h-0 lg:overflow-y-auto"><AppSidebar user={user} /></div>
        <main className="min-w-0 lg:h-full lg:min-h-0 lg:overflow-y-auto">
          <section className="mx-auto flex min-h-[calc(100vh-var(--topbar-h))] flex-col bg-surface shadow-sm lg:min-h-full">
            <header className="border-b border-border p-5 sm:px-8">
              <p className="text-micro font-semibold uppercase tracking-overline text-primary">Procedure &amp; Sampling Plan</p>
              <h1 className="mt-1 text-h1 font-semibold">{isComplete ? "Procedure preview" : "Generating procedure"}</h1>
              <p className="mt-1.5 text-small text-subdued">
                {stage?.title ?? sectionKey ?? "Preparing your procedure generation."}
              </p>
            </header>
            <div className="flex-1 bg-muted/50 px-4 py-6 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-[900px] space-y-5">
                {!validRequest ? (
                  <div role="alert" className="rounded-card border border-danger/30 bg-danger/5 p-5 text-small text-danger">
                    This generation link is missing a valid document, stage, or generation mode.
                  </div>
                ) : null}
                {validRequest && isRunning ? (
                  <section aria-live="polite" aria-busy="true" className="rounded-card border border-border bg-surface p-6 shadow-sm">
                    <div className="flex items-center gap-3">
                      <RefreshCw className="size-5 animate-spin text-primary" aria-hidden="true" />
                      <div>
                        <h2 className="text-h3 font-semibold">{regenerate ? "Regenerating procedure" : "Generating procedure"}</h2>
                        <p className="mt-1 text-small text-subdued">Status: {status}{progress?.step ? ` · ${progress.step}` : ""}</p>
                      </div>
                      {percent != null ? <span className="ml-auto text-h3 font-semibold tabular-nums">{percent}%</span> : null}
                    </div>
                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Procedure generation progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}>
                      <div className={`h-full rounded-full bg-primary transition-[width] duration-500 ${percent == null ? "w-1/3 animate-pulse" : ""}`} style={percent == null ? undefined : { width: `${percent}%` }} />
                    </div>
                    {progress?.error ? <p className="mt-3 text-small text-danger">{progress.error}</p> : null}
                  </section>
                ) : null}
                {error ? <div role="alert" className="rounded-card border border-danger/30 bg-danger/5 p-4 text-small text-danger">{error}</div> : null}
                {isComplete && shownPreview ? <ProcedureSamplingPreview value={shownPreview} /> : null}
                {isComplete && !shownPreview ? (
                  <div className="rounded-card border border-border bg-surface p-5 text-small text-subdued">Generation completed, but no preview content was returned.</div>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button type="button" onClick={back} className="inline-flex items-center gap-2 rounded-control border border-border bg-surface px-4 py-2 text-small font-semibold hover:bg-muted">
                    <ArrowLeft className="size-4" aria-hidden="true" /> Back to Procedure &amp; Sampling
                  </button>
                  {error ? <button type="button" onClick={() => window.location.reload()} className="rounded-control border border-border bg-surface px-4 py-2 text-small font-semibold hover:bg-muted">Retry generation</button> : null}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

async function runGeneration({
  documentId, sectionKey, regenerate, signal, onProgress, onStage, onPreview, onError, onRunning, onComplete,
}: {
  documentId: string;
  sectionKey: string;
  regenerate: boolean;
  signal: AbortSignal;
  onProgress: (value: GenerationProgress) => void;
  onStage: (value: ProcedureStage) => void;
  onPreview: (value: unknown) => void;
  onError: (value: string | null) => void;
  onRunning: (value: boolean) => void;
  onComplete: (value: boolean) => void;
}) {
  onRunning(true);
  onError(null);
  try {
    let start: JsonRecord = {};
    try {
      start = await generateProcedureStage(documentId, sectionKey, regenerate);
    } catch (caught) {
      if (!isGenerationInProgressError(caught)) throw caught;
    }
    let attemptId = asString(start.attempt_id ?? start.data?.attempt_id);
    while (!signal.aborted) {
      const next = await getProcedureGenerationProgress(documentId, attemptId || undefined, signal);
      if (!attemptId && next.attempt_id) attemptId = next.attempt_id;
      onProgress(next);
      const status = asString(next.status).toLowerCase();
      if (FAILURE_STATUSES.includes(status)) {
        throw new Error(asString(next.error ?? next.message) || (status.includes("timeout") ? "Procedure generation timed out." : "Procedure generation failed."));
      }
      if (SUCCESS_STATUSES.includes(status)) {
        let completedPreview: unknown = next.preview ?? next.result ?? null;
        try {
          const response = await getProcedureStagePreview(documentId, sectionKey);
          completedPreview = response;
        } catch (caught) {
          if (!completedPreview) throw caught;
        }
        try {
          const updatedStage = await getProcedureStage(documentId, sectionKey);
          onStage(updatedStage);
          if (!completedPreview && updatedStage.procedure) completedPreview = updatedStage.procedure;
        } catch {
          // The preview endpoint remains the source of truth, as on the original page.
        }
        onPreview(completedPreview ?? next);
        onComplete(true);
        return;
      }
      await delay(POLL_MS, signal);
    }
  } catch (caught) {
    if (!signal.aborted) {
      const apiMessage = getApiErrorMessage(caught, "");
      onError(apiMessage || (caught instanceof Error ? caught.message : "Unable to generate the procedure and sampling plan."));
    }
  } finally {
    if (!signal.aborted) onRunning(false);
  }
}

function asString(value: unknown): string {
  return value == null ? "" : String(value);
}

function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}
