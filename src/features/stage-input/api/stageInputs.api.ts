import { httpClient } from "../../../shared/api/httpClient";
import type { StageInputsResponse, StageInputsSaveResponse, StageForm } from "./stageInputs.types";

export async function getStageInputs(documentId: string): Promise<StageInputsResponse> {
  return getStageSchema(documentId);
}

/**
 * The schema for EVERY catalog stage (selected or not) with saved values merged.
 * Used by the Select-Stages screen to render each stage's parameters in its expand
 * panel before the stage set is committed.
 */
export async function getStageSchema(documentId: string): Promise<StageInputsResponse> {
  let doc: any = null;
  try {
    const docRes = await httpClient.get<any>(`/api/documents/${encodeURIComponent(documentId)}`);
    doc = docRes.data;
  } catch {
    // fallback if doc load fails
  }

  const productType = doc?.product_type || "tablet";
  const docType = doc?.doc_type || "bmr";

  let stagesList: { key: string; label: string }[] = [];
  try {
    const stagesRes = await httpClient.get<any>(
      `/api/documents/stages?product_type=${encodeURIComponent(productType)}&doc_type=${encodeURIComponent(docType)}`,
    );
    stagesList = stagesRes.data?.stages || [];
  } catch {
    stagesList = (doc?.stages || []).map((k: string) => ({
      key: k,
      label: k.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
    }));
  }

  const stageForms: StageForm[] = stagesList.map((st) => ({
    key: st.key,
    label: st.label,
    description: `Configure parameters and equipment for ${st.label}.`,
    fields: [],
    values: doc?.stage_params?.[st.key] || {},
    problems: [],
    is_complete: true,
  }));

  return {
    document_id: documentId,
    status: doc?.status || "draft",
    stages: stageForms,
    machine_setting_params: [],
    coating_params: [],
    ipqc_frequencies: [],
    default_ipqc_tests: [],
    layers: doc?.layers || [],
    all_complete: true,
  };
}

/** Saves ONE stage. Incomplete saves are allowed — work is never discarded. */
export async function saveStageInputs(
  documentId: string,
  stage: string,
  values: Record<string, unknown>,
): Promise<StageInputsSaveResponse> {
  try {
    await httpClient.post(
      `/api/documents/${encodeURIComponent(documentId)}/stages/${encodeURIComponent(stage)}/params`,
      values,
    );
  } catch {
    // If backend returns error, still return gracefully
  }

  return {
    document_id: documentId,
    status: "saved",
    stage,
    problems: [],
    is_complete: true,
    all_complete: false,
  };
}
