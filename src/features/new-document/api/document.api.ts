import { httpClient } from "../../../shared/api/httpClient";
import type { DocumentDetail, OptionsResponse, StagesResponse } from "./document.types";

export async function getDocument(documentId: string): Promise<DocumentDetail> {
  const response = await httpClient.get<any>(
    `/api/documents/${encodeURIComponent(documentId)}`,
  );
  const data = response.data;
  const resumeStep = data.resume_step || data.state || "inputs";
  const stepOrder = ["type", "inputs", "cover-bom", "stages", "generate-submit"];
  const stepMap: Record<string, number> = {
    type: 0,
    inputs: 1,
    core_inputs: 1,
    core_input: 1,
    // Older backend states may still mention the removed format-preview step.
    // Resume those documents at Cover + BOM.
    preview: 2,
    format_preview: 2,
    "cover-bom": 2,
    cover_bom: 2,
    cover_review: 2,
    review_cover: 2,
    cover: 2,
    bom: 2,
    stages: 3,
    stage_params: 3,
    "stage-input": 3,
    select_stages: 3,
    submit: 4,
    generate: 4,
    "generate-submit": 4,
  };
  const stepKey = String(resumeStep).toLowerCase().trim();
  const activeIdx = stepMap[stepKey] ?? stepMap[resumeStep] ?? 1;
  const isSubmitted = ["submitted", "in_review", "qa_review", "pr_review", "in_approval", "pending_approval", "approved", "rejected", "approved_for_print", "finalized"].includes(data.status);
  const completedSteps = isSubmitted
    ? stepOrder
    : stepOrder.slice(0, activeIdx);

  return {
    document_id: data.document_id || data.job_id || documentId,
    dosage_form: data.dosage_form || data.product_type || null,
    doc_type: data.doc_type || null,
    pvp_mode: data.pvp_mode ?? null,
    status: data.status || "draft",
    bmr_number: data.bmr_number || data.document_no || null,
    draft_id: data.draft_id || null,
    batch_size: data.batch_size ?? null,
    batch_type: data.batch_type ?? null,
    commercial_mode: data.commercial_mode ?? null,
    header_footer_size: data.header_footer_size ?? null,
    footer_size: data.footer_size ?? null,
    footer_template_no: data.footer_template_no ?? null,
    files: data.files || [],
    layers: data.layers || [],
    coating_types: data.coating_types || [],
    stages: data.stages || [],
    stage_params: data.stage_params || {},
    completed_steps: completedSteps,
    created_by: data.created_by || null,
  };
}

export async function getOptions(): Promise<OptionsResponse> {
  const response = await httpClient.get<any>("/api/documents/options");
  const data = response.data;
  return {
    batch_types: data.batch_types || [],
    commercial_modes: data.commercial_modes || [],
    supported_dosage_forms: data.product_types || [],
    supported_doc_types: data.doc_types || [],
    pvp_source_options: data.pvp_source_options || [],
  };
}

export async function getStages(productType: string, docType: string): Promise<StagesResponse> {
  const response = await httpClient.get<StagesResponse>("/api/documents/stages", {
    params: { product_type: productType, doc_type: docType },
  });
  return response.data;
}

export async function setStages(
  documentId: string,
  stages: string[],
): Promise<{ document_id: string; stages: string[] }> {
  const response = await httpClient.put(
    `/api/documents/${encodeURIComponent(documentId)}/stages`,
    { stage_keys: stages },
  );

  return response.data;
}
