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

/** Fetch the signed-in user's feed. Read/unread is tracked client-side, so this returns
 *  events without `unread` — the store fills it in from the local read-set. */
export async function getNotifications(): Promise<Omit<Notification, "unread">[]> {
  const response = await httpClient.get<{ items: ApiNotif[] }>("/api/bmr/notifications");
  return response.data.items.map((n) => ({
    id: n.id,
    category: n.category,
    doc: n.doc ? { id: n.doc.id, name: n.doc.name ?? "", version: n.doc.version ?? undefined } : undefined,
    md: n.md ?? undefined,
    system: n.system ?? undefined,
    actor: n.actor,
    actorRole: n.actor_role,
    action: n.action,
    state: (n.state as NotifStateKey | null) ?? undefined,
    comment: n.comment ?? undefined,
    date: n.date,
    time: n.time,
    needsAction: n.needs_action,
    open: n.open,
    to: n.to ?? undefined,
    viewOnly: n.view_only,
  }));
}
