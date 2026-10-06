import { Bell } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../../app/routing/routes";
import { useNotificationsStore, useUnreadCount } from "../state/notifications.store";

/**
 * The app-shell notification bell + unread-count badge, and the dropdown it opens. Reads
 * the shared notifications store, so the badge, this panel and the full Notifications
 * page always agree. "View all" jumps to the full page.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const unread = useUnreadCount();
  const items = useNotificationsStore((state) => state.items);
  const markAllRead = useNotificationsStore((state) => state.markAllRead);
  const fetchNotifications = useNotificationsStore((state) => state.fetch);

  // Load the real feed once so the badge is accurate wherever the shell renders.
  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  // Unread first, then newest — the four most relevant.
  const recent = useMemo(
    () => [...items].sort((a, b) => Number(b.unread) - Number(a.unread)).slice(0, 4),
    [items],
  );

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        className={`relative inline-flex size-9 items-center justify-center rounded-control border transition focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
          open ? "border-primary bg-accent-soft text-primary-dark" : "border-border text-subdued hover:bg-muted"
        }`}
      >
        <Bell className="size-4" aria-hidden="true" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-pill bg-primary px-1 font-mono text-[10px] font-bold leading-4 tabular-nums text-white">
            {unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-30 w-[min(92vw,380px)] overflow-hidden rounded-panel border border-border bg-surface text-text shadow-modal">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <h3 className="text-small font-semibold">Notifications</h3>
            <span className="rounded-pill bg-accent-soft px-2 py-0.5 font-mono text-micro text-primary-dark">
              {unread} unread
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto text-subdued transition hover:text-text"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="max-h-[320px] overflow-y-auto">
            {recent.map((n) => {
              const idLine =
                n.doc != null
                  ? `${n.doc.id} · ${n.doc.name}`
                  : n.md != null
                    ? `${n.md.id} · ${n.md.line}`
                    : `System · ${n.system ?? ""}`;
              return (
                <div key={n.id} className="flex gap-2.5 border-b border-border px-4 py-2.5 last:border-b-0">
                  <span
                    className={`mt-1.5 size-[7px] shrink-0 rounded-full ${
                      n.unread ? "bg-primary" : "bg-border-strong"
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className={`text-small leading-snug ${n.unread ? "font-semibold" : "font-medium text-subdued"}`}>
                      {n.action}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-micro text-subdued">
                      {idLine} · {n.date} {n.time}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center border-t border-border bg-sunken/40 px-4 py-2.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate(ROUTES.notifications);
              }}
              className="text-small font-semibold text-primary transition hover:text-primary-dark"
            >
              View all notifications
            </button>
            <button
              type="button"
              onClick={markAllRead}
              className="ml-auto text-small text-subdued transition hover:text-text"
            >
              Mark all as read
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
