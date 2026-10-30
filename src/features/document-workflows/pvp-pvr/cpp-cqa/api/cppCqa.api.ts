import { httpClient } from "../../../../../shared/api/httpClient";

export interface PvpCppCqaRow {
  main_stage: string;
  processing_stage: string;
  critical_process_parameter: string;
  critical_quality_attribute: string;
  kind: string;
}

export interface PvpCppCqaResponse {
  columns: unknown[];
  rows: PvpCppCqaRow[];
  source_doc_type: string;
}

export async function getPvpCppCqa(documentId: string): Promise<PvpCppCqaResponse> {
  const response = await httpClient.get<unknown>(
    `/api/documents/${encodeURIComponent(documentId)}/pvp/sections/critical-process-parameters-cqa`,
  );
  const body = asRecord(response.data);
  const data = asRecord(body.data ?? body);
  const rows = Array.isArray(data.rows) ? data.rows.filter(isRecord).map((row) => ({
    main_stage: stringValue(row.main_stage),
    processing_stage: stringValue(row.processing_stage),
    critical_process_parameter: stringValue(row.critical_process_parameter),
    critical_quality_attribute: stringValue(row.critical_quality_attribute),
    kind: stringValue(row.kind),
  })) : [];

  return {
    columns: Array.isArray(data.columns) ? data.columns : [],
    rows,
    source_doc_type: stringValue(data.source_doc_type),
  };
}

function stringValue(value: unknown): string {
  return value == null ? "" : String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}
