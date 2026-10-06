import { httpClient } from "../../../shared/api/httpClient";

export interface Correction {
  id: number;
  /** "BOM · Dry mixing · Sr 01 · Qty" — the field reference, as the design shows it. */
  target: string;
  target_kind: "cover" | "bom";
  target_key: string | null;
  row_index: number | null;
  current_value: string | null;
  proposed_value: string | null;
  reason: string;
  status: "open" | "resolved";
  raised_by: string;
  created_at: string;
  resolved_by: string | null;
  resolved_at: string | null;
}

export interface CorrectionsState {
  document_id: string;
  corrections: Correction[];
  open_count: number;
  has_unresolved: boolean;
}

export interface NewCorrection {
  target: string;
  target_kind: "cover" | "bom";
  target_key?: string | null;
  row_index?: number | null;
  current_value?: string | null;
  proposed_value?: string | null;
  reason: string;
}

const base = (documentId: string) =>
  `/api/bmr/documents/${encodeURIComponent(documentId)}/corrections`;

export async function getCorrections(documentId: string): Promise<CorrectionsState> {
  const response = await httpClient.get<CorrectionsState>(base(documentId));
  return response.data;
}

export async function raiseCorrection(
  documentId: string,
  correction: NewCorrection,
): Promise<CorrectionsState> {
  const response = await httpClient.post<CorrectionsState>(base(documentId), correction);
  return response.data;
}

export async function resolveCorrection(
  documentId: string,
  id: number,
): Promise<CorrectionsState> {
  const response = await httpClient.post<CorrectionsState>(`${base(documentId)}/${id}/resolve`);
  return response.data;
}

export async function reopenCorrection(
  documentId: string,
  id: number,
): Promise<CorrectionsState> {
  const response = await httpClient.post<CorrectionsState>(`${base(documentId)}/${id}/reopen`);
  return response.data;
}

/**
 * Accept the cover + BOM and move on.
 * Open corrections don't block it — but continuing with them must be deliberate,
 * and the acknowledgement is recorded in the audit trail.
 */
export async function acceptCoverBom(
  documentId: string,
  acknowledgeUnresolved = false,
): Promise<CorrectionsState> {
  const response = await httpClient.post<CorrectionsState>(`${base(documentId)}/accept`, {
    acknowledge_unresolved: acknowledgeUnresolved,
  });

  return response.data;
}
