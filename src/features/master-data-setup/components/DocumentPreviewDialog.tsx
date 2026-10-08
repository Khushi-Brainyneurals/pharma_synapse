import { ChevronLeft, ChevronRight, Download, FileText, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog } from "../../../shared/ui/Dialog";
import { Identifier } from "../../../shared/ui/Identifier";
import { DocxViewer } from "../../preview/components/DocxViewer";
import { getOtherDocumentPreviewBlob, getStageDocumentPreviewBlob } from "../api/masterDataDocuments.api";
import type { DocDef, UploadedFile } from "../model/setup.model";

interface DocumentPreviewDialogProps {
  doc: DocDef;
  file: UploadedFile;
  onClose: () => void;
}

export function DocumentPreviewDialog({ doc, file, onClose }: DocumentPreviewDialogProps) {
  const [page, setPage] = useState(1);
  const totalPages = 2;

  const [blob, setBlob] = useState<Blob | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(file.blobUrl ?? null);
  const [isLoading, setIsLoading] = useState(!file.blobUrl);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (file.blobUrl) {
      setStreamUrl(file.blobUrl);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    const loader = file.stageKey
      ? getStageDocumentPreviewBlob("tablet", "bmr", file.stageKey, doc.code)
      : getOtherDocumentPreviewBlob("tablet", "bmr", doc.code);

    loader
      .then((b) => {
        if (!cancelled) {
          setBlob(b);
          setStreamUrl(URL.createObjectURL(b));
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not stream document preview from backend.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [doc.code, file.blobUrl, file.stageKey]);

  const handleDownload = () => {
    const targetUrl = streamUrl || file.blobUrl;
    if (targetUrl) {
      const a = document.createElement("a");
      a.href = targetUrl;
      a.download = file.filename;
      a.click();
      return;
    }
    // Fallback template download
    const dummyContent = `Format: ${file.format}\nDocument: ${doc.name} (${doc.code})\nFilename: ${file.filename}\nUploaded by: ${file.by}\nAt: ${file.at}\n\nThis is the blank approved master format template for ${doc.name}.`;
    const fallbackBlob = new Blob([dummyContent], {
      type: file.format === "PDF" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const url = URL.createObjectURL(fallbackBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Dialog title={`${doc.name}`} size="xl" onClose={onClose}>
      <div className="space-y-4">
        {/* Document metadata banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-sunken/40 p-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary">
              <FileText className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Identifier className="font-semibold text-text">{file.filename}</Identifier>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-subdued">
                  {file.format}
                </span>
                <span className="text-micro text-subdued">· {file.sizeKB} KB</span>
              </div>
              <p className="text-micro text-subdued">
                {doc.code} · Uploaded by {file.by} · {file.at}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex h-8 items-center gap-1.5 rounded-control border border-border bg-surface px-3 text-small font-semibold text-text transition hover:bg-muted"
            >
              <Download className="size-3.5" />
              Download
            </button>
          </div>
        </div>

        {/* Document preview container */}
        <div className="relative min-h-[460px] max-h-[70vh] overflow-y-auto rounded-card border border-border bg-muted/60 p-4 sm:p-6">
          {isLoading ? (
            <div className="flex h-96 flex-col items-center justify-center gap-3 text-subdued">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-small">Loading document preview from backend…</p>
            </div>
          ) : blob && (file.format === "DOCX" || file.filename.toLowerCase().endsWith(".docx")) ? (
            <DocxViewer file={{ blob, filename: file.filename, format: "docx" }} />
          ) : streamUrl && (file.format === "PDF" || file.filename.toLowerCase().endsWith(".pdf")) ? (
            <object
              data={streamUrl}
              type="application/pdf"
              className="h-[60vh] w-full rounded border border-border"
              aria-label={`${file.filename} preview`}
            >
              <PreviewDocumentSheet doc={doc} file={file} page={page} total={totalPages} />
            </object>
          ) : (
            <PreviewDocumentSheet doc={doc} file={file} page={page} total={totalPages} />
          )}
        </div>

        {/* Footer with page navigation and close button */}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex size-7 items-center justify-center rounded-control border border-border bg-surface text-subdued transition hover:bg-muted disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-micro font-medium text-subdued">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex size-7 items-center justify-center rounded-control border border-border bg-surface text-subdued transition hover:bg-muted disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-control border border-border bg-surface px-4 py-1.5 text-small font-semibold text-text hover:bg-muted"
          >
            Close
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function PreviewDocumentSheet({
  doc,
  file,
  page,
  total,
}: {
  doc: DocDef;
  file: UploadedFile;
  page: number;
  total: number;
}) {
  return (
    <div className="mx-auto max-w-2xl rounded-card border border-border/80 bg-white p-8 text-black shadow-sm">
      <div className="flex items-center justify-between border-b border-black/10 pb-3 text-[10px] font-semibold uppercase tracking-wider text-black/60">
        <span>UNIT-01 · Master Format Template</span>
        <span>Tablet · BMR</span>
      </div>

      <div className="my-6 text-center">
        <h3 className="text-base font-bold uppercase tracking-wide text-black">{doc.name}</h3>
        <p className="mt-1 text-[11px] font-medium text-black/60">
          Document Code: {doc.code} · Format: {file.format}
        </p>
      </div>

      {page === 1 ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-2.5 w-full rounded bg-black/10" />
            <div className="h-2.5 w-5/6 rounded bg-black/10" />
            <div className="h-2.5 w-4/6 rounded bg-black/10" />
          </div>

          <div className="mt-6 rounded border border-black/20 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-black/70">
              General Information &amp; Scope
            </p>
            <div className="grid grid-cols-2 gap-2 text-[10px] text-black/70">
              <div><span className="font-semibold">Document:</span> {doc.name}</div>
              <div><span className="font-semibold">Identifier:</span> {doc.code}</div>
              <div><span className="font-semibold">Review Round:</span> 1</div>
              <div><span className="font-semibold">Master Status:</span> Approved Blank Template</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-4 gap-px overflow-hidden rounded border border-black/15 bg-black/15 text-[10px]">
            <div className="bg-black/[0.07] p-2 font-bold text-center">Sr. No.</div>
            <div className="bg-black/[0.07] p-2 font-bold">Parameter / Test</div>
            <div className="bg-black/[0.07] p-2 font-bold">Standard Spec</div>
            <div className="bg-black/[0.07] p-2 font-bold text-center">Observed</div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="contents">
                <div className="bg-white p-2 text-center text-black/70">{i + 1}</div>
                <div className="bg-white p-2 text-black/70">Check point parameter #{i + 1}</div>
                <div className="bg-white p-2 text-black/70">Conforms to standard</div>
                <div className="bg-white p-2 text-center text-black/50">—</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded border border-black/15 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-black/70">
              Process Checks &amp; Verification Observations
            </p>
            <div className="space-y-2">
              <div className="h-2 w-full rounded bg-black/10" />
              <div className="h-2 w-11/12 rounded bg-black/10" />
              <div className="h-2 w-3/4 rounded bg-black/10" />
            </div>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3 text-[10px] text-black/70">
            {["Done by (Operator)", "Checked by (Production)", "Verified by (QA)"].map((s) => (
              <div key={s} className="rounded border border-black/20 p-3">
                <p className="font-bold uppercase text-[9px]">{s}</p>
                <div className="mt-6 border-t border-black/20 pt-1 text-center text-[9px] text-black/50">
                  Signature &amp; Date
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between border-t border-black/10 pt-3 text-[9px] text-black/50">
        <span>{file.filename}</span>
        <span>Page {page} of {total} · Approved Master Format</span>
      </div>
    </div>
  );
}

