import { httpClient } from "../../../shared/api/httpClient";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import type { EquipmentRow, InstrumentRow, MasterDataStep } from "../../master-data-setup/model/setup.model";

const BASE = "/api/master-data";

export interface ApprovalState {
  category?: string;
  product_type?: string | null;
  doc_type?: string | null;
  status: string; // "draft" | "pending" | "approved" | "rejected"
  submitted_by?: string | null;
  submitted_at?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  reject_reason?: string | null;
}

export interface BackendEquipmentRow {
  _row_id?: number;
  sr_no?: number | null;
  name_of_machine: string;
  capacity?: string;
  working_capacity?: string;
  machine_id_no?: string;
  stage?: string;
  processing_stage?: string;
  steps?: { step: string; cpp: string[] }[];
}

export interface BackendInstrumentRow {
  _row_id?: number;
  sr_no?: number | null;
  name_of_instrument: string;
  instrument_id_no?: string;
  location?: string;
  stage?: string;
}

export interface UpsertRowsResponse {
  committed: boolean;
  status: string;
  ids?: number[];
  count?: number;
}

export interface MasterRowsResponse<T> {
  rows: T[];
}

// ---------------- Equipments ----------------

export async function getEquipments(signal?: AbortSignal): Promise<BackendEquipmentRow[]> {
  try {
    const response = await httpClient.get<MasterRowsResponse<BackendEquipmentRow>>(
      `${BASE}/equipments`,
      { signal },
    );
    return response.data?.rows ?? [];
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Unable to load equipment list."));
  }
}

export function toEquipmentPayload(row: EquipmentRow, index: number): BackendEquipmentRow {
  const sanitizeSteps = (steps?: MasterDataStep[]) => {
    return (steps ?? [])
      .map((item) => ({
        step: item.step?.trim() ?? "",
        cpp: (item.cpp ?? []).map((v) => v.trim()).filter(Boolean),
      }))
      .filter((item) => item.step || item.cpp.length > 0);
  };

  return {
    _row_id: (row as any)._row_id,
    sr_no: row.sr || index + 1,
    name_of_machine: row.name.trim(),
    capacity: row.capacity === "N/A" ? "" : row.capacity.trim(),
    working_capacity: row.workingCap === "N/A" ? "" : row.workingCap.trim(),
    machine_id_no: row.mcId.trim(),
    stage: row.stage.trim(),
    processing_stage: row.procStage.trim(),
    steps: sanitizeSteps(row.steps),
  };
}

export async function saveEquipments(rows: EquipmentRow[], signal?: AbortSignal): Promise<UpsertRowsResponse> {
  try {
    const payload = {
      rows: rows.map(toEquipmentPayload).filter((r) => Boolean(r.name_of_machine)),
    };
    const response = await httpClient.post<UpsertRowsResponse>(
      `${BASE}/equipments`,
      payload,
      { signal, timeout: 60_000 },
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Unable to save equipment list."));
  }
}

export async function getEquipmentApproval(signal?: AbortSignal): Promise<ApprovalState> {
  try {
    const response = await httpClient.get<ApprovalState>(`${BASE}/equipment/approval`, { signal });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Unable to load equipment approval status."));
  }
}

export async function submitEquipmentApproval(signal?: AbortSignal): Promise<ApprovalState> {
  try {
    const response = await httpClient.post<ApprovalState>(`${BASE}/equipment/approval/submit`, undefined, { signal });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Unable to submit equipment list for approval."));
  }
}

export async function decideEquipmentApproval(
  decision: "approved" | "rejected",
  reason?: string,
  signal?: AbortSignal,
): Promise<ApprovalState> {
  try {
    const response = await httpClient.post<ApprovalState>(
      `${BASE}/equipment/approval/decide`,
      { reason: reason ?? "" },
      { params: { decision }, signal },
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Unable to record equipment approval decision."));
  }
}

// ---------------- Instruments ----------------

export async function getInstruments(signal?: AbortSignal): Promise<BackendInstrumentRow[]> {
  try {
    const response = await httpClient.get<MasterRowsResponse<BackendInstrumentRow>>(
      `${BASE}/instruments`,
      { signal },
    );
    return response.data?.rows ?? [];
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Unable to load instrument list."));
  }
}

export function toInstrumentPayload(row: InstrumentRow, index: number): BackendInstrumentRow {
  return {
    _row_id: (row as any)._row_id,
    sr_no: row.sr || index + 1,
    name_of_instrument: row.name.trim(),
    instrument_id_no: row.instrumentId.trim(),
    location: row.location.trim(),
    stage: Array.isArray(row.stages) ? row.stages.join(", ") : String(row.stages || ""),
  };
}

export async function saveInstruments(rows: InstrumentRow[], signal?: AbortSignal): Promise<UpsertRowsResponse> {
  try {
    const payload = {
      rows: rows.map(toInstrumentPayload).filter((r) => Boolean(r.name_of_instrument)),
    };
    const response = await httpClient.post<UpsertRowsResponse>(
      `${BASE}/instruments`,
      payload,
      { signal, timeout: 60_000 },
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Unable to save instrument list."));
  }
}

export async function getInstrumentApproval(signal?: AbortSignal): Promise<ApprovalState> {
  try {
    const response = await httpClient.get<ApprovalState>(`${BASE}/instrument/approval`, { signal });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Unable to load instrument approval status."));
  }
}

export async function submitInstrumentApproval(signal?: AbortSignal): Promise<ApprovalState> {
  try {
    const response = await httpClient.post<ApprovalState>(`${BASE}/instrument/approval/submit`, undefined, { signal });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Unable to submit instrument list for approval."));
  }
}

export async function decideInstrumentApproval(
  decision: "approved" | "rejected",
  reason?: string,
  signal?: AbortSignal,
): Promise<ApprovalState> {
  try {
    const response = await httpClient.post<ApprovalState>(
      `${BASE}/instrument/approval/decide`,
      { reason: reason ?? "" },
      { params: { decision }, signal },
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error, "Unable to record instrument approval decision."));
  }
}

