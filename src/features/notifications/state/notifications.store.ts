import { create } from "zustand";
import { getNotifications } from "../api/notifications.api";

/**
 * The signed-in user's notification feed — one row per event: the document (or master-
 * data row / system item), who acted, what happened, when, and where to open it. Held
 * in a shared store so the app-shell bell (unread badge) and the Notifications page
 * render the same feed and stay in sync.
 *
 * Events are fetched from the BFF (`GET /api/bmr/notifications`), derived from the real
 * review chain + pending actions + master-data change requests. Read/unread is tracked
 * client-side (localStorage) since it's a per-viewer, non-regulated concern.
 */

export type NotifCategory = "doc" | "md" | "sys";
export type NotifStateKey =
  | "review"
  | "approved"
  | "draft"
  | "superseded"
  | "pending"
  | "effective"
  | "rejected";

export interface NotifDocRef {
  id: string;
  name: string;
  version?: string;
}
export interface NotifMdRef {
  id: string;
  line: string;
}

export interface Notification {
  id: string;
  category: NotifCategory;
  /** Exactly one of doc / md / system is set, per `category`. */
  doc?: NotifDocRef;
  md?: NotifMdRef;
  system?: string;
  /** Who triggered the event, and their role. */
  actor: string;
  actorRole: string;
  /** The activity phrase — shown in the "Status" column. */
  action: string;
  /** Lifecycle badge on the status, when the event carries a state. */
  state?: NotifStateKey;
  /** Reviewer / approver / change comment for this event (— when none). */
  comment?: string;
  date: string;
  time: string;
  unread: boolean;
  needsAction: boolean;
  /** Deep-link label, e.g. "Open · v2" / "Review diff" / "Change password". */
  open: string;
  /** Where "Open" goes — the screen that shows this document/version or master-data row.
   *  (Representative feed: routes to the Version History / Master data listing. With the
   *  real feed it deep-links to the exact document.) */
  to?: string;
  /** Informed-only recipient — the Open cell reads "View only", no link. */
  viewOnly?: boolean;
}

/** State key → foundation lifecycle badge (label + classes). */
export const NOTIF_STATE_BADGE: Record<NotifStateKey, { label: string; cls: string }> = {
  review: { label: "In review", cls: "bg-inreview-bg text-inreview-fg" },
  approved: { label: "Approved", cls: "bg-approved-bg text-approved-fg" },
  draft: { label: "Draft", cls: "bg-draft-bg text-draft-fg" },
  superseded: { label: "Superseded", cls: "bg-superseded-bg text-superseded-fg" },
  pending: { label: "Pending sign-off", cls: "bg-inreview-bg text-inreview-fg" },
  effective: { label: "Effective", cls: "bg-approved-bg text-approved-fg" },
  rejected: { label: "Rejected", cls: "bg-rejected-bg text-rejected-fg" },
};

const READ_KEY = "bmr.client.notif.read";

function loadReadSet(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(READ_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function saveReadSet(read: Set<string>) {
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify([...read]));
  } catch {
    // best-effort — read state is a display concern only.
  }
}

interface NotificationsState {
  items: Notification[];
  loading: boolean;
  loaded: boolean;
  /** Fetch the feed from the BFF and apply the local read-set. Safe to call repeatedly. */
  fetch: () => Promise<void>;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  loading: false,
  loaded: false,
  fetch: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const events = await getNotifications();
      const read = loadReadSet();
      set({ items: events.map((e) => ({ ...e, unread: !read.has(e.id) })), loaded: true });
    } catch {
      // Keep whatever we already have; the page shows its empty/error state.
    } finally {
      set({ loading: false });
    }
  },
  markRead: (id) => {
    const read = loadReadSet();
    read.add(id);
    saveReadSet(read);
    set((s) => ({ items: s.items.map((n) => (n.id === id ? { ...n, unread: false } : n)) }));
  },
  markAllRead: () => {
    const read = loadReadSet();
    get().items.forEach((n) => read.add(n.id));
    saveReadSet(read);
    set((s) => ({ items: s.items.map((n) => ({ ...n, unread: false })) }));
  },
}));

/** Count of unread notifications — drives the bell badge. */
export function useUnreadCount(): number {
  return useNotificationsStore((s) => s.items.filter((n) => n.unread).length);
}
