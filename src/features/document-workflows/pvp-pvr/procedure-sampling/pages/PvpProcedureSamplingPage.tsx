import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { AppHeader } from "../../../../../app/layout/AppHeader";
import { AppSidebar } from "../../../../../app/layout/AppSidebar";
import {
  getApiErrorMessage,
  isGenerationInProgressError,
} from "../../../../../shared/api/apiError";
import { useAuthStore } from "../../../../auth/state/auth.store";
import { useDocument } from "../../../selection/hooks/useDocument";
import { useDocumentSelectorData } from "../../../selection/hooks/useDocumentSelectorData";
import { useStepNavigation } from "../../../selection/hooks/useStepNavigation";
import { PVP_PVR_DOCUMENT_STEPS } from "../../../selection/model/documentSelector.config";
import { DocumentStepper } from "../../../selection/components/DocumentStepper";
import { SelectionStrip } from "../../../selection/components/SelectionStrip";
import {
  generateProcedureStage,
  getProcedureGenerationProgress,
  getProcedureStage,
  getProcedureStages,
  updateProcedureStage,
  type GenerationProgress,
  type JsonRecord,
  type ProcedureStage,
  type ProcedureStageSummary,
} from "../api/procedureSampling.api";

const POLL_MS = 3000;
const EDITABLE_FIELDS = [
  "additional_cpp_rows",
  "additional_cqa_rows",
  "analytical_methodology",
  "sampling_plan",
  "granulation_group_sampling",
  "compression_plan",
  "sampling_diagram_labels",
] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];
type SamplingRow = {
  stage: string;
  sample_quantity: string;
  number_of_samples: number | string;
  test: string;
  [key: string]: any;
};

