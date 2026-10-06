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
  const response = await httpClient.get<BomResponse>(
    `/api/documents/${encodeURIComponent(documentId)}/cover-preview`,
  );

  return response.data;
}

/**
 * The real Cover + BOM document, rendered by the AI backend and returned as a PDF.
 * Fetched through the authenticated client (a plain <iframe src> can't carry the
 * bearer token), so the caller embeds it via an object URL.
 */
export async function getCoverBomPdf(documentId: string): Promise<Blob> {
  const response = await httpClient.get(
    `/api/bmr/documents/${encodeURIComponent(documentId)}/cover-bom.pdf`,
    { responseType: "blob" },
  );

  return response.data as Blob;
}

/**
 * The Cover + BOM as a downloadable .docx (the editable source of the preview PDF),
 * fetched through the authenticated client so the caller can save it via an object URL.
 */
export async function getCoverBomDocx(documentId: string): Promise<Blob> {
  const response = await httpClient.get(
    `/api/bmr/documents/${encodeURIComponent(documentId)}/cover-bom.docx`,
    { responseType: "blob" },
  );

  return response.data as Blob;
}
