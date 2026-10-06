import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Download, Info, Loader2, Pencil } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { useAuthStore } from "../../auth/state/auth.store";
import { AppHeader } from "../../new-document/components/AppHeader";
import { AppSidebar } from "../../new-document/components/AppSidebar";
import { WizardHeader } from "../../new-document/components/WizardHeader";
import { useDocument } from "../../new-document/hooks/useDocument";
import { useStepNavigation } from "../../new-document/hooks/useStepNavigation";
import { DocumentViewer } from "../../../shared/document/DocumentViewer";
import {
  getFormatPreview,
  InvalidFormatPreviewError,
  type FormatPreviewFile,
} from "../api/preview.api";
import { DocxViewer } from "../components/DocxViewer";

export function PreviewPage() {
  const { documentId = "" } = useParams();
  const user = useAuthStore((state) => state.user);
  const { goToStep } = useStepNavigation(documentId);
  const { document: documentState } = useDocument(documentId);

  const [formatPreview, setFormatPreview] = useState<FormatPreviewFile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      setFormatPreview(await getFormatPreview(documentId));
    } catch (caught) {
      setFormatPreview(null);
      setError(
        caught instanceof InvalidFormatPreviewError
          ? caught.message
          : getApiErrorMessage(caught, "The preview could not be loaded."),
      );
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDownload = useCallback(async () => {
    if (!formatPreview) return;

    setIsDownloading(true);
    setError(null);
    try {
      const url = window.URL.createObjectURL(formatPreview.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = formatPreview.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not download the preview."));
    } finally {
      setIsDownloading(false);
    }
  }, [formatPreview]);

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader user={user} unit={user?.unitId ? { id: user.unitId } : null} />

      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />

        <main className="min-w-0 min-h-0 lg:h-full lg:overflow-y-auto">
          <div className="mx-auto space-y-5">
            <WizardHeader
              activeStepId="preview"
              completedStepIds={documentState?.completed_steps ?? []}
              onStepClick={goToStep}
              title="Page-1 preview"
              description="Check the letterhead, fonts and header/footer now — it is far cheaper to fix here than after the MFC has been read."
              identifier={documentState?.bmr_number ?? documentState?.draft_id ?? documentId}
              status="DRAFT"
              dosageForm={documentState?.dosage_form}
              docType={documentState?.doc_type}
            />

            {isLoading ? <LoadingState /> : null}

            {error && !isLoading ? (
              <ErrorState message={error} onRetry={() => void load()} />
            ) : null}

            {formatPreview && !isLoading ? (
              <>
                <div className="flex items-start gap-2 rounded-panel border border-border bg-muted p-4">
                  <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <p className="text-small text-subdued">
                    The latest format preview has been generated from the saved Core
                    Inputs. Review the rendered page below or download{" "}
                    <strong>{formatPreview.filename}</strong>.
                  </p>
                </div>

                {formatPreview.format === "pdf" ? (
                  <DocumentViewer
                    docKey={`${documentId}:${formatPreview.filename}`}
                    load={() => Promise.resolve(formatPreview.blob)}
                    fileName={formatPreview.filename}
                    loadingLabel="Rendering format preview…"
                    errorTitle="Could not render the format preview"
                  />
                ) : (
                  <DocxViewer file={formatPreview} />
                )}

                {/* Sticky Footer matching Cover + BOM Page */}
                <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t bg-surface p-3.5 shadow-auth">
                  <div className="flex items-center gap-2 text-small text-subdued">
                    <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                    Preview generated from the latest saved core inputs
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleDownload()}
                      disabled={isDownloading}
                      className="inline-flex items-center gap-2 rounded-control border border-border px-4 py-2 text-small font-semibold transition hover:bg-primary/10 disabled:opacity-50"
                    >
                      {isDownloading ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Download className="size-4" aria-hidden="true" />
                      )}
                      Download Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => goToStep("inputs")}
                      className="inline-flex items-center gap-2 rounded-control border border-border px-4 py-2 text-small font-semibold transition hover:bg-primary/10"
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                      Edit Core inputs
                    </button>
                    <button
                      type="button"
                      onClick={() => goToStep("cover-bom")}
                      className="inline-flex items-center gap-2 rounded-control bg-primary px-4 py-2 text-small font-semibold text-white transition hover:bg-primary-dark"
                    >
                      Proceed to Cover + BOM
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-panel border border-border bg-surface p-16 text-subdued mx-8">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      <span className="text-small">Rendering page 1…</span>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-panel border border-danger/30 bg-danger-soft p-5 mx-8">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-small font-semibold text-danger">Could not render the preview</p>
          <p className="mt-1 text-small text-subdued">{message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-control border border-border bg-surface px-3 py-1.5 text-small font-semibold transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}
