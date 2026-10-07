import { httpClient } from "../../../shared/api/httpClient";
import type {
  BomResponse,
  CoverPreviewFile,
  GenerateBomResponse,
  GenerateCoverProgress,
  UpdateBomPayload,
} from "./bom.types";

/** Starts one asynchronous cover-generation attempt; progress is polled separately. */
export async function generateBom(documentId: string, signal?: AbortSignal): Promise<GenerateBomResponse> {
  const response = await httpClient.post<GenerateBomResponse>(
    `/api/documents/${encodeURIComponent(documentId)}/generate-cover`,
    undefined,
    { signal },
  );

  return response.data;
}

export async function getBom(documentId: string, signal?: AbortSignal): Promise<BomResponse> {
  const response = await httpClient.get<any>(
    `/api/documents/${encodeURIComponent(documentId)}`,
    { signal },
  );
  const data = response.data;
  return {
    document_id: data.job_id || data.document_id || documentId,
    doc_type: String(data.doc_type || "bmr").toLowerCase() === "bpr" ? "bpr" : "bmr",
    status: data.preview_url ? "extracted" : "not_generated",
    preview_url: typeof data.preview_url === "string" ? data.preview_url : "",
    header: {
      company_name: null,
      department: null,
      logo_url: null,
      doc_title: data.doc_type ? String(data.doc_type).toUpperCase() : "BMR",
      product_name: data.product_name || null,
      batch_size: data.batch_size ? String(data.batch_size) : null,
      bmr_number: data.document_no || data.bmr_number || null,
      revision_number: "00",
      template_no: null,
    },
    cover: {
      product_name: data.product_name || null,
      generic_name: data.product_name || null,
      label_claim: null,
      product_code: data.product_code || null,
      mfc_number: null,
      bmr_number: data.document_no || null,
      revision_number: "00",
      supersedes: null,
      theoretical_batch_size: data.batch_size || null,
      theoretical_batch_wt: null,
      mfc_batch_size: data.batch_size || null,
      mfc_batch_size_uom: "kg",
      licence_no: null,
      market: null,
      shelf_life: null,
      product_description: null,
      finished_goods_code: null,
      storage_condition: null,
      pack_style: null,
      pharmacological_action: null,
      layers: data.layers || [],
    },
    ingredients: (data.ingredients || []).map((ing: any) => ({
      sr_no: ing.sr_no,
      material_code: ing.material_code,
      name: ing.ingredient_name || ing.name || "",
      specification: ing.specification || null,
      label_claim_mg_per_unit: ing.label_claim_mg_per_unit || null,
      qty_per_mfc_batch: ing.qty_per_mfc_batch,
      overage_pct: null,
      qty_required_production: ing.qty_required_production,
      functional_category: null,
      uom: ing.uom || "kg",
      layer: ing.layer || "",
      part: ing.part || "",
      is_api: false,
      is_compensated: false,
      is_avg_weight: ing.sr_no === 0,
      notes: null,
    })),
    formulation_notes: [],
    precautions: [],
    warnings: [],
    error_message: null,
  };
}

export async function getCoverGenerationProgress(
  documentId: string,
  signal?: AbortSignal,
): Promise<GenerateCoverProgress> {
  const response = await httpClient.get<GenerateCoverProgress>(
    `/api/documents/${encodeURIComponent(documentId)}/generate-cover/progress`,
    { signal },
  );
  return response.data;
}

export async function getCoverBomDocx(
  documentId: string,
  signal?: AbortSignal,
): Promise<CoverPreviewFile> {
  const response = await httpClient.get(
    `/api/documents/${encodeURIComponent(documentId)}/cover-preview`,
    {
      responseType: "blob",
      signal,
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    },
  );

  const blob = response.data as Blob;
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error("The backend returned an empty Cover + BOM document.");
  }
  return {
    blob,
    filename:
      getResponseFilename(response.headers["content-disposition"]) ??
      `cover_preview_${documentId}.docx`,
  };
}

export async function updateBom(documentId: string, payload: UpdateBomPayload) {
  const response = await httpClient.patch(
    `/api/documents/${encodeURIComponent(documentId)}/bom`,
    payload,
  );
  return response.data;
}

function getResponseFilename(contentDisposition: unknown): string | null {
  if (typeof contentDisposition !== "string") return null;
  const encoded = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = contentDisposition.match(/filename\s*=\s*"?([^";]+)"?/i)?.[1];
  const value = encoded ?? plain;
  if (!value) return null;
  try { return decodeURIComponent(value.trim()); } catch { return value.trim(); }
}
