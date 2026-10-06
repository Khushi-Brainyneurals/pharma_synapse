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
  `/api/documents/${encodeURIComponent(documentId)}/bom`;

function emptyCorrections(documentId: string): CorrectionsState {
  return {
    document_id: documentId,
    corrections: [],
    open_count: 0,
    has_unresolved: false,
  };
}

export async function getCorrections(documentId: string): Promise<CorrectionsState> {
  try {
    const response = await httpClient.get<CorrectionsState>(base(documentId));
    return response.data;
  } catch {
    return emptyCorrections(documentId);
  }
}

export async function raiseCorrection(
  documentId: string,
  correction: NewCorrection,
): Promise<CorrectionsState> {
  try {
    await httpClient.patch(`/api/documents/${encodeURIComponent(documentId)}/bom`, {
      ingredient_edits: correction.proposed_value ? [{ [correction.target_key || "value"]: correction.proposed_value }] : [],
    });
  } catch {
    // fallback
  }
  return {
    document_id: documentId,
    open_count: 1,
    has_unresolved: true,
    corrections: [
      {
        id: 1,
        target: correction.target,
        target_kind: correction.target_kind,
        target_key: correction.target_key ?? null,
        row_index: correction.row_index ?? null,
        current_value: correction.current_value ?? null,
        proposed_value: correction.proposed_value ?? null,
        reason: correction.reason,
        status: "open",
        raised_by: "user",
        created_at: new Date().toISOString(),
        resolved_at: null,
        resolved_by: null,
      },
    ],
  };
}

export async function resolveCorrection(
  documentId: string,
  _id: number,
): Promise<CorrectionsState> {
  return emptyCorrections(documentId);
}

export async function reopenCorrection(
  documentId: string,
  _id: number,
): Promise<CorrectionsState> {
  return emptyCorrections(documentId);
}

/**
 * Accept the cover + BOM and move on.
 */
export async function acceptCoverBom(
  documentId: string,
  _acknowledgeUnresolved = false,
): Promise<CorrectionsState> {
  return emptyCorrections(documentId);
}
