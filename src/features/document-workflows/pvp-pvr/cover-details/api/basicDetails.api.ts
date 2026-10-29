import { httpClient } from "../../../../../shared/api/httpClient";

export interface PvpBasicDetails {
  document_id?: string;
  data: Record<string, unknown>;
  sections: PvpBasicDetailsSection[];
  [key: string]: unknown;
}

export interface PvpBasicDetailsSection {
  section_number?: string | number;
  number?: string | number;
  title?: string;
  paragraphs?: unknown[] | string;
  subheadings?: unknown[];
  [key: string]: unknown;
}

export async function getPvpBasicDetails(documentId: string): Promise<PvpBasicDetails> {
  const response = await httpClient.get<PvpBasicDetails>(
    `/api/documents/${encodeURIComponent(documentId)}/pvp/basic-details`,
  );
  return normalizeBasicDetails(response.data);
}

export async function updatePvpBasicDetails(
  documentId: string,
  payload: Pick<PvpBasicDetails, "data" | "sections">,
): Promise<PvpBasicDetails> {
  const response = await httpClient.patch<PvpBasicDetails>(
    `/api/documents/${encodeURIComponent(documentId)}/pvp/basic-details`,
    payload,
  );
  return normalizeBasicDetails(response.data?.data && Array.isArray(response.data.sections)
    ? response.data
    : { data: payload.data, sections: payload.sections });
}

function normalizeBasicDetails(value: unknown): PvpBasicDetails {
  const body = asRecord(value);
  const nested = asRecord(body.basic_details);
  return {
    ...body,
    ...nested,
    data: asRecord(nested.data ?? body.data),
    sections: Array.isArray(nested.sections ?? body.sections)
      ? (nested.sections ?? body.sections) as PvpBasicDetailsSection[]
      : [],
  };
}

function asRecord(value: unknown): Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}
