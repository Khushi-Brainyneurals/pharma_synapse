export interface BomIngredient {
  sr_no: number | null;
  material_code: string | null;
  name: string;
  specification: string | null;
  label_claim_mg_per_unit: number | null;
  qty_per_mfc_batch: number | null;
  /** Derived from the part's overage footnote (e.g. "Coating ##"). null → render "—". */
  overage_pct: number | null;
  qty_required_production: number | null;
  functional_category: string | null;
  uom: string | null;
  layer: string | null;
  part: string | null;
  /** Derived from functional_category === "Active" (the stored flag is unreliable). */
  is_api: boolean;
  /** Derived: an MFC footnote ($/#) ties this diluent to an API whose qty it tracks. */
  is_compensated: boolean;
  /** "Avg. wt. of X Tablet" — a subtotal row, not an ingredient. */
  is_avg_weight: boolean;
  notes: string | null;
}

export interface BomCover {
  product_name: string | null;
  generic_name: string | null;
  label_claim: string | null;

  product_code: string | null;
  mfc_number: string | null;
  bmr_number: string | null;
  revision_number: string | null;
  supersedes: string | null;

  theoretical_batch_size: number | null;
  theoretical_batch_wt: number | null;
  mfc_batch_size: number | null;
  mfc_batch_size_uom: string | null;

  licence_no: string | null;
  market: string | null;
  shelf_life: string | null;
  product_description: string | null;

  /** Not carried by the MFC — the UI must say "not captured", not leave a gap. */
  finished_goods_code: string | null;
  storage_condition: string | null;
  pack_style: string | null;
  pharmacological_action: string | null;

  /** Derived from the BOM. Drives the confirm-layer-structure step. */
  layers: string[];
}

/**
 * `status` drives the whole screen:
 *   extracting        → poll, show progress
 *   extracted         → render cover + BOM
 *   extraction_failed → show error_message + retry
 */
export interface BomResponse {
  document_id: string;
  status: string;
  header: DocumentHeader;
  cover: BomCover;
  ingredients: BomIngredient[];
  /** MFC footnotes (@, $, #, ##) — printed under 2.1 and used by 2.1.1. */
  formulation_notes: string[];
  precautions: string[];
  warnings: string[];
  error_message: string | null;
}

export interface GenerateBomResponse {
  document_id: string;
  status: string;
  message: string;
}

export interface DocumentHeader {
  company_name: string | null;
  department: string | null;
  logo_url: string | null;
  doc_title: string;
  product_name: string | null;
  batch_size: string | null;
  bmr_number: string | null;
  revision_number: string | null;
  template_no: string | null;
}
