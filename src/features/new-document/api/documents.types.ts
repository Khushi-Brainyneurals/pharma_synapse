export interface CreateBmrDocumentRequest {
  dosage_form: string;
  doc_type: string;
  user: string;
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
  required: boolean;
  accept: string[];
  max_bytes: number;
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
  document_id: string;
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
  header_size: number | null;
  footer_size: number | null;
  footer_template_no: string | null;
  address_id: number | null;
  address: string | null;
  core_input_files: Record<string, string>;
}

export interface SetCoreInputsPayload {
  documentId: string;
  /** Only backend-advertised fields are appended; omitted files remain stored server-side. */
  sourceFiles: Record<string, File | null>;
  multipartFields: string[];
  batchSize: number;
  batchType: BatchType;
  commercialMode?: CommercialMode | "";
  headerFooterSize: number;
  footerSize: number;
  footerTemplateNo: string;
  addressId?: number | null;
  user?: string;
}

export interface SetCoreInputsResponse {
  document_id: string;
  status: "core_inputs_set";
  batch_size: number;
  batch_type: string;
  commercial_mode: string;
  header_size: number;
  footer_size: number;
  footer_template_no: string;
}
