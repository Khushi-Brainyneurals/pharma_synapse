import { Link, useLocation, useParams } from "react-router-dom";
import { ROUTES } from "../../../app/routing/routes";
import type { CreateBmrDocumentResponse } from "../api/documents.types";

type InputsLocationState = {
  document?: CreateBmrDocumentResponse;
};

export function DocumentInputsPendingPage() {
  const { documentId } = useParams();
  const location = useLocation();
  const state = location.state as InputsLocationState | null;
  const document = state?.document;

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-text">
      <section className="mx-auto max-w-3xl rounded-panel border border-border bg-surface p-8 shadow-auth">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Core inputs
        </p>
        <h1 className="mt-3 text-2xl font-semibold">Draft document created</h1>
        <p className="mt-3 text-sm leading-6 text-subdued">
          The Inputs step is ready to be connected. Refreshing this page will not create another
          draft.
        </p>

        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-subdued">Document ID</dt>
            <dd className="mt-1 break-all font-semibold">{document?.document_id ?? documentId}</dd>
          </div>
          <div>
            <dt className="font-medium text-subdued">Status</dt>
            <dd className="mt-1 font-semibold">{document?.status ?? "draft"}</dd>
          </div>
          {document ? (
            <>
              <div>
                <dt className="font-medium text-subdued">Dosage form</dt>
                <dd className="mt-1 font-semibold">{document.dosage_form}</dd>
              </div>
              <div>
                <dt className="font-medium text-subdued">Document type</dt>
                <dd className="mt-1 font-semibold">{document.doc_type}</dd>
              </div>
            </>
          ) : null}
        </dl>

        <Link
          className="mt-6 inline-flex min-h-10 items-center justify-center rounded-control border border-border bg-white px-5 py-2.5 text-sm font-semibold text-subdued transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          to={ROUTES.newDocument}
        >
          Back to New document
        </Link>
      </section>
    </main>
  );
}
