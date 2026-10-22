import { httpClient } from "../../../shared/api/httpClient";
/* ==========================================================================
 * ⚠️  DUMMY MODE — temporary stand-in until the backend is live.
 * Set USE_DUMMY = false (or delete the whole "DUMMY DATA" block below) to
 * restore real network calls.
 * ========================================================================== */
const USE_DUMMY = true;

/** One live controlled record, as listed on the Version History screen.
 *  Mirrors GET /api/documents/versions — `document_id` is added as a stable React
 *  key (= record_no) so list rows can be keyed without churn. */
export interface VersionHistoryItem {
  /** Stable React key (= record_no). */
  document_id: string;
  /** BMR No. column (== record_no, the path param for version-chain lookups). */
  bmr_number: string;
  /** Secondary document number when distinct from record_no. */
  document_no: string | null;
  /** BMR / BPR / PVP — drives the document-type filter. */
  doc_type: string | null;
  /** Latest live version label (mapped from backend `current_version`). */
  version: string;
  /** Lifecycle status (effective / approved / generated / …). */
  status: string;
  product_name: string | null;
  /** Number of older versions this one has superseded. */
  superseded_count: number;
  /** User who finalized this version. */
  created_by: string | null;
  /** ISO datetime the document was finalized (replaces the old `date_of_print`). */
  finalized_at: string | null;
}

/** One entry in the version chain for a given record_no. The backend returns a raw
 *  object per version whose shape is doc-type dependent, so we type only the fields
 *  the UI always reads and leave the rest as a passthrough. */
export interface VersionChainEntry {
  version?: string;
  status?: string;
  finalized_at?: string | null;
  created_by?: string | null;
  [key: string]: unknown;
}

/** Full snapshot of one version. Untyped on purpose — the shape depends on doc_type. */
export type VersionSnapshot = Record<string, unknown>;

/* --------------------------------------------------------------------------
 * DUMMY DATA — delete this block once the backend is live.
 * -------------------------------------------------------------------------- */

const DUMMY_ITEMS: VersionHistoryItem[] = [
  {
    document_id: "BMR-2024-0147",
    bmr_number: "BMR-2024-0147",
    document_no: null,
    doc_type: "bmr",
    version: "3.0",
    status: "effective",
    product_name: "Paracetamol 500mg Tablets",
    superseded_count: 2,
    created_by: "qa.smith@acme.com",
    finalized_at: "2025-03-18T09:21:00Z",
  },
  {
    document_id: "BMR-2024-0211",
    bmr_number: "BMR-2024-0211",
    document_no: null,
    doc_type: "bmr",
    version: "1.0",
    status: "effective",
    product_name: "Ibuprofen 400mg Tablets",
    superseded_count: 0,
    created_by: "qa.patel@acme.com",
    finalized_at: "2025-05-02T14:08:00Z",
  },
  {
    document_id: "BPR-2024-0388",
    bmr_number: "BPR-2024-0388",
    document_no: "DOC-BPR-388",
    doc_type: "bpr",
    version: "2.1",
    status: "effective",
    product_name: "Paracetamol 500mg (Blister 10s)",
    superseded_count: 1,
    created_by: "reviewer.lee@acme.com",
    finalized_at: "2025-06-11T11:45:00Z",
  },
  {
    document_id: "BMR-2024-0512",
    bmr_number: "BMR-2024-0512",
    document_no: null,
    doc_type: "bmr",
    version: "4.0",
    status: "approved",
    product_name: "Amoxicillin 250mg Capsules",
    superseded_count: 3,
    created_by: "approver.kumar@acme.com",
    finalized_at: "2025-07-23T16:30:00Z",
  },
  {
    document_id: "BMR-2024-0633",
    bmr_number: "BMR-2024-0633",
    document_no: null,
    doc_type: "bmr",
    version: "1.2",
    status: "generated",
    product_name: "Metformin 850mg Tablets",
    superseded_count: 0,
    created_by: "prep.das@acme.com",
    finalized_at: "2025-08-14T08:12:00Z",
  },
  {
    document_id: "BPR-2024-0719",
    bmr_number: "BPR-2024-0719",
    document_no: null,
    doc_type: "bpr",
    version: "1.0",
    status: "in_review",
    product_name: "Omeprazole 20mg Capsules (Blister)",
    superseded_count: 0,
    created_by: "prep.das@acme.com",
    finalized_at: null,
  },
  {
    document_id: "PVP-2024-0007",
    bmr_number: "PVP-2024-0007",
    document_no: null,
    doc_type: "pvp",
    version: "2.0",
    status: "effective",
    product_name: "Atorvastatin 10mg Tablets",
    superseded_count: 1,
    created_by: "qa.smith@acme.com",
    finalized_at: "2025-04-30T10:00:00Z",
  },
  {
    document_id: "BMR-2024-0824",
    bmr_number: "BMR-2024-0824",
    document_no: null,
    doc_type: "bmr",
    version: "5.0",
    status: "effective",
    product_name: "Losartan 50mg Tablets",
    superseded_count: 4,
    created_by: "approver.kumar@acme.com",
    finalized_at: "2025-09-05T13:42:00Z",
  },
  {
    document_id: "BPR-2024-0901",
    bmr_number: "BPR-2024-0901",
    document_no: "DOC-BPR-901",
    doc_type: "bpr",
    version: "3.0",
    status: "effective",
    product_name: "Cetirizine 10mg Tablets (Blister 15s)",
    superseded_count: 2,
    created_by: "qa.patel@acme.com",
    finalized_at: "2025-10-12T09:55:00Z",
  },
  {
    document_id: "BMR-2024-0956",
    bmr_number: "BMR-2024-0956",
    document_no: null,
    doc_type: "bmr",
    version: "1.0",
    status: "generated",
    product_name: "Azithromycin 500mg Tablets",
    superseded_count: 0,
    created_by: "prep.das@acme.com",
    finalized_at: "2025-10-18T15:20:00Z",
  },
];

