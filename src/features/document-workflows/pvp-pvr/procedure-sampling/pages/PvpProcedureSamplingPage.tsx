import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { AppHeader } from "../../../../../app/layout/AppHeader";
import { AppSidebar } from "../../../../../app/layout/AppSidebar";
import { getApiErrorMessage } from "../../../../../shared/api/apiError";
import { getPvpProcedureGenerationRoute } from "../../../../../app/routing/routes";
import { useAuthStore } from "../../../../auth/state/auth.store";
import { useDocument } from "../../../selection/hooks/useDocument";
import { useDocumentSelectorData } from "../../../selection/hooks/useDocumentSelectorData";
import { useStepNavigation } from "../../../selection/hooks/useStepNavigation";
import { PVP_PVR_DOCUMENT_STEPS } from "../../../selection/model/documentSelector.config";
import { DocumentStepper } from "../../../selection/components/DocumentStepper";
import { SelectionStrip } from "../../../selection/components/SelectionStrip";
import { ProcedureSamplingEditor } from "../components/ProcedureSamplingEditor";
import { PackingStageEditor } from "../components/PackingStageEditor";
import { ProcedureReferencesSection } from "../components/ProcedureReferencesSection";
import {
  getProcedureStage,
  getProcedureStages,
  advanceProcedureSamplingProgress,
  updateProcedureStage,
  type JsonRecord,
  type ProcedureStage,
  type ProcedureStageSummary,
} from "../api/procedureSampling.api";

const EDITABLE_FIELDS = [
  "additional_cpp_rows",
  "additional_cqa_rows",
  "analytical_methodology",
  "sampling_plan",
  "granulation_group_sampling",
  "compression_plan",
  "sampling_diagram_labels",
  "equipment_sop_numbers",
  "selected_parameters",
  "challenge_parameters",
  "challenge_studies",
] as const;
type SamplingRow = {
  stage: string;
  sample_quantity: string;
  number_of_samples: number | string;
  test: string;
  [key: string]: any;
};
type SamplingPlanGroup = {
  layer: string;
  sampling_rows: SamplingRow[];
};

