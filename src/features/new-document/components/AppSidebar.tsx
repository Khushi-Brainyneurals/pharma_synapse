import {
  Bell,
  ClipboardCheck,
  ClipboardClock,
  FileClock,
  FilePlus,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  ReceiptText,
} from "lucide-react";
import { masterDataAccess } from "../../master-data-setup/access";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ROUTES } from "../../../app/routing/routes";

/** Sidebar item id → route. Items with no route here are not built yet. */
const SIDEBAR_ROUTES: Record<string, string | undefined> = {
  "new-document": ROUTES.newDocument,
  "status-board": ROUTES.statusBoard,
  "version-history": ROUTES.versionHistory,
  notifications: ROUTES.notifications,
  "audit-trail": ROUTES.auditTrail,
  "master-data": ROUTES.masterDataSetup,
};
import { logout } from "../../auth/api/auth.api";
import type { AuthenticatedUser } from "../../auth/api/auth.types";
import { getStoredRefreshToken } from "../../auth/storage/auth.storage";
import { useAuthStore } from "../../auth/state/auth.store";
import { DOCUMENT_SIDEBAR_ITEMS } from "../model/documentSelector.config";

interface AppSidebarProps {
  user: AuthenticatedUser | null;
}

const iconMap = {
  "new-document": FilePlus,
  "status-board": LayoutDashboard,
  "version-history": History,
  notifications: Bell,
  "audit-trail": ClipboardClock,
  "master-data": ReceiptText,
};

export function AppSidebar({ user }: AppSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const clearSession = useAuthStore((state) => state.clearSession);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const mdAccess = masterDataAccess(user?.role);
  // Prepared-by has no edit access, so "Master data" points them straight at the read-only
  // preview of the uploaded masters instead of the equipment/instrument change-request page.
  const previewOnly = mdAccess.canView && !mdAccess.canEdit;

  function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    const refreshToken = getStoredRefreshToken();
    clearSession();
    navigate(ROUTES.login, { replace: true });

    if (refreshToken) {
      void logout({ refresh_token: refreshToken }).catch(() => {
        // Server-side revocation is best-effort; the browser session is already gone.
      });
    }
  }

  return (
    <aside className="hidden shrink-0 border-r border-border bg-surface lg:flex lg:h-full lg:w-sidebar-w lg:flex-col">
      <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4" aria-label="Primary">
        <Link 
          to="/" 
          aria-current={location.pathname === "/" ? "page" : undefined} 
          className={`flex min-h-row-h items-center gap-3 rounded-control mb-1 px-3 text-small font-medium transition ${ location.pathname === "/" ? "border border-primary/25 bg-accent-soft text-primary-dark" : "text-subdued hover:bg-muted hover:text-text" }`} >
          <LayoutDashboard className="size-4" aria-hidden="true" /> Dashboard
        </Link>
        <ul className="space-y-1">
          {DOCUMENT_SIDEBAR_ITEMS.filter(
            // Master data is only for the roles the rights matrix grants access to.
            (item) => item.id !== "master-data" || mdAccess.canView,
          ).map((item) => {
            // "New document" is the preparer's entry to create a BMR; every other role
            // reviews documents instead, so the same top slot becomes "Review document" →
            // the review queue.
            const asReview = item.id === "new-document" && user?.role !== "preparer";
            const label = asReview ? "Review document" : item.label;
            const Icon = asReview ? ClipboardCheck : iconMap[item.id as keyof typeof iconMap] ?? FileClock;
            // "Master data" opens the setup wizard for an editor, or its read-only preview
            // for a preparer.
            const to = asReview
              ? ROUTES.queue
              : item.id === "master-data" && previewOnly
                ? "/master-data-setup/preview"
                : item.id === "new-document"
                  ? SIDEBAR_ROUTES["new-document"]
                  : SIDEBAR_ROUTES[item.id];
            // Compare on the path only — a resume target can carry a query (e.g. ?stage=…).
            const toPath = (to ?? "").split("?")[0];
            const isActive = Boolean(toPath) && location.pathname.startsWith(toPath);

            // A screen that isn't built yet is shown disabled rather than as a link
            // that silently does nothing.
            if (!to) {
              return (
                <li key={item.id}>
                  <span
                    title="Not built yet"
                    className="flex min-h-row-h cursor-not-allowed items-center gap-3 rounded-control px-3 text-small font-medium text-subdued/50"
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span>{label}</span>
                  </span>
                </li>
              );
            }

            return (
              <li key={item.id}>
                <Link
                  to={to}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex min-h-row-h items-center gap-3 rounded-control px-3 text-small font-medium transition focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                    isActive
                      ? "border border-primary/25 bg-accent-soft text-primary-dark"
                      : "text-subdued hover:bg-muted hover:text-text"
                  }`}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-micro font-medium uppercase tracking-overline text-subdued">
              Signed in
            </p>
            <p className="mt-1.5 truncate text-small font-semibold text-text">
              {user?.username ?? user?.id ?? "U-0731"}
            </p>
          </div>

          <button
            type="button"
            aria-label="Log out"
            title="Log out"
            disabled={isLoggingOut}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-control border border-border text-subdued transition hover:bg-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleLogout}
          >
            {isLoggingOut ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
