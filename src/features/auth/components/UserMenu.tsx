import { ChevronDown, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AuthenticatedUser } from "../api/auth.types";
import { USER_ROLE_LABELS } from "../model/roles";
import { useLogout } from "../hooks/useLogout";

interface UserMenuProps {
  user: AuthenticatedUser | null;
}

export function UserMenu({ user }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { logout, isLoggingOut } = useLogout();
  const containerRef = useRef<HTMLDivElement>(null);

  const displayName = user?.displayName ?? user?.username ?? "User";

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="User menu"
        className="inline-flex items-center gap-2 rounded-pill border border-border px-1.5 py-1.5 text-left transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-micro font-semibold text-white">
          {getInitials(displayName)}
        </span>
        <span className="max-w-32 truncate text-small font-semibold">{displayName}</span>
        <ChevronDown className="size-4 text-subdued" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-panel border border-border bg-surface shadow-auth"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-small font-semibold">{displayName}</p>
            <p className="mt-0.5 truncate text-micro text-subdued">
              {user ? (USER_ROLE_LABELS[user.role] ?? user.role) : null}
            </p>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={logout}
            disabled={isLoggingOut}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-small text-text transition hover:bg-muted focus:bg-muted focus:outline-none disabled:opacity-60"
          >
            <LogOut className="size-4" aria-hidden="true" />
            {isLoggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
