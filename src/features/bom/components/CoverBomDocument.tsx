import { DocumentViewer } from "../../../shared/document/DocumentViewer";
import { getCoverBomPdf } from "../api/bom.api";

/**
 * The Cover + BOM document exactly as it will print — the real .docx rendered by the
 * AI backend and converted to a PDF, shown in the framed viewer. This is the actual
 * document, not a browser re-creation, so what the reviewer checks is what gets produced.
 */
export function CoverBomDocument({ documentId }: { documentId: string }) {
  return (
    <DocumentViewer
      docKey={documentId}
      load={() => getCoverBomPdf(documentId)}
      fileName={`BMR-${documentId}-cover-bom.pdf`}
      loadingLabel="Rendering the document…"
      errorTitle="Could not render the Cover + BOM"
    />
  );
}
