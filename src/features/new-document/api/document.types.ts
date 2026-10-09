import type { StageParamsMap } from "../../stages/model/stageParams";

export interface UploadedFile {
  field: string;
  filename: string;
}

export interface StageOption {
  key: string;
  label: string;
  description?: string;
  required?: boolean;
  implies?: string[];
}

export interface StagesResponse {
  product_type: string;
  doc_type: string;
  stages: StageOption[];
  supported: boolean;
  message: string;
}

/** Everything a step needs to repopulate itself when the user navigates back. */
export interface DocumentDetail {
  document_id: string;
  dosage_form: string | null;
  doc_type: string | null;
  status: string;
  bmr_number: string | null;
  /** Backend-assigned draft identifier, e.g. "BMR1-00" — present before the MFC is read. */
  draft_id: string | null;
  batch_size: number | null;
  batch_type: string | null;
  commercial_mode: string | null;
  header_footer_size: number | null;
  footer_size: number | null;
  footer_template_no: string | null;
  files: UploadedFile[];
  layers: string[];
  coating_types: string[];
  stages: string[];
  /** Per-stage in-process parameters, so the Select-stages panels repopulate on back-nav. */
  stage_params: StageParamsMap;
  /** Steps the user may jump back to — drives the clickable stepper. */
  completed_steps: string[];
  created_by: string | null;
}

export interface OptionsResponse {
  batch_types: string[];
  commercial_modes: string[];
  supported_dosage_forms: string[];
  supported_doc_types: string[];
}
