import { httpClient } from "../../../shared/api/httpClient";

/** One live controlled record, as listed on the Version History screen. */
export interface VersionHistoryItem {
  document_id: string;
  bmr_number: string;
  version: string;
  status: string;
  product_name: string | null;
  product_type: string | null;
  doc_type: string | null;
  batch_size: number | null;
  market: string | null;
  /** ISO date (YYYY-MM-DD) the document was generated/printed. */
  date_of_print: string | null;
  /** ISO date; user-editable (QA / Approver only). */
  effective_date: string | null;
}

export async function getVersionHistory(): Promise<VersionHistoryItem[]> {
  const response = await httpClient.get<{ items: VersionHistoryItem[] }>(
    "/api/bmr/version-history",
  );
  return response.data.items;
}

/**
 * Set (or reschedule) the effective date of a controlled record. Change-controlled:
 * the backend requires a reason and gates this to Reviewer QA and the Approver.
 */
export async function setEffectiveDate(
  documentId: string,
  effectiveDate: string | null,
  reason: string,
): Promise<string | null> {
  const response = await httpClient.put<{ document_id: string; effective_date: string | null }>(
    `/api/bmr/documents/${encodeURIComponent(documentId)}/effective-date`,
    { effective_date: effectiveDate, reason },
  );
  return response.data.effective_date;
}

/**
 * Start a new revision from a live record (Version History → Revise). Carries the formula,
 * core inputs, formatting and stages over into a fresh draft (revision bumped 00 → 01) and
 * returns the new document id to continue the wizard from. Preparer-initiated.
 */
export async function reviseDocument(documentId: string): Promise<string> {
  const response = await httpClient.post<{ document_id: string }>(
    `/api/bmr/documents/${encodeURIComponent(documentId)}/revise`,
    {},
  );
  return response.data.document_id;
}
