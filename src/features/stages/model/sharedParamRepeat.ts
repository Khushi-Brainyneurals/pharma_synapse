import { SHARED_PARAMS } from "./stageParams";

/** The schema row names corresponding to the shared in-process parameter keys. */
const SHARED_SCHEMA_NAMES: Record<string, string> = {
  temp: "temperature",
  rh: "relative_humidity",
  dp: "differential_pressure",
  ht: "holding_period",
  yield: "yield",
};

const SHARED_PARAMETER_NAMES = new Set(
  SHARED_PARAMS.map((parameter) => SHARED_SCHEMA_NAMES[parameter.key]).filter(Boolean),
);
const COPIED_VALUE_KEYS = ["enabled", "mode", "kind", "min", "max", "value", "unit"] as const;

type ParameterRow = Record<string, unknown> & { name?: unknown };

function parameterRows(value: unknown): ParameterRow[] {
  if (Array.isArray(value)) return value.flatMap(parameterRows);
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  const ownRow = typeof object.name === "string"
    && SHARED_PARAMETER_NAMES.has(object.name)
    ? [object as ParameterRow]
    : [];
  return [...ownRow, ...Object.values(object).flatMap(parameterRows)];
}

function hasEnteredValue(row: ParameterRow): boolean {
  return [row.min, row.max, row.value].some(
    (value) => value !== null && value !== undefined && String(value).trim() !== "",
  );
}

/** True when at least one shared parameter row contains an entered value. */
export function hasSharedParameterValues(values: Record<string, unknown> | undefined): boolean {
  return parameterRows(values).some(hasEnteredValue);
}

/** Copy entered values for matching shared rows, leaving every other target value intact. */
export function repeatSharedParameterValues(
  sourceValues: Record<string, unknown> | undefined,
  targetValues: Record<string, unknown>,
): Record<string, unknown> {
  const sourceRows = parameterRows(sourceValues);
  const sourceByName = new Map(
    sourceRows
      .filter((row) => row && SHARED_PARAMETER_NAMES.has(String(row.name || "")) && hasEnteredValue(row))
      .map((row) => [String(row.name), row]),
  );
  if (sourceByName.size === 0) return targetValues;

  let changed = false;
  const copyAt = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(copyAt);
    if (!value || typeof value !== "object") return value;
    const target = value as Record<string, unknown>;
    const name = String(target.name || "");
    const source = SHARED_PARAMETER_NAMES.has(name) ? sourceByName.get(name) : undefined;
    const next = Object.fromEntries(
      Object.entries(target).map(([key, child]) => [key, copyAt(child)]),
    ) as Record<string, unknown>;
    if (source) {
      changed = true;
      for (const key of COPIED_VALUE_KEYS) {
        if (key in source) next[key] = structuredClone(source[key]);
      }
    }
    return next;
  };
  const nextValues = copyAt(targetValues) as Record<string, unknown>;

  return changed ? nextValues : targetValues;
}
