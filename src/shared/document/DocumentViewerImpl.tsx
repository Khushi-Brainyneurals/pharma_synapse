import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RefreshCw,
  Search,
  StretchHorizontal,
  X,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { getApiErrorMessage } from "../api/apiError";

// pdf.js parses the file in a web worker. Vite bundles this worker and rewrites the URL
// to a hashed asset at build time; without it the <Document> silently renders nothing.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const ZOOM_STEP = 0.15;
const MIN_SCALE = 0.4;
const MAX_SCALE = 4;
/** Horizontal breathing room so a fit-to-width page never touches the scrollbar. */
const FIT_GUTTER = 40;

export interface DocumentViewerProps {
  /**
   * Stable identity for the thing being rendered (e.g. the document id). The PDF is
   * re-fetched only when this changes — NOT when `load`'s identity changes, so callers
   * can pass an inline arrow without re-triggering every render.
   */
  docKey: string;
  /** Fetches the PDF bytes through the authenticated API client. */
  load: () => Promise<Blob>;
  /** Shown in the header bar and used as the download filename. */
  fileName: string;
  loadingLabel?: string;
  errorTitle?: string;
}

/**
 * A framed document viewer for a server-rendered PDF. A .docx can't display in a browser,
 * so the AI backend converts it and this shows the real thing (not a re-creation). The
 * bytes are fetched via the API client — a plain <iframe src> can't carry the bearer
 * token — then rendered page-by-page with pdf.js so the toolbar (page count, zoom,
 * fit-width, in-document search, fullscreen) actually drives the render.
 */
