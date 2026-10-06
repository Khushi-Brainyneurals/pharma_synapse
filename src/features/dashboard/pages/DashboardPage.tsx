import {
  AlertCircle,
  AlertTriangle,
  Clock,
  Clock3,
  FileEdit,
  FileText,
  Loader2,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  TriangleAlert,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { ROUTES } from "../../../app/routing/routes";
import { useAuthStore } from "../../auth/state/auth.store";
import { clearDocumentLocation } from "../../auth/storage/resumeLocation";
import { AppHeader } from "../../new-document/components/AppHeader";
import { AppSidebar } from "../../new-document/components/AppSidebar";
import {
  cancelRecord,
  deleteDraft,
  getDashboard,
  OVERDUE_FILTER,
  RETAINED_FILTER,
  RETAINED_STATES,
  type DashboardItem,
  type DashboardResponse,
} from "../api/dashboard.api";
import { CloseDocumentModal, type CloseMode } from "../components/CloseDocumentModal";
import { DocumentCard } from "../components/DocumentCard";

/**
 * The Dashboard — where every non-administrator lands.
 *
 * One list of documents, bucketed by what this role is expected to do with them. Three
 * decisions shape the screen:
 *
 * 1. **The statuses live in the dropdown, and every option carries its own total.**
 *    "Draft (2)" answers "how many drafts are there" before the click and still answers
 *    it after, so the count is never something you have to go and find.
 * 2. **Two counts, not one.** The status total and the filtered total are different
 *    numbers doing different jobs — narrowing the list must never hide how big the group
 *    actually is.
 * 3. **Overdue is an overlay, not a stage.** A late document is still In review and is
 *    counted there too, so the totals deliberately do not sum. The screen says so rather
 *    than leaving a user to find that the numbers don't add up and report it as a defect.
 */
const STATUS_CARD_META: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    bgSoft: string;
    borderActive: string;
    bgActive: string;
    badgeActive: string;
    pillActive: string;
  }
> = {
  draft: {
    icon: FileEdit,
    accentColor: "text-amber-600",
    bgSoft: "bg-amber-500/10",
    borderActive: "border-amber-500 ring-2 ring-amber-500/20",
    bgActive: "bg-amber-50/50",
    badgeActive: "bg-amber-100 text-amber-800",
    pillActive: "bg-amber-500",
  },
  in_review: {
    icon: Clock,
    accentColor: "text-blue-600",
    bgSoft: "bg-blue-500/10",
    borderActive: "border-blue-500 ring-2 ring-blue-500/20",
    bgActive: "bg-blue-50/50",
    badgeActive: "bg-blue-100 text-blue-800",
    pillActive: "bg-blue-500",
  },
  in_approval: {
    icon: ShieldCheck,
    accentColor: "text-purple-600",
    bgSoft: "bg-purple-500/10",
    borderActive: "border-purple-500 ring-2 ring-purple-500/20",
    bgActive: "bg-purple-50/50",
    badgeActive: "bg-purple-100 text-purple-800",
    pillActive: "bg-purple-500",
  },
  approved_for_print: {
    icon: Printer,
    accentColor: "text-emerald-600",
    bgSoft: "bg-emerald-500/10",
    borderActive: "border-emerald-500 ring-2 ring-emerald-500/20",
    bgActive: "bg-emerald-50/50",
    badgeActive: "bg-emerald-100 text-emerald-800",
    pillActive: "bg-emerald-500",
  },
  returned_for_correction: {
    icon: RotateCcw,
    accentColor: "text-orange-600",
    bgSoft: "bg-orange-500/10",
    borderActive: "border-orange-500 ring-2 ring-orange-500/20",
    bgActive: "bg-orange-50/50",
    badgeActive: "bg-orange-100 text-orange-800",
    pillActive: "bg-orange-500",
  },
  rejected: {
    icon: XCircle,
    accentColor: "text-rose-600",
    bgSoft: "bg-rose-500/10",
    borderActive: "border-rose-500 ring-2 ring-rose-500/20",
    bgActive: "bg-rose-50/50",
    badgeActive: "bg-rose-100 text-rose-800",
    pillActive: "bg-rose-500",
  },
  overdue: {
    icon: AlertTriangle,
    accentColor: "text-red-600",
    bgSoft: "bg-red-500/10",
    borderActive: "border-red-500 ring-2 ring-red-500/20",
    bgActive: "bg-red-50/50",
    badgeActive: "bg-red-100 text-red-800",
    pillActive: "bg-red-500",
  },
};

