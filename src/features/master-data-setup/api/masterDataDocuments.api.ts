import { httpClient } from "../../../shared/api/httpClient";

export interface StageSlot {
  code: string;
  label: string;
  required: boolean;
  renders_as?: string;
  uploaded: boolean;
  file_name?: string | null;
  uploaded_by?: string | null;
  uploaded_at?: string | null;
}

export interface StageChecklistGroup {
  product_type: string;
  doc_type: string;
  stage_key: string;
  slots: StageSlot[];
  others: any[];
  uploaded_count: number;
  required_count: number;
}

export interface StageChecklistResponse {
  product_type: string;
  doc_type: string;
  stages: StageChecklistGroup[];
  uploaded_count: number;
  required_count: number;
}

export interface OtherDocumentsChecklistResponse {
  product_type: string;
  doc_type: string;
  slots: StageSlot[];
  uploaded_count: number;
  required_count: number;
}

export async function getStageChecklist(
  productType = "tablet",
  docType = "bmr",
): Promise<StageChecklistResponse> {
  const res = await httpClient.get<StageChecklistResponse>(
    `/api/master-data/${encodeURIComponent(productType)}/${encodeURIComponent(docType)}/checklist`,
  );
  return res.data;
}

export async function getOtherDocumentsChecklist(
  productType = "tablet",
  docType = "bmr",
): Promise<OtherDocumentsChecklistResponse> {
  const res = await httpClient.get<OtherDocumentsChecklistResponse>(
    `/api/master-data/${encodeURIComponent(productType)}/${encodeURIComponent(docType)}/other-documents/checklist`,
  );
  return res.data;
}

export async function uploadStageDocument(
  productType = "tablet",
  docType = "bmr",
  stageKey: string,
  docCode: string,
  file: File,
): Promise<{ label: string; file_name: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await httpClient.post(
    `/api/master-data/${encodeURIComponent(productType)}/${encodeURIComponent(docType)}/stages/${encodeURIComponent(stageKey)}/documents/${encodeURIComponent(docCode)}`,
    formData,
  );
  return res.data;
}

export async function removeStageDocument(
  productType = "tablet",
  docType = "bmr",
  stageKey: string,
  docCode: string,
): Promise<void> {
  await httpClient.delete(
    `/api/master-data/${encodeURIComponent(productType)}/${encodeURIComponent(docType)}/stages/${encodeURIComponent(stageKey)}/documents/${encodeURIComponent(docCode)}`,
  );
}

export async function uploadOtherDocument(
  productType = "tablet",
  docType = "bmr",
  docCode: string,
  file: File,
): Promise<{ label: string; file_name: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await httpClient.post(
    `/api/master-data/${encodeURIComponent(productType)}/${encodeURIComponent(docType)}/other-documents/${encodeURIComponent(docCode)}`,
    formData,
  );
  return res.data;
}

export async function removeOtherDocument(
  productType = "tablet",
  docType = "bmr",
  docCode: string,
): Promise<void> {
  await httpClient.delete(
    `/api/master-data/${encodeURIComponent(productType)}/${encodeURIComponent(docType)}/other-documents/${encodeURIComponent(docCode)}`,
  );
}

export async function getStageDocumentPreviewBlob(
  productType = "tablet",
  docType = "bmr",
  stageKey: string,
  docCode: string,
): Promise<Blob> {
  const res = await httpClient.get<Blob>(
    `/api/master-data/${encodeURIComponent(productType)}/${encodeURIComponent(docType)}/stages/${encodeURIComponent(stageKey)}/documents/${encodeURIComponent(docCode)}/preview`,
    { responseType: "blob" },
  );
  return res.data;
}

export async function getOtherDocumentPreviewBlob(
  productType = "tablet",
  docType = "bmr",
  docCode: string,
): Promise<Blob> {
  const res = await httpClient.get<Blob>(
    `/api/master-data/${encodeURIComponent(productType)}/${encodeURIComponent(docType)}/other-documents/${encodeURIComponent(docCode)}/preview`,
    { responseType: "blob" },
  );
  return res.data;
}

export interface StageApprovalStatus {
  category: string;
  product_type?: string | null;
  doc_type?: string | null;
  status: "draft" | "submitted" | "approved" | "rejected";
  submitted_by?: string | null;
  submitted_at?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  reject_reason?: string | null;
}

export async function getStageApprovalStatus(
  productType = "tablet",
  docType = "bmr",
): Promise<StageApprovalStatus> {
  const res = await httpClient.get<StageApprovalStatus>(
    `/api/master-data/${encodeURIComponent(productType)}/${encodeURIComponent(docType)}/approval`,
  );
  return res.data;
}

export async function submitStageApproval(
  productType = "tablet",
  docType = "bmr",
): Promise<StageApprovalStatus> {
  const res = await httpClient.post<StageApprovalStatus>(
    `/api/master-data/${encodeURIComponent(productType)}/${encodeURIComponent(docType)}/approval/submit`,
  );
  return res.data;
}

export async function decideStageApproval(
  productType = "tablet",
  docType = "bmr",
  decision: "approved" | "rejected",
  reason = "",
): Promise<StageApprovalStatus> {
  const res = await httpClient.post<StageApprovalStatus>(
    `/api/master-data/${encodeURIComponent(productType)}/${encodeURIComponent(docType)}/approval/decide?decision=${encodeURIComponent(decision)}`,
    { reason },
  );
  return res.data;
}

export const DOC_CODE_TO_STAGE_KEY: Record<string, string> = {
  "DSP-01": "dispensing_rm",
  "DSP-02": "dispensing_rm",
  "GRN-01": "granulation",
  "GRN-02": "granulation",
  "GRN-03": "granulation",
  "GRN-04": "granulation",
  "GRN-05": "granulation",
  "GRN-06": "granulation",
  "CMP-01": "compression",
  "CMP-02": "compression",
  "CMP-03": "compression",
  "CMP-04": "compression",
  "CMP-05": "compression",
  "CMP-06": "compression",
  "CMP-07": "compression",
  "CMP-08": "compression",
  "TIU-01": "uncoated_inspection",
  "TIU-02": "uncoated_inspection",
  "TIU-03": "uncoated_inspection",
  "TIU-04": "uncoated_inspection",
  "TIU-05": "uncoated_inspection",
  "TIU-06": "uncoated_inspection",
  "DCM-01": "dispensing_coating",
  "DCM-02": "dispensing_coating",
  "COA-01": "coating",
  "COA-02": "coating",
  "COA-03": "coating",
  "COA-04": "coating",
  "COA-05": "coating",
  "TIC-01": "coated_inspection",
  "TIC-02": "coated_inspection",
  "TIC-03": "coated_inspection",
  "TIC-04": "coated_inspection",
  "TIC-05": "coated_inspection",
  "TIC-06": "coated_inspection",
  "BAT-01": "batch_yield_reconciliation",
};

