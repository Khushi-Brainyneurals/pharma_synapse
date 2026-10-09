import { AlertCircle, Download, FileText, Loader2, Minus, Plus, StretchHorizontal } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormatPreviewFile } from "../api/preview.api";

export interface DocxViewerProps {
  file: FormatPreviewFile;
  hideHeader?: boolean;
  borderless?: boolean;
  containerHeightClass?: string;
  zoom?: number;
  className?: string;
}

export function DocxViewer({
  file,
  hideHeader = false,
  borderless = false,
  containerHeightClass,
  zoom: externalZoom,
  className,
}: DocxViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollWrapperRef = useRef<HTMLDivElement>(null);
  const renderVersionRef = useRef(0);
  const [isRendering, setIsRendering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [internalZoom, setInternalZoom] = useState(1);
  const [fitWidth, setFitWidth] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  // Measure container width for fit-to-width
  useLayoutEffect(() => {
    const node = scrollWrapperRef.current;
    if (!node) return;
    const measure = () => setContainerWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (fitWidth && containerWidth) {
      const scale = Math.min(1.25, Math.max(0.4, (containerWidth - 32) / 794));
      setInternalZoom(Number(scale.toFixed(2)));
    }
  }, [fitWidth, containerWidth]);

  const activeZoom = externalZoom ?? internalZoom;

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
          ignoreHeight: false, // Preserves standard A4 height (297mm)
          ignoreWidth: false,
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

  const heightClass = containerHeightClass ?? (hideHeader ? "h-auto min-h-[500px]" : "h-[750px]");

  const content = (
    <div
      ref={scrollWrapperRef}
      className={`relative ${heightClass} overflow-auto bg-neutral-100/90 p-4 sm:p-6 flex justify-center`}
    >
      {isRendering ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-neutral-100/90 text-subdued"
          role="status"
        >
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
          <span className="text-small">Rendering DOCX preview…</span>
        </div>
      ) : null}

      {error ? (
        <div className="m-auto max-w-md rounded-panel border border-danger/30 bg-danger-soft p-5">
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
        style={{ zoom: activeZoom }}
        className="format-preview-docx min-w-fit w-full flex flex-col items-center"
      />
    </div>
  );

  if (borderless && hideHeader) {
    return <div className={`w-full ${className ?? ""}`}>{content}</div>;
  }

  return (
    <div className={hideHeader ? "" : "px-4 py-2 sm:px-6 lg:px-8"}>
      <div className={`overflow-hidden rounded-panel border border-border bg-surface ${className ?? ""}`}>
        {!hideHeader && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-muted text-primary">
                <FileText className="size-4" aria-hidden="true" />
              </span>
              <span className="truncate text-small font-semibold" title={file.filename}>
                {file.filename}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Zoom controls */}
              <div className="flex items-center gap-1 rounded-control border border-border bg-surface p-0.5 text-micro">
                <button
                  type="button"
                  onClick={() => {
                    setFitWidth(false);
                    setInternalZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))));
                  }}
                  title="Zoom out"
                  className="flex size-6 items-center justify-center rounded-control text-subdued transition hover:bg-muted hover:text-text disabled:opacity-40"
                  disabled={activeZoom <= 0.4}
                >
                  <Minus className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFitWidth(false);
                    setInternalZoom(1);
                  }}
                  title="Reset to 100%"
                  className="w-10 text-center font-mono tabular-nums text-subdued hover:text-text"
                >
                  {Math.round(activeZoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFitWidth(false);
                    setInternalZoom((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))));
                  }}
                  title="Zoom in"
                  className="flex size-6 items-center justify-center rounded-control text-subdued transition hover:bg-muted hover:text-text disabled:opacity-40"
                  disabled={activeZoom >= 2.0}
                >
                  <Plus className="size-3" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setFitWidth((prev) => !prev)}
                title={fitWidth ? "Disable fit to width" : "Fit to width"}
                className={`flex h-7 items-center gap-1 rounded-control border px-2 text-micro font-medium transition ${
                  fitWidth
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-subdued hover:bg-muted hover:text-text"
                }`}
              >
                <StretchHorizontal className="size-3" />
                <span className="hidden sm:inline">Fit width</span>
              </button>

              <div className="flex shrink-0 items-center gap-2 text-micro text-subdued">
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
          </div>
        )}

        {content}
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