export function PvpProcedureSamplingPage() {
  const { documentId = "" } = useParams();
  const user = useAuthStore((state) => state.user);
  const { context, isLoading: isLoadingContext } =
    useDocumentSelectorData(user);
  const { document, isLoading: isLoadingDocument } = useDocument(documentId);
  const { goToStep } = useStepNavigation(documentId);
  const [stages, setStages] = useState<ProcedureStageSummary[]>([]);
  const [stage, setStage] = useState<ProcedureStage | null>(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [expandedStageKey, setExpandedStageKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<JsonRecord>({});
  const [originalDraft, setOriginalDraft] = useState<JsonRecord>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStage, setIsLoadingStage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [preview, setPreview] = useState<unknown>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const pollController = useRef<AbortController | null>(null);
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
      setPreview(null);
      setGenerationError(null);
      setProgress(null);
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
  useEffect(
    () => () => {
      pollController.current?.abort();
    },
    [],
  );

  const stageKind = useMemo(() => getStageKind(stage), [stage]);
  const readOnly = stageKind === "dispensing";
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
  const setField = (field: EditableField, value: any) =>
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
    if (!stage || readOnly || isSaving) return false;
    if (hasDuplicateParameters) {
      setError(
        "Parameter names must be unique and cannot duplicate backend source rows.",
      );
      return false;
    }
    const data: JsonRecord = {};
    for (const field of EDITABLE_FIELDS) {
      if (JSON.stringify(draft[field]) !== JSON.stringify(originalDraft[field]))
        data[field] = removeNulls(draft[field]);
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
    if (
      !stage ||
      readOnly ||
      stage.generation_supported === false ||
      isGenerating
    )
      return;
    const saved = await saveStage();
    if (!saved) return;
    pollController.current?.abort();
    const controller = new AbortController();
    pollController.current = controller;
    setIsGenerating(true);
    setGenerationError(null);
    setPreview(null);
    setProgress(null);
    try {
      let start: JsonRecord = {};
      try {
        start = await generateProcedureStage(
          documentId,
          stage.section_key,
          regenerate,
        );
      } catch (caught) {
        if (!isGenerationInProgressError(caught)) throw caught;
      }
      let attemptId = asString(start.attempt_id ?? start.data?.attempt_id);
      while (!controller.signal.aborted) {
        const next = await getProcedureGenerationProgress(
          documentId,
          attemptId || undefined,
          controller.signal,
        );
        if (!attemptId && next.attempt_id) attemptId = next.attempt_id;
        setProgress(next);
        const status = asString(next.status).toLowerCase();
        if (["error", "failed", "failure"].includes(status))
          throw new Error(
            asString(next.error ?? next.message) ||
              "Procedure generation failed.",
          );
        if (
          ["done", "complete", "completed", "success", "succeeded"].includes(
            status,
          )
        ) {
          await loadStage(stage.section_key);
          setPreview(next.preview ?? next.result ?? next);
          return;
        }
        await delay(POLL_MS, controller.signal);
      }
    } catch (caught) {
      if (!controller.signal.aborted)
        setGenerationError(
          getApiErrorMessage(
            caught,
            "Unable to generate the procedure and sampling plan.",
          ),
        );
    } finally {
      if (pollController.current === controller) {
        pollController.current = null;
        setIsGenerating(false);
      }
    }
  }

  const content =
    stage && !isLoadingStage ? (
      <>
        {stage.warnings?.length ? (
          <div className="mb-4 rounded-control border border-warning/30 bg-warning/10 p-3 text-small text-text">
            {stage.warnings.map((warning: string, i: number) => (
              <p key={i}>{warning}</p>
            ))}
          </div>
        ) : null}
        <div className="grid gap-4">
          <InfoSection title="Equipment" rows={stage.equipment_details} />
          <InfoSection title="Instruments" rows={stage.instruments} />
          <ParameterSection
            title="Critical Process Parameters"
            sourceRows={stage.critical_process_parameters}
            rows={draft.additional_cpp_rows ?? []}
            onChange={(rows) => setField("additional_cpp_rows", rows)}
            disabled={readOnly}
          />
          <ParameterSection
            title="Critical Quality Attributes"
            sourceRows={stage.critical_quality_attributes}
            rows={draft.additional_cqa_rows ?? []}
            onChange={(rows) => setField("additional_cqa_rows", rows)}
            disabled={readOnly}
          />
          <AnalyticalSection
            rows={draft.analytical_methodology ?? []}
            onChange={(rows) => setField("analytical_methodology", rows)}
            disabled={readOnly}
          />
          {stageKind === "compression" ? (
            <CompressionSection
              plan={{
                ...(draft.compression_plan ?? stage.compression_plan ?? {}),
                available_tests:
                  draft.compression_plan?.available_tests ??
                  stage.available_tests ??
                  [],
              }}
              availableTests={stage.available_tests ?? []}
              onChange={(plan) => setField("compression_plan", plan)}
              disabled={readOnly}
            />
          ) : stageKind === "granulation" ? (
            <GranulationSection
              groups={draft.granulation_group_sampling ?? []}
              onChange={(groups) =>
                setField("granulation_group_sampling", groups)
              }
              disabled={readOnly}
            />
          ) : (
            <SamplingSection
              rows={draft.sampling_plan ?? []}
              onChange={(rows) => setField("sampling_plan", rows)}
              disabled={readOnly}
            />
          )}
          <DiagramSection
            available={stage.available_sampling_diagrams ?? []}
            selected={draft.sampling_diagram_labels ?? []}
            onChange={(labels) => setField("sampling_diagram_labels", labels)}
            disabled={readOnly}
          />
        </div>
      </>
    ) : null;

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader
        user={user}
        unit={context?.unit ?? null}
        isLoadingUnit={isLoadingContext}
      />
      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />
        <main className="min-w-0 lg:h-full lg:overflow-y-auto">
          <section className="mx-auto bg-surface shadow-sm">
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
                Review stage inputs, edit sampling details, and generate the
                procedure preview.
              </p>
            </header>
            <div className="bg-muted/50 px-4 py-5 sm:px-6 lg:px-8">
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
                              className={`flex min-h-[60px] w-full items-center gap-3 border-l px-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-5 ${expanded ? "border-l-2 border-l-primary bg-primary/5" : "border-l-transparent hover:bg-muted/60"}`}
                            >
                              {/* <span className="font-mono text-micro font-medium text-subdued">
                                {item.number ?? ""}
                              </span> */}
                              <span
                                className={`min-w-0 flex-1 text-small font-semibold ${expanded ? "text-primary" : "text-text"}`}
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
                                    {/* <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3">
                                      <div>
                                        <h3 className="text-h3 font-semibold">
                                          {stage.title ??
                                            item.title ??
                                            item.section_key}
                                        </h3>
                                        <p className="mt-1 text-micro text-subdued">
                                          {stage.number ?? item.number ?? ""}
                                          {stage.procedure_current
                                            ? " · Generated procedure is current"
                                            : ""}
                                        </p>
                                      </div>
                                      {readOnly ? (
                                        <span className="rounded-full border border-border bg-muted px-3 py-1 text-micro text-subdued">
                                          Read only
                                        </span>
                                      ) : null}
                                    </div> */}
                                    {content}
                                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface p-4">
                                      <div className="text-small text-subdued">
                                        {saveMessage ||
                                          (dirty
                                            ? "Unsaved changes"
                                            : "All changes saved")}
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          disabled={
                                            !dirty ||
                                            isSaving ||
                                            readOnly ||
                                            hasDuplicateParameters
                                          }
                                          onClick={() => void saveStage()}
                                          className="rounded-control border border-border px-4 py-2 text-small font-semibold disabled:opacity-50"
                                        >
                                          {isSaving
                                            ? "Saving…"
                                            : "Save changes"}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={
                                            readOnly ||
                                            stage.generation_supported ===
                                              false ||
                                            isGenerating ||
                                            hasDuplicateParameters
                                          }
                                          onClick={() =>
                                            void generate(
                                              Boolean(stage.procedure_current),
                                            )
                                          }
                                          className="inline-flex items-center gap-2 rounded-control bg-primary px-4 py-2 text-small font-semibold text-white disabled:opacity-50"
                                        >
                                          {isGenerating ? (
                                            <>
                                              <RefreshCw className="size-4 animate-spin" />
                                              Generating…
                                            </>
                                          ) : stage.procedure_current ? (
                                            "Regenerate procedure"
                                          ) : (
                                            "Generate procedure"
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                    {generationError ? (
                                      <p
                                        role="alert"
                                        className="mt-3 rounded-control border border-danger/30 bg-danger/5 p-3 text-small text-danger"
                                      >
                                        {generationError}
                                      </p>
                                    ) : null}
                                    {isGenerating && progress ? (
                                      <div className="mt-3 rounded-control border border-primary/20 bg-primary/5 p-3 text-small">
                                        Generation{" "}
                                        {progress.status ?? "running"}
                                        {progress.step
                                          ? ` · ${progress.step}`
                                          : ""}
                                        {progress.percent != null
                                          ? ` · ${progress.percent}%`
                                          : ""}
                                      </div>
                                    ) : null}
                                    {preview ? (
                                      <Preview value={preview} />
                                    ) : stage.procedure?.length ? (
                                      <Preview value={stage.procedure} />
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
              </div>
            </div>
            <footer className="border-t border-border bg-surface px-4 py-4 sm:px-6 lg:px-8">
              <div className="mx-auto flex max-w-[1100px] flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-control border border-border-strong bg-surface px-5 py-2.5 text-small font-semibold text-text transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => goToStep("cpp-cqa")}
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Back
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-control bg-primary px-5 py-2.5 text-small font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => goToStep("generate-submit")}
                >
                  Continue to generate
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              </div>
            </footer>
          </section>
        </main>
      </div>
    </div>
  );
}

function normalizeDraft(stage: ProcedureStage): JsonRecord {
  const currentDiagrams =
    stage.sampling_diagram_labels ?? stage.sampling_diagrams ?? [];
  return {
    additional_cpp_rows: clone(stage.additional_cpp_rows ?? []),
    additional_cqa_rows: clone(stage.additional_cqa_rows ?? []),
    analytical_methodology: clone(stage.analytical_methodology ?? []),
    sampling_plan: clone(stage.sampling_plan ?? []),
    granulation_group_sampling: clone(stage.granulation_group_sampling ?? []),
    compression_plan: clone(stage.compression_plan ?? {}),
    sampling_diagram_labels: Array.isArray(currentDiagrams)
      ? currentDiagrams
          .map((item: any) =>
            typeof item === "string"
              ? item
              : asString(item?.label ?? item?.name),
          )
          .filter(Boolean)
      : [],
  };
}
function getStageKind(
  stage: ProcedureStage | null,
): "dispensing" | "granulation" | "compression" | "normal" {
  if (!stage) return "normal";
  const title = `${stage.title ?? ""} ${stage.section_key}`.toLowerCase();
  if (title.includes("dispens")) return "dispensing";
  if (
    (Array.isArray(stage.granulation_group_sampling) &&
      stage.granulation_group_sampling.length > 0) ||
    title.includes("granulation")
  )
    return "granulation";
  if (
    (stage.compression_plan && typeof stage.compression_plan === "object") ||
    title.includes("compression")
  )
    return "compression";
  return "normal";
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
function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function Card({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="overflow-hidden rounded-card border border-border bg-surface">
      <header
        className={`flex items-center justify-between gap-3 px-4 py-3 ${open ? "border-b border-border" : ""}`}
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="text-small font-semibold">{title}</span>
          {open ? (
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
        {action}
      </header>
      {open ? <div className="p-4">{children}</div> : null}
    </section>
  );
}
function InfoSection({ title, rows }: { title: string; rows?: JsonRecord[] }) {
  return (
    <Card title={title}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-small">
          <thead className="text-micro uppercase text-subdued">
            <tr>
              {[
                ...new Set((rows ?? []).flatMap((row) => Object.keys(row))),
              ].map((key) => (
                <th key={key} className="px-2 py-2">
                  {label(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).length ? (
              rows!.map((row, i) => (
                <tr key={i} className="border-t border-border">
                  {Object.values(row).map((value, j) => (
                    <td key={j} className="px-2 py-2">
                      {display(value)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-2 py-2 text-subdued" colSpan={8}>
                  No data provided.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ParameterSection({
  title,
  sourceRows,
  rows,
  onChange,
  disabled,
}: {
  title: string;
  sourceRows?: JsonRecord[];
  rows: JsonRecord[];
  onChange: (rows: JsonRecord[]) => void;
  disabled: boolean;
}) {
  const existing = (sourceRows ?? []).map((row) =>
    asString(row.parameter).trim().toLowerCase(),
  );
  const sourceColumns = [
    ...new Set((sourceRows ?? []).flatMap((row) => Object.keys(row))),
  ];
  const duplicate = rows.some((row, index) => {
    const name = asString(row.parameter).trim().toLowerCase();
    return (
      name &&
      (existing.includes(name) ||
        rows.findIndex(
          (item) => asString(item.parameter).trim().toLowerCase() === name,
        ) !== index)
    );
  });
  return (
    <Card
      title={title}
      action={
        !disabled ? (
          <button
            type="button"
            onClick={() =>
              onChange([
                ...rows,
                {
                  parameter: "",
                  limit: "",
                  layer: "",
                  processing_step: "",
                  coating_pass: "",
                  equipment_name: "",
                  equipment_id: "",
                  source_path: "",
                },
              ])
            }
            className="inline-flex items-center gap-1 text-small font-semibold text-primary"
          >
            <Plus className="size-4" />
            Add row
          </button>
        ) : undefined
      }
    >
      {(sourceRows ?? []).length ? (
        <div className="mb-4 overflow-x-auto">
          <p className="mb-1 text-micro font-medium uppercase text-subdued">
            Backend source rows · read only
          </p>
          <table className="w-full min-w-[600px] text-left text-small">
            <thead className="text-micro uppercase text-subdued">
              <tr>
                {sourceColumns.map((key) => (
                  <th key={key} className="px-2 py-2">
                    {label(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sourceRows!.map((row, i) => (
                <tr
                  key={`src-${i}`}
                  className="border-t border-border bg-muted/30"
                >
                  {sourceColumns.map((key) => (
                    <td key={key} className="px-2 py-2">
                      {display(row[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <p className="mb-1 text-micro font-medium uppercase text-subdued">
          Additional rows
        </p>
        <table className="w-full min-w-[600px] text-left text-small">
          <thead className="text-micro uppercase text-subdued">
            <tr>
              <th className="px-2 py-2">Parameter</th>
              <th className="px-2 py-2">Limit</th>
              <th className="px-2 py-2">Processing step</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`add-${index}`} className="border-t border-border">
                <td className="px-2 py-2">
                  <input
                    disabled={disabled}
                    aria-label={`${title} parameter ${index + 1}`}
                    className={inputClass}
                    value={row.parameter ?? ""}
                    onChange={(event) =>
                      updateAt(
                        rows,
                        index,
                        { ...row, parameter: event.target.value },
                        onChange,
                      )
                    }
                    placeholder="Parameter"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    disabled={disabled}
                    className={inputClass}
                    value={row.limit ?? ""}
                    onChange={(event) =>
                      updateAt(
                        rows,
                        index,
                        { ...row, limit: event.target.value },
                        onChange,
                      )
                    }
                    placeholder="Limit"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    disabled={disabled}
                    className={inputClass}
                    value={row.processing_step ?? ""}
                    onChange={(event) =>
                      updateAt(
                        rows,
                        index,
                        { ...row, processing_step: event.target.value },
                        onChange,
                      )
                    }
                    placeholder="Processing step"
                  />
                </td>
                <td>
                  <button
                    disabled={disabled}
                    type="button"
                    title="Remove row"
                    onClick={() => onChange(rows.filter((_, i) => i !== index))}
                    className="p-2 text-danger disabled:opacity-40"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? (
          <p className="px-2 py-2 text-small text-subdued">
            No additional rows.
          </p>
        ) : null}
      </div>
      {duplicate ? (
        <p className="mt-2 text-small text-danger">
          Parameter names must be unique and cannot duplicate source rows.
        </p>
      ) : null}
    </Card>
  );
}
function AnalyticalSection({
  rows,
  onChange,
  disabled,
}: {
  rows: JsonRecord[];
  onChange: (rows: JsonRecord[]) => void;
  disabled: boolean;
}) {
  return (
    <Card
      title="Analytical Methodology"
      action={
        !disabled ? (
          <AddButton
            onClick={() =>
              onChange([...rows, { quality_attribute: "", method_name: "" }])
            }
          />
        ) : undefined
      }
    >
      <div className="grid gap-3">
        {rows.map((row, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input
              disabled={disabled}
              className={inputClass}
              aria-label="Quality attribute"
              value={row.quality_attribute ?? ""}
              onChange={(e) =>
                updateAt(
                  rows,
                  i,
                  { ...row, quality_attribute: e.target.value },
                  onChange,
                )
              }
              placeholder="Quality attribute"
            />
            <input
              disabled={disabled}
              className={inputClass}
              aria-label="Method name"
              value={row.method_name ?? ""}
              onChange={(e) =>
                updateAt(
                  rows,
                  i,
                  { ...row, method_name: e.target.value },
                  onChange,
                )
              }
              placeholder="Method name"
            />
            <button
              disabled={disabled}
              type="button"
              onClick={() => onChange(rows.filter((_, index) => i !== index))}
              className="p-2 text-danger disabled:opacity-40"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        {!rows.length ? (
          <p className="text-small text-subdued">
            No analytical methods are defined.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
function SamplingSection({
  rows,
  onChange,
  disabled,
}: {
  rows: SamplingRow[];
  onChange: (rows: SamplingRow[]) => void;
  disabled: boolean;
}) {
  return (
    <Card
      title="Sampling Plan"
      action={
        !disabled ? (
          <AddButton
            onClick={() =>
              onChange([
                ...rows,
                {
                  stage: "",
                  sample_quantity: "",
                  number_of_samples: 1,
                  test: "",
                },
              ])
            }
          />
        ) : undefined
      }
    >
      <SamplingRows rows={rows} onChange={onChange} disabled={disabled} />
    </Card>
  );
}
function SamplingRows({
  rows,
  onChange,
  disabled,
}: {
  rows: SamplingRow[];
  onChange: (rows: SamplingRow[]) => void;
  disabled: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-small">
        <thead className="text-micro uppercase text-subdued">
          <tr>
            {["Stage", "Sample quantity", "Number of samples", "Test", ""].map(
              (x) => (
                <th key={x} className="px-2 py-2">
                  {x}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? index} className="border-t border-border">
              <td className="px-2 py-2">
                <TextCell
                  value={row.stage}
                  onChange={(v) =>
                    updateAt(rows, index, { ...row, stage: v }, onChange)
                  }
                  disabled={disabled}
                />
              </td>
              <td className="px-2 py-2">
                <TextCell
                  value={row.sample_quantity}
                  onChange={(v) =>
                    updateAt(
                      rows,
                      index,
                      { ...row, sample_quantity: v },
                      onChange,
                    )
                  }
                  disabled={disabled}
                />
              </td>
              <td className="px-2 py-2">
                <TextCell
                  value={row.number_of_samples}
                  type="number"
                  onChange={(v) =>
                    updateAt(
                      rows,
                      index,
                      { ...row, number_of_samples: v },
                      onChange,
                    )
                  }
                  disabled={disabled}
                />
              </td>
              <td className="px-2 py-2">
                <TextCell
                  value={row.test}
                  onChange={(v) =>
                    updateAt(rows, index, { ...row, test: v }, onChange)
                  }
                  disabled={disabled}
                />
              </td>
              <td>
                <RemoveButton
                  disabled={disabled}
                  onClick={() => onChange(rows.filter((_, i) => i !== index))}
                />
              </td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={5} className="px-2 py-2 text-subdued">
                No sampling rows.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
function GranulationSection({
  groups,
  onChange,
  disabled,
}: {
  groups: JsonRecord[];
  onChange: (groups: JsonRecord[]) => void;
  disabled: boolean;
}) {
  return (
    <Card title="Group-wise Sampling">
      <div className="grid gap-4">
        {groups.map((group, i) => (
          <section
            key={group.key ?? i}
            className="rounded-control border border-border p-3"
          >
            <h4 className="mb-3 text-small font-semibold">{group.key}</h4>
            <SamplingRows
              rows={group.sampling_rows ?? []}
              disabled={disabled}
              onChange={(rows) =>
                updateAt(groups, i, { ...group, sampling_rows: rows }, onChange)
              }
            />
          </section>
        ))}
        {groups.length === 0 ? (
          <p className="text-small text-subdued">
            No granulation sampling groups are provided by the backend.
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function CompressionSection({
  plan,
  availableTests: stageTests,
  onChange,
  disabled,
}: {
  plan: JsonRecord;
  availableTests: string[];
  onChange: (plan: JsonRecord) => void;
  disabled: boolean;
}) {
  const availableTests: string[] = plan.available_tests ?? stageTests;
  return (
    <Card title="Compression Plan">
      <div className="grid gap-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label="Machine runtime (hours)"
            value={plan.machine_runtime_hours ?? ""}
            type="number"
            disabled={disabled}
            onChange={(v) =>
              onChange({ ...plan, machine_runtime_hours: numberOrString(v) })
            }
          />
          <Field
            label="Blend loading"
            value={plan.blend_loading ?? ""}
            disabled={disabled}
            onChange={(v) => onChange({ ...plan, blend_loading: v })}
          />
          <Field
            label="Terminology"
            value={plan.terminology ?? ""}
            disabled={disabled}
            onChange={(v) => onChange({ ...plan, terminology: v })}
          />
        </div>
        <CompressionRows
          title="Challenges"
          rows={plan.challenges ?? []}
          tests={availableTests}
          disabled={disabled}
          onChange={(rows) => onChange({ ...plan, challenges: rows })}
        />
        <CompressionRows
          title="Sampling Points"
          rows={plan.sampling_points ?? []}
          tests={availableTests}
          disabled={disabled}
          onChange={(rows) => onChange({ ...plan, sampling_points: rows })}
        />
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-small font-semibold">Acceptance Criteria</h4>
            <AddButton
              disabled={disabled}
              onClick={() =>
                onChange({
                  ...plan,
                  acceptance_criteria: [
                    ...(plan.acceptance_criteria ?? []),
                    {
                      kind: "",
                      target: "",
                      minimum: "",
                      maximum: "",
                      l1: "",
                      l2: "",
                    },
                  ],
                })
              }
            />
          </div>
          <div className="grid gap-2">
            {(plan.acceptance_criteria ?? []).map(
              (item: JsonRecord, i: number) => (
                <div
                  key={i}
                  className="grid gap-2 sm:grid-cols-[repeat(5,minmax(0,1fr))_auto]"
                >
                  {["kind", "target", "minimum", "maximum", "l1", "l2"].map(
                    (key) => (
                      <TextCell
                        key={key}
                        value={item[key] ?? ""}
                        type={
                          key === "kind" || key === "target" ? "text" : "number"
                        }
                        disabled={disabled}
                        ariaLabel={key}
                        onChange={(v) =>
                          updateAt(
                            plan.acceptance_criteria ?? [],
                            i,
                            { ...item, [key]: numberOrString(v) },
                            (value) =>
                              onChange({ ...plan, acceptance_criteria: value }),
                          )
                        }
                      />
                    ),
                  )}
                  <RemoveButton
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...plan,
                        acceptance_criteria: plan.acceptance_criteria.filter(
                          (_: unknown, j: number) => i !== j,
                        ),
                      })
                    }
                  />
                </div>
              ),
            )}
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-small font-semibold">Available Tests</h4>
          <div className="flex flex-wrap gap-2">
            {availableTests.map((test) => (
              <span
                key={test}
                className="rounded-full border border-border bg-muted px-2.5 py-1 text-micro"
              >
                {test}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
function CompressionRows({
  title,
  rows,
  tests,
  disabled,
  onChange,
}: {
  title: string;
  rows: JsonRecord[];
  tests: string[];
  disabled: boolean;
  onChange: (rows: JsonRecord[]) => void;
}) {
  const update = (i: number, value: JsonRecord) =>
    updateAt(rows, i, value, onChange);
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-small font-semibold">{title}</h4>
        <AddButton
          disabled={disabled}
          onClick={() =>
            onChange([
              ...rows,
              {
                id: crypto.randomUUID(),
                name: "",
                runtime_minutes: "",
                ipqc_lhs_quantity: "",
                ipqc_rhs_quantity: "",
                qc_quantity: "",
                ipqc_tests: [],
                qc_tests: [],
              },
            ])
          }
        />
      </div>
      <div className="grid gap-3">
        {rows.map((row, i) => (
          <div
            key={row.id ?? i}
            className="rounded-control border border-border p-3"
          >
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ["Name", "name"],
                ["Runtime (minutes)", "runtime_minutes"],
                ["IPQC LHS quantity", "ipqc_lhs_quantity"],
                ["IPQC RHS quantity", "ipqc_rhs_quantity"],
                ["QC quantity", "qc_quantity"],
              ].map(([text, key]) => (
                <Field
                  key={key}
                  label={text}
                  value={row[key] ?? ""}
                  type={key === "name" ? "text" : "number"}
                  disabled={disabled}
                  onChange={(v) =>
                    update(i, {
                      ...row,
                      [key]: key === "name" ? v : numberOrString(v),
                    })
                  }
                />
              ))}
              <div className="flex items-end justify-end">
                <RemoveButton
                  disabled={disabled}
                  onClick={() => onChange(rows.filter((_, j) => i !== j))}
                />
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TestPicker
                label="IPQC tests"
                available={tests}
                selected={row.ipqc_tests ?? []}
                disabled={disabled}
                onChange={(value) => update(i, { ...row, ipqc_tests: value })}
              />
              <TestPicker
                label="QC tests"
                available={tests}
                selected={row.qc_tests ?? []}
                disabled={disabled}
                onChange={(value) => update(i, { ...row, qc_tests: value })}
              />
            </div>
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="text-small text-subdued">
            No {title.toLowerCase()} defined.
          </p>
        ) : null}
      </div>
    </section>
  );
}
function TestPicker({
  label: title,
  available,
  selected,
  disabled,
  onChange,
}: {
  label: string;
  available: string[];
  selected: string[];
  disabled: boolean;
  onChange: (value: string[]) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-micro font-medium text-subdued">
        {title}
      </legend>
      <div className="flex max-h-28 flex-wrap gap-2 overflow-auto">
        {available.map((test) => (
          <label
            key={test}
            className="inline-flex items-center gap-1.5 rounded border border-border px-2 py-1 text-micro"
          >
            <input
              type="checkbox"
              disabled={disabled}
              checked={selected.includes(test)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, test]
                    : selected.filter((item) => item !== test),
                )
              }
            />
            {test}
          </label>
        ))}
      </div>
      {available.length === 0 ? (
        <span className="text-micro text-subdued">No tests provided.</span>
      ) : null}
    </fieldset>
  );
}

function DiagramSection({
  available,
  selected,
  onChange,
  disabled,
}: {
  available: any[];
  selected: string[];
  onChange: (labels: string[]) => void;
  disabled: boolean;
}) {
  const labels = available
    .map((item) =>
      typeof item === "string" ? item : asString(item.label ?? item.name),
    )
    .filter(Boolean);
  return (
    <Card title="Sampling Diagrams">
      <div className="flex flex-wrap gap-2">
        {labels.map((name) => (
          <label
            key={name}
            className="inline-flex items-center gap-2 rounded-control border border-border px-3 py-2 text-small"
          >
            <input
              type="checkbox"
              disabled={disabled}
              checked={selected.includes(name)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, name]
                    : selected.filter((item) => item !== name),
                )
              }
            />
            {name}
          </label>
        ))}
        {labels.length === 0 ? (
          <p className="text-small text-subdued">
            No sampling diagrams are available for this stage.
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function Preview({ value }: { value: unknown }) {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonRecord)
      : null;
  const summary =
    record?.ai_summary ?? record?.summary ?? record?.procedure_summary;
  const diagrams = collectDataUrls(value);
  const tables =
    record?.sampling_tables ?? record?.sampling_plan ?? record?.tables;
  return (
    <section className="mt-5 rounded-card border border-primary/20 bg-surface p-5">
      <h3 className="text-h3 font-semibold">Generated Preview</h3>
      {summary ? (
        <div className="mt-4">
          <h4 className="text-small font-semibold">AI Summary</h4>
          <div className="mt-1 whitespace-pre-wrap text-small">
            {typeof summary === "string"
              ? summary
              : JSON.stringify(summary, null, 2)}
          </div>
        </div>
      ) : null}
      {tables ? (
        <div className="mt-4">
          <h4 className="mb-2 text-small font-semibold">Sampling Tables</h4>
          <GeneratedTables value={tables} />
        </div>
      ) : null}
      {diagrams.length ? (
        <div className="mt-4">
          <h4 className="mb-2 text-small font-semibold">Generated Diagrams</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {diagrams.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Generated sampling diagram ${i + 1}`}
                className="max-h-[420px] w-full rounded-control border border-border object-contain"
              />
            ))}
          </div>
        </div>
      ) : null}
      {!summary && !tables && !diagrams.length ? (
        <pre className="mt-3 overflow-auto rounded-control bg-muted p-3 text-micro">
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}
function GeneratedTables({ value }: { value: unknown }) {
  const entries = Array.isArray(value)
    ? [["Sampling", value] as const]
    : value && typeof value === "object"
      ? Object.entries(value as JsonRecord)
      : [["Sampling", value] as const];
  return (
    <div className="grid gap-3">
      {entries.map(([title, rows], i) => {
        const list = Array.isArray(rows) ? rows : [rows];
        const columns = [
          ...new Set(
            list.flatMap((row) =>
              row && typeof row === "object" ? Object.keys(row) : ["value"],
            ),
          ),
        ];
        return (
          <div
            key={`${title}-${i}`}
            className="overflow-x-auto rounded-control border border-border"
          >
            <h5 className="bg-muted px-3 py-2 text-micro font-semibold">
              {label(String(title))}
            </h5>
            <table className="w-full min-w-[420px] text-left text-small">
              <thead>
                <tr>
                  {columns.map((key) => (
                    <th
                      key={key}
                      className="px-3 py-2 text-micro uppercase text-subdued"
                    >
                      {label(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-border">
                    {columns.map((key) => (
                      <td key={key} className="px-3 py-2">
                        {display(
                          row && typeof row === "object" ? row[key] : row,
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
function collectDataUrls(value: unknown): string[] {
  if (typeof value === "string")
    return value.startsWith("data:image/") ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(collectDataUrls);
  if (value && typeof value === "object")
    return Object.values(value).flatMap(collectDataUrls);
  return [];
}

function AddButton({
  onClick,
  disabled = false,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1 text-small font-semibold text-primary disabled:opacity-40"
    >
      <Plus className="size-4" />
      Add
    </button>
  );
}
function RemoveButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title="Remove row"
      onClick={onClick}
      className="p-2 text-danger disabled:opacity-40"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
function Field({
  label: title,
  value,
  type = "text",
  disabled,
  onChange,
}: {
  label: string;
  value: any;
  type?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-micro font-medium text-subdued">
      {title}
      <input
        type={type}
        disabled={disabled}
        className={`${inputClass} mt-1 w-full`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function TextCell({
  value,
  onChange,
  disabled,
  type = "text",
  ariaLabel,
}: {
  value: any;
  onChange: (value: string) => void;
  disabled: boolean;
  type?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      type={type}
      disabled={disabled}
      className={inputClass}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
function updateAt<T>(
  rows: T[],
  index: number,
  row: T,
  onChange: (rows: T[]) => void,
) {
  onChange(rows.map((current, i) => (i === index ? row : current)));
}
function numberOrString(value: string): number | string {
  return value === ""
    ? ""
    : Number.isFinite(Number(value))
      ? Number(value)
      : value;
}
function label(value: string) {
  return value.replace(/_/g, " ");
}
function display(value: any): string {
  return value == null
    ? ""
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
}
const inputClass =
  "min-w-0 rounded-control border border-border bg-surface px-3 py-2 text-small text-text outline-none focus:border-primary disabled:bg-muted disabled:text-subdued";
