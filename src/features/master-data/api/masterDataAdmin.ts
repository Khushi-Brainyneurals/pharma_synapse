import { httpClient } from "../../../shared/api/httpClient";

export type MasterKind = "equipments" | "instruments";

export interface MasterRowItem {
  id: number;
  kind: string;
  row: Record<string, unknown>;
  is_active: boolean;
  created_by: string | null;
}

export interface MasterRowsList {
  rows: MasterRowItem[];
  can_edit: boolean;
  commits_directly: boolean;
}

export interface ChangeRequestItem {
  id: number;
  requested_by: string;
  target: string;
  payload: { kind: string; rows: Record<string, unknown>[] };
  status: string;
  approver_id: string | null;
  reject_reason: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface AddRowsResponse {
  committed: boolean;
  status: string;
  change_request_id: number | null;
  count: number;
}

export async function listMasterRows(kind: MasterKind): Promise<MasterRowsList> {
  const response = await httpClient.get<MasterRowsList>(`/api/master-data/${kind}`);
  return response.data;
}

/**
 * Download the whole master data (equipment + instrument + company info) as a ZIP.
 * The backend sets Content-Length, so `onProgress` reports a real 0–100 percentage.
 */
export async function downloadMasterDataZip(onProgress?: (pct: number) => void): Promise<Blob> {
  const response = await httpClient.get("/api/master-data/export.zip", {
    responseType: "blob",
    onDownloadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    },
  });
  return response.data as Blob;
}

export async function addMasterRows(
  kind: MasterKind,
  rows: Record<string, unknown>[],
): Promise<AddRowsResponse> {
  const response = await httpClient.post<AddRowsResponse>(`/api/master-data/${kind}`, { rows });
  return response.data;
}

/**
 * Save the whole table at once — replaces the current active set for `kind`. Used by the
 * Master-data Setup "Save" button; committed directly (WRITE_ROLES) so the Stage-input
 * dropdowns every role sees reflect the edit on their next load.
 */
export async function replaceMasterRows(
  kind: MasterKind,
  rows: Record<string, unknown>[],
): Promise<AddRowsResponse> {
  const response = await httpClient.put<AddRowsResponse>(`/api/master-data/${kind}/replace`, {
    rows,
  });
  return response.data;
}

export async function listChangeRequests(status?: string): Promise<ChangeRequestItem[]> {
  const response = await httpClient.get<ChangeRequestItem[]>("/api/master-data/change-requests", {
    params: status ? { status } : undefined,
  });
  return response.data;
}

export async function approveChangeRequest(id: number): Promise<ChangeRequestItem> {
  const response = await httpClient.post<ChangeRequestItem>(
    `/api/master-data/change-requests/${id}/approve`,
  );
  return response.data;
}

export async function rejectChangeRequest(id: number, reason: string): Promise<ChangeRequestItem> {
  const response = await httpClient.post<ChangeRequestItem>(
    `/api/master-data/change-requests/${id}/reject`,
    { reason },
  );
  return response.data;
}
