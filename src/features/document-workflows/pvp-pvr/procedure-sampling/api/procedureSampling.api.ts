import { httpClient } from "../../../../../shared/api/httpClient";

export type JsonRecord = Record<string, any>;

export interface ProcedureStageSummary extends JsonRecord {
  section_key: string;
  title?: string;
  number?: string;
}

export interface ProcedureStageList extends JsonRecord {
  document_id?: string;
  supported?: boolean;
  section?: JsonRecord & { stages?: ProcedureStageSummary[] };
  stages?: ProcedureStageSummary[];
}

export interface ProcedureStage extends JsonRecord {
  section_key: string;
  title?: string;
  procedure_status?: string;
  generation_supported?: boolean;
}

export interface GenerationProgress extends JsonRecord {
  status?: string;
  attempt_id?: string;
  error?: string;
  preview?: unknown;
  result?: unknown;
}

const root = (documentId: string) => `/api/documents/${encodeURIComponent(documentId)}/pvp/sections/procedure-sampling-plan`;

export async function getProcedureStages(documentId: string): Promise<ProcedureStageList> {
  const { data } = await httpClient.get<ProcedureStageList>(root(documentId));
  return data;
}

export async function getProcedureStage(documentId: string, sectionKey: string): Promise<ProcedureStage> {
  const { data } = await httpClient.get<JsonRecord>(`${root(documentId)}/stages/${encodeURIComponent(sectionKey)}`);
  return (data.stage ?? data) as ProcedureStage;
}

export async function updateProcedureStage(documentId: string, sectionKey: string, data: JsonRecord): Promise<ProcedureStage> {
  const { data: response } = await httpClient.patch<JsonRecord>(`${root(documentId)}/stages/${encodeURIComponent(sectionKey)}`, { data });
  return (response.stage ?? response) as ProcedureStage;
}

export async function generateProcedureStage(documentId: string, sectionKey: string, regenerate: boolean): Promise<JsonRecord> {
  const { data } = await httpClient.post<JsonRecord>(`${root(documentId)}/stages/${encodeURIComponent(sectionKey)}/generate`, regenerate ? { regenerate: true } : {});
  return data;
}

export async function getProcedureGenerationProgress(documentId: string, attemptId?: string, signal?: AbortSignal): Promise<GenerationProgress> {
  const { data } = await httpClient.get<GenerationProgress>(`${root(documentId)}/generate/progress`, {
    params: attemptId ? { attempt_id: attemptId } : undefined,
    signal,
  });
  return ((data as JsonRecord).data ?? data) as GenerationProgress;
}
