import { AlertCircle, ClipboardList, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { useAuthStore } from "../../auth/state/auth.store";
import { AppHeader } from "../../new-document/components/AppHeader";
import { AppSidebar } from "../../new-document/components/AppSidebar";
import { getQueue, STATUS_LABELS, type QueueItem } from "../api/review.api";
import { Identifier } from "../../../shared/ui/Identifier";
import { StatusPill } from "../components/StatusPill";

export function ReviewQueuePage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  const [items, setItems] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getQueue();
      setItems(response.items);
      setError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not load the queue."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isPreparer = user?.role === "preparer";

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader
        user={user}
        unit={user?.unitId ? { id: user.unitId } : null}
        title={isPreparer ? "My documents" : "Review document"}
      />

      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />

        <main className="min-w-0 min-h-0 p-4 lg:p-6 lg:h-full lg:overflow-y-auto">
          <div className="mx-auto max-w-5xl space-y-5">
            <header>
              <h1 className="text-h1 font-semibold">
                {isPreparer ? "My documents" : "Review queue"}
              </h1>
              <p className="mt-1 text-small text-subdued">
                {isPreparer
                  ? "Everything you have prepared, and what is happening to it."
                  : "Documents waiting on you. Ones you have already decided drop off this list."}
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
                <span className="text-small">Loading…</span>
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-panel border border-border bg-surface p-16 text-center">
                <ClipboardList
                  className="mx-auto size-6 text-subdued"
                  aria-hidden="true"
                />
                <p className="mt-3 text-small font-semibold">Nothing waiting on you</p>
                <p className="mt-1 text-small text-subdued">
                  {isPreparer
                    ? "Start a new document to see it here."
                    : "When a document is submitted for review, it will appear here."}
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.document_id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/documents/${item.document_id}/review`)}
                      className="w-full rounded-panel border border-border bg-surface p-4 text-left transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-small font-semibold">
                            {item.product_name ?? "Untitled product"}
                          </p>
                          <p className="mt-0.5 text-micro text-subdued">
                            {/* DS rule 4 — identifiers in mono, tabular figures: 0/O and
                                1/l must never be transcribable wrong on a regulated record. */}
                            <Identifier>
                              {item.bmr_number ?? item.document_id.slice(0, 8)}
                            </Identifier>
                            {item.batch_size ? (
                              <>
                                {" · "}
                                <Identifier>{item.batch_size.toLocaleString()}</Identifier>
                                {" units"}
                              </>
                            ) : null}
                            {item.prepared_by ? ` · prepared by ${item.prepared_by}` : null}
                            {item.review_round > 1
                              ? ` · round ${item.review_round}`
                              : null}
                          </p>
                        </div>

                        <StatusPill status={item.status} />
                      </div>

                      {item.status === "rejected" && item.reject_reason ? (
                        <p className="mt-3 rounded-control border border-draft-fg/30 bg-draft-bg px-3 py-2 text-small text-draft-fg">
                          <span className="font-semibold">Rejected:</span>{" "}
                          {item.reject_reason}
                        </p>
                      ) : null}

                      {item.pending_roles.length > 0 &&
                      item.status !== "rejected" &&
                      item.status !== "approved" ? (
                        <p className="mt-2 text-micro text-subdued">
                          Waiting on:{" "}
                          {item.pending_roles
                            .map((role) => STATUS_ROLE_SHORT[role] ?? role)
                            .join(", ")}
                        </p>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

const STATUS_ROLE_SHORT: Record<string, string> = {
  reviewer_qa: "QA",
  reviewer_pr: "Production",
  approver: "Approved By",
};

export { STATUS_LABELS };
