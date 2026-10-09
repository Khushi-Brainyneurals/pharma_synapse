import type { JsonSchema } from "../api/stageInputs.types";

function localRef(root: JsonSchema, ref?: string): JsonSchema | undefined {
  if (!ref?.startsWith("#/")) return undefined;
  let current: unknown = root;
  for (const part of ref.slice(2).split("/")) {
    current = (current as Record<string, unknown> | undefined)?.[
      part.replace(/~1/g, "/").replace(/~0/g, "~")
    ];
  }
  return current as JsonSchema | undefined;
}

export function resolveSchema(root: JsonSchema, node: JsonSchema): JsonSchema {
  const referred = localRef(root, node.$ref);
  if (referred) return { ...resolveSchema(root, referred), ...node, $ref: undefined };
  const choice = [...(node.anyOf || []), ...(node.oneOf || [])].find(
    (item) => item.type !== "null",
  );
  return choice ? { ...resolveSchema(root, choice), ...node, anyOf: undefined, oneOf: undefined } : node;
}

function defaultFor(root: JsonSchema, raw: JsonSchema): unknown {
  const node = resolveSchema(root, raw);
  if (node.default !== undefined) return structuredClone(node.default);
  if (node.type === "object" || node.properties) {
    return Object.fromEntries(
      Object.entries(node.properties || {}).map(([key, child]) => [key, defaultFor(root, child)]),
    );
  }
  if (node.type === "array") return [];
  return undefined;
}

export function buildSchemaDefaults(schema: JsonSchema): Record<string, unknown> {
  const root = resolveSchema(schema, schema);
  const value = defaultFor(schema, root);
  const defaults = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  if (
    root.properties?.coating_process_hours
    && schema.x_ui_reference?.coating_process_hours !== undefined
  ) {
    defaults.coating_process_hours = schema.x_ui_reference.coating_process_hours;
  }
  return defaults;
}

export function hasMeaningfulValues(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.some(hasMeaningfulValues);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).some(hasMeaningfulValues);
  return true;
}

export function mergeSchemaValues(defaults: unknown, saved: unknown, schema?: JsonSchema): any {
  if (schema) {
    const mergeAt = (raw: JsonSchema, fallback: unknown, persisted: unknown): unknown => {
      const node = resolveSchema(schema, raw);
      if (persisted === undefined) return fallback;
      if (node.type === "array") {
        return Array.isArray(persisted)
          ? persisted.map((item) => mergeAt(node.items || {}, defaultFor(schema, node.items || {}), item))
          : fallback;
      }
      if (node.type === "object" || node.properties) {
        const source = persisted && typeof persisted === "object" && !Array.isArray(persisted)
          ? persisted as Record<string, unknown>
          : {};
        const defaultsObject = fallback && typeof fallback === "object" && !Array.isArray(fallback)
          ? fallback as Record<string, unknown>
          : {};
        const known = Object.fromEntries(Object.entries(node.properties || {}).map(([key, child]) => [
          key,
          mergeAt(child, defaultsObject[key] ?? defaultFor(schema, child), source[key]),
        ]));
        if (node.additionalProperties) {
          for (const [key, value] of Object.entries(source)) {
            if (key in (node.properties || {})) continue;
            known[key] = typeof node.additionalProperties === "object"
              ? mergeAt(node.additionalProperties, undefined, value)
              : value;
          }
        }
        return known;
      }
      return persisted;
    };
    return mergeAt(schema, defaults, saved);
  }
  if (saved === undefined) return defaults;
  if (Array.isArray(saved)) return structuredClone(saved);
  if (saved && typeof saved === "object" && defaults && typeof defaults === "object") {
    const result = { ...(defaults as Record<string, unknown>) };
    for (const [key, value] of Object.entries(saved as Record<string, unknown>)) {
      result[key] = mergeSchemaValues(result[key], value);
    }
    return result;
  }
  return saved;
}

