export interface CreateBmrDocumentRequest {
  dosage_form: string;
  doc_type: string;
  user: string;
  pvp_mode?: string;
}

export interface CreateBmrDocumentResponse {
  document_id: string;
  dosage_form: string;
  doc_type: string;
  status: string;
}

export type BatchType = "exhibit" | "scale_up" | "commercial";

export type CommercialMode = "revision" | "validation";

interface SourceSlotBase {
  kind: string;
  label: string;
  required?: boolean;
  required_when?: { field: string; equals: string | number | boolean };
  input?: "file" | "boolean" | "document_reference" | "text" | string;
  accept?: string[];
  max_bytes?: number;
  allowed_doc_types?: string[];
}

export interface RegularSourceSlot extends SourceSlotBase {
  field: string;
}

export interface RepeatableSourceSlot extends SourceSlotBase {
  repeat_field: string;
  max: number;
}

export type SourceSlot = RegularSourceSlot | RepeatableSourceSlot;

export interface SourceSlotsResponse {
  document_id?: string;
  product_type: string;
  doc_type: string;
  slots: SourceSlot[];
  multipart_fields: string[];
}

export interface CoreInputsResponse {
  document_id: string;
  batch_size: number | null;
  batch_type: string | null;
  commercial_mode: string | null;
  address_id: number | null;
  address: string | null;
  core_input_files: Record<string, string>;
  source_document_id?: string | null;
  source_doc_type?: string | null;
  pvp_mode?: string | null;
  bu_available?: boolean | null;
}

export interface SetCoreInputsPayload {
  documentId: string;
  /** Only backend-advertised fields are appended; omitted files remain stored server-side. */
  sourceFiles: Record<string, File | null>;
  multipartFields: string[];
  batchSize?: number;
  batchType?: BatchType;
  commercialMode?: CommercialMode | "";
  sourceDocumentId?: string;
  buAvailable?: boolean;
  /** PVP submits only the backend driven source fields; BMR/BPR retain their old fields. */
  pvp?: boolean;
  addressId?: number | null;
  user?: string;
}

export interface SetCoreInputsResponse {
  document_id: string;
  status: "core_inputs_set";
  batch_size?: number | null;
  batch_type?: string | null;
  commercial_mode?: string | null;
  source_document_id?: string | null;
  source_doc_type?: string | null;
  pvp_mode?: string | null;
  bu_available?: boolean | null;
}

export interface PvpSourceRecord {
  job_id: string;
  source_doc_type?: string;
  doc_type?: string;
  document_no?: string;
  bmr_number?: string;
  draft_id?: string;
  product_name?: string;
  product?: string;
  batch_size?: number | string;
  status?: string;
  [key: string]: unknown;
}
