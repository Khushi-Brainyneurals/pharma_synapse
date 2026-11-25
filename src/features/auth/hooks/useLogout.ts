import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../../app/routing/routes";
import { logout as logoutRequest } from "../api/auth.api";
import { useAuthStore } from "../state/auth.store";

/**
 * Ends the session and returns the user to the login screen.
 *
 * The local session is cleared even if the server call fails — otherwise a
 * backend hiccup would trap the user in an authenticated shell with no way out.
 * The server-side revoke is best-effort; the token expires on its own anyway.
 */
export function useLogout() {
  const navigate = useNavigate();
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const accessToken = useAuthStore((state) => state.accessToken);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const logout = useCallback(() => {
    setIsLoggingOut(true);

    // End the local session first. This prevents an in-flight 401 from refreshing
    // and reviving a session after the user explicitly chose to sign out.
    clearSession();
    navigate(ROUTES.modules, { replace: true });

    if (refreshToken) {
      void logoutRequest({ refresh_token: refreshToken }, accessToken).catch(() => {
        // Server-side revocation is best-effort; the browser session is already gone.
      });
    }
  }, [accessToken, clearSession, navigate, refreshToken]);

  return { logout, isLoggingOut };
}
