import {
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  Clock,
  Clock3,
  FileEdit,
  FileText,
  LayoutGrid,
  List,
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
import { AppHeader } from "../../../app/layout/AppHeader";
import { AppSidebar } from "../../../app/layout/AppSidebar";
import {
  cancelRecord,
  deleteDraft,
  getDocuments,
  OVERDUE_FILTER,
  RETAINED_FILTER,
  RETAINED_STATES,
  type DocumentItem,
  type DocumentsResponse,
} from "../api/documents.api";
import { CloseDocumentModal, type CloseMode } from "../components/CloseDocumentModal";
import { DocumentCard } from "../components/DocumentCard";
import { DocumentList } from "../components/DocumentList";
import { GlassSelect } from "../../../shared/ui/GlassSelect";
import { findModule } from "../../modules/model/modules";
import { getRememberedModule } from "../../modules/model/selectedModule";

/**
 * The Documents page — where every non-administrator lands.
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
type CardFamily = "harbor" | "sage" | "iris" | "honey" | "clay" | "rose" | "mist";

/** Each status card's icon and design-system family (Draft honey, In review iris, ...). */
const STATUS_CARD_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; family: CardFamily }
> = {
  draft: { icon: FileEdit, family: "honey" },
  in_review: { icon: Clock, family: "iris" },
  in_approval: { icon: ShieldCheck, family: "harbor" },
  approved_for_print: { icon: Printer, family: "sage" },
  returned_for_correction: { icon: RotateCcw, family: "clay" },
  rejected: { icon: XCircle, family: "rose" },
  overdue: { icon: AlertTriangle, family: "rose" },
};

/** The big page title for each module card the user can arrive from; any other module shows "Documents". */
const MODULE_PAGE_TITLE: Record<string, string> = {
  BATCH_DOC_101: "Batch documents",
  PROC_VALID_201: "Validation reports",
  CPV_202: "CPV report",
  APQR_203: "Report",
};

const DEFAULT_CARD_META = { icon: FileText, family: "mist" as CardFamily };

type ViewMode = "card" | "list";
const VIEW_MODE_KEY = "dashboard.viewMode";

const VIEW_TABS: {
  mode: ViewMode;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
    { mode: "card", label: "Cards", Icon: LayoutGrid },
    { mode: "list", label: "List", Icon: List },
  ];

