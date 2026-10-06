export interface StageField {
  key: string;
  label: string;
  /** text | number | select | multiselect | range | duration | table | machine_setting | ipqc | coating_params | layer_type */
  type: string;
  required: boolean;
  /** Shown beside the label: "Limit · %", "Count · stations". */
  hint: string;
  help: string;
  placeholder: string;
  default: unknown;
  options: string[];
  /** "master data" / "MFC" — where the value comes from when it isn't typed. */
  source: string;
  /** For range / duration / number — "°C", "%RH", "Pa", "hours". */
  unit: string;
  /** For table — the column headers. */
  columns: string[];
  params?: { name: string; source: string; spec: string }[];
}

/** A range value: acceptance min–max. */
export interface RangeValue {
  min: string;
  max: string;
}

/** A duration value: a time amount + its unit. */
export interface DurationValue {
  value: string;
  unit: string;
}

export interface CoatingParamSpec {
  key: string;
  label: string;
  unit: string;
  placeholder: string;
}

export interface StageForm {
  key: string;
  label: string;
  description: string;
  fields: StageField[];
  values: Record<string, unknown>;
  problems: string[];
  is_complete: boolean;
  per_layer?: boolean;
  per_type?: boolean;
  layer_scoped?: boolean;
}

export interface RepeatSlot {
  key: string;
  name: string;
  index?: string;
  lot_no?: string;
  colour?: string;
}

export interface StageInputsResponse {
  document_id: string;
  status: string;
  stages: StageForm[];

  /** The 8 machine-setting tolerances, in the order the pipeline expects them. */
  machine_setting_params: string[];
  coating_params: CoatingParamSpec[];
  ipqc_frequencies: string[];
  default_ipqc_tests: string[];

  /** Read from the BOM — the layer chips are read-only. */
  layers: string[];
  layer_slots?: RepeatSlot[];
  coating_slots?: RepeatSlot[];

  all_complete: boolean;
}

export interface StageInputsSaveResponse {
  document_id: string;
  status: string;
  stage: string;
  problems: string[];
  is_complete: boolean;
  all_complete: boolean;
}
