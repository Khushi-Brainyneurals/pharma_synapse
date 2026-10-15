import { httpClient } from "../../../shared/api/httpClient";
import type { NotifCategory, NotifStateKey, Notification } from "../state/notifications.store";

/** The wire shape the BFF returns (snake_case). */
interface ApiNotif {
  id: string;
  category: NotifCategory;
  document_id?: string | null;
  doc?: { id: string; name?: string | null; version?: string | null } | null;
  md?: { id: string; line: string } | null;
  system?: string | null;
  actor: string;
  actor_role: string;
  action: string;
  state?: string | null;
  comment?: string | null;
  date: string;
  time: string;
  needs_action: boolean;
  open: string;
  to?: string | null;
  view_only: boolean;
}

const LOCAL_NOTIFS_STORAGE_KEY = "pharma_custom_notifications";

export function getLocalNotifications(): Omit<Notification, "unread">[] {
  try {
    const raw = localStorage.getItem(LOCAL_NOTIFS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalNotification(notif: Omit<Notification, "unread">): void {
  try {
    const existing = getLocalNotifications();
    const updated = [notif, ...existing.filter((n) => n.id !== notif.id)].slice(0, 50);
    localStorage.setItem(LOCAL_NOTIFS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // best-effort display cache
  }
}

/** Fetch the signed-in user's feed. Read/unread is tracked client-side, so this returns
 *  events without `unread` — the store fills it in from the local read-set. */
export async function getNotifications(): Promise<Omit<Notification, "unread">[]> {
  const localItems = getLocalNotifications();
  let resData: any = null;
  try {
    const response = await httpClient.get<any>("/notifications");
    resData = response.data;
  } catch (err: any) {
    if (err?.response?.status === 404) {
      try {
        const response = await httpClient.get<any>("/api/notifications");
        resData = response.data;
      } catch (err2: any) {
        if (err2?.response?.status === 404) {
          try {
            const response = await httpClient.get<any>("/api/bmr/notifications");
            resData = response.data;
          } catch {
            return localItems;
          }
        } else {
          return localItems;
        }
      }
    } else {
      return localItems;
    }
  }

  const rawItems = Array.isArray(resData?.items)
    ? resData.items
    : Array.isArray(resData)
      ? resData
      : [];

  const backendItems = rawItems.map((n: any) => {
    const createdAt = n.created_at ? new Date(n.created_at) : new Date();
    return {
      id: String(n.id ?? n._id ?? Math.random().toString(36).slice(2)),
      category: (n.category as NotifCategory) ?? (n.job_id ? "doc" : "sys"),
      doc: n.doc
        ? { id: n.doc.id, name: n.doc.name ?? "", version: n.doc.version ?? undefined }
        : n.job_id
          ? { id: n.bmr_number || n.job_id, name: n.title ?? "Document", version: undefined }
          : undefined,
      md: n.md ?? undefined,
      system: n.system ?? undefined,
      actor: n.actor ?? "System",
      actorRole: n.actor_role ?? n.actorRole ?? "",
      action: n.action ?? n.title ?? "Update",
      state: (n.state as NotifStateKey | null) ?? undefined,
      comment: n.comment ?? n.message ?? undefined,
      date: n.date ?? createdAt.toLocaleDateString(),
      time: n.time ?? createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      needsAction: Boolean(n.needs_action ?? n.action_required),
      open: n.open ?? "Open",
      to: n.to ?? n.link ?? (n.job_id ? `/documents/${n.job_id}/inputs` : undefined),
      viewOnly: Boolean(n.view_only),
    };
  });

  // Merge local custom notifications (e.g. master data workflow events) with backend notifications
  const backendIds = new Set(backendItems.map((b: { id: string }) => b.id));
  const uniqueLocal = localItems.filter((l) => !backendIds.has(l.id));
  return [...uniqueLocal, ...backendItems];
}

export async function markNotificationAsRead(id: string | number): Promise<void> {
  const numId = Number(id);
  if (!Number.isNaN(numId)) {
    try {
      await httpClient.post(`/notifications/${numId}/read`);
    } catch {
      // non-blocking fallback
    }
  }
}

export async function markAllNotificationsAsRead(): Promise<void> {
  try {
    await httpClient.post("/notifications/mark-all-read");
  } catch {
    // non-blocking fallback
  }
}