export default function DocumentViewer({
  docKey,
  load,
  fileName,
  loadingLabel = "Rendering the document…",
  errorTitle = "Could not render the document",
}: DocumentViewerProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [numPages, setNumPages] = useState(0);
  const [pageWidth, setPageWidth] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [fitWidth, setFitWidth] = useState(false);
  const [manualScale, setManualScale] = useState(1);

  const [search, setSearch] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [activeMatch, setActiveMatch] = useState(0);
  const [renderTick, setRenderTick] = useState(0);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const shellRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch the authenticated PDF bytes and hand pdf.js a blob URL. Re-run only on docKey /
  // manual retry — see the docKey note above.
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    setIsLoading(true);
    setError(null);
    setFileUrl(null);
    setBlob(null);
    setNumPages(0);
    setPageWidth(null);

    load()
      .then((fetched) => {
        if (cancelled) return;
        objectUrl = window.URL.createObjectURL(fetched);
        setBlob(fetched);
        setFileUrl(objectUrl);
        setLoadedAt(new Date());
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(getApiErrorMessage(caught, "The document preview could not be built."));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
    // `load` is intentionally excluded — see docKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey, reloadKey]);

  // Track the scroll area's width so "fit width" stays correct through window/panel resizes.
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    const measure = () => setContainerWidth(node.clientWidth);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [fileUrl]);

  const fitScale =
    pageWidth && containerWidth ? (containerWidth - FIT_GUTTER) / pageWidth : 1;
  const scale = clamp(fitWidth ? fitScale : manualScale, MIN_SCALE, MAX_SCALE);
  const percent = Math.round(scale * 100);

  const zoomTo = useCallback(
    (next: number) => {
      setFitWidth(false);
      setManualScale(clamp(next, MIN_SCALE, MAX_SCALE));
    },
    [],
  );

  // Highlight search hits by wrapping matches in the text layer pdf.js renders. Returning
  // a fresh renderer on each keystroke re-paints the text layer with the marks.
  const textRenderer = useCallback(
    ({ str }: { str: string }) => highlight(str, search),
    [search],
  );

  // Count matches (and clamp the active one) once the text layers have painted.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const count = root.querySelectorAll("mark.dv-hl").length;
    setMatchCount(count);
    setActiveMatch((current) => (count ? Math.min(current, count - 1) : 0));
  }, [search, numPages, scale, renderTick]);

  // Move the "current match" ring and bring it into view.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const marks = root.querySelectorAll<HTMLElement>("mark.dv-hl");
    marks.forEach((mark, index) => mark.classList.toggle("dv-hl-active", index === activeMatch));
    if (search && marks[activeMatch]) {
      marks[activeMatch].scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [activeMatch, search, renderTick, matchCount]);

  const stepMatch = useCallback(
    (delta: number) => {
      setActiveMatch((current) => {
        if (!matchCount) return 0;
        return (current + delta + matchCount) % matchCount;
      });
    },
    [matchCount],
  );

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void shellRef.current?.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const download = useCallback(() => {
    if (!blob) return;
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }, [blob, fileName]);

  return (
    <div className="px-4 py-2 sm:px-6 lg:px-8">
    <div
      ref={shellRef}
      className={`flex flex-col overflow-hidden rounded-panel border border-border bg-surface  ${
        isFullscreen ? "h-screen" : ""
      }`}
    >
      {/* File header bar */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-muted text-primary">
            <FileText className="size-4" aria-hidden="true" />
          </span>
          <span className="truncate text-small font-semibold" title={fileName}>
            {fileName}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-micro text-subdued">
          {blob ? <span className="tabular-nums">{formatBytes(blob.size)}</span> : null}
          {loadedAt ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="hidden sm:inline">Updated {formatTimestamp(loadedAt)}</span>
            </>
          ) : null}
          <button
            type="button"
            onClick={download}
            disabled={!blob}
            title="Download"
            className="flex size-7 items-center justify-center rounded-control text-subdued transition hover:bg-muted hover:text-text disabled:opacity-40"
          >
            <Download className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subdued"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setActiveMatch(0);
              }}
              placeholder="Search document"
              className="h-9 w-44 rounded-control border border-border bg-surface pl-8 pr-7 text-small outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 sm:w-56"
            />
            {search ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setActiveMatch(0);
                }}
                title="Clear search"
                className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-control text-subdued transition hover:bg-muted hover:text-text"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          {search ? (
            <div className="flex items-center gap-0.5 text-micro text-subdued">
              <span className="w-12 text-center tabular-nums">
                {matchCount ? `${activeMatch + 1} / ${matchCount}` : "0 / 0"}
              </span>
              <ToolbarButton onClick={() => stepMatch(-1)} disabled={!matchCount} title="Previous match">
                <ChevronUp className="size-4" aria-hidden="true" />
              </ToolbarButton>
              <ToolbarButton onClick={() => stepMatch(1)} disabled={!matchCount} title="Next match">
                <ChevronDown className="size-4" aria-hidden="true" />
              </ToolbarButton>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-micro tabular-nums text-subdued">
            {numPages || "—"} {numPages === 1 ? "page" : "pages"}
          </span>

          <div className="flex items-center rounded-control border border-border">
            <ToolbarButton onClick={() => zoomTo(scale - ZOOM_STEP)} title="Zoom out">
              <Minus className="size-4" aria-hidden="true" />
            </ToolbarButton>
            <span className="w-11 text-center text-micro tabular-nums text-subdued">{percent}%</span>
            <ToolbarButton onClick={() => zoomTo(scale + ZOOM_STEP)} title="Zoom in">
              <Plus className="size-4" aria-hidden="true" />
            </ToolbarButton>
          </div>

          <button
            type="button"
            onClick={() => setFitWidth((prev) => !prev)}
            title={fitWidth ? "Disable fit to width" : "Fit to width"}
            aria-pressed={fitWidth}
            className={`flex h-9 items-center gap-1.5 rounded-control border px-2.5 text-micro font-semibold transition ${
              fitWidth
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-subdued hover:bg-muted hover:text-text"
            }`}
          >
            <StretchHorizontal className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Fit width</span>
          </button>

          <ToolbarButton
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            bordered
          >
            {isFullscreen ? (
              <Minimize2 className="size-4" aria-hidden="true" />
            ) : (
              <Maximize2 className="size-4" aria-hidden="true" />
            )}
          </ToolbarButton>
        </div>
      </div>

      {/* Document body */}
      <div
        ref={scrollRef}
        className={`relative overflow-auto bg-sunken ${isFullscreen ? "flex-1" : "h-[720px]"}`}
      >
        {isLoading ? (
          <CenteredState>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span className="text-small">{loadingLabel}</span>
          </CenteredState>
        ) : error ? (
          <div className="p-6">
            <div className="rounded-panel border border-danger/30 bg-danger-soft p-5">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                <div className="flex-1">
                  <p className="text-small font-semibold text-danger">{errorTitle}</p>
                  <p className="mt-1 break-words text-small text-subdued">{error}</p>
                  <button
                    type="button"
                    onClick={() => setReloadKey((key) => key + 1)}
                    className="mt-3 inline-flex items-center gap-2 rounded-control border border-border bg-surface px-3 py-1.5 text-small font-semibold transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  >
                    <RefreshCw className="size-4" aria-hidden="true" />
                    Try again
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : fileUrl ? (
          <div className="flex flex-col items-center gap-4 p-4 sm:p-6">
            <Document
              file={fileUrl}
              onLoadSuccess={({ numPages: total }) => setNumPages(total)}
              onLoadError={(caught) =>
                setError(getApiErrorMessage(caught, "The document could not be read."))
              }
              loading={
                <CenteredState>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  <span className="text-small">{loadingLabel}</span>
                </CenteredState>
              }
              error={
                <p className="p-6 text-small text-danger">The document could not be read.</p>
              }
            >
              {Array.from({ length: numPages }, (_, index) => (
                <Page
                  key={index}
                  pageNumber={index + 1}
                  scale={scale}
                  customTextRenderer={textRenderer}
                  renderAnnotationLayer={false}
                  onLoadSuccess={
                    index === 0 ? (page) => setPageWidth(page.originalWidth) : undefined
                  }
                  onRenderTextLayerSuccess={() => setRenderTick((tick) => tick + 1)}
                  className="mb-4 overflow-hidden rounded-sm bg-white shadow-modal last:mb-0"
                />
              ))}
            </Document>
          </div>
        ) : null}
      </div>
    </div>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  disabled,
  title,
  bordered,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title: string;
  bordered?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex size-9 items-center justify-center rounded-control text-subdued transition hover:bg-muted hover:text-text disabled:opacity-40 disabled:hover:bg-transparent ${
        bordered ? "border border-border" : ""
      }`}
    >
      {children}
    </button>
  );
}

function CenteredState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center gap-2 text-subdued">
      {children}
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns the text-layer chunk as HTML with every case-insensitive match of `term`
 * wrapped in a <mark>. The raw text is HTML-escaped first — pdf.js writes this straight
 * into the DOM, so an unescaped '<' in the document would break the layer.
 */
function highlight(str: string, term: string): string {
  if (!term.trim()) return escapeHtml(str);
  const pattern = new RegExp(`(${escapeRegExp(term)})`, "gi");
  return str
    .split(pattern)
    .map((part, index) =>
      index % 2 === 1 ? `<mark class="dv-hl">${escapeHtml(part)}</mark>` : escapeHtml(part),
    )
    .join("");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}