export function DocumentsPage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  // The module card the user signed in from (Batch documents, Process validation, CPV, APQR,
  // eLogBook ...). It names the screen; without one the page keeps its plain title.
  const sourceModule = useMemo(() => findModule(getRememberedModule()), []);
  const sourceModuleName = sourceModule?.name.trim();
  const pageTitle =
    (sourceModule && MODULE_PAGE_TITLE[sourceModule.key]) ??
    (user?.role === "preparer" ? "Your documents" : "Documents");

  const [data, setData] = useState<DocumentsResponse | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [formFilter, setFormFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return localStorage.getItem(VIEW_MODE_KEY) === "list" ? "list" : "card";
    } catch {
      return "card";
    }
  });

  const [closing, setClosing] = useState<{ mode: CloseMode; item: DocumentItem } | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function changeView(mode: ViewMode) {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      /* storage unavailable — the choice just won't persist */
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getDocuments());
      setError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not load your documents."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === "admin" || user?.role === "superadmin") {
      navigate(ROUTES.employees, { replace: true });
      return;
    }
    void load();
  }, [user?.role, navigate, load]);

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
      return items.filter((item) => item.bucket === "overdue");
    }
    if (statusFilter) {
      return items.filter((item) => item.bucket === statusFilter);
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

  // The API's buckets define the workflow stages. Keep that configuration as the
  // source of column labels and keys; overdue is a cross-stage overlay, not a stage.
  const workflowColumns = useMemo(() => {
    const configured = data?.buckets?.length ? data.buckets : data?.cards ?? [];
    const columns = configured
      .filter((bucket) => bucket.key !== "overdue")
      .map((bucket) => ({ key: bucket.key, label: bucket.label }));

    // Retained documents are outside the active workflow. When that existing
    // filter is selected, expose their backend bucket as a column as well.
    if (statusFilter === RETAINED_FILTER) {
      for (const item of visible) {
        const key = item.bucket || item.status;
        if (key && !columns.some((column) => column.key === key)) {
          columns.push({ key, label: item.state_label || key });
        }
      }
    }
    return columns;
  }, [data, statusFilter, visible]);

  const documentsByBucket = useMemo(() => {
    const groups = new Map<string, DocumentItem[]>();
    for (const item of visible) {
      const key = item.bucket || item.status;
      const group = groups.get(key);
      if (group) group.push(item);
      else groups.set(key, [item]);
    }
    return groups;
  }, [visible]);

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
        title="Documents"
      />

      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />

        <main className="min-w-0 min-h-0 p-4 lg:p-6 lg:h-full lg:overflow-y-auto">
          <div className="mx-auto">
            {/* Band: page title and the number-first stat cards over their glows. */}
            <section className="ps-band -mx-4 -mt-4 px-4 pb-5 pt-4 lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6">
              <div className="relative z-[1] mb-5 flex flex-wrap items-end gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                  {sourceModuleName ? (
                    <nav aria-label="Breadcrumb">
                      <ol className="m-0 flex list-none items-center gap-1.5 p-0 text-small text-subdued">
                        <li aria-current="page" className="font-semibold text-text">
                          {sourceModuleName}
                        </li>
                        <li aria-hidden="true">
                          <ChevronRight className="size-3.5" />
                        </li>
                        <li>Documents</li>
                      </ol>
                    </nav>
                  ) : null}
                  <h1 className="text-h1 font-semibold tracking-tight">
                    {pageTitle}
                  </h1>
                  {sourceModule?.line ? (
                    <p className="m-0 text-small text-subdued">{sourceModule.line}</p>
                  ) : null}
                </div>
                <span className="flex-1" />

                {/* {data ? (
                <span className="inline-flex items-center gap-2 rounded-pill border border-border-strong bg-surface px-3.5 py-1.5 text-micro text-subdued">
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  Step limits — review <b className="font-mono font-semibold text-text">{data.sla_days?.in_review ?? 3}d</b> ·
                  approval <b className="font-mono font-semibold text-text">{data.sla_days?.approval ?? 2}d</b> ·
                  correction <b className="font-mono font-semibold text-text">{data.sla_days?.returned ?? 5}d</b>
                </span>
              ) : null} */}

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
            </section>

            {/* Status Summary Cards - Responsive 7-Column Lifecycle Grid */}
            {/* <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
              {isLoading && !data
                ? Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="ps-stat ps-stat--skeleton ps-fam-mist" aria-hidden="true" />
                  ))
                : (data?.cards ?? []).map((card) => {
                    const isSelected =
                      statusFilter === card.key ||
                      (card.key === "overdue" && (statusFilter === OVERDUE_FILTER || statusFilter === "overdue"));
                    const meta = STATUS_CARD_META[card.key] ?? DEFAULT_CARD_META;
                    const IconComponent = meta.icon;

                    return (
                      <div key={card.key} className={`ps-glowframe ps-fam-${meta.family}`}>
                        <span className="ps-glowframe__glow" aria-hidden="true" />
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => {
                            if (isSelected) {
                              setStatusFilter("");
                            } else {
                              setStatusFilter(card.key === "overdue" ? OVERDUE_FILTER : card.key);
                            }
                          }}
                          className="ps-stat"
                          title={`Filter by ${card.label} (${card.count})`}
                        >
                          <span className="ps-stat__top">
                            <span className="ps-stat__tile">
                              <IconComponent className="size-[18px]" />
                            </span>
                            {isSelected ? <span className="ps-stat__active">Active</span> : null}
                          </span>
                          <span className="ps-stat__num">{card.count}</span>
                          <span className="ps-stat__label">{card.label}</span>
                          <span className="ps-stat__note">{cardNotes[card.key]}</span>
                        </button>
                      </div>
                    );
                  })}
            </div> */}

            <div className="flex flex-wrap items-end gap-5 rounded-card border border-border bg-surface p-5">
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
                label="Dosage form"
                value={formFilter}
                onChange={setFormFilter}
                allLabel="All dosage forms"
                options={dosageForms}
              />
              <FilterSelect
                label="Document type"
                value={typeFilter}
                onChange={setTypeFilter}
                allLabel="All document types"
                options={docTypes}
              />

              <div className="flex min-w-[200px] flex-col">
                <span className={filterLabelClass}>
                  Status
                </span>
                <GlassSelect
                  aria-label="Status"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className={`${filterControlClass} w-full`}
                >
                  <option value="">{`All active (${data?.active_count ?? 0})`}</option>
                  {(data?.cards ?? data?.buckets ?? []).map((card) => {
                    const optionValue = card.key === "overdue" ? OVERDUE_FILTER : card.key;
                    return (
                      <option key={optionValue} value={optionValue}>
                        {`${card.label} (${card.count})`}
                      </option>
                    );
                  })}
                  <option value={RETAINED_FILTER}>
                    {`Superseded & cancelled (${data?.retained_count ?? 0})`}
                  </option>
                </GlassSelect>
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
            {/* Card / list view switch */}
            <div className="flex justify-end">
              <div
                role="tablist"
                aria-label="Document view"
                className="my-3 inline-flex overflow-hidden rounded-control border border-border-strong bg-surface"
              >
                {VIEW_TABS.map(({ mode, label, Icon }) => (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={viewMode === mode}
                    aria-label={label}
                    title={label}
                    onClick={() => changeView(mode)}
                    className={`inline-flex h-[34px] items-center gap-1.5 px-3 text-micro font-medium transition ${viewMode === mode
                      ? "bg-primary text-white"
                      : "text-subdued hover:bg-accent-soft hover:text-primary-dark"
                      }`}
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                    {/* {label} */}
                  </button>
                ))}
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
              viewMode === "list" ? (
                <DocumentList items={visible} />
              ) : (
                <div
                  aria-label="Documents by workflow status"
                  className="kanban-column-scrollbar flex h-[min(68vh,720px)] min-h-[320px] items-stretch gap-4 overflow-x-auto pb-3"
                >
                  {workflowColumns.map((column) => {
                    const columnItems = documentsByBucket.get(column.key) ?? [];
                    return (
                      <section
                        key={column.key}
                        aria-label={`${column.label}, ${columnItems.length} documents`}
                        className="flex h-full min-h-[320px] w-[min(82vw,320px)] shrink-0 flex-col overflow-hidden rounded-card border border-border bg-sunken/50"
                      >
                        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
                          <h2 className="min-w-0 truncate text-small font-semibold text-text" title={column.label}>
                            {column.label}
                          </h2>
                          <span className="inline-flex min-w-7 items-center justify-center rounded-pill bg-muted px-2 py-0.5 text-micro font-semibold tabular-nums text-subdued">
                            {columnItems.length}
                          </span>
                        </header>
                        <div className="kanban-column-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                          {columnItems.length ? (
                            columnItems.map((item, index) => (
                              <DocumentCard
                                key={`${item.document_id}-${item.version}-${index}`}
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
                            ))
                          ) : (
                            <p className="rounded-control border border-dashed border-border-strong bg-surface/70 px-3 py-5 text-center text-micro text-subdued">
                              Nothing in this stage.
                            </p>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )
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
  label: string;
  value: string;
  allLabel: string;
  options: string[];
  onChange: (value: string) => void;
}

function FilterSelect({ label, value, allLabel, options, onChange }: FilterSelectProps) {
  return (
    <div className="flex min-w-[180px] flex-col">
      <span className={filterLabelClass}>
        {label}
      </span>
      <GlassSelect
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${filterControlClass} w-full`}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </GlassSelect>
    </div>
  );
}

/** Whether a document belongs to a status card or filter key. */
function matchesStatus(item: DocumentItem, key: string): boolean {
  if (item.bucket === key) return true;
  if (item.status === key) return true;
  if (
    key === "in_review" &&
    ["in_review", "under_review", "submitted", "qa_review", "pr_review"].includes(item.status)
  )
    return true;
  if (
    key === "in_approval" &&
    ["in_approval", "pending_approval"].includes(item.status)
  )
    return true;
  if (
    key === "approved_for_print" &&
    ["approved", "approved_for_print"].includes(item.status)
  )
    return true;
  if (
    key === "returned_for_correction" &&
    ["returned", "returned_for_correction"].includes(item.status)
  )
    return true;
  if (key === "rejected" && item.status === "rejected") return true;
  return false;
}

function uniqueValues(items: DocumentItem[], key: "dosage_form" | "doc_type"): string[] {
  const seen = new Set<string>();
  for (const item of items) {
    const value = item[key];
    if (value) seen.add(value);
  }
  return [...seen].sort();
}

function statusLabelFor(data: DocumentsResponse | null, statusFilter: string): string {
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
  "h-[38px] rounded-[10px] border border-border-strong bg-surface px-3 text-small text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-accent-soft";
const filterSetClass = "border-primary bg-accent-soft font-semibold text-primary-dark";
