import { Loader2 } from "lucide-react";
import { Suspense, lazy } from "react";
import type { DocumentViewerProps } from "./DocumentViewerImpl";

// pdf.js is ~800 KB. Loading it lazily keeps it out of the main bundle — it only arrives
// when a screen that actually shows a document mounts.
const DocumentViewerImpl = lazy(() => import("./DocumentViewerImpl"));

export function DocumentViewer(props: DocumentViewerProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 rounded-panel border border-border bg-surface p-16 text-subdued">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          <span className="text-small">{props.loadingLabel ?? "Rendering the document…"}</span>
        </div>
      }
    >
      <DocumentViewerImpl {...props} />
    </Suspense>
  );
}
