import { AlertCircle, Eye, Loader2, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { Identifier } from "../../../shared/ui/Identifier";
import { ROLE_LABELS } from "../../review/api/review.api";
import { StatusPill } from "../../review/components/StatusPill";
import { useAuthStore } from "../../auth/state/auth.store";
import { AppHeader } from "../../new-document/components/AppHeader";
import { AppSidebar } from "../../new-document/components/AppSidebar";
import {
  ageLabel,
  ageMs,
  bucketOf,
  getBoard,
  isOverdue,
  type BoardBucket,
  type BoardItem,
} from "../api/board.api";

const PAGE_SIZE = 8;

type StateFilter = "all" | BoardBucket;

/** Where a row opens — the screen that owns the pending action for that state. The board
 *  is read-only; every real action happens on the owning screen. */
function ownerRoute(item: BoardItem): string {
  const id = encodeURIComponent(item.document_id);
  switch (bucketOf(item.status)) {
    case "in_review":
      return `/documents/${id}/review`;
    case "approved":
    case "rejected":
      return `/documents/${id}/review`;
    default: {
      const s = (item.status || "").toLowerCase();
      // in-progress drafts open where their next input lives
      if (["cover_review", "review_cover", "extracted", "stages_set", "cover_bom", "cover-bom"].includes(s)) return `/documents/${id}/cover-bom`;
      if (["format_preview", "preview"].includes(s)) return `/documents/${id}/preview`;
      if (["stage_params", "stages", "stage-input"].includes(s)) return `/documents/${id}/stages`;
      if (["generating", "generated"].includes(s)) return `/documents/${id}/generate`;
      return `/documents/${id}/inputs`;
    }
  }
}

function pendingOwner(item: BoardItem): string {
  if (item.pending_roles.length) {
    return item.pending_roles.map((r) => ROLE_LABELS[r] ?? r).join(", ");
  }
  if (bucketOf(item.status) === "draft") return item.prepared_by ? `${item.prepared_by} (Prep.)` : "Preparer";
  return "—";
}

export function StatusBoardPage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  const [items, setItems] = useState<BoardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<number>(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [docType, setDocType] = useState<string>("all");
  const [exceptionsOnly, setExceptionsOnly] = useState(false);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getBoard();
      setItems(response.items);
      setLoadedAt(Date.now());
      setError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not load the status board."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep "age in state" and "updated N ago" ticking without re-fetching.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Document-type scope drives the summary strip; state/search/exceptions only filter the table.
  const inScope = useMemo(
    () => items.filter((i) => docType === "all" || (i.doc_type ?? "").toLowerCase() === docType),
    [items, docType],
  );

  const counts = useMemo(() => {
    const c = { draft: 0, in_review: 0, approved: 0, overdue: 0 };
    for (const i of inScope) {
      const b = bucketOf(i.status);
      if (b === "draft" || b === "rejected") c.draft += b === "draft" ? 1 : 0;
      if (b === "in_review") c.in_review += 1;
      if (b === "approved") c.approved += 1;
      if (isOverdue(i, now)) c.overdue += 1;
    }
    return c;
  }, [inScope, now]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inScope
      .filter((i) => (stateFilter === "all" ? true : bucketOf(i.status) === stateFilter))
      .filter((i) => (exceptionsOnly ? isOverdue(i, now) || i.status === "rejected" : true))
      .filter((i) => {
        if (!q) return true;
        return (
          (i.bmr_number ?? "").toLowerCase().includes(q) ||
          (i.product_name ?? "").toLowerCase().includes(q) ||
          (i.batch_type ?? "").toLowerCase().includes(q) ||
          i.document_id.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => ageMs(b, now) - ageMs(a, now)); // oldest-in-state first
  }, [inScope, stateFilter, exceptionsOnly, search, now]);

  // Any filter change resets to the first page.
  useEffect(() => setPage(0), [stateFilter, docType, exceptionsOnly, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  const docTypes = useMemo(() => {
    const s = new Set<string>();
    for (const i of items) if (i.doc_type) s.add(i.doc_type.toLowerCase());
    return Array.from(s);
  }, [items]);

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader user={user} unit={user?.unitId ? { id: user.unitId } : null} title="Status board" />

      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />

        <main className="min-w-0 min-h-0 p-4 lg:p-6 lg:h-full lg:overflow-y-auto">
          <div className="mx-auto max-w-6xl space-y-5">
            {/* Title + refresh */}
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-h1 font-semibold">Status board</h1>
                <p className="mt-1 max-w-2xl text-small text-subdued">
                  Where every batch record sits in its lifecycle, who holds the pending action, and
                  what is stalling. Read-only — a row opens the screen that owns the action.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-micro text-subdued">
                  Updated {(() => {
                    const ago = ageLabel(now - loadedAt);
                    return ago === "just now" ? "just now" : `${ago} ago`;
                  })()}
                </span>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-control border border-border px-3 text-small font-semibold text-subdued transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
                  Refresh
                </button>
              </div>
            </header>

            {/* Document-type scope */}
            {docTypes.length > 1 ? (
              <div>
                <p className="mb-1.5 text-micro font-medium uppercase tracking-overline text-subdued">
                  Document type
                </p>
                <Segmented
                  options={[{ value: "all", label: "All" }, ...docTypes.map((d) => ({ value: d, label: d.toUpperCase() }))]}
                  value={docType}
                  onChange={setDocType}
                />
              </div>
            ) : null}

            {error ? (
              <div className="flex items-start gap-2 rounded-panel border border-danger/30 bg-danger-soft p-4 text-small text-danger-ink">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}

            {/* Summary strip */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <SummaryCard
                label="Draft"
                count={counts.draft}
                dot="bg-draft-fg"
                active={stateFilter === "draft"}
                onClick={() => setStateFilter((s) => (s === "draft" ? "all" : "draft"))}
              />
              <SummaryCard
                label="In review"
                count={counts.in_review}
                dot="bg-inreview-fg"
                active={stateFilter === "in_review"}
                onClick={() => setStateFilter((s) => (s === "in_review" ? "all" : "in_review"))}
              />
              <SummaryCard
                label="Approved"
                count={counts.approved}
                dot="bg-approved-fg"
                active={stateFilter === "approved"}
                onClick={() => setStateFilter((s) => (s === "approved" ? "all" : "approved"))}
              />
              <SummaryCard
                label="Overdue"
                count={counts.overdue}
                danger
                active={exceptionsOnly}
                onClick={() => setExceptionsOnly((v) => !v)}
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subdued" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="BMR ID, product or batch type"
                  className="h-9 w-full rounded-control border border-border bg-surface pl-9 pr-3 text-small outline-none placeholder:text-subdued focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value as StateFilter)}
                className="h-9 rounded-control border border-border bg-surface px-3 text-small outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">All states</option>
                <option value="draft">Draft</option>
                <option value="in_review">In review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <label className="inline-flex select-none items-center gap-2 text-small text-subdued">
                <input
                  type="checkbox"
                  checked={exceptionsOnly}
                  onChange={(e) => setExceptionsOnly(e.target.checked)}
                  className="size-4 rounded border-border text-primary focus:ring-primary"
                />
                Exceptions only
              </label>
            </div>

            {/* Records table */}
            <div className="overflow-hidden rounded-panel border border-border bg-surface">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-small font-semibold">
                  Batch manufacturing records{" "}
                  <span className="font-normal text-subdued">{filtered.length} shown</span>
                </p>
                <p className="hidden text-micro text-subdued sm:block">Sorted by age in state · descending</p>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center gap-2 p-12 text-subdued">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  <span className="text-small">Loading the board…</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-12 text-center text-small text-subdued">
                  No records match this view.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-small">
                    <thead>
                      <tr className="border-b border-border text-left text-micro uppercase tracking-overline text-subdued">
                        <th className="px-4 py-2 font-medium">Document</th>
                        <th className="px-4 py-2 font-medium">Product</th>
                        <th className="px-4 py-2 font-medium">Batch type</th>
                        <th className="px-4 py-2 font-medium">State</th>
                        <th className="px-4 py-2 font-medium">Pending owner</th>
                        <th className="px-4 py-2 text-right font-medium">Age in state</th>
                        <th className="px-4 py-2 font-medium sr-only">Open</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((item) => {
                        const overdue = isOverdue(item, now);
                        return (
                          <tr
                            key={item.document_id}
                            onClick={() => navigate(ownerRoute(item))}
                            className="cursor-pointer border-b border-border/70 transition last:border-0 hover:bg-sunken"
                          >
                            <td className="px-4 py-3">
                              <Identifier className="text-text">
                                {item.bmr_number ?? item.document_id.slice(0, 8)}
                              </Identifier>
                            </td>
                            <td className="max-w-[220px] truncate px-4 py-3 text-subdued" title={item.product_name ?? ""}>
                              {item.product_name ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-subdued">{item.batch_type ?? "—"}</td>
                            <td className="px-4 py-3">
                              <StatusPill status={item.status} />
                            </td>
                            <td className="max-w-[200px] truncate px-4 py-3 text-subdued" title={pendingOwner(item)}>
                              {pendingOwner(item)}
                            </td>
                            <td className={`whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums ${overdue ? "font-semibold text-danger-ink" : "text-subdued"}`}>
                              {ageLabel(ageMs(item, now))}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Eye className="ml-auto size-4 text-subdued" aria-hidden="true" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {filtered.length > PAGE_SIZE ? (
                <div className="flex items-center justify-between border-t border-border px-4 py-3 text-small">
                  <span className="font-mono tabular-nums text-subdued">
                    {clampedPage * PAGE_SIZE + 1}–{Math.min((clampedPage + 1) * PAGE_SIZE, filtered.length)} of{" "}
                    {filtered.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={clampedPage === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      className="inline-flex h-8 items-center rounded-control border border-border px-3 text-small font-medium text-subdued transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="font-mono text-micro text-subdued">
                      Page {clampedPage + 1} / {pageCount}
                    </span>
                    <button
                      type="button"
                      disabled={clampedPage >= pageCount - 1}
                      onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                      className="inline-flex h-8 items-center rounded-control border border-border px-3 text-small font-medium text-subdued transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <p className="rounded-panel border border-dashed border-border bg-sunken/40 p-3 text-micro leading-relaxed text-subdued">
              <span className="font-semibold text-text">On the floor:</span> a QA head can glance at this board on
              a shop-floor tablet — the summary strip, state badges and overdue flags stay legible at arm's length,
              and because the board is read-only a stray touch can't change a record. Every real action still happens
              back on the owning screen.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  count,
  dot,
  danger,
  active,
  onClick,
}: {
  label: string;
  count: number;
  dot?: string;
  danger?: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start rounded-panel border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
        danger
          ? `border-danger/40 ${count > 0 ? "bg-danger-soft" : "bg-surface"} ${active ? "ring-2 ring-danger/40" : ""}`
          : `border-border bg-surface hover:bg-sunken ${active ? "ring-2 ring-primary/40" : ""}`
      }`}
    >
      <span className="flex items-center gap-2 text-micro font-semibold uppercase tracking-overline">
        {danger ? (
          <AlertCircle className="size-3.5 text-danger-ink" aria-hidden="true" />
        ) : (
          <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
        )}
        <span className={danger ? "text-danger-ink" : "text-subdued"}>{label}</span>
      </span>
      <span className={`mt-2 font-mono text-3xl font-semibold tabular-nums ${danger && count > 0 ? "text-danger-ink" : "text-text"}`}>
        {count}
      </span>
    </button>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="inline-flex rounded-control border border-border bg-surface p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-[6px] px-3 py-1 text-small font-medium transition ${
            value === opt.value ? "bg-accent-soft text-primary-dark" : "text-subdued hover:text-text"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
