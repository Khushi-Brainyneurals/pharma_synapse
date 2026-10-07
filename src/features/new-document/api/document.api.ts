import { httpClient } from "../../../shared/api/httpClient";
import type { StageParamsMap } from "../../stages/model/stageParams";
import type { DocumentDetail, OptionsResponse } from "./document.types";

export async function getDocument(documentId: string): Promise<DocumentDetail> {
  const response = await httpClient.get<any>(
    `/api/documents/${encodeURIComponent(documentId)}`,
  );
  const data = response.data;
  const resumeStep = data.resume_step || "inputs";
  const stepOrder = ["type", "inputs", "preview", "cover-bom", "stages", "generate-submit"];
  const stepMap: Record<string, number> = {
    type: 0,
    inputs: 1,
    core_inputs: 1,
    preview: 2,
    format_preview: 2,
    "cover-bom": 3,
    cover_bom: 3,
    stages: 4,
    stage_params: 4,
    "stage-input": 4,
    submit: 5,
    generate: 5,
    "generate-submit": 5,
  };
  const activeIdx = stepMap[resumeStep] ?? 1;
  const isSubmitted = ["submitted", "in_review", "in_approval", "approved", "rejected"].includes(data.status);
  const completedSteps = isSubmitted
    ? stepOrder
    : stepOrder.slice(0, activeIdx);

  return {
    document_id: data.document_id || data.job_id || documentId,
    dosage_form: data.dosage_form || data.product_type || null,
    doc_type: data.doc_type || null,
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
    stages: data.stages || [],
    default_stages: data.default_stages || [],
    batch_types: data.batch_types || ["commercial", "exhibit", "scale_up"],
    commercial_modes: data.commercial_modes || ["revision", "validation"],
    supported_dosage_forms: data.supported_dosage_forms || data.product_types || ["tablet"],
    supported_doc_types: data.supported_doc_types || data.doc_types || ["bmr", "bpr"],
  };
}

export async function setStages(
  documentId: string,
  stages: string[],
  params: StageParamsMap = {},
): Promise<{ document_id: string; status: string; stages: string[]; params: StageParamsMap }> {
  const response = await httpClient.put(
    `/api/documents/${encodeURIComponent(documentId)}/stages`,
    { stages, params },
  );

  return response.data;
}
