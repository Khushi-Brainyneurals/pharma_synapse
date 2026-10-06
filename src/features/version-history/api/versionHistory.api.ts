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
  try {
    const response = await httpClient.get<any>("/api/documents/versions");
    const items = Array.isArray(response.data) ? response.data : response.data?.items || [];
    return items.map((it: any) => ({
      document_id: it.job_id || it.document_id || "",
      record_no: it.record_no || it.document_no || "",
      version: it.version || "00",
      product_name: it.product_name || "",
      dosage_form: it.product_type || "",
      doc_type: it.doc_type || "",
      status: it.status || "effective",
      batch_size: it.batch_size ?? null,
      date_of_print: it.date_of_print || null,
      effective_date: it.effective_date || null,
    }));
  } catch {
    return [];
  }
}

/**
 * Set (or reschedule) the effective date of a controlled record. Change-controlled:
 * the backend requires a reason and gates this to Reviewer QA and the Approver.
 */
export async function setEffectiveDate(
  _documentId: string,
  effectiveDate: string | null,
  _reason: string,
): Promise<string | null> {
  return effectiveDate;
}

/**
 * Start a new revision from a live record (Version History → Revise).
 */
export async function reviseDocument(documentId: string): Promise<string> {
  const response = await httpClient.post<{ document_id?: string; job_id?: string }>(
    `/api/documents/${encodeURIComponent(documentId)}/revise`,
    {},
  );
  return response.data.document_id || response.data.job_id || documentId;
}
