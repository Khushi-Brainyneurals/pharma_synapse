import axios from "axios";
import { httpClient } from "../../../../shared/api/httpClient";
import type {
  CoreInputsResponse,
  CreateBmrDocumentRequest,
  CreateBmrDocumentResponse,
  SetCoreInputsPayload,
  SetCoreInputsResponse,
  PvpSourceRecord,
  SourceSlotsResponse,
} from "./documents.types";

export async function createBmrDocument(
  request: CreateBmrDocumentRequest,
): Promise<CreateBmrDocumentResponse> {
  const response = await httpClient.post<CreateBmrDocumentResponse>(
    "/api/documents",
    request,
  );

  return response.data;
}

export async function getSourceSlots(documentId: string): Promise<SourceSlotsResponse> {
  const response = await httpClient.get<SourceSlotsResponse>(
    `/api/documents/${encodeURIComponent(documentId)}/source-slots`,
  );

  return response.data;
}

export async function getCoreInputs(documentId: string): Promise<CoreInputsResponse | null> {
  try {
    const response = await httpClient.get<CoreInputsResponse>(
      `/api/documents/${encodeURIComponent(documentId)}/core-inputs`,
    );

    return response.data;
  } catch (error) {
    // A newly created document has no saved Step 3 values yet.
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

export async function getPvpSourceRecords(
  mode: string,
  query?: string,
  documentId?: string,
): Promise<PvpSourceRecord[]> {
  const response = await httpClient.get<unknown>("/api/documents/pvp-source-records", {
    params: { mode, ...(query?.trim() ? { query: query.trim() } : {}), ...(documentId ? { document_id: documentId } : {}) },
  });
  const data = response.data;
  if (Array.isArray(data)) return data as PvpSourceRecord[];
  if (data && typeof data === "object") {
    const body = data as { records?: unknown; items?: unknown; source_records?: unknown };
    const records = body.records ?? body.items ?? body.source_records;
    if (Array.isArray(records)) return records as PvpSourceRecord[];
  }
  return [];
}

export function normalizePvpSourceMode(value?: string | null): "manufacturing" | "packing" | "" {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized.includes("pack")) return "packing";
  if (normalized.includes("manufact") || normalized === "bmr") return "manufacturing";
  if (normalized === "bpr") return "packing";
  return "";
}

export async function setCoreInputs(
  payload: SetCoreInputsPayload,
): Promise<SetCoreInputsResponse> {
  const formData = new FormData();

  // Only append a file the user actually chose. An omitted part tells the backend to
  // keep the stored one, rather than wiping it.
  const allowedFields = new Set(payload.multipartFields);
  Object.entries(payload.sourceFiles).forEach(([field, file]) => {
    if (file && allowedFields.has(field)) {
      formData.append(field, file);
    }
  });

  if (payload.batchSize != null) {
    formData.append("batch_size", String(payload.batchSize));
  }

  if (payload.pvp) {
    if (payload.sourceDocumentId) formData.append("source_document_id", payload.sourceDocumentId);
    if (payload.buAvailable != null) formData.append("bu_available", String(payload.buAvailable));
  } else {
    if (payload.batchSize == null) formData.append("batch_size", "");
    formData.append("batch_type", payload.batchType ?? "");

    if (payload.batchType === "commercial" && payload.commercialMode) {
      formData.append("commercial_mode", payload.commercialMode);
    }
  }

  if (!payload.pvp) {
    if (payload.addressId != null) {
      formData.append("address_id", String(payload.addressId));
    }

    if (payload.user) {
      formData.append("user", payload.user);
    }
  }

  const response = await httpClient.put<SetCoreInputsResponse>(
    `/api/documents/${encodeURIComponent(payload.documentId)}/core-inputs`,
    formData,
  );

  return response.data;
}
