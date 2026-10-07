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
  reviseDocument,
  setEffectiveDate,
  type VersionHistoryItem,
} from "../api/versionHistory.api";

const EDIT_ROLES = new Set(["reviewer_qa", "approver"]);

/** Friendly labels for the pre-filter dropdowns. Falls back to a title-cased raw value. */
const DOSAGE_LABELS: Record<string, string> = { tablet: "Tablet", capsule: "Capsule" };
const DOC_TYPE_LABELS: Record<string, string> = {
  bmr: "Batch Manufacturing Record (BMR)",
  bpr: "Batch Packaging Record (BPR)",
};
function labelFor(map: Record<string, string>, value: string): string {
  return map[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}
function isLive(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() <= Date.now();
}

function statusBadge(status: string): { label: string; cls: string } {
  if (status === "approved") return { label: "Approved", cls: "bg-approved-bg text-approved-fg" };
  if (status === "generated") return { label: "Generated", cls: "bg-draft-bg text-draft-fg" };
  return { label: "In review", cls: "bg-inreview-bg text-inreview-fg" };
}

/**
 * Version History — current live (generated-or-beyond) controlled records. The effective
 * date can be rescheduled by Reviewer QA / the Approver against a required reason (the
 * backend writes old→new + reason to the audit trail); everyone else sees it read-only.
 */
export function VersionHistoryPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const canEdit = EDIT_ROLES.has(user?.role ?? "");
  // A preparer re-issues an existing BMR straight from here (the Version History → Revise path).
  const canRevise = user?.role === "preparer";

  const [items, setItems] = useState<VersionHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [market, setMarket] = useState("all");
  // The list is designed per dosage form + document type: both are chosen first, then the
  // matching records appear.
  const [dosage, setDosage] = useState("");
  const [docType, setDocType] = useState("");
  const [revisingId, setRevisingId] = useState<string | null>(null);

  // Inline edit state.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState("");
  const [draftReason, setDraftReason] = useState("");
  const [saving, setSaving] = useState(false);

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

  const dosageOptions = useMemo(
    () => [...new Set((items ?? []).map((r) => r.product_type).filter(Boolean) as string[])].sort(),
    [items],
  );
  const docTypeOptions = useMemo(
    () => [...new Set((items ?? []).map((r) => r.doc_type).filter(Boolean) as string[])].sort(),
    [items],
  );
  const bothSelected = dosage !== "" && docType !== "";

  // Records for the chosen dosage form + document type + search, BEFORE the market filter —
  // drives the market chips and their counts.
  const scoped = useMemo(() => {
    if (!bothSelected) return [];
    return (items ?? []).filter((r) => {
      if (r.product_type !== dosage) return false;
      if (r.doc_type !== docType) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.bmr_number.toLowerCase().includes(q) &&
          !(r.product_name ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [items, bothSelected, dosage, docType, search]);

  const markets = useMemo(() => {
    const set = new Set<string>();
    scoped.forEach((r) => r.market && set.add(r.market));
    return ["all", ...[...set].sort()];
  }, [scoped]);

  const rows = useMemo(
    () => scoped.filter((r) => market === "all" || r.market === market),
    [scoped, market],
  );

  const revise = useCallback(
    async (documentId: string) => {
      setRevisingId(documentId);
      setError(null);
      try {
        const newId = await reviseDocument(documentId);
        navigate(getDocumentCoverBomRoute(newId));
      } catch (caught) {
        setError(getApiErrorMessage(caught, "Could not start a revision."));
        setRevisingId(null);
      }
    },
    [navigate],
  );

  const startEdit = (row: VersionHistoryItem) => {
    setEditingId(row.document_id);
    setDraftDate(row.effective_date ?? "");
    setDraftReason("");
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraftReason("");
  };
  const save = useCallback(
    async (documentId: string) => {
      if (draftReason.trim().length < 3) return;
      setSaving(true);
      setError(null);
      try {
        const saved = await setEffectiveDate(documentId, draftDate || null, draftReason.trim());
        setItems(
          (cur) =>
            cur?.map((r) =>
              r.document_id === documentId ? { ...r, effective_date: saved } : r,
            ) ?? null,
        );
        setEditingId(null);
        setDraftReason("");
      } catch (caught) {
        setError(getApiErrorMessage(caught, "Could not save the effective date."));
      } finally {
        setSaving(false);
      }
    },
    [draftDate, draftReason],
  );

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader user={user} unit={user?.unitId ? { id: user.unitId } : null} title="Version History" />
      <div className="flex">
        <AppSidebar user={user} />
        <main className="min-w-0 flex-1 p-4 lg:p-6">
          <div className="mx-auto max-w-7xl space-y-4">
            <header className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-micro font-semibold uppercase tracking-overline text-primary">
                  Current live documents · one row per BMR
                </p>
                <h1 className="mt-0.5 text-h1 font-semibold">Version History</h1>
                <p className="mt-1 max-w-3xl text-small text-subdued">
                  Every BMR's currently effective controlled version. The effective date can be
                  rescheduled by QA / the Approver against a reason and e-signature.
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

            {/* Choose a dosage form + document type first — the matching records then show. */}
            <div className="flex flex-wrap items-end gap-3 rounded-panel border border-border bg-surface p-4">
              <TypeSelect
                label="Dosage form"
                value={dosage}
                onChange={setDosage}
                options={dosageOptions}
                labels={DOSAGE_LABELS}
                placeholder="Select dosage form…"
              />
              <TypeSelect
                label="Document type"
                value={docType}
                onChange={setDocType}
                options={docTypeOptions}
                labels={DOC_TYPE_LABELS}
                placeholder="Select document type…"
              />
              {bothSelected ? (
                <button
                  type="button"
                  onClick={() => {
                    setDosage("");
                    setDocType("");
                  }}
                  className="h-9 rounded-control border border-border-strong bg-surface px-3 text-small font-semibold text-subdued transition hover:bg-muted"
                >
                  Clear
                </button>
              ) : null}
            </div>

            {/* toolbar — only once a dosage form + document type are chosen */}
            {bothSelected ? (
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
                <span className="ml-1 text-micro font-semibold uppercase tracking-overline text-subdued">
                  Market
                </span>
                {markets.map((m) => {
                  const count = m === "all" ? scoped.length : scoped.filter((r) => r.market === m).length;
                  const active = market === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMarket(m)}
                      className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-small font-medium transition ${
                        active
                          ? "border-primary bg-primary text-white"
                          : "border-border-strong bg-surface text-subdued hover:border-primary hover:text-primary-dark"
                      }`}
                    >
                      {m === "all" ? "All markets" : m}
                      <span className={`font-mono text-micro ${active ? "text-white/80" : "text-subdued"}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {items === null && !error ? (
              <div className="flex items-center justify-center gap-2 rounded-panel border border-border bg-surface p-16 text-subdued">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                <span className="text-small">Loading…</span>
              </div>
            ) : !bothSelected ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border-strong bg-surface p-16 text-center">
                <Search className="size-6 text-subdued" aria-hidden="true" />
                <p className="text-small font-semibold">Select a dosage form and document type</p>
                <p className="max-w-md text-small text-subdued">
                  Choose both above to list the live controlled records for that combination.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-card border border-border bg-surface">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-small">
                    <thead>
                      <tr className="bg-sunken text-left text-micro uppercase tracking-overline text-subdued">
                        <th className="px-4 py-2.5 font-semibold">BMR No.</th>
                        <th className="px-4 py-2.5 font-semibold">Version No.</th>
                        <th className="min-w-[16rem] px-4 py-2.5 font-semibold">Product name</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Batch size</th>
                        <th className="px-4 py-2.5 font-semibold">Market</th>
                        <th className="px-4 py-2.5 font-semibold">Date of print</th>
                        <th className="min-w-[15rem] px-4 py-2.5 font-semibold">Effective date</th>
                        {canRevise ? <th className="px-4 py-2.5 font-semibold">Action</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={canRevise ? 8 : 7} className="px-4 py-16 text-center text-small text-subdued">
                            No live documents match this filter.
                          </td>
                        </tr>
                      ) : (
                        rows.map((row) => {
                          const badge = statusBadge(row.status);
                          return (
                            <tr key={row.document_id} className="border-t border-border hover:bg-muted/50">
                              <td className="px-4 py-3 align-middle">
                                <span className="rounded-sm border border-border bg-sunken px-1.5 py-0.5 font-mono text-micro font-semibold">
                                  {row.bmr_number}
                                </span>
                              </td>
                              <td className="px-4 py-3 align-middle">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-small font-semibold">{row.version}</span>
                                  <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-micro font-semibold uppercase tracking-wide ${badge.cls}`}>
                                    {badge.label}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 align-middle">
                                <p className="font-semibold">{row.product_name ?? "—"}</p>
                                {row.product_type ? (
                                  <p className="mt-0.5 text-micro capitalize text-subdued">{row.product_type}</p>
                                ) : null}
                              </td>
                              <td className="px-4 py-3 text-right align-middle font-mono tabular-nums">
                                {row.batch_size != null ? row.batch_size.toLocaleString() : "—"}
                              </td>
                              <td className="px-4 py-3 align-middle">
                                {row.market ? (
                                  <span className="rounded-sm border border-border bg-sunken px-1.5 py-0.5 font-mono text-micro text-subdued">
                                    {row.market}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="px-4 py-3 align-middle font-mono text-small tabular-nums text-subdued">
                                {fmtDate(row.date_of_print)}
                              </td>
                              <td className="px-4 py-3 align-middle">
                                {editingId === row.document_id && canEdit ? (
                                  <div className="rounded-control border border-primary bg-sunken p-3">
                                    <label className="mb-1 block text-micro font-semibold uppercase tracking-wide text-subdued">
                                      New effective date
                                    </label>
                                    <input
                                      type="date"
                                      value={draftDate}
                                      onChange={(e) => setDraftDate(e.target.value)}
                                      className="h-8 rounded-control border border-border-strong bg-surface px-2 font-mono text-small outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                                    />
                                    <label className="mb-1 mt-2.5 block text-micro font-semibold uppercase tracking-wide text-subdued">
                                      Reason for change (required)
                                    </label>
                                    <input
                                      type="text"
                                      value={draftReason}
                                      onChange={(e) => setDraftReason(e.target.value)}
                                      placeholder="e.g. aligned to training completion date"
                                      className="h-8 w-full rounded-control border border-border-strong bg-surface px-2.5 text-small outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                                    />
                                    <div className="mt-2.5 flex items-center gap-2">
                                      <button
                                        type="button"
                                        disabled={saving || draftReason.trim().length < 3}
                                        onClick={() => void save(row.document_id)}
                                        className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-1.5 text-micro font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-border-strong"
                                      >
                                        {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
                                        Save &amp; sign
                                      </button>
                                      <button
                                        type="button"
                                        onClick={cancelEdit}
                                        className="rounded-control border border-border-strong bg-surface px-3 py-1.5 text-micro font-semibold text-subdued transition hover:bg-muted"
                                      >
                                        Cancel
                                      </button>
                                      <span className="ml-auto inline-flex items-center gap-1 text-micro text-subdued">
                                        <Lock className="size-3" aria-hidden="true" />
                                        e-signature + audit
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2.5">
                                    <span className="font-mono text-small font-semibold">{fmtDate(row.effective_date)}</span>
                                    {row.effective_date ? (
                                      isLive(row.effective_date) ? (
                                        <span className="inline-flex items-center gap-1.5 text-micro text-approved-fg">
                                          <span className="size-1.5 rounded-full bg-approved-fg" aria-hidden="true" />
                                          Live
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1.5 text-micro text-draft-fg">
                                          <span className="size-1.5 rounded-full border border-draft-fg" aria-hidden="true" />
                                          Pending
                                        </span>
                                      )
                                    ) : null}
                                    {canEdit ? (
                                      <button
                                        type="button"
                                        title="Reschedule effective date (QA / Approver)"
                                        onClick={() => startEdit(row)}
                                        className="ml-auto flex size-7 items-center justify-center rounded-control border border-border-strong text-subdued transition hover:border-primary hover:bg-accent-soft hover:text-primary-dark"
                                      >
                                        <Pencil className="size-3.5" aria-hidden="true" />
                                      </button>
                                    ) : (
                                      <span className="ml-auto inline-flex items-center gap-1 text-micro text-subdued" title="Editable by QA / Approver only">
                                        <Lock className="size-3" aria-hidden="true" />
                                        QA only
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              {canRevise ? (
                                <td className="px-4 py-3 align-middle">
                                  <button
                                    type="button"
                                    disabled={revisingId === row.document_id || !row.effective_date}
                                    onClick={() => void revise(row.document_id)}
                                    title={
                                      row.effective_date
                                        ? "Start a new revision from this version"
                                        : "Available once the document is effective (an effective date is set)"
                                    }
                                    className="inline-flex items-center gap-1.5 rounded-control border border-primary bg-accent-soft px-3 py-1.5 text-micro font-semibold text-primary-dark transition hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:border-border disabled:bg-sunken disabled:text-subdued disabled:opacity-70"
                                  >
                                    {revisingId === row.document_id ? (
                                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                    ) : (
                                      <FilePlus2 className="size-3.5" aria-hidden="true" />
                                    )}
                                    Revise
                                  </button>
                                </td>
                              ) : null}
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

/** A labelled dropdown for the dosage-form / document-type pre-filter. */
function TypeSelect({
  label,
  value,
  onChange,
  options,
  labels,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  labels: Record<string, string>;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-micro font-semibold uppercase tracking-overline text-subdued">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-64 rounded-control border border-border-strong bg-surface px-3 text-small outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {labelFor(labels, opt)}
          </option>
        ))}
      </select>
    </div>
  );
}
