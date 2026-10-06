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
import { useParams } from "react-router-dom";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { useAuthStore } from "../../auth/state/auth.store";
import { AppHeader } from "../../new-document/components/AppHeader";
import { AppSidebar } from "../../new-document/components/AppSidebar";
import { WizardHeader } from "../../new-document/components/WizardHeader";
import { useDocument } from "../../new-document/hooks/useDocument";
import { useStepNavigation } from "../../new-document/hooks/useStepNavigation";
import { generateBom, getBom, getCoverBomDocx } from "../api/bom.api";
import type { BomResponse } from "../api/bom.types";
import { BomEditTable, type BomFieldChange } from "../components/BomEditTable";
import { CoverBomDocument } from "../components/CoverBomDocument";
import {
  acceptCoverBom,
  getCorrections,
  raiseCorrection,
  reopenCorrection,
  resolveCorrection,
  type CorrectionsState,
  type NewCorrection,
} from "../api/corrections.api";
import { CorrectionDialog, type CorrectionTarget } from "../components/CorrectionDialog";
import { CorrectionsPanel } from "../components/CorrectionsPanel";

const POLL_INTERVAL_MS = 5000;

export function CoverBomPage() {
  const { documentId = "" } = useParams();
  const user = useAuthStore((state) => state.user);
  const { goToStep } = useStepNavigation(documentId);
  const { document: documentState, reload: reloadDocument } = useDocument(documentId);

  const [bom, setBom] = useState<BomResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [corrections, setCorrections] = useState<CorrectionsState | null>(null);
  const [correcting, setCorrecting] = useState<CorrectionTarget | null>(null);
  const [busyCorrection, setBusyCorrection] = useState<number | null>(null);
  const [acceptWarning, setAcceptWarning] = useState(false);
  const [editingBom, setEditingBom] = useState(false);
  const [savingBom, setSavingBom] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const pollRef = useRef<number | null>(null);

  // The reference pill: the BMR number once assigned (at submission), otherwise the
  // document id — matching the designed draft screen. The wizard document is a DRAFT
  // until it's submitted for review.
  const identifier = bom?.header.bmr_number ?? documentState?.bmr_number ?? documentId;

  // Editing a BOM cell files a correction against that row — the BOM is only ever
  // changed through the structured table, never inside the Word document. Only the
  // cells the user actually changed are sent.
  const saveBomEdits = useCallback(
    async (changes: BomFieldChange[]) => {
      if (changes.length === 0) {
        setEditingBom(false);
        return;
      }

      setSavingBom(true);
      try {
        let state: CorrectionsState | null = corrections;
        for (const item of changes) {
          state = await raiseCorrection(documentId, {
            target: `BOM · Sr ${item.sr_no ?? item.row_index + 1} · ${item.label}`,
            target_kind: "bom",
            target_key: item.material_code,
            row_index: item.row_index,
            current_value: item.from,
            proposed_value: item.to,
            reason: "Edited in the BOM table",
          });
        }
        setCorrections(state);
        setEditingBom(false);
      } catch (caught) {
        setError(getApiErrorMessage(caught, "Could not save the BOM changes."));
      } finally {
        setSavingBom(false);
      }
    },
    [corrections, documentId],
  );

  const downloadCoverBomDocx = useCallback(async () => {
    setDownloading(true);
    try {
      const blob = await getCoverBomDocx(documentId);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `BMR-${documentId}-cover-bom.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not download the document."));
    } finally {
      setDownloading(false);
    }
  }, [documentId]);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const next = await getBom(documentId);
      setBom(next);
      setError(null);

      if (next.status !== "extracting") {
        stopPolling();
        setCorrections(await getCorrections(documentId).catch(() => null));
      }

      return next;
    } catch (caught) {
      stopPolling();
      setError(getApiErrorMessage(caught, "Could not load the Cover + BOM."));
      return null;
    }
  }, [documentId, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = window.setInterval(() => void load(), POLL_INTERVAL_MS);
  }, [load, stopPolling]);

  const startExtraction = useCallback(async () => {
    setIsStarting(true);
    setError(null);

    try {
      await generateBom(documentId);
      await load();
      startPolling();
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not start extraction."));
    } finally {
      setIsStarting(false);
    }
  }, [documentId, load, startPolling]);

  // On entry: read current state. Extraction is expensive, so only kick it off if it
  // has never run — never re-run it just because the user reloaded the page.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const current = await load();
      if (cancelled || !current) {
        return;
      }

      if (current.status === "extracting") {
        startPolling();
      } else if (current.status === "core_inputs_set") {
        await startExtraction();
      }
    })();

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [load, startExtraction, startPolling, stopPolling]);

  const addCorrection = useCallback(
    async (correction: NewCorrection) => {
      setCorrections(await raiseCorrection(documentId, correction));
      setCorrecting(null);
    },
    [documentId],
  );

  const changeCorrection = useCallback(
    async (id: number, action: "resolve" | "reopen") => {
      setBusyCorrection(id);
      try {
        setCorrections(
          action === "resolve"
            ? await resolveCorrection(documentId, id)
            : await reopenCorrection(documentId, id),
        );
      } finally {
        setBusyCorrection(null);
      }
    },
    [documentId],
  );

  // Open corrections don't block continuing — but doing so must be deliberate, and
  // the acknowledgement is written to the audit trail.
  const accept = useCallback(
    async (acknowledge = false) => {
      try {
        await acceptCoverBom(documentId, acknowledge);
        setAcceptWarning(false);
        goToStep("stages");
      } catch (caught) {
        if (corrections?.has_unresolved && !acknowledge) {
          setAcceptWarning(true);
          return;
        }
        setError(getApiErrorMessage(caught, "Could not accept the cover and BOM."));
      }
    },
    [corrections, documentId, goToStep],
  );

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

            {error ? <ErrorPanel message={error} onRetry={() => void startExtraction()} /> : null}

            {status === "extracting" || isStarting ? <ExtractingPanel /> : null}

            {status === "extraction_failed" ? (
              <ErrorPanel
                message={bom?.error_message ?? "Extraction failed."}
                onRetry={() => void startExtraction()}
              />
            ) : null}

            {status === "extracted" && bom ? (
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
                        >
                          {/* Pass corrections as children so they render inside the table,
                              above its internal sticky footer */}
                          {corrections && corrections.corrections.length > 0 ? (
                            <CorrectionsPanel
                              corrections={corrections.corrections}
                              onResolve={(id) => void changeCorrection(id, "resolve")}
                              onReopen={(id) => void changeCorrection(id, "reopen")}
                              busyId={busyCorrection}
                            />
                          ) : null}
                        </BomEditTable>
                  </>
                ) : (
                  <>
                    {/* The real document as it will print — the .docx rendered by the AI
                        backend and shown as a PDF (cover + BOM). This is the actual output,
                        not a browser re-creation, so what's reviewed is what's produced. */}
                    <CoverBomDocument documentId={documentId} />

                    {corrections && corrections.corrections.length > 0 ? (
                      <CorrectionsPanel
                        corrections={corrections.corrections}
                        onResolve={(id) => void changeCorrection(id, "resolve")}
                        onReopen={(id) => void changeCorrection(id, "reopen")}
                        busyId={busyCorrection}
                      />
                    ) : null}

                    {acceptWarning && corrections ? (
                      <div className="rounded-card border border-draft-fg/30 bg-draft-bg p-5">
                        <p className="text-small font-semibold text-draft-fg">
                          Continue with {corrections.open_count} correction
                          {corrections.open_count === 1 ? "" : "s"} still open?
                        </p>
                        <p className="mt-1 text-small text-draft-fg">
                          The document moves on carrying these observations. They stay on the
                          record, and the audit trail will show that you chose to proceed.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void accept(true)}
                            className="h-[34px] rounded-control bg-primary px-3.5 text-small font-semibold text-white transition hover:bg-primary-dark"
                          >
                            Accept with corrections open
                          </button>
                          <button
                            type="button"
                            onClick={() => setAcceptWarning(false)}
                            className="h-[34px] rounded-control border border-border bg-surface px-3.5 text-small font-semibold transition hover:bg-primary/10"
                          >
                            Go back and resolve them
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t bg-surface p-3.5 shadow-auth">
                      <div className="flex items-center gap-2 text-small text-subdued">
                        <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                        Latest generated version loaded
                        {corrections?.open_count
                          ? ` · ${corrections.open_count} correction(s) open`
                          : ` · ${bom.ingredients.length} ingredients`}
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
                        <button
                          type="button"
                          onClick={() => setEditingBom(true)}
                          className="inline-flex items-center gap-2 rounded-control border border-border px-4 py-2 text-small font-semibold transition hover:bg-primary/10"
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                          Edit BOM
                        </button>
                        <button
                          type="button"
                          onClick={() => void accept(false)}
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

      {correcting ? (
        <CorrectionDialog
          target={correcting}
          onCancel={() => setCorrecting(null)}
          onAdd={addCorrection}
        />
      ) : null}
    </div>
  );
}


function ExtractingPanel() {
  return (
    <div className="rounded-panel border border-border bg-surface p-10 mx-8 text-center">
      <Loader2 className="mx-auto size-6 animate-spin text-primary" aria-hidden="true" />
      <p className="mt-3 text-small font-semibold">Reading your MFC…</p>
      <p className="mt-1 text-small text-subdued">
        Scanning the document and extracting the formulation. This usually takes a few
        minutes — you can leave this page open.
      </p>
    </div>
  );
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
