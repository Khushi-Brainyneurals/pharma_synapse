export type PreviewFieldStatus =
  /** Known now. */
  | "value"
  /** Comes from the MFC, which hasn't been read yet. */
  | "pending"
  /** Deliberately printed empty — filled in by hand during manufacturing. */
  | "blank";

export interface PreviewField {
  label: string;
  value: string | null;
  status: PreviewFieldStatus;
  unit: string | null;
  note: string | null;
  full_width: boolean;
}

export interface PreviewCompany {
  name: string | null;
  address: string | null;
  department: string | null;
  initials: string | null;
  logo_url: string | null;
  is_complete: boolean;
}

export interface PreviewFormatting {
  font_name: string;
  font_size: number;
  line_spacing: number;
  header_size: number;
  footer_size: number;
  template_no: string | null;
}

export interface PreviewResponse {
  document_id: string;
  status: string;
  title: string;
  dosage_form: string | null;
  company: PreviewCompany;
  header_fields: PreviewField[];
  general_information: PreviewField[];
  precautions: string[];
  precautions_are_placeholder: boolean;
  formatting: PreviewFormatting;
  warnings: string[];
}
