import { httpClient } from "../../../../../shared/api/httpClient";

export type PvpBomRow = Record<string, unknown>;

export interface PvpManufacturingBomResponse {
  type: "manufacturing";
  rows: PvpBomRow[];
}

export interface PvpPackingMaterialRow extends Record<string, unknown> {
  material_code?: string;
  name?: string;
  std_qty?: string;
  uom?: string;
  notes?: string;
  sr_no?: number;
}

export interface PvpPackingBomResponse {
  type: "packing";
  rows: PvpPackingMaterialRow[];
}

export type PvpBomResponse = PvpManufacturingBomResponse | PvpPackingBomResponse;

export interface PvpMaterialSpecificationOption {
  material_name: string;
  specification_no: string;
}

export interface PvpMaterialSpecificationRow {
  serial_number: string;
  material_name: string;
  functional_category: string;
  selected_specification_no: string;
  available_specifications: PvpMaterialSpecificationOption[];
}

export interface PvpMaterialSpecificationSelection {
  serial_number: string;
  material_name: string;
  specification_no: string;
}

export async function getPvpProcessFlow(documentId: string): Promise<Blob> {
  const response = await httpClient.get<Blob>(
    `/api/documents/${encodeURIComponent(documentId)}/pvp/process-flow`,
    { params: { format: "png" }, responseType: "blob" },
  );
  return response.data;
}

export async function getPvpBom(documentId: string): Promise<PvpBomResponse> {
  const response = await httpClient.get<unknown>(
    `/api/documents/${encodeURIComponent(documentId)}/pvp/bom`,
  );
  const body = unwrap(response.data);
  const payload = asRecord(body);

  // The packing key is the payload discriminator. Keep the original ingredient mapping
  // as the fallback so existing Manufacturing responses retain their current behavior.
  if (Array.isArray(payload.packing_materials)) {
    return {
      type: "packing",
      rows: payload.packing_materials.filter(isRecord) as PvpPackingMaterialRow[],
    };
  }

  const ingredients = payload.ingredients;
  return {
    type: "manufacturing",
    rows: Array.isArray(ingredients) ? ingredients.filter(isRecord) : [],
  };
}

export async function getPvpMaterialSpecifications(
  documentId: string,
): Promise<PvpMaterialSpecificationRow[]> {
  const response = await httpClient.get<unknown>(
    `/api/documents/${encodeURIComponent(documentId)}/pvp/material-specifications`,
  );
  const rows = asRecord(unwrap(response.data)).rows;
  if (!Array.isArray(rows)) return [];

  return rows.filter(isRecord).map((row) => ({
    serial_number: stringValue(row.serial_number),
    material_name: stringValue(row.material_name),
    functional_category: stringValue(row.functional_category),
    selected_specification_no: stringValue(row.selected_specification_no),
    available_specifications: Array.isArray(row.available_specifications)
      ? row.available_specifications.filter(isRecord).map((option) => ({
          material_name: stringValue(option.material_name),
          specification_no: stringValue(option.specification_no),
        }))
      : [],
  }));
}

export async function updatePvpMaterialSpecifications(
  documentId: string,
  selections: PvpMaterialSpecificationSelection[],
): Promise<void> {
  await httpClient.patch(
    `/api/documents/${encodeURIComponent(documentId)}/pvp/material-specifications`,
    { selections },
  );
}

function unwrap(value: unknown): unknown {
  const body = asRecord(value);
  return body.data ?? value;
}

function stringValue(value: unknown): string {
  return value == null ? "" : String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}