const DEFAULT_CARD_META = {
  icon: FileText,
  accentColor: "text-subdued",
  bgSoft: "bg-muted",
  borderActive: "border-primary ring-2 ring-primary/20",
  bgActive: "bg-accent-soft/30",
  badgeActive: "bg-primary/10 text-primary-dark",
  pillActive: "bg-primary",
};

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [formFilter, setFormFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  const [closing, setClosing] = useState<{ mode: CloseMode; item: DashboardItem } | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getDashboard());
      setError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not load the dashboard."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const items = useMemo(() => data?.items ?? [], [data]);

  /** Documents in the selected status, before search / form / type narrow them. */
  const inStatus = useMemo(() => {
    if (statusFilter === RETAINED_FILTER) {
      return items.filter((item) => RETAINED_STATES.includes(item.state));
    }
    if (statusFilter === OVERDUE_FILTER || statusFilter === "overdue") {
      return items.filter((item) => item.is_overdue);
    }
    if (statusFilter) {
      return items.filter((item) => {
        if (item.bucket === statusFilter) return true;
        if (item.status === statusFilter) return true;
        if (
          statusFilter === "in_review" &&
          ["in_review", "under_review", "submitted", "qa_review", "pr_review"].includes(item.status)
        )
          return true;
        if (
          statusFilter === "in_approval" &&
          ["in_approval", "pending_approval"].includes(item.status)
        )
          return true;
        if (
          statusFilter === "approved_for_print" &&
          ["approved", "approved_for_print"].includes(item.status)
        )
          return true;
        if (
          statusFilter === "returned_for_correction" &&
          ["returned", "returned_for_correction"].includes(item.status)
        )
          return true;
        if (statusFilter === "rejected" && item.status === "rejected") return true;
        return false;
      });
    }
    return items.filter((item) => !RETAINED_STATES.includes(item.state));
  }, [items, statusFilter]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return inStatus.filter((item) => {
      if (formFilter && item.dosage_form !== formFilter) return false;
      if (typeFilter && item.doc_type !== typeFilter) return false;
      if (!query) return true;
      return [item.display_id, item.product_name ?? "", item.version]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [inStatus, formFilter, typeFilter, search]);

  const dosageForms = useMemo(() => uniqueValues(items, "dosage_form"), [items]);
  const docTypes = useMemo(() => uniqueValues(items, "doc_type"), [items]);

  const hasFilters =
    statusFilter !== "" || formFilter !== "" || typeFilter !== "" || search.trim() !== "";
  const narrowed = formFilter !== "" || typeFilter !== "" || search.trim() !== "";

  function resetFilters() {
    setStatusFilter("");
    setFormFilter("");
    setTypeFilter("");
    setSearch("");
  }

  async function confirmClose(input: { category: string; reason: string; password: string }) {
    if (!closing) return;
    setCloseError(null);
    try {
      if (closing.mode === "delete") {
        await deleteDraft(closing.item.document_id, {
          category: input.category,
          reason: input.reason,
        });
        // The draft is gone; its remembered step would only outlive what it points at.
        if (user?.username) {
          clearDocumentLocation(user.username, closing.item.document_id);
        }
        setToast(
          `Draft ${closing.item.display_id} ${closing.item.version} deleted. The audit entry recording that it existed is permanent.`,
        );
      } else {
        await cancelRecord(closing.item.document_id, {
          category: input.category,
          reason: input.reason,
          password: input.password,
        });
        setToast(
          `Record ${closing.item.display_id} ${closing.item.version} cancelled and signed — retained, not deleted.`,
        );
        // A cancelled record leaves the active view; show where it went.
        setStatusFilter(RETAINED_FILTER);
      }
      setClosing(null);
      await load();
    } catch (caught) {
      setCloseError(getApiErrorMessage(caught, "The action could not be completed."));
    }
  }

  const statusLabel = statusLabelFor(data, statusFilter);
  const canCreate = data?.can_create ?? false;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader
        user={user}
        unit={user?.unitId ? { id: user.unitId } : null}
        title="Dashboard"
      />

      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />

        <main className="px-6 py-6 lg:px-8 min-w-0 min-h-0 lg:h-full lg:overflow-y-auto">
          <div className="mx-auto max-w-[1280px]">
            <div className="mb-5 flex flex-wrap items-end gap-4">
              <h1 className="text-h1 font-semibold tracking-tight">
                {user?.role === "preparer" ? "Your documents" : "Documents"}
              </h1>
              <span className="flex-1" />

              {data ? (
                <span className="inline-flex items-center gap-2 rounded-pill border border-border-strong bg-surface px-3.5 py-1.5 text-micro text-subdued">
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  Step limits — review <b className="font-mono font-semibold text-text">{data.sla_days?.in_review ?? 3}d</b> ·
                  approval <b className="font-mono font-semibold text-text">{data.sla_days?.approval ?? 2}d</b> ·
                  correction <b className="font-mono font-semibold text-text">{data.sla_days?.returned ?? 5}d</b>
                </span>
              ) : null}

              {!canCreate ? (
                <span className="max-w-[20ch] text-right text-micro leading-tight text-subdued">
                  <b className="font-semibold">Prepared By</b> only
                </span>
              ) : null}

              <button
                type="button"
                disabled={!canCreate}
                onClick={() => navigate(ROUTES.newDocument)}
                className="inline-flex h-10 items-center gap-2 rounded-control bg-primary px-4 text-small font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-muted disabled:text-subdued"
              >
                <Plus className="size-4" aria-hidden="true" />
                New document
              </button>
            </div>
 
            {/* Status Summary Cards - Responsive 7-Column Lifecycle Grid */}
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
              {isLoading && !data
                ? Array.from({ length: 7 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-[84px] animate-pulse rounded-card border border-border bg-surface/70"
                    />
                  ))
                : (data?.cards ?? []).map((card) => {
                    const isSelected =
                      statusFilter === card.key ||
                      (card.key === "overdue" && (statusFilter === OVERDUE_FILTER || statusFilter === "overdue"));
                    const meta = STATUS_CARD_META[card.key] ?? DEFAULT_CARD_META;
                    const IconComponent = meta.icon;

                    return (
                      <button
                        key={card.key}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setStatusFilter("");
                          } else {
                            setStatusFilter(card.key === "overdue" ? OVERDUE_FILTER : card.key);
                          }
                        }}
                        className={`group relative flex flex-col justify-between rounded-card border p-3 text-left transition-all hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                          isSelected
                            ? `${meta.borderActive} ${meta.bgActive} shadow-sm`
                            : "border-border bg-surface hover:border-border-strong hover:bg-surface/90"
                        }`}
                        title={`Filter by ${card.label} (${card.count})`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span
                            className={`inline-flex items-center justify-center size-7 rounded-control transition-colors ${meta.bgSoft} ${meta.accentColor}`}
                          >
                            <IconComponent className="size-4" />
                          </span>
                          {isSelected ? (
                            <span
                              className={`rounded-pill px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${meta.badgeActive}`}
                            >
                              Active
                            </span>
                          ) : card.count > 0 ? (
                            <span
                              className={`size-2 rounded-full ${meta.pillActive} ring-2 ring-white`}
                            />
                          ) : null}
                        </div>

                        <div>
                          <div className="text-h2 font-bold tabular-nums text-text tracking-tight leading-none">
                            {card.count}
                          </div>
                          <div
                            className="mt-1.5 truncate text-micro font-medium text-subdued group-hover:text-text"
                            title={card.label}
                          >
                            {card.label}
                          </div>
                        </div>
                      </button>
                    );
                  })}
            </div>

            <div className="mb-5 flex flex-wrap items-end gap-5 rounded-card border border-border bg-surface p-5">
              <div className="relative flex flex-col">
                <span className={filterLabelClass}>Search</span>
                <Search
                  className="pointer-events-none absolute bottom-3 left-3 size-4 text-subdued"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Product, document or version"
                  aria-label="Search documents"
                  className={`${filterControlClass} w-[230px] pl-9`}
                />
              </div>

              <FilterSelect
                id="filter-form"
                label="Dosage form"
                value={formFilter}
                onChange={setFormFilter}
                allLabel="All dosage forms"
                options={dosageForms}
              />
              <FilterSelect
                id="filter-type"
                label="Document type"
                value={typeFilter}
                onChange={setTypeFilter}
                allLabel="All document types"
                options={docTypes}
              />

              <div className="flex flex-col">
                <label htmlFor="filter-status" className={filterLabelClass}>
                  Status
                </label>
                <select
                  id="filter-status"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className={`${filterControlClass} min-w-[232px] ${
                    statusFilter ? filterSetClass : ""
                  }`}
                >
                  <option value="">All active ({data?.active_count ?? 0})</option>
                  {(data?.cards ?? data?.buckets ?? []).map((card) => (
                    <option
                      key={card.key}
                      value={card.key === "overdue" ? OVERDUE_FILTER : card.key}
                    >
                      {card.label} ({card.count})
                    </option>
                  ))}
                  <option value={RETAINED_FILTER}>
                    Superseded &amp; cancelled ({data?.retained_count ?? 0})
                  </option>
                </select>
              </div>

              <div className="ml-auto flex items-center gap-4 pb-1">
                {/* Two numbers, deliberately: the size of the status group, and how many
                    of those survive the filters layered on top of it. */}
                <span className="text-micro text-subdued">
                  {statusFilter === "" ? (
                    narrowed ? (
                      <>
                        <b className="font-semibold text-text">{visible.length}</b> of{" "}
                        {inStatus.length} shown
                      </>
                    ) : null
                  ) : visible.length === inStatus.length ? (
                    <>
                      <b className="font-semibold text-text">{inStatus.length}</b> {statusLabel}
                    </>
                  ) : (
                    <>
                      <b className="font-semibold text-text">{visible.length}</b> of{" "}
                      {inStatus.length} {statusLabel} shown
                    </>
                  )}
                </span>

                {hasFilters ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex h-[34px] items-center gap-1.5 rounded-control border border-border-strong bg-surface px-3 text-micro font-medium text-subdued transition hover:border-danger hover:text-danger"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                    Reset
                  </button>
                ) : null}
              </div>
            </div>

            {statusFilter === OVERDUE_FILTER ? (
              <p className="mb-5 flex items-center gap-2 rounded-control bg-overdue-bg px-3.5 py-2.5 text-small text-overdue-fg">
                <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
                <span>
                  <b className="font-semibold">Overdue is not a separate stage.</b> Each of
                  these is still in its own status and counted there too — a document does
                  not leave In review by being late.
                </span>
              </p>
            ) : null}

            {error ? (
              <div className="mb-5 flex items-start gap-2 rounded-control border border-danger/30 bg-danger-soft p-3">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                <p className="text-small text-danger">{error}</p>
              </div>
            ) : null}

            {isLoading && !data ? (
              <p className="flex items-center gap-2 py-16 text-small text-subdued">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Loading your documents…
              </p>
            ) : visible.length ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(252px,1fr))] items-stretch gap-4">
                {visible.map((item) => (
                  <DocumentCard
                    key={item.document_id}
                    item={item}
                    onDelete={(target) => {
                      setCloseError(null);
                      setClosing({ mode: "delete", item: target });
                    }}
                    onCancel={(target) => {
                      setCloseError(null);
                      setClosing({ mode: "cancel", item: target });
                    }}
                  />
                ))}
              </div>
            ) : (
              <EmptyState filtered={hasFilters} onReset={resetFilters} />
            )}
          </div>
        </main>
      </div>

      {closing ? (
        <CloseDocumentModal
          mode={closing.mode}
          item={closing.item}
          error={closeError}
          onDismiss={() => {
            setClosing(null);
            setCloseError(null);
          }}
          onConfirm={confirmClose}
        />
      ) : null}

      {toast ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-40 max-w-lg -translate-x-1/2 rounded-card bg-text px-5 py-3 text-small text-white shadow-modal"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ filtered, onReset }: { filtered: boolean; onReset: () => void }) {
  return (
    <div className="rounded-card border border-border bg-surface px-6 py-16 text-center">
      <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-sunken text-subdued">
        {filtered ? (
          <Search className="size-5" aria-hidden="true" />
        ) : (
          <FileText className="size-5" aria-hidden="true" />
        )}
      </span>
      <h3 className="text-h3 font-semibold">
        {filtered ? "Nothing matches" : "No documents yet"}
      </h3>
      <p className="mx-auto mb-5 mt-2 max-w-[46ch] text-small text-subdued">
        {filtered
          ? "Nothing is missing — the view is filtered. Reset to see everything again."
          : "Nothing has been created yet. A document appears here the moment it is started."}
      </p>
      {filtered ? (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-10 items-center gap-2 rounded-control border border-border-strong bg-surface px-4 text-small font-medium text-text transition hover:border-primary hover:text-primary-dark"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Reset
        </button>
      ) : null}
    </div>
  );
}

