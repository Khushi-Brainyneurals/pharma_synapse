import { httpClient } from "../../../shared/api/httpClient";
import { useAuthStore } from "../../auth/state/auth.store";

/** One document as it sits on the read-only status board. */
export interface BoardItem {
  document_id: string;
  bmr_number: string | null;
  product_name: string | null;
  status: string;
  product_type: string | null;
  doc_type: string | null;
  batch_type: string | null;
  batch_size: number | null;
  prepared_by: string | null;
  pending_roles: string[];
  review_round: number;
  reject_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface BoardResponse {
  role: string;
  items: BoardItem[];
}

export async function getBoard(role?: string): Promise<BoardResponse> {
  const currentRole = role || useAuthStore.getState().user?.role;
  const isOverviewRole =
    currentRole === "approver" || currentRole === "admin" || currentRole === "superadmin";
  const endpoint = isOverviewRole
    ? "/api/documents/dashboard/overview"
    : "/api/documents/dashboard/me";

  let res: any;
  try {
    res = await httpClient.get<any>(endpoint);
  } catch (err: any) {
    if (isOverviewRole) {
      try {
        res = await httpClient.get<any>("/api/documents/dashboard/me");
      } catch (err2: any) {
        if (err2?.response?.status === 403) {
          return { role: currentRole || "admin", items: [] };
        }
        throw err2;
      }
    } else {
      if (err?.response?.status === 403) {
        return { role: currentRole || "preparer", items: [] };
      }
      throw err;
    }
  }
  const data = res?.data ?? {};
  const docs = Array.isArray(data.documents) ? data.documents : [];
  return {
    role: data.role || currentRole || "preparer",
    items: docs.map((d: any) => ({
      document_id: d.job_id || d.document_id,
      bmr_number: d.document_no || null,
      product_name: d.product_name || null,
      status: d.status || "draft",
      dosage_form: d.product_type || null,
      doc_type: d.doc_type || null,
      batch_size: d.batch_size ?? null,
      prepared_by: d.created_by || null,
      pending_roles: [],
      review_round: 1,
      reject_reason: null,
      created_at: d.last_modified_at || null,
      updated_at: d.last_modified_at || null,
    })),
  };
}

/** The four lifecycle buckets the summary strip counts, and which raw statuses fall in
 *  each. Kept here so the strip and the state filter agree. */
export const BOARD_BUCKETS = {
  draft: ["draft", "core_inputs_set", "extracting", "extraction_failed", "extracted", "stages_set", "generating", "generation_failed", "generated"],
  in_review: ["submitted", "in_review", "pending_approval"],
  approved: ["approved"],
  rejected: ["rejected"],
} as const;

export type BoardBucket = keyof typeof BOARD_BUCKETS;

export function bucketOf(status: string): BoardBucket {
  for (const [bucket, statuses] of Object.entries(BOARD_BUCKETS) as [BoardBucket, readonly string[]][]) {
    if (statuses.includes(status)) return bucket;
  }
  return "draft";
}

/** In-review documents that have sat untouched past the SLA are the board's "overdue"
 *  exceptions. Dummy default: 3 days — confirm against the real QA SLA before release. */
const OVERDUE_DAYS = 3;

export function ageMs(item: BoardItem, now: number): number {
  const ts = item.updated_at ? Date.parse(item.updated_at) : NaN;
  return Number.isNaN(ts) ? 0 : now - ts;
}

export function isOverdue(item: BoardItem, now: number): boolean {
  return bucketOf(item.status) === "in_review" && ageMs(item, now) > OVERDUE_DAYS * 86_400_000;
}

/** Compact "age in state" — 3d / 5h / 12m / just now. */
export function ageLabel(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
