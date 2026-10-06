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
  const response = await httpClient.get<{ items?: any[] }>("/notifications");
  const rawItems = Array.isArray(response.data?.items) ? response.data.items : [];
  return rawItems.map((n: any) => {
    const createdAt = n.created_at ? new Date(n.created_at) : new Date();
    return {
      id: String(n.id),
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
}
