import { LogOut } from "lucide-react";
import { useLogout } from "../features/auth/hooks/useLogout";
import { USER_ROLE_LABELS } from "../features/auth/model/roles";
import { useAuthStore } from "../features/auth/state/auth.store";

export function ProtectedPlaceholderPage() {
  const user = useAuthStore((state) => state.user);
  const { logout, isLoggingOut } = useLogout();

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-text">
      <section className="mx-auto max-w-3xl rounded-panel border border-border bg-surface p-8 shadow-auth">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              Authenticated session
            </p>
            <h1 className="mt-3 text-2xl font-semibold">
              This screen isn't built yet.
            </h1>
          </div>

          <button
            type="button"
            onClick={logout}
            disabled={isLoggingOut}
            className="inline-flex shrink-0 items-center gap-2 rounded-control border border-border px-3 py-2 text-sm font-semibold transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60"
          >
            <LogOut className="size-4" aria-hidden="true" />
            {isLoggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>

        <p className="mt-3 text-sm leading-6 text-subdued">
          Login, session restoration and protected routing all work — this is a
          placeholder standing in for a dashboard screen that isn&apos;t
          implemented yet. Sign in as <strong>Prepared By</strong> to reach the
          New-document flow.
        </p>

        {user ? (
          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-subdued">User ID</dt>
              <dd className="mt-1 font-semibold">{user.username}</dd>
            </div>
            <div>
              <dt className="font-medium text-subdued">Role</dt>
              <dd className="mt-1 font-semibold">{USER_ROLE_LABELS[user.role]}</dd>
            </div>
          </dl>
        ) : null}
      </section>
    </main>
  );
}