export function PvpProcedureSamplingPage() {
  const { documentId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { context, isLoading: isLoadingContext } =
    useDocumentSelectorData(user);
  const { document, isLoading: isLoadingDocument } = useDocument(documentId);
  const { goToStep } = useStepNavigation(documentId);
  const [stages, setStages] = useState<ProcedureStageSummary[]>([]);
  const [packType, setPackType] = useState("");
  const [pvpMode, setPvpMode] = useState("");
  const [packingReadiness, setPackingReadiness] = useState<JsonRecord | null>(null);
  const [stage, setStage] = useState<ProcedureStage | null>(null);
  const [selectedKey, setSelectedKey] = useState(searchParams.get("section_key") ?? "");
  const [expandedStageKey, setExpandedStageKey] = useState<string | null>(searchParams.get("section_key"));
  const [draft, setDraft] = useState<JsonRecord>({});
  const [originalDraft, setOriginalDraft] = useState<JsonRecord>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStage, setIsLoadingStage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const dirty = EDITABLE_FIELDS.some(
    (field) =>
      JSON.stringify(draft[field]) !== JSON.stringify(originalDraft[field]),
  );

  const loadStages = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getProcedureStages(documentId);
      const listed = result.section?.stages ?? result.stages ?? [];
      setPvpMode(String(result.pvp_mode ?? ""));
      setPackType(String(result.pack_type ?? result.section?.pack_type ?? ""));
      setPackingReadiness((result.readiness_counts ?? result.section?.readiness_counts ?? result.readiness ?? null) as JsonRecord | null);
      setStages(listed.filter((item) => typeof item.section_key === "string"));
      if (listed.length && !selectedKey) {
        setSelectedKey(listed[0].section_key);
        setExpandedStageKey(listed[0].section_key);
      }
      if (result.supported === false)
        setError(
          "Procedure & Sampling Plan is not supported for this document.",
        );
    } catch (caught) {
      setError(
        getApiErrorMessage(
          caught,
          "Unable to load Procedure & Sampling Plan stages.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [documentId, selectedKey]);

  useEffect(() => {
    void loadStages();
  }, [loadStages]);

  const loadStage = useCallback(
    async (key: string) => {
      if (!key) return;
      setIsLoadingStage(true);
      setError(null);
      setSaveMessage("");
      try {
        const result = await getProcedureStage(documentId, key);
        setStage(result);
        const normalized = normalizeDraft(result);
        setDraft(normalized);
        setOriginalDraft(normalized);
      } catch (caught) {
        setStage(null);
        setError(getApiErrorMessage(caught, "Unable to load this stage."));
      } finally {
        setIsLoadingStage(false);
      }
    },
    [documentId],
  );

  useEffect(() => {
    if (selectedKey) void loadStage(selectedKey);
  }, [selectedKey, loadStage]);
  const stageKind = useMemo(() => getStageKind(stage), [stage]);
  const isPacking = ["dispensing_packing_material", "primary_packing", "secondary_packing"].includes(stage?.section_key ?? "");
  const isDispensing = stage?.section_key === "dispensing_rm" || stage?.section_key === "dispensing_packing_material";
  const isPackingReadOnly = stage?.section_key === "dispensing_packing_material";
  const hasDuplicateParameters = Boolean(
    stage &&
    (hasDuplicates(
      stage.critical_process_parameters ?? [],
      draft.additional_cpp_rows ?? [],
    ) ||
      hasDuplicates(
        stage.critical_quality_attributes ?? [],
        draft.additional_cqa_rows ?? [],
      )),
  );
  const setField = (field: string, value: any) =>
    setDraft((current) => ({ ...current, [field]: value }));

  function openStage(key: string) {
    if (selectedKey === key) {
      setExpandedStageKey((current) => (current === key ? null : key));
      return;
    }
    setSelectedKey(key);
    setExpandedStageKey(key);
  }

  async function saveStage(): Promise<boolean> {
    if (!stage || isSaving) return false;
    if (isPackingReadOnly) return true;
    if (hasDuplicateParameters) {
      setError(
        "Parameter names must be unique and cannot duplicate backend source rows.",
      );
      return false;
    }
    const data: JsonRecord = {};
    for (const field of EDITABLE_FIELDS) {
      if (JSON.stringify(draft[field]) !== JSON.stringify(originalDraft[field]))
        data[field] = removeNulls(
          isPacking && ["additional_cpp_rows", "additional_cqa_rows"].includes(field)
            ? (draft[field] ?? []).map((row: JsonRecord) => ({ parameter: row.parameter, limit: row.limit }))
            : isPacking && field === "analytical_methodology"
              ? (draft[field] ?? []).map((row: JsonRecord) => ({ quality_attribute: row.quality_attribute, method_name: row.method_name }))
              : isPacking && field === "equipment_sop_numbers"
                ? (draft.equipment_sop_numbers ?? [])
                    .filter((row: JsonRecord) => (stage.equipment_details ?? []).some((equipment: JsonRecord) => String(equipment.id_no) === String(row.id_no)))
                    .map((row: JsonRecord) => ({ id_no: row.id_no, operation_sop_no: row.operation_sop_no }))
            : field === "compression_plan"
            ? cleanCompressionPlan(draft.compression_plan)
            : draft[field],
        );
    }

    const criteriaError = data.compression_plan
      ? validateCriteria(data.compression_plan)
      : null;
    if (criteriaError) {
      setError(criteriaError);
      return false;
    }
    if (!Object.keys(data).length) return true;
    setIsSaving(true);
    setError(null);
    setSaveMessage("");
    try {
      await updateProcedureStage(documentId, stage.section_key, data);
      const next = clone(draft);
      setOriginalDraft(next);
      setSaveMessage("Stage changes saved.");
      return true;
    } catch (caught) {
      setError(
        getApiErrorMessage(
          caught,
          "Unable to save stage changes. Check the entered values and try again.",
        ),
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function generate(regenerate: boolean) {
    if (!stage || isDispensing) return;
    const saved = await saveStage();
    if (!saved) return;
    navigate(
      getPvpProcedureGenerationRoute(documentId, stage.section_key, regenerate),
    );
  }

  const content =
    stage && !isLoadingStage ? (
      isPacking ? (
        <PackingStageEditor stage={stage} draft={draft} onFieldChange={setField} readOnly={isPackingReadOnly} />
      ) : <ProcedureSamplingEditor
        stage={stage}
        stageKind={stageKind}
        isDispensing={isDispensing}
        draft={draft}
        compressionPlan={
          draft.compression_plan ?? editableCompressionPlan(stage.compression_plan)
        }
        samplingGroups={normalizeSamplingPlan(draft.sampling_plan ?? [])}
        samplingStages={getSamplingStageOptions(stage)}
        availableTests={
          stageKind === "compression"
            ? stage.available_tests ?? stage.compression_plan?.available_tests ?? []
            : stage.available_tests ?? []
        }
        onSamplingPlanChange={(groups) =>
          setField("sampling_plan", serializeSamplingPlan(groups))
        }
        onFieldChange={setField}
      />
    ) : null;

  return (
    <div className="min-h-screen bg-background text-text lg:fixed lg:inset-0 lg:flex lg:flex-col lg:overflow-hidden">
      <AppHeader
        user={user}
        unit={context?.unit ?? null}
        isLoadingUnit={isLoadingContext}
      />
      <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <div className="lg:h-full lg:min-h-0 lg:overflow-y-auto">
          <AppSidebar user={user} />
        </div>
        <main className="min-w-0 lg:h-full lg:min-h-0 lg:overflow-y-auto">
          <section className="mx-auto flex min-h-[calc(100vh-var(--topbar-h))] flex-col bg-surface shadow-sm lg:min-h-full">
            <div className="px-4 py-4 sm:px-6 lg:px-8">
              <DocumentStepper
                steps={PVP_PVR_DOCUMENT_STEPS}
                activeStepId="procedure-sampling"
                onStepClick={goToStep}
              />
            </div>
            <SelectionStrip
              dosageForm={document?.dosage_form}
              docType={document?.doc_type}
              identifier={document?.bmr_number ?? document?.draft_id}
            />
            <header className="border-b border-border p-5">
              <p className="text-micro font-semibold uppercase tracking-overline text-primary">
                Step 6 of 7
              </p>
              <h1 className="mt-1 text-h1 font-semibold">
                Procedure &amp; Sampling Plan
              </h1>
              <p className="mt-1.5 text-small text-subdued">
                {packType
                  ? "Review the BPR sourced packing stages, enter document-specific challenge and sampling inputs, then continue when packing readiness is met."
                  : "Review stage inputs, edit sampling details, and generate the procedure preview."}
              </p>
            </header>
            <div className="flex-1 bg-muted/50 px-4 py-5 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-[1100px]">
                {error ? (
                  <div
                    role="alert"
                    className="mb-4 rounded-control border border-danger/30 bg-danger/5 p-3 text-small text-danger"
                  >
                    {error}
                    <button
                      type="button"
                      className="ml-3 font-semibold underline"
                      onClick={() => {
                        void loadStages();
                        if (selectedKey) void loadStage(selectedKey);
                      }}
                    >
                      Retry
                    </button>
                  </div>
                ) : null}
                {isLoading || isLoadingDocument ? (
                  <div className="rounded-card border border-border bg-surface p-8 text-center text-small text-subdued">
                    Loading stages…
                  </div>
                ) : null}
                {pvpMode === "packing" || document?.pvp_mode === "packing" ? <div className="mb-4 grid gap-3">
                  <PackTypeCard value={packType} />
                  {/* {packingReadiness ? <div className="rounded-card border border-border bg-surface px-4 py-3 text-small"><strong>Readiness:</strong> <span className="text-subdued">{Object.entries(packingReadiness).map(([key, value]) => `${key.replace(/_/g, " ")} ${typeof value === "object" ? JSON.stringify(value) : String(value)}`).join(" · ")}</span></div> : null} */}
                </div> : null}
                {!isLoading && stages.length === 0 && !error ? (
                  <div className="rounded-card border border-border bg-surface p-8 text-center text-small text-subdued">
                    No procedure stages are available for this document.
                  </div>
                ) : null}
                {!isLoading && stages.length > 0 ? (
                  <section
                    aria-label="Procedure stages"
                    className="overflow-hidden rounded-card border border-border bg-surface shadow-sm"
                  >
                    <header className="border-b border-border px-4 py-4 sm:px-5">
                      <h2 className="text-small font-semibold">Stages</h2>
                      <p className="mt-1 text-micro text-subdued">
                        Choose a stage to review its equipment, parameters,
                        methods, and sampling plan.
                      </p>
                    </header>
                    <div className="divide-y divide-border">
                      {stages.map((item) => {
                        const expanded = expandedStageKey === item.section_key;
                        const activeStage =
                          stage?.section_key === item.section_key;
                        const status = activeStage
                          ? stage.procedure_status
                          : item.procedure_status;
                        return (
                          <div key={item.section_key}>
                            <button
                              type="button"
                              aria-expanded={expanded}
                              onClick={() => openStage(item.section_key)}
                              className={`flex min-h-[60px] w-full items-center gap-3 border-l px-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-5 ${expanded ? "border-l-2 border-l-primary bg-primary/5 " : "border-l-transparent hover:bg-muted/60"}`}
                            >
                              {/* <span className="font-mono text-micro font-medium text-subdued">
                                {item.number ?? ""}
                              </span> */}
                              <span
                                className={`min-w-0 flex-1 text-small font-semibold ${expanded ? "text-primary-dark" : "text-text"}`}
                              >
                                {item.title ?? item.section_key}
                              </span>
                              {status ? (
                                <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-micro text-subdued">
                                  {status}
                                </span>
                              ) : null}
                              {expanded ? (
                                <ChevronUp
                                  className="size-4 shrink-0 text-subdued"
                                  aria-hidden="true"
                                />
                              ) : (
                                <ChevronDown
                                  className="size-4 shrink-0 text-subdued"
                                  aria-hidden="true"
                                />
                              )}
                            </button>
                            {expanded ? (
                              <div className="border-t border-dashed border-border bg-muted/20 px-3 py-4 sm:px-6 sm:py-5">
                                {isLoadingStage && !activeStage ? (
                                  <div className="rounded-card border border-border bg-surface p-8 text-center text-small text-subdued">
                                    Loading stage…
                                  </div>
                                ) : null}
                                {activeStage ? (
                                  <>
                                    {content}

                                    {!isDispensing && !isPacking ? (
                                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-card">
                                        <div className="text-small text-subdued">
                                          {saveMessage ||
                                            (dirty ? "Unsaved changes" : "All changes saved")}
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                          <button
                                            type="button"
                                            disabled={!dirty || isSaving || hasDuplicateParameters}
                                            onClick={() => void saveStage()}
                                            className="rounded-control border border-border px-4 py-2 text-small font-semibold disabled:opacity-50"
                                          >
                                            {isSaving ? "Saving…" : "Save changes"}
                                          </button>

                                          <button
                                            type="button"
                                            disabled={hasDuplicateParameters}
                                            onClick={() =>
                                              void generate(Boolean(stage.procedure_current))
                                            }
                                            className="inline-flex items-center gap-2 rounded-control bg-primary px-4 py-2 text-small font-semibold text-white disabled:opacity-50"
                                          >
                                            {stage.procedure_current
                                              ? "Regenerate procedure"
                                              : "Generate procedure"}
                                          </button>
                                        </div>
                                      </div>
                                    ) : null}
                                  </>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
                <ProcedureReferencesSection documentId={documentId} />
              </div>
            </div>
            <footer className="sticky bottom-0 z-10 border-t border-border bg-surface px-4 py-3.5 shadow-auth sm:px-6 lg:px-8">
              <div className="mx-auto flex max-w-[1100px] flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-control border border-border-strong bg-surface px-5 py-2 text-small font-semibold text-text transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => goToStep("cpp-cqa")}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-control bg-primary px-5 py-2 text-small font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => void continueToGenerate()}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving…" : "Continue to generate"}
                </button>
              </div>
            </footer>
          </section>
        </main>
      </div>
    </div>
  );

  async function continueToGenerate() {
    if (isSaving) return;
    if (isPacking) {
      const saved = await saveStage();
      if (!saved) return;
      setIsSaving(true);
      setError(null);
      try {
        await advanceProcedureSamplingProgress(documentId);
        goToStep("generate-submit");
      } catch (caught) {
        setError(getApiErrorMessage(caught, "Packing readiness requirements are not complete."));
      } finally {
        setIsSaving(false);
      }
      return;
    }
    goToStep("generate-submit");
  }
}

function PackTypeCard({ value }: { value: string }) {
  const options = ["Blister", "Alu-Alu Blister", "Strip"];
  const normalized = value.toLowerCase().replace(/[^a-z]/g, "");
  const selected = normalized.includes("alualu")
    ? "Alu-Alu Blister"
    : normalized.includes("strip")
      ? "Strip"
      : normalized === "blister" || normalized === "blisterpack"
        ? "Blister"
        : "";

  return <section className="rounded-card border border-border bg-surface p-4" aria-label="Pack type selected from BPR">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-small font-semibold">Pack type</h2>
      {value ? <span className="text-micro text-subdued">Selected from BPR</span> : <span className="text-micro text-subdued">No pack type returned by BPR</span>}
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      {options.map((option) => {
        const active = selected === option;
        return <div key={option} aria-current={active ? "true" : undefined} className={`flex min-h-16 items-center justify-between gap-3 rounded-control border px-4 py-3 text-small font-semibold transition-colors ${active ? "border-primary bg-primary/10 text-primary-dark ring-1 ring-primary" : "border-border bg-surface text-subdued"}`}>
          <span>{option}</span>
          {active ? <Check className="size-4 shrink-0 text-primary" aria-label="Selected" /> : null}
        </div>;
      })}
    </div>
  </section>;
}

function normalizeDraft(stage: ProcedureStage): JsonRecord {
  const currentDiagrams =
    stage.sampling_diagram_labels ?? stage.sampling_diagrams ?? [];
  const availableDiagramLabels = new Set(
    (stage.available_sampling_diagrams ?? [])
      .map((item: any) =>
        typeof item === "string" ? item : asString(item?.label),
      )
      .filter(Boolean),
  );
  return {
    additional_cpp_rows: clone(stage.additional_cpp_rows ?? []),
    additional_cqa_rows: clone(stage.additional_cqa_rows ?? []),
    analytical_methodology: clone(stage.analytical_methodology ?? []),
    sampling_plan: clone(stage.sampling_plan ?? []),
    granulation_group_sampling: clone(stage.granulation_group_sampling ?? []),
    compression_plan: editableCompressionPlan(stage.compression_plan),
    sampling_diagram_labels: Array.isArray(currentDiagrams)
      ? currentDiagrams
          .map((item: any) =>
            typeof item === "string"
              ? item
              : asString(item?.label ?? item?.name),
          )
          .filter((item: string) => item && availableDiagramLabels.has(item))
      : [],
    equipment_sop_numbers: clone(stage.equipment_sop_numbers ?? []),
    selected_parameters: clone(stage.selected_parameters ?? []),
    challenge_parameters: clone(stage.challenge_parameters ?? []),
    challenge_studies: clone(stage.challenge_studies ?? []),
  };
}
function granulationGroups(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as JsonRecord).map(([key, group]) => ({
    ...(group && typeof group === "object" ? group : {}),
    key,
  }));
}
function getStageKind(
  stage: ProcedureStage | null,
): "dispensing" | "granulation" | "compression" | "normal" {
  if (!stage) return "normal";
  if (stage.section_key === "dispensing_rm") return "dispensing";
  if (
    (Array.isArray(stage.granulation_group_sampling) &&
      stage.granulation_group_sampling.length > 0) ||
    (stage.granulation_group_sampling &&
      typeof stage.granulation_group_sampling === "object" &&
      !Array.isArray(stage.granulation_group_sampling) &&
      Object.keys(stage.granulation_group_sampling).length > 0)
  )
    return "granulation";
  if (
    (stage.compression_plan && typeof stage.compression_plan === "object") ||
    String(stage.title ?? "").trim().toLowerCase() === "compression"
  )
    return "compression";
  return "normal";
}
function getSamplingStageOptions(stage: ProcedureStage): string[] {
  const isCoating = `${stage.section_key} ${stage.title ?? ""}`
    .toLowerCase()
    .includes("coating");
  const field = isCoating ? "coating_pass" : "processing_step";
  const rows = [
    ...(stage.critical_process_parameters ?? []),
    ...(stage.critical_quality_attributes ?? []),
  ];
  return [
    ...new Set(
      rows
        .map((row: JsonRecord) => asString(row?.[field]).trim())
        .filter(Boolean),
    ),
  ];
}
function normalizeSamplingPlan(value: unknown): SamplingPlanGroup[] {
  if (!Array.isArray(value)) return [{ layer: "", sampling_rows: [] }];
  const nestedGroups = value.filter(
    (item: JsonRecord) => Array.isArray(item?.sampling_rows),
  );
  if (nestedGroups.length) {
    return nestedGroups.map((item: JsonRecord) => ({
      layer: asString(item.layer),
      sampling_rows: item.sampling_rows.map((row: SamplingRow) =>
        normalizeSamplingRow(row),
      ),
    }));
  }

  const legacyRows = value.filter(
    (item: JsonRecord) => item && typeof item === "object" && "stage" in item,
  ) as SamplingRow[];
  if (!legacyRows.length) return [{ layer: "", sampling_rows: [] }];
  const groups = new Map<string, SamplingRow[]>();
  for (const row of legacyRows) {
    const layer = asString(row.layer);
    const rows = groups.get(layer) ?? [];
    rows.push(normalizeSamplingRow(row));
    groups.set(layer, rows);
  }
  return [...groups].map(([layer, sampling_rows]) => ({ layer, sampling_rows }));
}
function editableCompressionPlan(value: unknown): JsonRecord {
  const plan = clone(
    (value && typeof value === "object" ? value : {}) as JsonRecord,
  );
  delete plan.available_tests;
  return plan;
}
function cleanCompressionPlan(value: unknown): JsonRecord {
  const plan = editableCompressionPlan(value);
  const dropEmpty = (row: JsonRecord) =>
    Object.fromEntries(
      Object.entries(row).filter(([, v]) => v !== "" && v != null),
    );

  if (Array.isArray(plan.acceptance_criteria))
    plan.acceptance_criteria = plan.acceptance_criteria.map(dropEmpty);

  // Numeric fields in these rows are ints on the backend, so "" would be rejected.
  const numericKeys = [
    "runtime_minutes",
    "ipqc_lhs_quantity",
    "ipqc_rhs_quantity",
    "qc_quantity",
  ];
  for (const key of ["challenges", "sampling_points"]) {
    if (Array.isArray(plan[key]))
      plan[key] = plan[key].map((row: JsonRecord) =>
        Object.fromEntries(
          Object.entries(row).filter(
            ([k, v]) => !(numericKeys.includes(k) && v === ""),
          ),
        ),
      );
  }
  return plan;
}

function validateCriteria(plan: JsonRecord): string | null {
  const need: Record<string, string[]> = {
    range: ["minimum", "maximum"],
    rsd: ["maximum"],
    l1_l2: ["l1", "l2"],
  };
  const rows: JsonRecord[] = plan.acceptance_criteria ?? [];
  const bad = rows.some((row) =>
    (need[row.kind] ?? []).some((k) => row[k] === "" || row[k] == null),
  );
  return bad
    ? "Fill in every limit in the acceptance criteria before saving."
    : null;
}

function normalizeSamplingRow(row: SamplingRow): SamplingRow {
  return {
    stage: asString(row.stage),
    sample_quantity: asString(row.sample_quantity),
    number_of_samples: row.number_of_samples ?? 1,
    test: asString(row.test),
  };
}
function serializeSamplingPlan(groups: SamplingPlanGroup[]): SamplingPlanGroup[] {
  return groups.map((group) => ({
    layer: asString(group.layer),
    sampling_rows: group.sampling_rows.map((row) => normalizeSamplingRow(row)),
  }));
}
function hasDuplicates(source: JsonRecord[], added: JsonRecord[]): boolean {
  const names = source
    .map((row) => asString(row.parameter).trim().toLowerCase())
    .filter(Boolean);
  for (const row of added) {
    const name = asString(row.parameter).trim().toLowerCase();
    if (name && names.includes(name)) return true;
    if (name) names.push(name);
  }
  return false;
}
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
function removeNulls(value: any): any {
  if (Array.isArray(value)) return value.map(removeNulls);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== null && item !== undefined)
        .map(([key, item]) => [key, removeNulls(item)]),
    );
  return value;
}
function asString(value: unknown): string {
  return value == null ? "" : String(value);
}

