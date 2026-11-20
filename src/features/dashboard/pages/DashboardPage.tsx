import {
  AlertCircle,
  AlertTriangle,
  Building2,
  ChevronRight,
  Clock,
  FileEdit,
  FileText,
  History,
  Loader2,
  Printer,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { AppHeader } from "../../../app/layout/AppHeader";
import { AppSidebar } from "../../../app/layout/AppSidebar";
import { ROUTES } from "../../../app/routing/routes";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { useAuthStore } from "../../auth/state/auth.store";
import { getDocumentAction } from "../../documents/components/DocumentCard";
import { StatusPill } from "../../review/components/StatusPill";
import { dashboardAccess, type DashboardScope } from "../access";
import { getDashboard, type DashboardData, type DashboardDocument } from "../api/dashboard.api";
import { DepartmentPerformance } from "../components/DepartmentPerformance";
import { DocumentActivity } from "../components/DocumentActivity";
import { EquipmentCompliance } from "../components/EquipmentCompliance";

/**
 * The Dashboard — the first sidebar entry for anyone whose login `features` grant it.
 *
 * - `personal_dashboard` → the user's own status cards and recent activity (GET /dashboard/me).
 * - `company_dashboard`  → the same layout for the whole module and site (GET /dashboard/company).
 * - Both granted         → a Personal / Company switch in the page band.
 * - `activity_graph`     → the leadership graphs from the design handoff: department
 *   performance, document activity (status donut + generated timeline) and equipment
 *   compliance, between the cards and the recent activity.
 *
 * Cards are number-first and filter the recent activity below them, the same
 * behaviour as the My work tiles in the design handoff.
 */

/** How many of the most recently modified documents the activity list shows. */
const RECENT_LIMIT = 20;
const SCOPE_KEY = "dashboard.scope";

type CardFamily = "harbor" | "sage" | "iris" | "honey" | "clay" | "rose" | "mist";
type IconComponent = React.ComponentType<{ className?: string }>;

/** Same icon and design-system family per status as the Documents page cards. */
const STATUS_CARD_META: Record<string, { icon: IconComponent; family: CardFamily }> = {
  draft: { icon: FileEdit, family: "honey" },
  in_review: { icon: Clock, family: "iris" },
  in_approval: { icon: ShieldCheck, family: "harbor" },
  approved_for_print: { icon: Printer, family: "sage" },
  returned_for_correction: { icon: RotateCcw, family: "clay" },
  rejected: { icon: XCircle, family: "rose" },
  overdue: { icon: AlertTriangle, family: "rose" },
};
const DEFAULT_CARD_META = { icon: FileText, family: "mist" as CardFamily };

/** Document statuses (as the API sends them) grouped under each card key. */
const CARD_STATUSES: Record<string, string[]> = {
  draft: ["draft"],
  in_review: ["in_review", "under_review", "submitted", "qa_review", "pr_review", "qc_review"],
  in_approval: ["in_approval", "pending_approval"],
  approved_for_print: ["approved_for_print", "approved", "finalized"],
  returned_for_correction: ["returned_for_correction", "returned"],
  rejected: ["rejected"],
};

/** StatusPill knows the canonical names; the dashboard APIs send a few aliases. */
const PILL_STATUS: Record<string, string> = { under_review: "in_review" };

const TILE_TONE: Record<CardFamily, string> = {
  harbor: "bg-harbor-100 text-harbor-700",
  sage: "bg-sage-100 text-sage-700",
  iris: "bg-iris-100 text-iris-700",
  honey: "bg-honey-100 text-honey-700",
  clay: "bg-clay-100 text-clay-700",
  rose: "bg-rose-100 text-rose-700",
  mist: "bg-muted text-subdued",
};

const SCOPE_TABS: { scope: DashboardScope; label: string; Icon: IconComponent }[] = [
  { scope: "personal", label: "Personal", Icon: User },
  { scope: "company", label: "Company", Icon: Building2 },
];

function matchesCard(cardKey: string, doc: DashboardDocument) {
  if (cardKey === "overdue") return doc.is_overdue;
  const statuses = CARD_STATUSES[cardKey];
  return statuses ? statuses.includes(doc.status) : doc.bucket === cardKey;
}

function cardKeyFor(doc: DashboardDocument) {
  return Object.keys(CARD_STATUSES).find((key) => CARD_STATUSES[key].includes(doc.status));
}

function timestamp(value: string | null) {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(time) ? 0 : time;
}

function formatRelative(value: string | null) {
  const time = timestamp(value);
  if (!time) return "—";
  const minutes = Math.round((Date.now() - time) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(time).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function formatFull(value: string | null) {
  const time = timestamp(value);
  return time
    ? new Date(time).toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : undefined;
}

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const access = dashboardAccess(user);

  const [scope, setScope] = useState<DashboardScope>(() => {
    try {
      const saved = localStorage.getItem(SCOPE_KEY);
      if (saved === "company" && access.canViewCompany) return "company";
      if (saved === "personal" && access.canViewPersonal) return "personal";
    } catch {
      /* storage unavailable — fall back to the default view */
    }
    return access.defaultScope;
  });
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setLoading] = useState(access.canViewDocuments);
  const [error, setError] = useState<string | null>(null);
  const [cardFilter, setCardFilter] = useState<string | null>(null);

  const load = useCallback(async (target: DashboardScope) => {
    setLoading(true);
    setError(null);
    try {
      setData(await getDashboard(target));
    } catch (caught) {
      setData(null);
      setError(
        getApiErrorMessage(
          caught,
          target === "company" ? "Could not load the company dashboard." : "Could not load your dashboard.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (access.canViewDocuments) void load(scope);
  }, [access.canViewDocuments, scope, load]);

  function changeScope(next: DashboardScope) {
    if (next === scope) return;
    setScope(next);
    setCardFilter(null);
    setData(null);
    try {
      localStorage.setItem(SCOPE_KEY, next);
    } catch {
      /* storage unavailable — the choice just won't persist */
    }
  }

  const recent = useMemo(() => {
    const documents = data?.documents ?? [];
    const filtered = cardFilter ? documents.filter((doc) => matchesCard(cardFilter, doc)) : documents;
    return [...filtered]
      .sort((a, b) => timestamp(b.last_modified_at) - timestamp(a.last_modified_at))
      .slice(0, RECENT_LIMIT);
  }, [data, cardFilter]);

  if (!access.canView) {
    return <Navigate to={ROUTES.documents} replace />;
  }

  const isCompany = scope === "company";
  const showDocuments = access.canViewDocuments;
  const activeCard = cardFilter ? data?.cards.find((card) => card.key === cardFilter) : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader user={user} unit={user?.unitId ? { id: user.unitId } : null} title="Dashboard" />

      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />

        <main className="relative min-w-0 min-h-0 overflow-x-hidden p-4 lg:p-6 lg:h-full lg:overflow-y-auto">
          {/* Band: title, the scope switch, and the number-first status cards. */}
          <section className="ps-band -mx-4 -mt-4 px-4 pb-5 pt-4 lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6">
            <div className="relative z-[1] mb-5 flex flex-wrap items-end gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <h1 className="text-h1 font-semibold tracking-tight">
                  {!showDocuments ? "Dashboard" : isCompany ? "Company dashboard" : "Your dashboard"}
                </h1>
                <p className="m-0 text-small text-subdued">
                  {!showDocuments
                    ? "Department performance, document activity and equipment compliance."
                    : isCompany
                      ? "Where every document in this module stands, across all preparers."
                      : "Your drafts, your corrections, and where your documents are."}
                </p>
              </div>
              <span className="flex-1" />

              {showDocuments ? (
              <>

              <button
                type="button"
                onClick={() => void load(scope)}
                disabled={isLoading}
                title="Refresh"
                aria-label="Refresh dashboard"
                className="inline-flex size-[34px] items-center justify-center rounded-control border border-border-strong bg-surface text-subdued transition hover:bg-accent-soft hover:text-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
              </button>

              {access.canSwitch ? (
                <div
                  role="tablist"
                  aria-label="Dashboard scope"
                  className="inline-flex overflow-hidden rounded-control border border-border-strong bg-surface"
                >
                  {SCOPE_TABS.map(({ scope: tabScope, label, Icon }) => (
                    <button
                      key={tabScope}
                      type="button"
                      role="tab"
                      aria-selected={scope === tabScope}
                      onClick={() => changeScope(tabScope)}
                      className={`inline-flex h-[34px] items-center gap-1.5 px-3.5 text-micro font-semibold transition ${
                        scope === tabScope
                          ? "bg-primary text-white"
                          : "text-subdued hover:bg-accent-soft hover:text-primary-dark"
                      }`}
                    >
                      <Icon className="size-3.5" aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
              </>
              ) : null}
            </div>

            {showDocuments ? (
            <div className="relative z-[1] grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
              {isLoading && !data
                ? Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="ps-stat ps-stat--skeleton ps-fam-mist" aria-hidden="true" />
                  ))
                : (data?.cards ?? []).map((card) => {
                    const isSelected = cardFilter === card.key;
                    const meta = STATUS_CARD_META[card.key] ?? DEFAULT_CARD_META;
                    const CardIcon = meta.icon;
                    return (
                      <div key={card.key} className={`ps-glowframe ps-fam-${meta.family}`}>
                        <span className="ps-glowframe__glow" aria-hidden="true" />
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setCardFilter(isSelected ? null : card.key)}
                          className="ps-stat"
                          title={isSelected ? "Show all recent activity" : `Show recent ${card.label.toLowerCase()} documents`}
                        >
                          <span className="ps-stat__top">
                            <span className="ps-stat__tile">
                              <CardIcon className="size-[18px]" />
                            </span>
                            {isSelected ? <span className="ps-stat__active">Active</span> : null}
                          </span>
                          <span className="ps-stat__num">{card.count}</span>
                          <span className="ps-stat__label">{card.label}</span>
                        </button>
                      </div>
                    );
                  })}
            </div>
            ) : null}
          </section>

          {/* Leadership graphs, for users whose login features include activity_graph. */}
          {access.canViewGraphs ? (
            <div className="mt-5 flex flex-col gap-5">
              <DepartmentPerformance />
              <DocumentActivity />
              <EquipmentCompliance />
            </div>
          ) : null}

          {error ? (
            <div className="my-5 flex items-start gap-2 rounded-control border border-danger/30 bg-danger-soft p-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
              <p className="text-small text-danger">{error}</p>
            </div>
          ) : null}

          {/* Recent activity: the most recently modified documents in this scope. */}
          {showDocuments ? (
          <section className="mt-5 rounded-card border border-border bg-surface" aria-labelledby="recent-activity-title">
            <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
              <span className="inline-flex size-[30px] items-center justify-center rounded-card bg-harbor-100 text-harbor-700">
                <History className="size-[18px]" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 id="recent-activity-title" className="text-h3 font-semibold">
                  {activeCard ? `Recent activity · ${activeCard.label}` : "Recent activity"}
                </h2>
                <p className="text-micro text-subdued">
                  {data
                    ? `Latest ${recent.length} of ${data.total} ${data.total === 1 ? "document" : "documents"}${
                        isCompany ? " in this module" : ""
                      }, most recently changed first.`
                    : "Most recently changed documents first."}
                </p>
              </div>
              <span className="flex-1" />
              {cardFilter ? (
                <button
                  type="button"
                  onClick={() => setCardFilter(null)}
                  className="text-small font-semibold text-primary-dark hover:underline"
                >
                  Clear filter
                </button>
              ) : null}
              <Link
                to={ROUTES.documents}
                className="inline-flex items-center gap-1 text-small font-semibold text-primary-dark hover:underline"
              >
                View all documents
                <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            </header>

            {isLoading && !data ? (
              <p className="flex items-center gap-2 px-5 py-12 text-small text-subdued">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Loading recent activity…
              </p>
            ) : recent.length ? (
              <ul className="divide-y divide-border">
                {recent.map((doc, index) => (
                  <ActivityRow key={`${doc.document_id}-${index}`} doc={doc} showPeople={isCompany} />
                ))}
              </ul>
            ) : data ? (
              <p className="px-5 py-12 text-center text-small text-subdued">
                {cardFilter ? "No documents in this status right now." : "Nothing here yet."}
              </p>
            ) : null}
          </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function ActivityRow({ doc, showPeople }: { doc: DashboardDocument; showPeople: boolean }) {
  const username = useAuthStore((state) => state.user?.username);
  const userRole = useAuthStore((state) => state.user?.role);
  const { target, action } = getDocumentAction(doc, username, userRole);
  const cardKey = cardKeyFor(doc);
  const meta = (cardKey && STATUS_CARD_META[cardKey]) || DEFAULT_CARD_META;
  const RowIcon = meta.icon;
  const docLabel = doc.display_id || `${doc.doc_type}_${doc.document_id.slice(0, 8)}`;
  const people = [
    doc.prepared_by ? `Prepared by ${doc.prepared_by}` : null,
    doc.last_modified_by && doc.last_modified_by !== doc.prepared_by ? `Last change by ${doc.last_modified_by}` : null,
  ].filter(Boolean);

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 transition hover:bg-accent-soft/30">
      <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-card ${TILE_TONE[meta.family]}`}>
        <RowIcon className="size-4" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1 basis-[220px]">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2">
          <Link
            to={target}
            state={{ documentPermissions: doc.permissions }}
            className="truncate font-semibold hover:text-primary-dark hover:underline"
          >
            {doc.product_name || "Untitled document"}
          </Link>
          <span className="font-mono text-micro text-subdued">{docLabel}</span>
        </div>
        <p className="truncate text-micro text-subdued">
          {[doc.doc_type, doc.dosage_form, doc.state_label].filter(Boolean).join(" · ")}
          {showPeople && people.length ? ` · ${people.join(" · ")}` : ""}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <StatusPill status={PILL_STATUS[doc.status] ?? doc.status} />
        {doc.is_overdue ? (
          <span className="inline-flex items-center gap-1 rounded-pill bg-overdue-bg px-2.5 py-1 text-micro font-semibold text-overdue-fg">
            <AlertTriangle className="size-3" aria-hidden="true" />
            Overdue
          </span>
        ) : null}
        <span className="w-[84px] text-right text-micro text-subdued" title={formatFull(doc.last_modified_at)}>
          {formatRelative(doc.last_modified_at)}
        </span>
        <Link
          to={target}
          state={{ documentPermissions: doc.permissions }}
          className="inline-flex h-8 items-center whitespace-nowrap rounded-control border border-primary px-3 text-small font-semibold text-primary-dark transition hover:bg-primary-dark hover:text-white"
        >
          {action}
        </Link>
      </div>
    </li>
  );
}
