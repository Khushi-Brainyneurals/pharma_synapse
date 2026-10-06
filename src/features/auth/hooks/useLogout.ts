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
  const clearSession = useAuthStore((state) => state.clearSession);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const logout = useCallback(async () => {
    setIsLoggingOut(true);

    try {
      if (refreshToken) {
        await logoutRequest({ refresh_token: refreshToken });
      }
    } catch {
      // Ignore — clearing the local session below is what actually signs the
      // user out of this browser.
    } finally {
      clearSession();
      setIsLoggingOut(false);
      navigate(ROUTES.login, { replace: true });
    }
  }, [clearSession, navigate, refreshToken]);

  return { logout, isLoggingOut };
}
