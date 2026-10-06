import { httpClient } from "../../../shared/api/httpClient";

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

/** Role-scoped on the server: a preparer sees their own work, everyone else the whole
 *  cross-author picture. */
export async function getBoard(): Promise<BoardResponse> {
  const response = await httpClient.get<BoardResponse>("/api/bmr/board");
  return response.data;
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
