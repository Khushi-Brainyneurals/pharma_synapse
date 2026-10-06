import { httpClient } from "../../../shared/api/httpClient";
import type { StageInputsResponse, StageInputsSaveResponse } from "./stageInputs.types";

export async function getStageInputs(documentId: string): Promise<StageInputsResponse> {
  const response = await httpClient.get<StageInputsResponse>(
    `/api/bmr/documents/${encodeURIComponent(documentId)}/stage-inputs`,
  );

  return response.data;
}

/**
 * The schema for EVERY catalog stage (selected or not) with saved values merged.
 * Used by the Select-Stages screen to render each stage's parameters in its expand
 * panel before the stage set is committed.
 */
export async function getStageSchema(documentId: string): Promise<StageInputsResponse> {
  const response = await httpClient.get<StageInputsResponse>(
    `/api/bmr/documents/${encodeURIComponent(documentId)}/stage-schema`,
  );

  return response.data;
}

/** Saves ONE stage. Incomplete saves are allowed — work is never discarded. */
export async function saveStageInputs(
  documentId: string,
  stage: string,
  values: Record<string, unknown>,
): Promise<StageInputsSaveResponse> {
  const response = await httpClient.put<StageInputsSaveResponse>(
    `/api/bmr/documents/${encodeURIComponent(documentId)}/stage-inputs`,
    { stage, values },
  );

  return response.data;
}