function sanitize(root: JsonSchema, raw: JsonSchema, value: unknown): unknown {
  const node = resolveSchema(root, raw);
  if (node.type === "object" || node.properties) {
    const source = value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
    const result = Object.fromEntries(
      Object.entries(node.properties || {})
        .filter(([key]) => source[key] !== undefined)
        .map(([key, child]) => [key, sanitize(root, child, source[key])]),
    );
    if (node.additionalProperties) {
      for (const [key, item] of Object.entries(source)) {
        if (key in (node.properties || {})) continue;
        result[key] = typeof node.additionalProperties === "object"
          ? sanitize(root, node.additionalProperties, item)
          : item;
      }
    }
    return result;
  }
  if (node.type === "array") {
    return Array.isArray(value) ? value.map((item) => sanitize(root, node.items || {}, item)) : [];
  }
  if (node.type === "boolean") return Boolean(value);
  if ((node.type === "number" || node.type === "integer") && value !== "" && value !== null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  return value ?? null;
}

export function sanitizeForSchema(schema: JsonSchema, values: Record<string, unknown>): Record<string, unknown> {
  return sanitize(schema, schema, values) as Record<string, unknown>;
}

const STAGE_PARAMETER_NAMES: Record<string, string[]> = {
  dispensing_rm: ["temperature", "relative_humidity", "differential_pressure"],
  granulation: ["temperature", "relative_humidity", "differential_pressure", "holding_period", "yield"],
  compression: ["temperature", "relative_humidity", "differential_pressure", "holding_period", "yield"],
  uncoated_inspection: ["temperature", "relative_humidity", "differential_pressure", "yield"],
  dispensing_coating: ["temperature", "relative_humidity", "differential_pressure"],
  coating: ["temperature", "relative_humidity", "differential_pressure", "holding_period", "yield"],
  coated_inspection: ["temperature", "relative_humidity", "differential_pressure", "yield"],
  dispensing_packing_material: ["temperature", "relative_humidity", "differential_pressure"],
  primary_packing: ["temperature", "relative_humidity", "differential_pressure"],
  secondary_packing: ["temperature", "relative_humidity", "differential_pressure"],
};

export function parameterNamesForStage(stageKey: string | undefined, advertised: string[]): string[] {
  const allowed = stageKey ? STAGE_PARAMETER_NAMES[stageKey] : undefined;
  return allowed ? advertised.filter((name) => allowed.includes(name)) : advertised;
}

/** Schema-filter a payload and enforce the backend's stage-specific parameter-name policy. */
export function sanitizeStageValues(
  stageKey: string,
  schema: JsonSchema,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized = sanitizeForSchema(schema, values);
  const allowed = STAGE_PARAMETER_NAMES[stageKey];
  if (!allowed) return sanitized;
  const prune = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(prune);
    if (!value || typeof value !== "object") return value;
    const object = value as Record<string, unknown>;
    return Object.fromEntries(Object.entries(object).map(([key, child]) => [
      key,
      key === "parameters" && Array.isArray(child)
        ? child.filter((row) => row && typeof row === "object" && allowed.includes(String((row as Record<string, unknown>).name || ""))).map(prune)
        : prune(child),
    ]));
  };
  return prune(sanitized) as Record<string, unknown>;
}

export function schemaOptions(node: JsonSchema): string[] {
  if (node.enum) return node.enum.map(String);
  const match = node.description?.match(/(?:^|\n)([a-z][a-z0-9_]*(?:\s*\|\s*[a-z][a-z0-9_]*)+)/i);
  return match ? match[1].split("|").map((item) => item.trim()) : [];
}

export function emptyItem(root: JsonSchema, itemSchema?: JsonSchema): unknown {
  return defaultFor(root, itemSchema || {});
}

/** Seed the common parameter rows advertised by the schema for a brand-new stage only. */
export function seedSchemaParameterRows(
  schema: JsonSchema,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const parameters = resolveSchema(schema, schema).properties?.parameters;
  if (!parameters || (Array.isArray(values.parameters) && values.parameters.length > 0)) return values;
  const item = resolveSchema(schema, resolveSchema(schema, parameters).items || {});
  const names = item.properties?.name ? schemaOptions(resolveSchema(schema, item.properties.name)) : [];
  if (names.length === 0) return values;
  return {
    ...values,
    parameters: names.map((name) => ({ ...(emptyItem(schema, item) as Record<string, unknown>), name })),
  };
}

export interface StageSchemaContext {
  layers?: string[];
  coatingTypes?: string[];
  stageKey?: string;
}

export interface StageAssetScope {
  key: string;
  label: string;
  path: (string | number)[];
  schema: JsonSchema;
}

/** True when equipment/instrument inputs exist anywhere in the stage schema. */
export function schemaHasAssetInputs(schema: JsonSchema): boolean {
  const seen = new Set<JsonSchema>();
  const visit = (raw: JsonSchema): boolean => {
    const node = resolveSchema(schema, raw);
    if (seen.has(node)) return false;
    seen.add(node);
    if (node.properties?.equipment_list || node.properties?.instrument_list) return true;
    if (Object.values(node.properties || {}).some(visit)) return true;
    if (node.items && visit(node.items)) return true;
    return typeof node.additionalProperties === "object" && visit(node.additionalProperties);
  };
  return visit(schema);
}

/**
 * Locate the asset editors exposed by the current stage instance. Some schemas keep
 * them at stage level, while granulation owns them per layer and coating per pass.
 */
export function collectStageAssetScopes(
  schema: JsonSchema,
  values: Record<string, unknown>,
): StageAssetScope[] {
  const scopes: StageAssetScope[] = [];
  const add = (key: string, label: string, path: (string | number)[], raw: JsonSchema) => {
    const node = resolveSchema(schema, raw);
    if (node.properties?.equipment_list || node.properties?.instrument_list) {
      scopes.push({ key, label, path, schema: node });
    }
  };

  const root = resolveSchema(schema, schema);
  add("stage", "Stage level", [], root);

  const layersRaw = root.properties?.layers;
  if (layersRaw) {
    const layersNode = resolveSchema(schema, layersRaw);
    const itemSchema = resolveSchema(schema, layersNode.items || {});
    const rows = Array.isArray(values.layers) ? values.layers as Record<string, unknown>[] : [];
    rows.forEach((row, index) => add(
      `layer:${index}`,
      String(row?.layer || (rows.length === 1 ? "Single layer" : `Layer ${index + 1}`)),
      ["layers", index],
      itemSchema,
    ));
  }

  const passesRaw = root.properties?.coat_passes;
  if (passesRaw) {
    const passesNode = resolveSchema(schema, passesRaw);
    const passSchema = typeof passesNode.additionalProperties === "object"
      ? passesNode.additionalProperties
      : undefined;
    const passes = values.coat_passes && typeof values.coat_passes === "object" && !Array.isArray(values.coat_passes)
      ? values.coat_passes as Record<string, unknown>
      : {};
    if (passSchema) {
      Object.keys(passes).forEach((name) => add(
        `coat:${name}`,
        name.replace(/_/g, " "),
        ["coat_passes", name],
        passSchema,
      ));
    }
  }

  return scopes;
}

