import { httpClient } from "../../../shared/api/httpClient";
import { mapBomResponse } from "../../bom/api/bom.api";
import type { BomResponse } from "../../bom/api/bom.types";

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
  can_act: boolean;
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
  return_reason: string | null;
  qa_review_status: string | null;
  pr_review_status: string | null;
  pending_roles: string[];
  /** Whether the signed-in user may act on it right now. */
  can_act: boolean;
  reviews: ReviewEntry[];
}

export interface ReviewPageData {
  reviewState: ReviewState;
  bom: BomResponse | null;
  document: { status: string; bmr_number: string | null; header_footer_size: number | null };
}

/** Role-derived on the server — a reviewer can't ask for someone else's queue. */
export async function getQueue(): Promise<QueueResponse> {
  const response = await httpClient.get<any>("/api/documents/dashboard/me");
  const data = response.data ?? {};
  const docs = Array.isArray(data.items) ? data.items : Array.isArray(data.documents) ? data.documents : [];
  return {
    role: data.role || "",
    items: docs.map((d: any) => ({
      document_id: d.job_id || d.document_id || d.id,
      bmr_number: d.document_no || null,
      product_name: d.product_name || null,
      status: d.status || "draft",
      batch_size: d.batch_size ?? null,
      prepared_by: d.prepared_by || d.created_by || null,
      review_round: Number(d.review_round ?? 1),
      pending_roles: Array.isArray(d.pending_roles) ? d.pending_roles : [],
      reject_reason: d.reject_reason ?? d.reason ?? null,
      can_act: Boolean(d.permissions?.can_review || d.permissions?.can_approve || d.can_review || d.can_approve),
      updated_at: d.last_modified_at || null,
    })),
  };
}

function mapReviewState(data: any, documentId: string): ReviewState {
  const status = String(data.status ?? "draft");
  const qaStatus = data.qa_review_status ?? null;
  const prStatus = data.pr_review_status ?? null;
  const pendingRoles = Array.isArray(data.pending_roles) ? data.pending_roles : [];
  const approverReady = ["in_approval", "pending_approval"].includes(status) && qaStatus === "approved" && prStatus === "approved";
  return {
    document_id: data.job_id || data.document_id || documentId,
    status,
    review_round: Number(data.review_round ?? 1),
    reject_reason: data.reject_reason ?? (status === "rejected" ? data.reason ?? null : null),
    return_reason: data.return_reason ?? (status.includes("returned") ? data.reason ?? null : null),
    qa_review_status: qaStatus,
    pr_review_status: prStatus,
    pending_roles: pendingRoles,
    can_act: Boolean(data.can_act ?? data.permissions?.can_review ?? data.permissions?.can_approve ?? (
      pendingRoles.length > 0 || qaStatus === "pending" || prStatus === "pending" || approverReady
    )),
    reviews: Array.isArray(data.reviews) ? data.reviews : [],
  };
}

export async function getReviewState(documentId: string): Promise<ReviewState> {
  const response = await httpClient.get<any>(`/api/documents/${encodeURIComponent(documentId)}`);
  return mapReviewState(response.data ?? {}, documentId);
}

export async function getReviewPageData(documentId: string): Promise<ReviewPageData> {
  const response = await httpClient.get<any>(`/api/documents/${encodeURIComponent(documentId)}`);
  const data = response.data ?? {};
  const bom = Array.isArray(data.ingredients)
    ? mapBomResponse(data, documentId)
    : null;
  return {
    reviewState: mapReviewState(data, documentId),
    bom,
    document: {
      status: String(data.status ?? "draft"),
      bmr_number: data.bmr_number || data.document_no || null,
      header_footer_size: data.header_footer_size ?? null,
    },
  };
}

export async function submitReview(
  documentId: string,
  role: "reviewer_qa" | "reviewer_pr",
  decision: "approved" | "returned",
  reason: string,
): Promise<void> {
  const endpoint = role === "reviewer_qa" ? "review/qa" : "review/pr";
  await httpClient.post(`/api/documents/${encodeURIComponent(documentId)}/${endpoint}`, { decision, reason });
}

export async function approveDocument(
  documentId: string,
  decision: "approved" | "returned" | "rejected",
  reason: string,
): Promise<void> {
  const base = `/api/documents/${encodeURIComponent(documentId)}`;
  if (decision === "approved") await httpClient.post(`${base}/approve`);
  else if (decision === "returned") await httpClient.post(`${base}/return`, { reason });
  else await httpClient.post(`${base}/reject`, { reason });
}

export interface FinalizeAttachment {
  name: string;
  pages: number;
}

export interface FinalizeDocumentPayload {
  product_code: string;
  document_no: string;
  bmr_no: string;
  bpr_no: string;
  attachments: FinalizeAttachment[];
  ccn_no: string;
  ccn_approval_date: string;
}

export async function finalizeDocument(documentId: string, payload: FinalizeDocumentPayload): Promise<void> {
  await httpClient.post(`/api/documents/${encodeURIComponent(documentId)}/finalize`, payload);
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
  qa_review: "QA review",
  pr_review: "Production review",
  in_approval: "Awaiting sign-off",
  pending_approval: "Awaiting sign-off",
  approved: "Approved",
  rejected: "Rejected",
  returned: "Returned for correction",
  returned_for_correction: "Returned for correction",
  approved_for_print: "Approved for print",
  finalized: "Finalized",
};

export const ROLE_LABELS: Record<string, string> = {
  reviewer_qa: "Reviewer — QA",
  reviewer_pr: "Reviewer — Production",
  approver: "Approved By",
};
