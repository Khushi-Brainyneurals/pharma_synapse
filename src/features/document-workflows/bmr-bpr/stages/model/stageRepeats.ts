import type { RepeatSlot, StageInputsResponse } from "../../stage-input/api/stageInputs.types";

export const BATCH_YIELD_KEY = "batch_yield";
export type StageValues = Record<string, Record<string, unknown>>;
export type RepeatValueKey = "per_layer" | "per_type";
export interface StageRepeat { axis: "layer" | "coating type"; valueKey: RepeatValueKey; slots: RepeatSlot[] }
export interface ConditionSource { label: string; value: unknown; meta?: Record<string, unknown> }
export type ConditionSources = Record<string, ConditionSource[]>;

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object") : [];
}

/** Mirrors the BFF slot contract: labels may change, identities never do. */
export function layerSlots(reference: StageInputsResponse, dispensing: Record<string, unknown>): RepeatSlot[] {
  const chosen = String(dispensing.layers ?? "").trim();
  const bilayer = chosen ? chosen !== "Single layer" : reference.layers.length > 1;
  if (!bilayer) return [];
  let keys = reference.layers.filter((key) => key.trim());
  if (keys.length < 2) keys = ["Layer 1", "Layer 2"];
  const saved = records(dispensing.layer_config);
  return keys.map((key, index) => {
    const entry = saved.find((item) => item.key === key);
    return { key, name: String(entry?.name ?? "").trim() || key, index: String(index + 1),
      lot_no: String(entry?.lot_no ?? "").trim(), colour: String(entry?.colour ?? "").trim() };
  });
}

export function repeatFor(stageKey: string, reference: StageInputsResponse, values: StageValues): StageRepeat | null {
  if (stageKey === "granulation") {
    const slots = layerSlots(reference, values.dispensing_rm ?? {});
    return slots.length ? { axis: "layer", valueKey: "per_layer", slots } : null;
  }
  if (stageKey === "coating") {
    const dispensing = values.dispensing_coating ?? {};
    const chosen = Array.isArray(dispensing.coating_types) ? dispensing.coating_types : [];
    const saved = records(dispensing.coating_config);
    const slots = chosen.map(String).map((key) => key.trim()).filter(Boolean).map((key, index) => {
      const entry = saved.find((item) => item.key === key);
      return { key, name: String(entry?.name ?? "").trim() || key, index: String(index + 1), colour: String(entry?.colour ?? "").trim() };
    });
    return slots.length ? { axis: "coating type", valueKey: "per_type", slots } : null;
  }
  return null;
}

export function setUnitValue(values: StageValues, stage: string, valueKey: RepeatValueKey, unit: string, field: string, value: unknown): StageValues {
  const current = values[stage] ?? {};
  const units = (current[valueKey] as Record<string, Record<string, unknown>>) ?? {};
  return { ...values, [stage]: { ...current, [valueKey]: { ...units, [unit]: { ...units[unit], [field]: value } } } };
}

export function copyUnitValues(values: StageValues, stage: string, valueKey: RepeatValueKey, from: string, to: string): StageValues {
  const current = values[stage] ?? {};
  const units = (current[valueKey] as Record<string, Record<string, unknown>>) ?? {};
  if (from === to || !units[from]) return values;
  return { ...values, [stage]: { ...current, [valueKey]: { ...units, [to]: structuredClone(units[from]) } } };
}

/** Only earlier selected stages offer environmental limits for an explicit copy. */
export function conditionSourcesFor(stage: string, reference: StageInputsResponse, values: StageValues, order: string[]): ConditionSources {
  const result: ConditionSources = {};
  const index = order.indexOf(stage);
  if (index < 0) return result;
  for (const key of order.slice(0, index)) {
    const source = values[key] ?? {};
    const label = reference.stages.find((form) => form.key === key)?.label ?? key;
    const repeat = repeatFor(key, reference, values);
    const units = repeat ? (source[repeat.valueKey] as Record<string, Record<string, unknown>>) ?? {} : null;
    const entries = repeat ? repeat.slots.map((slot) => ({ label: `${label} · ${slot.name}`, values: units?.[slot.key] ?? {} })) : [{ label, values: source }];
    for (const entry of entries) {
      const metadata = (entry.values.__param_meta ?? {}) as Record<string, Record<string, unknown>>;
      for (const field of ["temp", "rh", "dp"]) {
        const range = entry.values[field] as { min?: string; max?: string } | undefined;
        const meta = metadata[field];
        if (!range || (!range.min && !range.max) || meta?.enabled === false || meta?.mode === "record") continue;
        (result[field] ??= []).push({ label: entry.label, value: range, meta });
      }
    }
  }
  return result;
}
