/**
 * Setup-table ⇄ backend master-row conversion.
 *
 * The Setup wizard edits flat tables (one row per M/C ID); the backend stores machines
 * grouped by (stage, name) with their processing sub-stages + CPPs — the shape the
 * Stage-input dropdowns read via `getMasterData`. `equipRowsToMaster` / `instrRowsToMaster`
 * fold the flat tables back into that grouped shape when the operator hits **Save**.
 *
 * The Setup table carries CPPs as one comma-joined list per machine (not mapped per
 * sub-stage), so on save we attach the machine's full CPP set to each of its processing
 * stages — whichever sub-stage the operator later selects, its CPPs are present and none
 * are dropped.
 */
import type { EquipmentRow, InstrumentRow } from "./model/setup.model";

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function uniq(items: string[]): string[] {
  return [...new Set(items)];
}

interface EquipmentGroup {
  name: string;
  stage: string;
  ids: string[];
  capacity: string;
  working_capacity: string;
  procStages: string[];
  cpps: string[];
}

/** Flat equipment rows → machines grouped by (stage, name), backend `equipment` shape. */
export function equipRowsToMaster(rows: EquipmentRow[]): Record<string, unknown>[] {
  const groups = new Map<string, EquipmentGroup>();
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) continue; // blank rows are not persisted
    const stage = row.stage.trim();
    const key = `${stage}||${name}`;
    let group = groups.get(key);
    if (!group) {
      group = { name, stage, ids: [], capacity: "", working_capacity: "", procStages: [], cpps: [] };
      groups.set(key, group);
    }
    if (row.mcId.trim()) group.ids.push(row.mcId.trim());
    if (!group.capacity && row.capacity.trim()) group.capacity = row.capacity.trim();
    if (!group.working_capacity && row.workingCap.trim()) group.working_capacity = row.workingCap.trim();
    group.procStages.push(...splitList(row.procStage));
    group.cpps.push(...splitList(row.cpp));
  }

  return [...groups.values()].map((group) => {
    const procStages = uniq(group.procStages);
    const cpps = uniq(group.cpps);
    const stages = procStages.length
      ? procStages.map((stage) => ({ stage, cpps }))
      : cpps.length
        ? [{ stage: "", cpps }]
        : [];
    return {
      name: group.name,
      stage: group.stage,
      ids: uniq(group.ids),
      capacity: group.capacity || "N/A",
      working_capacity: group.working_capacity || "N/A",
      stages,
    };
  });
}

interface InstrumentGroup {
  name: string;
  instruments: { instrument_id: string; location: string; stages: string[] }[];
}

/** Flat instrument rows → instruments grouped by name, backend `instrument` shape. */
export function instrRowsToMaster(rows: InstrumentRow[]): Record<string, unknown>[] {
  const groups = new Map<string, InstrumentGroup>();
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) continue;
    let group = groups.get(name);
    if (!group) {
      group = { name, instruments: [] };
      groups.set(name, group);
    }
    group.instruments.push({
      instrument_id: row.instrumentId.trim(),
      location: row.location.trim(),
      stages: row.stages.filter(Boolean),
    });
  }
  return [...groups.values()].map((group) => ({ name: group.name, instruments: group.instruments }));
}