/** Build the stage-specific editable shape using only schema and document metadata. */
export function initializeStageSchemaValues(
  schema: JsonSchema,
  values: Record<string, unknown>,
  context: StageSchemaContext = {},
): Record<string, unknown> {
  const seed = (raw: JsonSchema, current: unknown, key = ""): unknown => {
    const node = resolveSchema(schema, raw);
    if (node.type === "array") {
      let rows = Array.isArray(current) ? current : [];
      const item = resolveSchema(schema, node.items || {});
      if (rows.length === 0 && key === "parameters") {
        const advertised = item.properties?.name
          ? schemaOptions(resolveSchema(schema, item.properties.name))
          : [];
        const names = parameterNamesForStage(context.stageKey, advertised);
        rows = names.map((name) => ({ ...(emptyItem(schema, item) as Record<string, unknown>), name }));
      } else if (rows.length === 0 && key === "layers") {
        const layerNames = context.layers?.length ? context.layers : [""];
        rows = layerNames.map((layer) => ({ ...(emptyItem(schema, item) as Record<string, unknown>), layer }));
      } else if (rows.length === 0 && key === "ipqc_table") {
        rows = (schema.x_ui_reference?.fixed_ipqc_parameters || []).map((parameter) => ({
          parameter,
          frequency: "",
        }));
      }
      return rows.map((row) => seed(item, row));
    }
    if (node.type === "object" || node.properties || node.additionalProperties) {
      let object = current && typeof current === "object" && !Array.isArray(current)
        ? { ...(current as Record<string, unknown>) }
        : (defaultFor(schema, node) as Record<string, unknown>) || {};
      const isParameter = Boolean(node.properties?.name && node.properties?.enabled && node.properties?.mode);
      if (isParameter && !object.name && key.includes("yield")) object.name = "yield";

      if (node.additionalProperties && Object.keys(node.properties || {}).length === 0) {
        if (key === "coat_passes" && context.coatingTypes?.length) {
          object = Object.fromEntries(context.coatingTypes.map((coat) => [
            coat,
            object[coat]
              ?? emptyItem(schema, typeof node.additionalProperties === "object" ? node.additionalProperties : {}),
          ]));
        }
        if (typeof node.additionalProperties === "object") {
          return Object.fromEntries(Object.entries(object).map(([entryKey, entryValue]) => [
            entryKey,
            seed(node.additionalProperties as JsonSchema, entryValue, entryKey),
          ]));
        }
        return object;
      }

      for (const [childKey, child] of Object.entries(node.properties || {})) {
        object[childKey] = seed(child, object[childKey], childKey);
      }
      return object;
    }
    if (
      key === "coating_process_hours"
      && (current === undefined || current === null || current === "")
      && schema.x_ui_reference?.coating_process_hours !== undefined
    ) {
      return schema.x_ui_reference.coating_process_hours;
    }
    return current;
  };
  return seed(schema, values) as Record<string, unknown>;
}

export function validateSchema(
  schema: JsonSchema,
  values: Record<string, unknown>,
  context: StageSchemaContext = {},
): string[] {
  const errors: string[] = [];
  const visit = (raw: JsonSchema, value: unknown, path: string) => {
    const node = resolveSchema(schema, raw);
    if (node.type === "object" || node.properties) {
      const object = value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
      for (const key of node.required || []) {
        const child = object[key];
        if (child === undefined || child === null || child === "") {
          errors.push(`${path}${node.properties?.[key]?.title || key} is required.`);
        }
      }
      for (const [key, child] of Object.entries(node.properties || {})) {
        if (object[key] !== undefined) visit(child, object[key], `${path}${child.title || key}: `);
      }
    } else if (node.type === "array" && Array.isArray(value)) {
      value.forEach((item, index) => visit(node.items || {}, item, `${path}${index + 1}: `));
    }
  };
  visit(schema, values, "");
  if (
    context.stageKey === "dispensing_rm"
    && (context.layers?.length ?? 0) > 1
    && resolveSchema(schema, schema).properties?.lot_size
  ) {
    const lotSizes = String(values.lot_size ?? "").split(",");
    context.layers!.forEach((layer, index) => {
      if (!lotSizes[index]?.trim()) errors.push(`Lot size for ${layer} is required.`);
    });
  }
  return errors;
}
