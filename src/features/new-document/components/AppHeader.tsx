import { Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import type { AuthenticatedUser } from "../../auth/api/auth.types";
import { UserMenu } from "../../auth/components/UserMenu";
import { USER_ROLE_LABELS } from "../../auth/model/roles";
import { NotificationBell } from "../../notifications/components/NotificationBell";
import type { UnitContext } from "../model/documentSelector.types";

interface AppHeaderProps {
  user: AuthenticatedUser | null;
  unit: UnitContext | null;
  isLoadingUnit?: boolean;
  /** The current screen's name, shown after the product mark. Defaults to "New document". */
  title?: string;
}

export function AppHeader({ user, unit, isLoadingUnit = false, title = "New document" }: AppHeaderProps) {
  const [time, setTime] = useState(() => formatTime(new Date()));
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTime(formatTime(new Date()));
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex min-h-topbar items-center border-b border-border bg-surface p-2.5 text-small text-text lg:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <img src="/pharmasynapse-lockup.svg" alt="PharmaDoc AI Logo" className="h-5 w-21 mt-1" />
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-muted-foreground">|</span>
          <span className="truncate text-h2 font-semibold">
            {title}
          </span>
        </div>
      </div>

      <div className="ml-4 hidden items-center gap-3 md:flex">
        <div className="inline-flex items-center gap-2 rounded-pill border border-border bg-muted px-3 py-1 text-small">
          {isLoadingUnit ? (
            <span
              className="h-4 w-16 animate-pulse rounded-pill bg-border"
              aria-hidden="true"
            />
          ) : (
            <span className="font-semibold text-primary-dark">
              {unit?.id ?? "No Unit"}
            </span>
          )}

          <span className="text-[var(--text-subtle)]">•</span>

          <span className="font-small text-subdued">
            {user ? (USER_ROLE_LABELS[user.role] ?? user.role) : "Prepared By"}
          </span>
        </div>

        <span className="inline-flex items-center gap-2 text-small text-subdued">
          <Clock3 className="size-4" aria-hidden="true" />
          {time}
        </span>
        <NotificationBell />
        <UserMenu user={user} />
      </div>
    </header>
  );
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
