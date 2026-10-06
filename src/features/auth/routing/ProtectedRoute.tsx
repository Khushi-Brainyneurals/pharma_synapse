import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ROUTES } from "../../../app/routing/routes";
import { useAuthStore } from "../state/auth.store";
import { saveDocumentLocation } from "../storage/resumeLocation";

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const username = useAuthStore((state) => state.user?.username);
  const location = useLocation();

  // Each dashboard card resumes its own document; signing in always opens the dashboard.
  useEffect(() => {
    if (!isAuthenticated || !username) return;
    const { pathname } = location;
    const match = /^\/documents\/([^/]+)\//.exec(pathname);
    if (match) {
      try { saveDocumentLocation(username, decodeURIComponent(match[1]), pathname + location.search); }
      catch { /* malformed route */ }
    }
  }, [isAuthenticated, username, location.pathname, location.search]);

  if (!isAuthenticated) {
    return (
      <Navigate
        to={ROUTES.login}
        replace
        state={{
          from: location,
          authNotice: {
            message:
              "Your session timed out. Your progress was saved - sign in and open the document from your dashboard to pick up where you left off.",
            variant: "info",
          },
        }}
      />
    );
  }

  return <Outlet />;
}
