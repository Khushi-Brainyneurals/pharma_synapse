import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.25;
const DEFAULT_ZOOM = 0.5;

type ProcessFlowViewerProps = {
  src: string;
  alt: string;
  fileName?: string;
};


const TOOL_BUTTON =
  "inline-flex size-9 items-center justify-center rounded-control border border-border bg-surface text-subdued transition hover:border-primary/50 hover:text-text disabled:cursor-not-allowed disabled:opacity-50";

export function ProcessFlowViewer({ src, alt, fileName = "process-flow.png" }: ProcessFlowViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)));
  const resetZoom = () => setZoom(DEFAULT_ZOOM);

  useEffect(() => {
    const onChange = () => setIsFullscreen(window.document.fullscreenElement === containerRef.current);
    window.document.addEventListener("fullscreenchange", onChange);
    return () => window.document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (window.document.fullscreenElement) {
        await window.document.exitFullscreen();
      } else {
        await containerRef.current?.requestFullscreen();
      }
    } catch {
      /* fullscreen not supported or blocked */
    }
  }, []);

  async function handleDownload() {
    setIsDownloading(true);
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error("Download failed");
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = window.document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(src, "_blank", "noopener,noreferrer");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div
      ref={containerRef}
      className={`flex flex-col rounded-card border border-border bg-surface ${isFullscreen ? "h-screen rounded-none" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-2 sm:px-4">
        <div className="flex items-center gap-2">
          <button type="button" className={TOOL_BUTTON} onClick={zoomOut} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out" title="Zoom out">
            <ZoomOut className="size-4" aria-hidden="true" />
          </button>
          <span className="w-12 text-center text-small font-semibold text-subdued" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <button type="button" className={TOOL_BUTTON} onClick={zoomIn} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in" title="Zoom in">
            <ZoomIn className="size-4" aria-hidden="true" />
          </button>
          <button type="button" className={TOOL_BUTTON} onClick={resetZoom} disabled={zoom === DEFAULT_ZOOM} aria-label="Reset zoom" title="Reset zoom">
            <RotateCcw className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={TOOL_BUTTON} onClick={() => void handleDownload()} disabled={isDownloading} aria-label="Download image" title="Download">
            <Download className="size-4" aria-hidden="true" /> 
          </button>
          <button type="button" className={TOOL_BUTTON} onClick={() => void toggleFullscreen()} aria-label={isFullscreen ? "Exit full screen" : "Full screen"} title={isFullscreen ? "Exit full screen" : "Full screen"}>
            {isFullscreen ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div className={`min-h-0 flex-1 overflow-auto p-3 sm:p-5 ${isFullscreen ? "" : "max-h-[70vh]"}`}>
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="mx-auto h-auto max-w-none object-contain transition-[width] duration-150"
          style={{ width: `${zoom * 100}%` }}
        />
      </div>
    </div>
  );
}