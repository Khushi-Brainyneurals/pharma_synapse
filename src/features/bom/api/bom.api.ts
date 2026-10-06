import { httpClient } from "../../../shared/api/httpClient";
import type { BomResponse, GenerateBomResponse } from "./bom.types";

/** Kicks off OCR + extraction. Returns 202 immediately — this takes minutes. */
export async function generateBom(documentId: string): Promise<GenerateBomResponse> {
  const response = await httpClient.post<GenerateBomResponse>(
    `/api/documents/${encodeURIComponent(documentId)}/generate-cover`,
  );

  return response.data;
}

export async function getBom(documentId: string): Promise<BomResponse> {
  const response = await httpClient.get<any>(
    `/api/documents/${encodeURIComponent(documentId)}`,
  );
  const data = response.data;
  return {
    document_id: data.job_id || data.document_id || documentId,
    status: data.ingredients && data.ingredients.length > 0 ? "extracted" : "extracting",
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

export async function getCoverBomPdf(documentId: string): Promise<Blob> {
  const response = await httpClient.get(
    `/api/documents/${encodeURIComponent(documentId)}/cover-preview`,
    { responseType: "blob" },
  );

  return response.data as Blob;
}

export async function getCoverBomDocx(documentId: string): Promise<Blob> {
  const response = await httpClient.get(
    `/api/documents/${encodeURIComponent(documentId)}/cover-preview`,
    { responseType: "blob" },
  );

  return response.data as Blob;
}
