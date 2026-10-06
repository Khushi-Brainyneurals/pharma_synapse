import { httpClient } from "../../../shared/api/httpClient";

export interface QueueItem {
  document_id: string;
  bmr_number: string | null;
  product_name: string | null;
  status: string;
  batch_size: number | null;
  prepared_by: string | null;
  review_round: number;
  pending_roles: string[];
  reject_reason: string | null;
  updated_at: string | null;
}

export interface QueueResponse {
  role: string;
  items: QueueItem[];
}

export interface ReviewEntry {
  role: string;
  reviewer: string;
  decision: string;
  comment: string | null;
  round: number;
  created_at: string;
}

export interface ReviewState {
  document_id: string;
  status: string;
  review_round: number;
  reject_reason: string | null;
  pending_roles: string[];
  /** Whether the signed-in user may act on it right now. */
  can_act: boolean;
  reviews: ReviewEntry[];
}

/** Role-derived on the server — a reviewer can't ask for someone else's queue. */
export async function getQueue(): Promise<QueueResponse> {
  const response = await httpClient.get<QueueResponse>("/api/bmr/queue");
  return response.data;
}

export async function getReviewState(documentId: string): Promise<ReviewState> {
  const response = await httpClient.get<ReviewState>(
    `/api/bmr/documents/${encodeURIComponent(documentId)}/review`,
  );

  return response.data;
}

export async function submitReview(
  documentId: string,
  decision: "approved" | "rejected",
  comment: string,
): Promise<ReviewState> {
  const response = await httpClient.post<ReviewState>(
    `/api/bmr/documents/${encodeURIComponent(documentId)}/review`,
    { decision, comment },
  );

  return response.data;
}

export async function approveDocument(
  documentId: string,
  decision: "approved" | "rejected",
  comment: string,
): Promise<ReviewState> {
  const response = await httpClient.post<ReviewState>(
    `/api/bmr/documents/${encodeURIComponent(documentId)}/approve`,
    { decision, comment },
  );

  return response.data;
}

export async function resubmitDocument(documentId: string): Promise<ReviewState> {
  const response = await httpClient.post<ReviewState>(
    `/api/bmr/documents/${encodeURIComponent(documentId)}/resubmit`,
  );

  return response.data;
}

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  core_inputs_set: "Inputs set",
  extracting: "Reading the MFC",
  extraction_failed: "Extraction failed",
  extracted: "BOM ready",
  stages_set: "Stages selected",
  generating: "Generating",
  generation_failed: "Generation failed",
  generated: "Generated",
  submitted: "Awaiting review",
  in_review: "In review",
  pending_approval: "Awaiting sign-off",
  approved: "Approved",
  rejected: "Rejected",
};

export const ROLE_LABELS: Record<string, string> = {
  reviewer_qa: "Reviewer — QA",
  reviewer_pr: "Reviewer — Production",
  approvedby: "Approved By",
};
