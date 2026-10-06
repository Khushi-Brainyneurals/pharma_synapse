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

export async function getDashboard(): Promise<DashboardResponse> {
  return (await httpClient.get<DashboardResponse>("/api/bmr/dashboard")).data;
}
export async function deleteDraft(id: string, input: CloseRequest): Promise<CloseResponse> {
  return (await httpClient.post<CloseResponse>(`/api/bmr/documents/${encodeURIComponent(id)}/delete-draft`, input)).data;
}
export async function cancelRecord(id: string, input: CloseRequest): Promise<CloseResponse> {
  return (await httpClient.post<CloseResponse>(`/api/bmr/documents/${encodeURIComponent(id)}/cancel`, input)).data;
}
