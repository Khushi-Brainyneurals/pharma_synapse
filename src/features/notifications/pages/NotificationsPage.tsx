import { ArrowRight, Eye, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../auth/state/auth.store";
import { AppHeader } from "../../new-document/components/AppHeader";
import { AppSidebar } from "../../new-document/components/AppSidebar";
import {
  NOTIF_STATE_BADGE,
  useNotificationsStore,
  type Notification,
} from "../state/notifications.store";

type FilterKey = "all" | "act" | "doc" | "md" | "sys";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "act", label: "Action required" },
  { key: "doc", label: "Documents" },
  { key: "md", label: "Master data" },
  { key: "sys", label: "System" },
];

function matches(n: Notification, key: FilterKey): boolean {
  if (key === "all") return true;
  if (key === "act") return n.needsAction;
  return n.category === key;
}

/**
 * Notifications — one row per event: the document (or master-data row / system item),
 * who acted, what happened, when, and where to open it. Notifications are pointers; the
 * append-only audit trail remains the record.
 */
export function NotificationsPage() {
  const user = useAuthStore((state) => state.user);
  const items = useNotificationsStore((state) => state.items);
  const markRead = useNotificationsStore((state) => state.markRead);
  const markAllRead = useNotificationsStore((state) => state.markAllRead);
  const fetchNotifications = useNotificationsStore((state) => state.fetch);
  const loading = useNotificationsStore((state) => state.loading);
  const loaded = useNotificationsStore((state) => state.loaded);
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const rows = useMemo(() => items.filter((n) => matches(n, filter)), [items, filter]);
  const unread = items.filter((n) => n.unread).length;
  const needAction = items.filter((n) => n.unread && n.needsAction).length;

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader user={user} unit={user?.unitId ? { id: user.unitId } : null} title="Notifications" />
      <div className="flex">
        <AppSidebar user={user} />
        <main className="min-w-0 flex-1 p-4 lg:p-6">
          <div className="mx-auto max-w-6xl space-y-4">
            <header className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-micro font-semibold uppercase tracking-overline text-primary">
                  Shared shell — all roles · scoped per role &amp; unit
                </p>
                <h1 className="mt-0.5 text-h1 font-semibold">Notifications</h1>
                <p className="mt-1 max-w-2xl text-small text-subdued">
                  One row per event: the document, who acted, what happened, when, and a link to
                  open that version. Notifications are pointers — the audit trail remains the record.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-small text-subdued">
                  <b className="font-mono font-semibold text-primary-dark">{unread} unread</b> ·{" "}
                  {needAction} need{needAction === 1 ? "s" : ""} your action
                </span>
                <button
                  type="button"
                  onClick={markAllRead}
                  className="rounded-control border border-border-strong bg-surface px-3 py-2 text-small font-semibold transition hover:bg-muted"
                >
                  Mark all as read
                </button>
              </div>
            </header>

            <div className="flex flex-wrap items-center gap-2">
              {FILTERS.map((f) => {
                const count = items.filter((n) => matches(n, f.key)).length;
                const active = filter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-small font-medium transition ${
                      active
                        ? "border-primary bg-primary text-white"
                        : "border-border-strong bg-surface text-subdued hover:border-primary hover:text-primary-dark"
                    }`}
                  >
                    {f.label}
                    <span className={`font-mono text-micro ${active ? "text-white/80" : "text-subdued"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
              <span className="ml-auto text-micro text-subdued">
                Showing last 30 days · older events live in the audit trail
              </span>
            </div>

            <div className="overflow-hidden rounded-card border border-border bg-surface">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-small">
                  <thead>
                    <tr className="bg-sunken text-left text-micro uppercase tracking-overline text-subdued">
                      <th className="px-5 py-2.5 font-semibold">Document</th>
                      <th className="px-5 py-2.5 font-semibold">User</th>
                      <th className="px-5 py-2.5 font-semibold">Status</th>
                      <th className="min-w-[16rem] px-5 py-2.5 font-semibold">Comment</th>
                      <th className="px-5 py-2.5 font-semibold">Date &amp; time</th>
                      <th className="px-5 py-2.5 text-right font-semibold">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && !loaded ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-16 text-center">
                          <span className="inline-flex items-center gap-2 text-small text-subdued">
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                            Loading notifications…
                          </span>
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-16 text-center">
                          <p className="text-small font-semibold text-subdued">You're all caught up</p>
                          <p className="mt-1 text-small text-subdued">
                            Nothing under this filter — events appear the moment a document or
                            master-data change needs you.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      rows.map((n) => <Row key={n.id} n={n} onRead={() => markRead(n.id)} />)
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Row({ n, onRead }: { n: Notification; onRead: () => void }) {
  const navigate = useNavigate();
  const badge = n.state ? NOTIF_STATE_BADGE[n.state] : null;
  const idLabel = n.doc?.id ?? n.md?.id ?? "SYSTEM";
  const subLabel = n.doc?.name ?? n.md?.line ?? n.system ?? "";

  // "Open" takes you to where this document / version (or master-data row) lives.
  const openEvent = () => {
    onRead();
    if (n.to) navigate(n.to);
  };

  return (
    <tr
      onClick={onRead}
      className={`cursor-pointer border-t border-border transition hover:bg-muted/60 ${
        n.needsAction ? "border-l-[3px] border-l-primary" : "border-l-[3px] border-l-transparent"
      }`}
    >
      {/* Document */}
      <td className="px-5 py-3 align-middle">
        <div className="flex items-center gap-2">
          <span
            className={`size-2 shrink-0 rounded-full ${n.unread ? "bg-primary" : "bg-transparent"}`}
            aria-hidden="true"
          />
          <span className="rounded-sm border border-border bg-sunken px-1.5 py-0.5 font-mono text-micro font-semibold">
            {idLabel}
          </span>
          {n.doc?.version ? (
            <span className="rounded-pill border border-border-strong px-1.5 font-mono text-micro text-subdued">
              {n.doc.version}
            </span>
          ) : null}
        </div>
        <p className="mt-1 pl-4 text-micro text-subdued">{subLabel}</p>
      </td>

      {/* User */}
      <td className="px-5 py-3 align-middle">
        {n.actor === "—" ? (
          <span className="text-small text-subdued">{n.actorRole || "System"}</span>
        ) : (
          <>
            <p className="text-small font-medium">{n.actor}</p>
            {n.actorRole ? <p className="text-micro text-subdued">{n.actorRole}</p> : null}
          </>
        )}
      </td>

      {/* Status */}
      <td className="px-5 py-3 align-middle">
        <p className={`text-small leading-snug ${n.unread ? "font-semibold" : "font-medium"}`}>
          {n.action}
        </p>
        {badge ? (
          <span
            className={`mt-1.5 inline-flex items-center rounded-pill px-2 py-0.5 text-micro font-semibold uppercase tracking-wide ${badge.cls}`}
          >
            {badge.label}
          </span>
        ) : null}
      </td>

      {/* Comment */}
      <td className="px-5 py-3 align-middle">
        {n.comment ? (
          <p className="max-w-[22rem] text-small leading-snug text-subdued">{n.comment}</p>
        ) : (
          <span className="text-small text-subdued">—</span>
        )}
      </td>

      {/* Date & time */}
      <td className="whitespace-nowrap px-5 py-3 align-middle">
        <p className="font-mono text-small tabular-nums">{n.date}</p>
        <p className="font-mono text-micro text-subdued">{n.time}</p>
      </td>

      {/* Open — goes to the document/version (or master-data row) this event is about */}
      <td className="px-5 py-3 text-right align-middle">
        {n.viewOnly || !n.to ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-small text-subdued">
            <Eye className="size-3.5" aria-hidden="true" />
            {n.viewOnly ? "View only" : n.open}
          </span>
        ) : (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openEvent();
            }}
            title={`Go to ${n.doc?.id ?? n.md?.id ?? "the record"}`}
            className="inline-flex items-center gap-1 whitespace-nowrap text-small font-semibold text-primary transition hover:text-primary-dark"
          >
            {n.open}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </td>
    </tr>
  );
}
