import { AlertCircle, Download, FileText, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormatPreviewFile } from "../api/preview.api";

export function DocxViewer({
  file,
  hideHeader = false,
}: {
  file: FormatPreviewFile;
  hideHeader?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderVersionRef = useRef(0);
  const [isRendering, setIsRendering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderVersion = renderVersionRef.current + 1;
    renderVersionRef.current = renderVersion;
    const staging = document.createElement("div");

    setIsRendering(true);
    setError(null);
    container.replaceChildren();

    void import("docx-preview")
      .then(({ renderAsync }) =>
        renderAsync(file.blob, staging, staging, {
          breakPages: true,
          inWrapper: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          useBase64URL: true,
          ignoreHeight: true,
        }),
      )
      .then(() => {
        if (renderVersionRef.current === renderVersion) {
          container.replaceChildren(...Array.from(staging.childNodes));
        }
      })
      .catch(() => {
        if (renderVersionRef.current === renderVersion) {
          setError("The returned DOCX could not be rendered. Download it and verify the file in Word.");
        }
      })
      .finally(() => {
        if (renderVersionRef.current === renderVersion) setIsRendering(false);
      });

    return () => {
      if (renderVersionRef.current === renderVersion) renderVersionRef.current += 1;
      container.replaceChildren();
    };
  }, [file, retryKey]);

  const download = useCallback(() => {
    const url = window.URL.createObjectURL(file.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className={hideHeader ? "" : "px-4 py-2 sm:px-6 lg:px-8"}>
      <div className="overflow-hidden rounded-panel border border-border bg-surface">
        {!hideHeader && (
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-muted text-primary">
                <FileText className="size-4" aria-hidden="true" />
              </span>
              <span className="truncate text-small font-semibold" title={file.filename}>
                {file.filename}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-micro text-subdued">
              <span className="tabular-nums">{formatBytes(file.blob.size)}</span>
              <button
                type="button"
                onClick={download}
                title="Download DOCX"
                aria-label="Download DOCX"
                className="flex size-7 items-center justify-center rounded-control text-subdued transition hover:bg-muted hover:text-text"
              >
                <Download className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        <div className={`relative ${hideHeader ? "h-[50vh] max-h-[480px]" : "h-[720px]"} overflow-auto bg-sunken p-4 sm:p-6`}>
          {isRendering ? (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-sunken text-subdued"
              role="status"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              <span className="text-small">Rendering DOCX preview…</span>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-panel border border-danger/30 bg-danger-soft p-5">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                <div className="flex-1">
                  <p className="text-small font-semibold text-danger">Could not render the preview</p>
                  <p className="mt-1 text-small text-subdued">{error}</p>
                  <button
                    type="button"
                    onClick={() => setRetryKey((key) => key + 1)}
                    className="mt-3 rounded-control border border-border bg-surface px-3 py-1.5 text-small font-semibold transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div
            ref={containerRef}
            className="format-preview-docx min-w-fit [&_.docx-wrapper]:bg-transparent [&_.docx-wrapper]:p-0"
          />
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
