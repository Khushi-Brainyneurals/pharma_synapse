import { httpClient } from "../../../shared/api/httpClient";

export interface GenerationStatus {
  document_id: string;
  status: string;
  has_artifact: boolean;
  artifact_size: number | null;
  error_message: string | null;
}

export interface SubmitResponse {
  document_id: string;
  status: string;
  message: string;
}

/** Kicks off the build. Returns 202 — poll getGenerationStatus. */
export async function generateDocument(documentId: string): Promise<GenerationStatus> {
  const response = await httpClient.post(
    `/api/documents/${encodeURIComponent(documentId)}/generate`,
  );

  return response.data;
}

export async function getGenerationStatus(documentId: string): Promise<GenerationStatus> {
  const response = await httpClient.get<any>(
    `/api/documents/${encodeURIComponent(documentId)}/generate/progress`,
  );

  return response.data?.result ?? response.data;
}

export async function submitDocument(documentId: string): Promise<SubmitResponse> {
  const response = await httpClient.post<SubmitResponse>(
    `/api/documents/${encodeURIComponent(documentId)}/submit`,
  );

  return response.data;
}

/** Downloads the .docx through the authenticated client, then saves it. */
export async function downloadDocument(documentId: string, filename: string): Promise<void> {
  const response = await httpClient.get(
    `/api/documents/${encodeURIComponent(documentId)}/preview`,
    { responseType: "blob" },
  );

  // A plain <a href> can't carry the Authorization header, so the file is fetched
  // via the API client and handed to the browser as an object URL.
  const url = window.URL.createObjectURL(response.data as Blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export interface GenerateProgress {
  document_id: string;
  status: "running" | "done" | "error";
  percent: number | null;
  step: string;
  result: GenerationStatus | null;
  error: string | null;
}

export async function getGenerateProgress(documentId: string): Promise<GenerateProgress> {
  return (await httpClient.get<GenerateProgress>(
    `/api/documents/${encodeURIComponent(documentId)}/generate/progress`,
  )).data;
}

export async function getDocumentPdf(documentId: string): Promise<Blob> {
  return (await httpClient.get<Blob>(
    `/api/documents/${encodeURIComponent(documentId)}/preview`,
    { responseType: "blob" },
  )).data;
}
