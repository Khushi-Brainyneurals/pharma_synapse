import { httpClient } from "../../../shared/api/httpClient";

export const OVERDUE_FILTER = "__overdue";
export const RETAINED_FILTER = "__retained";
export const RETAINED_STATES = ["superseded", "cancelled"];

export interface DashboardItem {
  document_id: string;
  display_id: string;
  version: string;
  product_name: string | null;
  dosage_form: string | null;
  doc_type: string | null;
  batch_size: number | null;
  batch_type: string | null;
  status: string;
  resume_step: string;
  state: string;
  state_label: string;
  bucket: string | null;
  is_overdue: boolean;
  days_in_step: number | null;
  step_limit_days: number | null;
  pending_roles: string[];
  pending_with: string | null;
  prepared_by: string | null;
  is_mine: boolean;
  review_round: number;
  note: string | null;
  permissions: {
    can_edit: boolean;
    can_delete: boolean;
    can_cancel: boolean;
    can_review: boolean;
    can_approve: boolean;
    can_correct: boolean;
  };
  created_at: string | null;
  updated_at: string | null;
}

export interface DashboardResponse {
  role: string;
  buckets: { key: string; label: string; sub: string; count: number }[];
  overdue_count: number;
  retained_count: number;
  active_count: number;
  sla_days: Record<string, number>;
  can_create: boolean;
  items: DashboardItem[];
}

interface CloseRequest { category: string; reason: string; password?: string }
interface CloseResponse { document_id: string; status: string; message: string }

function normalizeDashboardItem(raw: any): DashboardItem {
  const document_id = String(raw.document_id ?? raw.job_id ?? raw.id ?? "");
  const docNo = (raw.document_no || raw.bmr_number || raw.product_code || "").trim();
  const display_id = raw.display_id || docNo || (document_id ? `BMR-${document_id.slice(0, 8)}` : "Document");
  const status = String(raw.status ?? raw.state ?? "draft");
  const state = String(raw.state ?? raw.status ?? "draft");
  const state_label = String(raw.state_label ?? (status === "draft" ? "Draft" : status));
  const isDraft = status === "draft" || state === "draft";
  const isUnderReview = status === "under_review" || status === "in_review" || status === "submitted";
  const isReturned = status === "returned" || status === "rejected";
  const isApproved = status === "approved" || status === "pending_approval";

  const permissions = raw.permissions ?? {
    can_edit: Boolean(raw.can_edit ?? isDraft),
    can_delete: Boolean(raw.can_delete ?? isDraft),
    can_cancel: Boolean(raw.can_cancel ?? false),
    can_review: Boolean(raw.can_review ?? isUnderReview),
    can_approve: Boolean(raw.can_approve ?? isApproved),
    can_correct: Boolean(raw.can_correct ?? isReturned),
  };

  return {
    document_id,
    display_id,
    version: raw.version ?? "v00",
    product_name: raw.product_name || "Untitled document",
    dosage_form: raw.dosage_form ?? raw.product_type ?? "Tablet",
    doc_type: (raw.doc_type ?? "BMR").toUpperCase(),
    batch_size: raw.batch_size != null ? Number(raw.batch_size) : null,
    batch_type: raw.batch_type ?? null,
    status,
    resume_step: raw.resume_step ?? "inputs",
    state,
    state_label,
    bucket: raw.bucket ?? (isDraft ? "draft" : status),
    is_overdue: Boolean(raw.is_overdue),
    days_in_step: raw.days_in_step ?? null,
    step_limit_days: raw.step_limit_days ?? null,
    pending_roles: Array.isArray(raw.pending_roles) ? raw.pending_roles : [],
    pending_with: raw.pending_with ?? null,
    prepared_by: raw.prepared_by ?? raw.created_by ?? null,
    is_mine: Boolean(raw.is_mine ?? true),
    review_round: raw.review_round ?? 1,
    note: raw.note ?? null,
    permissions,
    created_at: raw.created_at ?? null,
    updated_at: raw.updated_at ?? raw.last_modified_at ?? null,
  };
}

export async function getDashboard(): Promise<DashboardResponse> {
  const response = await httpClient.get<any>("/api/documents/dashboard/me");
  const data = response.data ?? {};
  const rawList = Array.isArray(data.items) ? data.items : Array.isArray(data.documents) ? data.documents : [];
  const items = rawList.map(normalizeDashboardItem);
  const buckets = Array.isArray(data.buckets)
    ? data.buckets
    : Array.isArray(data.cards)
      ? data.cards.map((c: any) => ({ key: c.key, label: c.label, sub: "", count: Number(c.count ?? 0) }))
      : [];
  const overdueCard = Array.isArray(data.cards) ? data.cards.find((c: any) => c.key === "overdue") : null;

  return {
    ...data,
    role: data.role ?? "",
    buckets,
    items,
    sla_days: {
      in_review: data.sla_days?.in_review ?? 3,
      approval: data.sla_days?.approval ?? 2,
      returned: data.sla_days?.returned ?? 5,
      ...data.sla_days,
    },
    active_count: data.active_count ?? items.length,
    overdue_count: data.overdue_count ?? overdueCard?.count ?? 0,
    retained_count: data.retained_count ?? 0,
    can_create: data.can_create ?? true,
  };
}
export async function deleteDraft(id: string, input: CloseRequest): Promise<CloseResponse> {
  return (await httpClient.post<CloseResponse>(`/api/documents/${encodeURIComponent(id)}/delete-draft`, input)).data;
}
export async function cancelRecord(id: string, input: CloseRequest): Promise<CloseResponse> {
  return (await httpClient.post<CloseResponse>(`/api/documents/${encodeURIComponent(id)}/cancel`, input)).data;
}
