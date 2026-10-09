import { httpClient } from "../../../shared/api/httpClient";
import { buildSchemaDefaults, hasMeaningfulValues, initializeStageSchemaValues, mergeSchemaValues, sanitizeStageValues, type StageSchemaContext } from "../model/schemaForm";
import type { JsonSchema, StageForm, StageInputsSaveResponse } from "./stageInputs.types";

export async function getStageParamsSchema(
  stageKey: string,
  productType: string,
  docType: string,
): Promise<JsonSchema> {
  const response = await httpClient.get<JsonSchema>(
    `/api/documents/stages/${encodeURIComponent(stageKey)}/params-schema`,
    { params: { product_type: productType, doc_type: docType } },
  );
  return response.data;
}

export async function getSavedStageParams(
  documentId: string,
  stageKey: string,
): Promise<Record<string, unknown>> {
  const response = await httpClient.get<Record<string, unknown>>(
    `/api/documents/${encodeURIComponent(documentId)}/stages/${encodeURIComponent(stageKey)}/params`,
  );
  return response.data || {};
}

/** Load the independent schema and document-specific values together for one stage. */
export async function getStageForm(
  documentId: string,
  stageKey: string,
  label: string,
  productType: string,
  docType: string,
  context: StageSchemaContext = {},
): Promise<StageForm> {
  const [schema, saved] = await Promise.all([
    getStageParamsSchema(stageKey, productType, docType),
    getSavedStageParams(documentId, stageKey),
  ]);
  const defaults = buildSchemaDefaults(schema);
  const hasSaved = hasMeaningfulValues(saved);
  const merged = hasSaved
    ? mergeSchemaValues(defaults, saved, schema)
    : defaults;
  const values = initializeStageSchemaValues(schema, merged, { ...context, stageKey });
  return {
    key: stageKey,
    label,
    description: schema.description || `Configure inputs for ${label}.`,
    fields: [],
    values,
    problems: [],
    is_complete: false,
    schema,
    has_saved_values: hasSaved,
  };
}

/** Saves one schema-filtered stage payload. Errors intentionally reach the page error UI. */
export async function saveStageInputs(
  documentId: string,
  stage: string,
  values: Record<string, unknown>,
  schema?: JsonSchema,
): Promise<StageInputsSaveResponse> {
  const body = schema ? sanitizeStageValues(stage, schema, values) : values;
  await httpClient.post(
    `/api/documents/${encodeURIComponent(documentId)}/stages/${encodeURIComponent(stage)}/params`,
    body,
  );

  return {
    document_id: documentId,
    status: "saved",
    stage,
    problems: [],
    is_complete: true,
    all_complete: false,
  };
}