interface FilterSelectProps {
  id: string;
  label: string;
  value: string;
  allLabel: string;
  options: string[];
  onChange: (value: string) => void;
}

function FilterSelect({ id, label, value, allLabel, options, onChange }: FilterSelectProps) {
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className={filterLabelClass}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${filterControlClass} ${value ? filterSetClass : ""}`}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function uniqueValues(items: DashboardItem[], key: "dosage_form" | "doc_type"): string[] {
  const seen = new Set<string>();
  for (const item of items) {
    const value = item[key];
    if (value) seen.add(value);
  }
  return [...seen].sort();
}

function statusLabelFor(data: DashboardResponse | null, statusFilter: string): string {
  if (statusFilter === RETAINED_FILTER) return "superseded & cancelled";
  if (statusFilter === OVERDUE_FILTER || statusFilter === "overdue") return "overdue";
  const card = data?.cards?.find(
    (c) => c.key === statusFilter || (c.key === "overdue" && statusFilter === OVERDUE_FILTER),
  );
  if (card) return `“${card.label}”`;
  const bucket = data?.buckets?.find((candidate) => candidate.key === statusFilter);
  return bucket ? `“${bucket.label}”` : statusFilter;
}

const filterLabelClass =
  "mb-2 text-overline font-bold uppercase tracking-overline text-subdued";
const filterControlClass =
  "h-[42px] rounded-control border border-border-strong bg-surface px-3 text-small text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-accent-soft";
const filterSetClass = "border-primary bg-accent-soft font-semibold text-primary-dark";