/** Synthetic version chain for a dummy item — walks back from `version` to v1.0,
 *  marking every earlier version as `superseded`. Keeps the chain length consistent
 *  with `superseded_count`. */
function dummyChainFor(item: VersionHistoryItem): VersionChainEntry[] {
  const totalVersions = Math.max(1, item.superseded_count + 1);
  const currentMajor = parseInt(item.version.split(".")[0] || "1", 10) || 1;
  const chain: VersionChainEntry[] = [];
  for (let i = 0; i < totalVersions; i++) {
    const major = currentMajor - i;
    const isCurrent = i === 0;
    const finalized = isCurrent ? item.finalized_at : shiftDate(item.finalized_at, -(i * 45));
    chain.push({
      version: `${major}.0`,
      status: isCurrent ? item.status : "superseded",
      finalized_at: finalized,
      created_by: item.created_by,
      record_no: item.bmr_number,
      doc_type: item.doc_type,
      reason: major === 1 ? "Initial issue" : isCurrent ? "Periodic review / minor revision" : "Superseded by later revision",
    });
  }
  return chain;
}

function shiftDate(iso: string | null, daysOffset: number): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString();
}

/** Tiny delay so the loading spinner / pending button actually shows. */
function dummyDelay<T>(value: T, ms = 450): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/* --------------------------------------------------------------------------
 * END DUMMY DATA
 * -------------------------------------------------------------------------- */

/**
 * GET /api/documents/versions — every live controlled record, one row per finalized
 * (doc_type, record_no). Swallows network errors and returns [] so the list page can
 * render an empty state instead of crashing.
 */
export async function getVersionHistory(): Promise<VersionHistoryItem[]> {
  if (USE_DUMMY) return dummyDelay(DUMMY_ITEMS);
  try {
    const response = await httpClient.get<any>("/api/documents/versions");
    const items = Array.isArray(response.data) ? response.data : response.data?.items || [];
    return items.map((it: any): VersionHistoryItem => ({
      document_id: it.record_no || it.document_no || "",
      bmr_number: it.record_no || it.document_no || "",
      document_no: it.document_no ?? null,
      doc_type: it.doc_type ?? null,
      version: it.current_version ?? it.version ?? "00",
      status: it.status || "effective",
      product_name: it.product_name ?? null,
      superseded_count: it.superseded_count ?? 0,
      created_by: it.created_by ?? null,
      finalized_at: it.finalized_at ?? null,
    }));
  } catch {
    return [];
  }
}

/**
 * GET /api/documents/versions/{record_no} — full version chain for one document
 * number. Pass `doc_type` when BMR/BPR/PVP share a number, and `site_id` to scope
 * to a particular Address.
 */
export async function getVersionChain(
  recordNo: string,
  docType?: string | null,
  siteId?: number | null,
): Promise<VersionChainEntry[]> {
  if (USE_DUMMY) {
    const item = DUMMY_ITEMS.find((r) => r.bmr_number === recordNo);
    if (!item) return dummyDelay([]);
    return dummyDelay(dummyChainFor(item));
  }
  const params: Record<string, unknown> = {};
  if (docType) params.doc_type = docType;
  if (siteId != null) params.site_id = siteId;
  const response = await httpClient.get<VersionChainEntry[]>(
    `/api/documents/versions/${encodeURIComponent(recordNo)}`,
    { params },
  );
  return Array.isArray(response.data) ? response.data : [];
}

/**
 * GET /api/documents/versions/{record_no}/{version} — one version's full document
 * snapshot, scoped to an Address. Same query params as getVersionChain.
 */
export async function getVersionSnapshot(
  recordNo: string,
  version: string,
  docType?: string | null,
  siteId?: number | null,
): Promise<VersionSnapshot> {
  if (USE_DUMMY) {
    return dummyDelay({
      record_no: recordNo,
      version,
      doc_type: docType ?? null,
      site_id: siteId ?? null,
      snapshot: "Dummy snapshot — wire the real endpoint when the backend is live.",
      sections: [
        { id: "1", title: "Manufacturing steps", completed: 12, total: 18 },
        { id: "2", title: "In-process controls", completed: 5, total: 5 },
        { id: "3", title: "Yield & reconciliation", completed: 0, total: 3 },
      ],
    });
  }
  const params: Record<string, unknown> = {};
  if (docType) params.doc_type = docType;
  if (siteId != null) params.site_id = siteId;
  const response = await httpClient.get<VersionSnapshot>(
    `/api/documents/versions/${encodeURIComponent(recordNo)}/${encodeURIComponent(version)}`,
    { params },
  );
  return response.data ?? {};
}

/**
 * Set (or reschedule) the effective date of a controlled record. Change-controlled:
 * the backend requires a reason and gates this to Reviewer QA and the Approver.
 *
 * NOTE: the GET /api/documents/versions response no longer surfaces `effective_date`,
 * so this is now an action-only API. Callers that want to refresh the date must
 * re-fetch the version chain (getVersionChain) or read it from the response. The
 * function still returns the supplied date so optimistic UI keeps working until the
 * backend contract is finalised.
 */
export async function setEffectiveDate(
  _recordNo: string,
  effectiveDate: string | null,
  _reason: string,
): Promise<string | null> {
  return dummyDelay(effectiveDate, 350);
}
