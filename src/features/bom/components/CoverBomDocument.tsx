import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { DocumentViewer } from "../../../shared/document/DocumentViewer";
import { DocxViewer } from "../../preview/components/DocxViewer";
import { getCoverBomPdf } from "../api/bom.api";

export function CoverBomDocument({ documentId }: { documentId: string }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDocx, setIsDocx] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getCoverBomPdf(documentId)
      .then(async (fetched) => {
        if (cancelled) return;
        setBlob(fetched);
        const signature = new Uint8Array(await fetched.slice(0, 5).arrayBuffer());
        const text = String.fromCharCode(...signature);
        setIsDocx(text !== "%PDF-");
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-subdued">
        <Loader2 className="size-4 animate-spin" />
        <span>Loading Cover + BOM preview…</span>
      </div>
    );
  }

  if (!blob) return null;

  if (isDocx) {
    return <DocxViewer file={{ blob, filename: `BMR-${documentId}-cover-bom.docx`, format: "docx" }} />;
  }

  return (
    <DocumentViewer
      docKey={documentId}
      load={() => Promise.resolve(blob)}
      fileName={`BMR-${documentId}-cover-bom.pdf`}
      loadingLabel="Rendering the document…"
      errorTitle="Could not render the Cover + BOM"
    />
  );
}
