import { AlertCircle, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { useAuthStore } from "../../auth/state/auth.store";
import { DocumentViewer } from "../../../shared/document/DocumentViewer";
import { AppHeader } from "../../../app/layout/AppHeader";
import { AppSidebar } from "../../../app/layout/AppSidebar";
import { DocxViewer } from "../../document-workflows/shared/components/DocxViewer";
import { getDocumentPdf } from "../../document-workflows/bmr-bpr/generate/api/generate.api";
import { finalizeDocument, getReviewPageData, type FinalizeAttachment, type ReviewPageData } from "../api/review.api";

export function DocumentFinalizePage() {
  const { documentId = "" } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [pageData, setPageData] = useState<ReviewPageData | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [isPreviewDocx, setIsPreviewDocx] = useState(true);
  const [isPreviewLoading, setIsPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [productCode, setProductCode] = useState("");
  const [documentNo, setDocumentNo] = useState("");
  const [bmrNo, setBmrNo] = useState("");
  const [bprNo, setBprNo] = useState("");
  const [attachments, setAttachments] = useState<FinalizeAttachment[]>([]);
  const [ccnNo, setCcnNo] = useState("");
  const [ccnApprovalDate, setCcnApprovalDate] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    getReviewPageData(documentId)
      .then((data) => { if (active) setPageData(data); })
      .catch((caught) => { if (active) setError(getApiErrorMessage(caught, "Could not load this document.")); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [documentId]);

  useEffect(() => {
    let active = true;
    setPreviewBlob(null);
    setPreviewError(null);
    setIsPreviewLoading(true);

    void getDocumentPdf(documentId)
      .then(async (blob) => {
        if (!active) return;
        const signature = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
        if (!active) return;
        const isPdf = String.fromCharCode(...signature) === "%PDF-";
        setIsPreviewDocx(!isPdf);
        setPreviewBlob(blob);
      })
      .catch((caught) => {
        if (active) {
          setPreviewError(getApiErrorMessage(caught, "Could not load the document preview."));
        }
      })
      .finally(() => {
        if (active) setIsPreviewLoading(false);
      });

    return () => { active = false; };
  }, [documentId]);

  const previewFile = useMemo(
    () => previewBlob
      ? { blob: previewBlob, filename: `${pageData?.document.bmr_number ?? documentId}.docx`, format: "docx" as const }
      : null,
    [documentId, pageData?.document.bmr_number, previewBlob],
  );

  const canFinalize = user?.role === "preparer" && pageData?.document.status === "approved_for_print";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsBusy(true);
    setError(null);
    try {
      await finalizeDocument(documentId, {
        product_code: productCode.trim(),
        document_no: documentNo.trim(),
        bmr_no: bmrNo.trim(),
        bpr_no: bprNo.trim(),
        attachments: attachments.filter((item) => item.name.trim()).map((item) => ({
          name: item.name.trim(),
          pages: Number(item.pages) || 0,
        })),
        ccn_no: ccnNo.trim(),
        ccn_approval_date: ccnApprovalDate,
      });
      navigate("/");
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not finalize this document."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader user={user} unit={user?.unitId ? { id: user.unitId } : null} title="Finalize document" />
      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />
        <main className="min-w-0 min-h-0 p-4 lg:p-6 lg:h-full lg:overflow-y-auto">
          <div className="mx-auto max-w-[1440px] space-y-5">
            <header>
              <h1 className="text-h1 font-semibold">Finalize document</h1>
              <p className="mt-1 text-small text-subdued">
                Add the official product and document identifiers. Finalization creates the controlled v00 document.
              </p>
            </header>

            {error ? (
              <div className="flex items-start gap-2 rounded-panel border border-danger/30 bg-danger-soft p-4">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                <p className="text-small text-danger">{error}</p>
              </div>
            ) : null}

            {isLoading ? (
              <div className="flex items-center justify-center gap-2 rounded-panel border border-border bg-surface p-16 text-subdued">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                <span className="text-small">Loading document…</span>
              </div>
            ) : !canFinalize ? (
              <div className="rounded-panel border border-border bg-surface p-6">
                <p className="text-small font-semibold">Finalization is not available</p>
                <p className="mt-1 text-small text-subdued">
                  Only the preparer can finalize a document after it is approved for print.
                </p>
              </div>
            ) : (
              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
                  {previewFile ? (
                    isPreviewDocx ? (
                      <DocxViewer
                        file={previewFile}
                        containerHeightClass="h-[calc(100vh-300px)] min-h-[420px]"
                      />
                    ) : (
                      <DocumentViewer
                        docKey={documentId}
                        load={() => Promise.resolve(previewFile.blob)}
                        fileName={previewFile.filename.replace(/\.docx$/, ".pdf")}
                        loadingLabel="Loading document preview…"
                        errorTitle="Could not load the document preview"
                      />
                    )
                  ) : (
                    <div className="rounded-control border border-border bg-sunken/40 p-10 text-center text-small text-subdued">
                      {isPreviewLoading
                        ? "Loading document preview…"
                        : previewError ?? "The document preview is not available."}
                    </div>
                  )}
              <form onSubmit={(event) => void submit(event)} className="space-y-5 rounded-panel border border-border bg-surface p-5 text-subdued">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Product code" value={productCode} onChange={setProductCode} />
                  <Field label="Document number" value={documentNo} onChange={setDocumentNo} />
                  <Field label="BMR number" value={bmrNo} onChange={setBmrNo} />
                  <Field label="BPR number" value={bprNo} onChange={setBprNo} />
                  <Field label="CCN number" value={ccnNo} onChange={setCcnNo} />
                  <label className="flex flex-col gap-1.5 text-small font-medium">
                    CCN approval date
                    <input type="date" value={ccnApprovalDate} onChange={(event) => setCcnApprovalDate(event.target.value)} className="h-10 rounded-control text-text border border-border bg-surface px-3 font-normal focus:outline-none focus:ring-1 focus:ring-primary/25" />
                  </label>
                </div>

                <section className="space-y-3 border-t border-border pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-small font-semibold">Attachments</h2>
                      <p className="text-micro text-subdued">Optional attachment names and page counts.</p>
                    </div>
                    <button type="button" onClick={() => setAttachments((items) => [...items, { name: "", pages: 0 }])} className="inline-flex items-center gap-1.5 rounded-control border border-border px-3 py-2 text-small font-semibold hover:bg-muted">
                      <Plus className="size-4" aria-hidden="true" /> Add
                    </button>
                  </div>
                  {attachments.map((attachment, index) => (
                    <div key={index} className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]">
                      <input aria-label={`Attachment ${index + 1} name`} value={attachment.name} onChange={(event) => setAttachments((items) => items.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} placeholder="Attachment name" className="h-10 rounded-control border border-border bg-surface px-3 text-small focus:outline-none focus:ring-1 focus:ring-primary/25" />
                      <input aria-label={`Attachment ${index + 1} pages`} type="number" min="0" value={attachment.pages} onChange={(event) => setAttachments((items) => items.map((item, i) => i === index ? { ...item, pages: Number(event.target.value) } : item))} placeholder="Pages" className="h-10 rounded-control border border-border bg-surface px-3 text-small focus:outline-none focus:ring-1 focus:ring-primary/25" />
                      <button type="button" aria-label={`Remove attachment ${index + 1}`} onClick={() => setAttachments((items) => items.filter((_, i) => i !== index))} className="inline-flex h-10 items-center justify-center rounded-control border border-border px-3 text-subdued hover:bg-muted">
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </section>

                <div className="flex justify-end border-t border-border pt-4">
                  <button type="submit" disabled={isBusy} className="inline-flex items-center gap-2 rounded-control bg-primary px-4 py-2 text-small font-semibold text-white disabled:opacity-60">
                    {isBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                    Finalize document
                  </button>
                </div>
              </form>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5 text-small font-medium">
      {label}
      <input required={required} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-control border border-border bg-surface px-3 text-text font-normal focus:outline-none focus:ring-1 focus:ring-primary/25" />
    </label>
  );
}
