import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  Loader2,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { useAuthStore } from "../../auth/state/auth.store";
import { AppHeader } from "../../new-document/components/AppHeader";
import { AppSidebar } from "../../new-document/components/AppSidebar";
import { WizardHeader } from "../../new-document/components/WizardHeader";
import { useDocument } from "../../new-document/hooks/useDocument";
import { useStepNavigation } from "../../new-document/hooks/useStepNavigation";
import {
  generateBom,
  getBom,
  getCoverBomDocx,
  getCoverGenerationProgress,
  updateBom,
} from "../api/bom.api";
import type { BomResponse, CoverPreviewFile, GenerateCoverProgress } from "../api/bom.types";
import { BomEditTable, type BomFieldChange } from "../components/BomEditTable";
import { CoverBomDocument } from "../components/CoverBomDocument";

const POLL_INTERVAL_MS = 1500;

export function CoverBomPage() {
  const { documentId = "" } = useParams();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const { goToStep } = useStepNavigation(documentId);
  const { document: documentState } = useDocument(documentId);

  const [bom, setBom] = useState<BomResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [preview, setPreview] = useState<CoverPreviewFile | null>(null);
  const [generationProgress, setGenerationProgress] = useState<GenerateCoverProgress | null>(null);
  const [editingBom, setEditingBom] = useState(false);
  const [savingBom, setSavingBom] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const generationControllerRef = useRef<AbortController | null>(null);
  const generationInFlightRef = useRef(false);
  const resumeGeneration = Boolean((location.state as { coverGenerationStarted?: boolean } | null)?.coverGenerationStarted);
  const isBmr = bom?.doc_type === "bmr";

  // The reference pill: the BMR number once assigned (at submission), otherwise the
  // document id — matching the designed draft screen. The wizard document is a DRAFT
  // until it's submitted for review.
  const identifier = bom?.header.bmr_number ?? documentState?.bmr_number ?? documentId;

  const saveBomEdits = useCallback(
    async (changes: BomFieldChange[]) => {
      if (changes.length === 0) {
        setEditingBom(false);
        return;
      }

      setSavingBom(true);
      setError(null);
      try {
        if (!bom || bom.doc_type !== "bmr") return;
        await updateBom(documentId, {
          ingredient_edits: buildIngredientEdits(bom, changes),
          user: user?.username ?? user?.id ?? "",
        });
        setPreview(null);
        const [nextBom, nextPreview] = await Promise.all([
          getBom(documentId),
          getCoverBomDocx(documentId),
        ]);
        setBom(nextBom);
        setPreview(nextPreview);
        setEditingBom(false);
      } catch (caught) {
        setError(getApiErrorMessage(caught, "Could not save the BOM changes."));
      } finally {
        setSavingBom(false);
      }
    },
    [bom, documentId, user?.id, user?.username],
  );

  const downloadCoverBomDocx = useCallback(async () => {
    setDownloading(true);
    try {
      const file = preview ?? await getCoverBomDocx(documentId);
      const url = window.URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not download the document."));
    } finally {
      setDownloading(false);
    }
  }, [documentId, preview]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setPreview(null);
    try {
      const next = await getBom(documentId, signal);
      setBom(next);
      setError(null);
      setPreview(next.preview_url ? await getCoverBomDocx(documentId, signal) : null);

      return next;
    } catch (caught) {
      if (signal?.aborted) return null;
      setError(getApiErrorMessage(caught, "Could not load the Cover + BOM."));
      return null;
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [documentId]);

  const runGeneration = useCallback(async (startGeneration: boolean) => {
    if (generationInFlightRef.current) return;
    generationInFlightRef.current = true;
    setIsStarting(true);
    setError(null);
    setPreview(null);
    setGenerationProgress(null);
    const controller = new AbortController();
    generationControllerRef.current = controller;

    try {
      if (startGeneration) await generateBom(documentId, controller.signal);
      while (!controller.signal.aborted) {
        const progress = await getCoverGenerationProgress(documentId, controller.signal);
        setGenerationProgress(progress);
        if (progress.status === "error") {
          throw new Error(progress.error || "Cover generation failed.");
        }
        if (progress.status === "done") {
          const [nextBom, nextPreview] = await Promise.all([
            getBom(documentId, controller.signal),
            getCoverBomDocx(documentId, controller.signal),
          ]);
          setBom(nextBom);
          setPreview(nextPreview);
          break;
        }
        await delay(POLL_INTERVAL_MS, controller.signal);
      }
    } catch (caught) {
      if (!controller.signal.aborted) {
        setError(getApiErrorMessage(caught, "Could not generate the Cover + BOM."));
      }
    } finally {
      if (generationControllerRef.current === controller) {
        generationControllerRef.current = null;
        generationInFlightRef.current = false;
        setIsStarting(false);
        setIsLoading(false);
      }
    }
  }, [documentId]);

  useEffect(() => {
    const loadController = new AbortController();
    if (resumeGeneration) void runGeneration(false);
    else {
      void (async () => {
        const current = await load(loadController.signal);
        if (!current || current.status !== "not_generated" || loadController.signal.aborted) return;
        try {
          const progress = await getCoverGenerationProgress(documentId, loadController.signal);
          if (progress.status === "started" || progress.status === "running" || progress.status === "done") {
            setGenerationProgress(progress);
            void runGeneration(false);
          }
        } catch {
          // No generation exists yet. Stay in the explicit "not generated" state.
        }
      })();
    }
    return () => {
      loadController.abort();
      const controller = generationControllerRef.current;
      generationControllerRef.current = null;
      generationInFlightRef.current = false;
      controller?.abort();
    };
  }, [load, resumeGeneration, runGeneration]);

  const accept = useCallback(() => goToStep("stages"), [goToStep]);

  const status = bom?.status;

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader user={user} unit={user?.unitId ? { id: user.unitId } : null} />

      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />

        <main className="min-w-0 min-h-0 lg:h-full lg:overflow-y-auto">
          <div className="mx-auto space-y-5">
            <WizardHeader
              activeStepId="cover-bom"
              completedStepIds={documentState?.completed_steps ?? []}
              onStepClick={goToStep}
              title="Cover + BOM"
              status="DRAFT"
              dosageForm={documentState?.dosage_form}
              docType={documentState?.doc_type}
            />

            {error ? <ErrorPanel message={error} onRetry={() => void runGeneration(true)} /> : null}

            {isLoading && !isStarting ? <LoadingPanel /> : null}

            {isStarting ? <ExtractingPanel progress={generationProgress} /> : null}

            {!isLoading && !isStarting && !error && status === "not_generated" ? (
              <NotGeneratedPanel onGenerate={() => void runGeneration(true)} />
            ) : null}

            {status === "extracted" && bom && (preview || editingBom) ? (
              <>
                {bom.warnings.length > 0 ? (
                  <div className="rounded-panel border border-draft-fg/30 bg-draft-bg p-4 mx-8">
                    <div className="flex items-start gap-2">
                      <AlertTriangle
                        className="mt-0.5 size-4 shrink-0 text-draft-fg"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-small font-semibold text-draft-fg">
                          {bom.warnings.length} thing
                          {bom.warnings.length === 1 ? "" : "s"} to check
                        </p>
                        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-small text-draft-fg">
                          {bom.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : null}

                {editingBom ? (
                  <>
                    {/* The structured formulation sheet — the BOM is only ever changed
                        here, never inside the Word document. Editing a supported cell
                        files a correction against that row. */}
                    <BomEditTable
                          ingredients={bom.ingredients}
                          onSave={(changes) => void saveBomEdits(changes)}
                          onCancel={() => setEditingBom(false)}
                          saving={savingBom}
                        />
                  </>
                ) : (
                  <>
                    {preview ? <CoverBomDocument file={preview} /> : null}

                    <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t bg-surface p-3.5 shadow-auth">
                      <div className="flex items-center gap-2 text-small text-subdued">
                        <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                        Latest generated version loaded
                        {bom.doc_type === "bmr" ? ` · ${bom.ingredients.length} ingredients` : ""}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void downloadCoverBomDocx()}
                          disabled={downloading}
                          className="inline-flex items-center gap-2 rounded-control border border-border px-4 py-2 text-small font-semibold transition hover:bg-primary/10 disabled:opacity-50"
                        >
                          {downloading ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Download className="size-4" aria-hidden="true" />
                          )}
                          Download DOCX
                        </button>
                        {isBmr ? (
                          <button
                            type="button"
                            onClick={() => setEditingBom(true)}
                            className="inline-flex items-center gap-2 rounded-control border border-border px-4 py-2 text-small font-semibold transition hover:bg-primary/10"
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                            Edit BOM
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={accept}
                          className="inline-flex items-center gap-2 rounded-control bg-primary px-4 py-2 text-small font-semibold text-white transition hover:bg-primary-dark"
                        >
                          Proceed to Select Stages
                          <ArrowRight className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : null}
          </div>
        </main>
      </div>

    </div>
  );
}


function ExtractingPanel({ progress }: { progress: GenerateCoverProgress | null }) {
  const percent = Math.min(100, Math.max(0, Math.round(progress?.percent ?? 0)));
  return (
    <div className="rounded-panel border border-border bg-surface p-10 mx-8 text-center">
      <Loader2 className="mx-auto size-6 animate-spin text-primary" aria-hidden="true" />
      <p className="mt-3 text-small font-semibold">{progress?.step || "Starting Cover + BOM generation…"}</p>
      <div className="mx-auto mt-4 flex max-w-xl items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <span className="text-small font-semibold text-subdued whitespace-nowrap">
        {percent}%
      </span>
    </div>
    </div>
  );
}

function LoadingPanel() {
  return <div className="mx-8 flex items-center justify-center gap-2 rounded-panel border border-border bg-surface p-10 text-subdued"><Loader2 className="size-5 animate-spin" /><span className="text-small">Loading Cover + BOM…</span></div>;
}

function NotGeneratedPanel({ onGenerate }: { onGenerate: () => void }) {
  return <div className="mx-8 rounded-panel border border-border bg-surface p-8 text-center"><p className="text-small font-semibold">Cover + BOM has not been generated.</p><button type="button" onClick={onGenerate} className="mt-4 inline-flex items-center gap-2 rounded-control bg-primary px-4 py-2 text-small font-semibold text-white"><RefreshCw className="size-4" />Generate Cover + BOM</button></div>;
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-panel border border-danger/30 bg-danger-soft p-5">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-small font-semibold text-danger">Extraction failed</p>
          <p className="mt-1 break-words text-small text-subdued">{message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-2 rounded-control border border-border bg-surface px-3 py-1.5 text-small font-semibold transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

function buildIngredientEdits(bom: BomResponse, changes: BomFieldChange[]) {
  const rows = new Map<number, { ingredient_name: string; sr_no: number; uom: string }>();
  for (const change of changes) {
    const ingredient = bom.ingredients[change.row_index];
    if (!ingredient) continue;
    const edit = rows.get(change.row_index) ?? {
      ingredient_name: ingredient.name,
      sr_no: ingredient.sr_no ?? 0,
      uom: ingredient.uom ?? "kg",
    };
    if (change.field === "name") edit.ingredient_name = change.to.trim();
    if (change.field === "sr_no") edit.sr_no = Number(change.to);
    if (change.field === "uom") edit.uom = change.to.trim();
    rows.set(change.row_index, edit);
  }
  return [...rows.values()];
}

function delay(ms: number, signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}
