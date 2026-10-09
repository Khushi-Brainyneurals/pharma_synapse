import { httpClient } from "../../../shared/api/httpClient";

export interface EquipmentStep {
  step: string;
  cpp: string[];
}

export interface EquipmentMaster {
  sr_no: number | null;
  name_of_machine: string;
  capacity: string;
  working_capacity: string;
  machine_id_no: string;
  stage: string;
  processing_stage: string;
  steps: EquipmentStep[];
  _row_id: number;
  _is_active: boolean;
  _created_by: string | null;
  _created_at: string;
}

export interface InstrumentMaster {
  sr_no: number | null;
  name_of_instrument: string;
  instrument_id_no: string;
  location: string;
  stage: string;
  _row_id: number;
  _is_active: boolean;
  _created_by: string | null;
  _created_at: string;
}

export interface MasterData {
  equipments: EquipmentMaster[];
  instruments: InstrumentMaster[];
  errors: {
    equipments?: unknown;
    instruments?: unknown;
  };
}

interface MasterRowsResponse<T> {
  rows?: T[];
}

export interface EquipmentEntry {
  mode: "equipment" | "instrument";
  name: string;
  id: string;
  /** The manufacturing (wizard) stage this entry was recorded under. */
  stage: string;
  /** The processing sub-stage chosen for the machine (equipment only). */
  proc_stage: string;
  cpp: Record<string, string>;
  layer?: string;
  /** The schema-owned container: stage, a granulation layer, or a coating pass. */
  scope?: string;
}

let equipmentRequest: Promise<EquipmentMaster[]> | null = null;
let instrumentRequest: Promise<InstrumentMaster[]> | null = null;

function activeRows<T extends { _is_active: boolean }>(response: MasterRowsResponse<T>): T[] {
  return Array.isArray(response.rows) ? response.rows.filter((row) => row._is_active === true) : [];
}

async function getEquipmentMasterData(): Promise<EquipmentMaster[]> {
  if (!equipmentRequest) {
    equipmentRequest = httpClient
      .get<MasterRowsResponse<EquipmentMaster>>("/api/master-data/equipments")
      .then((response) => activeRows(response.data))
      .catch((error) => {
        equipmentRequest = null;
        throw error;
      });
  }
  return equipmentRequest;
}

async function getInstrumentMasterData(): Promise<InstrumentMaster[]> {
  if (!instrumentRequest) {
    instrumentRequest = httpClient
      .get<MasterRowsResponse<InstrumentMaster>>("/api/master-data/instruments")
      .then((response) => activeRows(response.data))
      .catch((error) => {
        instrumentRequest = null;
        throw error;
      });
  }
  return instrumentRequest;
}

/**
 * Load both global masters once. A failure in one optional master does not discard the
 * other, and failed requests are left retryable on the next page load.
 */
export async function getMasterData(): Promise<MasterData> {
  const [equipments, instruments] = await Promise.allSettled([
    getEquipmentMasterData(),
    getInstrumentMasterData(),
  ]);

  return {
    equipments: equipments.status === "fulfilled" ? equipments.value : [],
    instruments: instruments.status === "fulfilled" ? instruments.value : [],
    errors: {
      ...(equipments.status === "rejected" ? { equipments: equipments.reason } : {}),
      ...(instruments.status === "rejected" ? { instruments: instruments.reason } : {}),
    },
  };
}

export async function getEquipmentInputs(documentId: string): Promise<EquipmentEntry[]> {
  try {
    const res = await httpClient.get<any>(`/api/documents/${encodeURIComponent(documentId)}`);
    return res.data?.equipment_inputs || [];
  } catch {
    return [];
  }
}

export async function setEquipmentInputs(
  _documentId: string,
  entries: EquipmentEntry[],
): Promise<EquipmentEntry[]> {
  return entries;
}

/**
 * Format hint for a CPP field — unit + an example range/value — mirrored from the
 * client's parameter matrix so the operator sees "EX: 100 - 1600" etc. This is display
 * help only; any value is accepted.
 */
export function cppMeta(raw: string): { unit: string; ex: string } {
  const n = raw.toLowerCase();
  const V = (unit: string, ex: string) => ({ unit, ex });
  if (n.includes("impeller")) return V("rpm", "100 - 1600");
  if (n.includes("chopper")) return V("rpm", "200 - 2200");
  if (n.includes("ampere")) return V("A", "10 - 25");
  if (n.includes("turret")) return V("rpm", "20 - 60");
  if (n.includes("feeder")) return V("rpm", "15 - 45");
  if (n.includes("compaction force")) return V("kN", "5 - 20");
  if (n.includes("die fill")) return V("mm", "3 - 12");
  if (n.includes("punch penetration")) return V("mm", "2 - 6");
  if (n.includes("cylindrical height")) return V("mm", "3 - 6");
  if (n.includes("pan speed")) return V("rpm", "3 - 12");
  if (n.includes("peristaltic")) return V("rpm", "10 - 40");
  if (n.includes("nozzle")) return V("mm", "1");
  if (n.includes("gun to bed")) return V("cm", "15 - 25");
  if (n.includes("spray gun")) return V("nos", "2");
  if (n.includes("spray rate") || n.includes("srray rate")) return V("g/min", "20 - 60");
  if (n.includes("atomization") || n.includes("compressed air")) return V("bar", "1 - 3");
  if (n.includes("air flow") || n.includes("inlet air")) return V("CFM", "1000 - 2500");
  if (n.includes("damper")) return V("%", "30 - 70");
  if (n.includes("lod")) return V("%", "1 - 3");
  if (n.includes("binding with drying time")) return V("min", "25");
  if (n.includes("spraying time")) return V("min", "20");
  if (n.includes("drying time")) return V("min", "30");
  if (n.includes("temperature")) return V("°C", "40 - 70");
  if (n.includes("mixing speed") || n.includes("mixer speed")) return V("rpm", "8 - 15");
  if (n.includes("stirrer")) return V("rpm", "300 - 900");
  if (n.includes("binder solution addition")) return V("min", "5");
  if (n.includes("kneading")) return V("min", "5");
  if (n.includes("total time")) return V("min", "20");
  if (n.includes("mixing time")) return V("min", "10");
  if (n.includes("quantity")) return V("L", "5");
  if (n.includes("angle of discharge")) return V("°", "30 - 60");
  if (n.includes("defect threshold")) return V("", "1 - 5");
  return V("", "");
}
