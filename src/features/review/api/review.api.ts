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
  const response = await httpClient.get<any>("/api/documents/dashboard/me");
  const data = response.data;
  const docs = Array.isArray(data.documents) ? data.documents : [];
  return {
    role: data.role || "reviewer",
    items: docs.map((d: any) => ({
      document_id: d.job_id || d.document_id,
      bmr_number: d.document_no || null,
      product_name: d.product_name || null,
      status: d.status || "draft",
      batch_size: d.batch_size ?? null,
      prepared_by: d.created_by || null,
      review_round: 1,
      pending_roles: ["qa_reviewer", "pr_reviewer"],
      reject_reason: null,
      updated_at: d.last_modified_at || null,
    })),
  };
}

export async function getReviewState(documentId: string): Promise<ReviewState> {
  try {
    const response = await httpClient.get<any>(
      `/api/documents/${encodeURIComponent(documentId)}`,
    );
    const data = response.data;
    return {
      document_id: data.job_id || data.document_id || documentId,
      status: data.status || "draft",
      review_round: 1,
      reject_reason: null,
      pending_roles: ["qa_reviewer", "pr_reviewer"],
      can_act: true,
      reviews: [],
    };
  } catch {
    return {
      document_id: documentId,
      status: "in_review",
      review_round: 1,
      reject_reason: null,
      pending_roles: ["qa_reviewer", "pr_reviewer"],
      can_act: true,
      reviews: [],
    };
  }
}

export async function submitReview(
  documentId: string,
  decision: "approved" | "rejected",
  comment: string,
): Promise<ReviewState> {
  const endpoint = decision === "approved"
    ? `/api/documents/${encodeURIComponent(documentId)}/review/qa`
    : `/api/documents/${encodeURIComponent(documentId)}/return`;

  await httpClient.post(endpoint, { comment });
  return getReviewState(documentId);
}

export async function approveDocument(
  documentId: string,
  decision: "approved" | "rejected",
  comment: string,
): Promise<ReviewState> {
  const endpoint = decision === "approved"
    ? `/api/documents/${encodeURIComponent(documentId)}/approve`
    : `/api/documents/${encodeURIComponent(documentId)}/reject`;

  await httpClient.post(endpoint, { comment });
  return getReviewState(documentId);
}

export async function resubmitDocument(documentId: string): Promise<ReviewState> {
  await httpClient.post(
    `/api/documents/${encodeURIComponent(documentId)}/revise`,
    {},
  );

  return getReviewState(documentId);
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
  approver: "Approved By",
};
