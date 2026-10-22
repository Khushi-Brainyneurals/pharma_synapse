import { AlertCircle, FilePlus2, Loader2, Lock, Pencil, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDocumentCoverBomRoute } from "../../../app/routing/routes";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { useAuthStore } from "../../auth/state/auth.store";
import { AppHeader } from "../../new-document/components/AppHeader";
import { AppSidebar } from "../../new-document/components/AppSidebar";
import {
  getVersionHistory,
  type VersionHistoryItem,
} from "../api/versionHistory.api";

const DOC_TYPE_LABELS: Record<string, string> = {
  bmr: "Batch Manufacturing Record (BMR)",
  bpr: "Batch Packaging Record (BPR)",
  pvp: "Pharmacovigilance Plan (PVP)",
};
function labelFor(map: Record<string, string>, value: string): string {
  return map[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  // The backend now returns an ISO datetime (e.g. 2025-04-18T09:21:00Z); take the date
  // portion so the column reads cleanly without a time component.
  const datePart = iso.slice(0, 10);
  const [y, m, d] = datePart.split("-");
  if (!y || !m || !d) return iso;
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

function statusBadge(status: string): { label: string; cls: string } {
  if (status === "approved") return { label: "Approved", cls: "bg-approved-bg text-approved-fg" };
  if (status === "effective") return { label: "Live", cls: "bg-approved-bg text-approved-fg" };
  if (status === "generated") return { label: "Generated", cls: "bg-draft-bg text-draft-fg" };
  return { label: "In review", cls: "bg-inreview-bg text-inreview-fg" };
}

/**
 * Version History — every currently live controlled record (one row per finalized
 * (doc_type, record_no)). The list is filtered by document type first, then searched
 * by BMR no. or product name. Starting a new revision stays available to the
 * preparer role, gated on the row being `effective`.
 *
 * NOTE: the new backend response no longer surfaces `product_type` (dosage form),
 * `market`, `batch_size`, `date_of_print` or `effective_date`, so the corresponding
 * filters and columns have been removed. New columns surface the freshly-exposed
 * `finalized_at`, `superseded_count` and `created_by`. The inline "reschedule
 * effective date" editor has moved off this page — wire it up on a per-version
 * detail view (use `getVersionChain` / `getVersionSnapshot` from versionHistory.api)
 * when that view lands.
 */
export function VersionHistoryPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  // A preparer re-issues an existing BMR straight from here (Version History → Revise).
  const canRevise = user?.role === "preparer";

  const [items, setItems] = useState<VersionHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Optional document-type filter — empty string means "all document types".
  const [docType, setDocType] = useState("");
  const [revisingId, setRevisingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVersionHistory()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((caught) => {
        if (!cancelled) setError(getApiErrorMessage(caught, "Could not load version history."));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const docTypeOptions = useMemo(
    () => [...new Set((items ?? []).map((r) => r.doc_type).filter(Boolean) as string[])].sort(),
    [items],
  );
  const docTypeSelected = docType !== "";

  // Records for the optional document-type filter + search. With no doc type
  // selected, every record shows; search still applies across BMR no. + product.
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items ?? []).filter((r) => {
      if (docType && r.doc_type !== docType) return false;
      if (q) {
        if (
          !r.bmr_number.toLowerCase().includes(q) &&
          !(r.product_name ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [items, docType, search]);


  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader user={user} unit={user?.unitId ? { id: user.unitId } : null} title="Version History" />
      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />
        <main className="min-w-0 min-h-0 p-4 lg:p-6 lg:h-full lg:overflow-y-auto">
          <div className="mx-auto max-w-7xl space-y-4">
            <header className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-micro font-semibold uppercase tracking-overline text-primary">
                  Current live documents · one row per finalized record
                </p>
                <h1 className="mt-0.5 text-h1 font-semibold">Version History</h1>
                <p className="mt-1 max-w-3xl text-small text-subdued">
                  Every finalized controlled document's current version. Optionally narrow by document type, or search by BMR no. or product.
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-h1 font-semibold text-primary-dark">{rows.length}</p>
                <p className="text-micro text-subdued">live documents</p>
              </div>
            </header>

            {error ? (
              <div className="flex items-start gap-2 rounded-panel border border-danger/30 bg-danger-soft p-4">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                <p className="text-small text-danger">{error}</p>
              </div>
            ) : null}

            {/* Optional document-type filter — empty selection shows all records. */}
            <div className="flex flex-wrap items-end gap-3 rounded-panel border border-border bg-surface p-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-micro font-semibold uppercase tracking-overline text-subdued">
                  Document type
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="h-9 w-64 rounded-control border border-border-strong bg-surface px-3 text-small outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">All document types</option>
                  {docTypeOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {labelFor(DOC_TYPE_LABELS, opt)}
                    </option>
                  ))}
                </select>
              </div>
              {docTypeSelected ? (
                <button
                  type="button"
                  onClick={() => setDocType("")}
                  className="h-9 rounded-control border border-border-strong bg-surface px-3 text-small font-semibold text-subdued transition hover:bg-muted"
                >
                  Clear
                </button>
              ) : null}
            </div>

            {/* toolbar — always visible once the list has loaded. */}
            {items !== null && !error ? (
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subdued" aria-hidden="true" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search BMR no. or product…"
                    className="h-9 w-72 rounded-control border border-border-strong bg-surface pl-8 pr-3 text-small outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
            ) : null}

            {items === null && !error ? (
              <div className="flex items-center justify-center gap-2 rounded-panel border border-border bg-surface p-16 text-subdued">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                <span className="text-small">Loading…</span>
              </div>
            ) : (
              <div className="overflow-hidden rounded-card border border-border bg-surface">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-small">
                    <thead>
                      <tr className="bg-sunken text-left text-micro uppercase tracking-overline text-subdued">
                        <th className="px-4 py-2.5 font-semibold">Document No.</th>
                        <th className="px-4 py-2.5 font-semibold">Version</th>
                        <th className="min-w-[16rem] px-4 py-2.5 font-semibold">Product name</th>
                        <th className="px-4 py-2.5 font-semibold">Finalized at</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Superseded</th>
                        <th className="px-4 py-2.5 font-semibold">Created by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={canRevise ? 7 : 6} className="px-4 py-16 text-center text-small text-subdued">
                            No live documents match this filter.
                          </td>
                        </tr>
                      ) : (
                        rows.map((row) => {
                          const badge = statusBadge(row.status);
                          const canReviseRow = row.status === "effective";
                          return (
                            <tr key={row.document_id} className="border-t border-border hover:bg-muted/50">
                              <td className="px-4 py-3 align-middle">
                                <span className="rounded-sm border border-border bg-sunken px-1.5 py-0.5 font-mono text-micro font-semibold">
                                  {row.bmr_number}
                                </span>
                                {row.document_no && row.document_no !== row.bmr_number ? (
                                  <p className="mt-0.5 text-micro text-subdued">
                                    Doc: <span className="font-mono">{row.document_no}</span>
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-4 py-3 align-middle">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-small font-semibold">{row.version}</span>
                                  <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-micro font-semibold uppercase tracking-wide ${badge.cls}`}>
                                    {badge.label}
                                  </span>
                                </div>
                                {row.superseded_count > 0 ? (
                                  <p className="mt-0.5 text-micro text-subdued">
                                    {row.superseded_count} prior version{row.superseded_count === 1 ? "" : "s"}
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-4 py-3 align-middle">
                                <p className="font-semibold">{row.product_name ?? "—"}</p>
                                {row.doc_type ? (
                                  <p className="mt-0.5 text-micro text-subdued">
                                    {labelFor(DOC_TYPE_LABELS, row.doc_type)}
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-4 py-3 align-middle font-mono text-small tabular-nums text-subdued">
                                {fmtDate(row.finalized_at)}
                              </td>
                              <td className="px-4 py-3 text-center align-middle font-mono tabular-nums">
                                {row.superseded_count > 0 ? row.superseded_count.toLocaleString() : "—"}
                              </td>
                              <td className="px-4 py-3 align-middle text-subdued">
                                {row.created_by ?? "—"}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
