import {
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronDown,
  Info,
  Loader2,
  Plus,
  SlidersHorizontal,
  SquarePen,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { useAuthStore } from "../../auth/state/auth.store";
import { getOptions, setStages } from "../../new-document/api/document.api";
import type { StageOption } from "../../new-document/api/document.types";
import { AppHeader } from "../../new-document/components/AppHeader";
import { AppSidebar } from "../../new-document/components/AppSidebar";
import { WizardHeader } from "../../new-document/components/WizardHeader";
import { useDocument } from "../../new-document/hooks/useDocument";
import { useStepNavigation } from "../../new-document/hooks/useStepNavigation";
import { getStageSchema, saveStageInputs } from "../../stage-input/api/stageInputs.api";
import type { StageForm, StageInputsResponse } from "../../stage-input/api/stageInputs.types";
import { RepeatStagePanel } from "../components/RepeatStagePanel";
import { BATCH_YIELD_KEY, repeatFor, conditionSourcesFor, setUnitValue, copyUnitValues, type RepeatValueKey } from "../model/stageRepeats";
import { StageParamPanel } from "../components/StageParamPanel";

interface StageUi {
  checked: boolean;
  /** The user has reviewed this stage's parameters and clicked Continue. */
  saved: boolean;
  open: boolean;
}

type StageValues = Record<string, Record<string, unknown>>;

export function SelectStagesPage() {
  const { documentId = "" } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { goToStep } = useStepNavigation(documentId);
  const { document, isLoading, reload } = useDocument(documentId);

  const [options, setOptions] = useState<StageOption[]>([]);
  const [schema, setSchema] = useState<StageInputsResponse | null>(null);
  const [ui, setUi] = useState<Record<string, StageUi>>({});
  const [values, setValues] = useState<StageValues>({});
  const [ready, setReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [busyStage, setBusyStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [optionsResponse, schemaResponse] = await Promise.all([
          getOptions(),
          getStageSchema(documentId),
        ]);
        if (cancelled) return;

        setOptions(optionsResponse.stages);
        setSchema(schemaResponse);

        const alreadyConfigured = document?.stages && document.stages.length > 0;
        const selectedKeys = new Set(
          alreadyConfigured ? document!.stages : optionsResponse.default_stages,
        );

        const nextUi: Record<string, StageUi> = {};
        const nextValues: StageValues = {};
        for (const form of schemaResponse.stages) {
          nextValues[form.key] = { ...form.values };
          const isSelected = selectedKeys.has(form.key);
          nextUi[form.key] = {
            checked: isSelected,
            // A stage that was already selected on a saved document counts as reviewed.
            saved: Boolean(alreadyConfigured && isSelected),
            open: false,
          };
        }
        setUi(nextUi);
        setValues(nextValues);
        setReady(true);
      } catch (caught) {
        if (!cancelled) setError(getApiErrorMessage(caught, "Could not load the stage list."));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [document, documentId]);

  const formFor = useCallback(
    (key: string): StageForm | undefined => schema?.stages.find((form) => form.key === key),
    [schema],
  );

  const reference = schema;
  const batchYieldForm = formFor(BATCH_YIELD_KEY);
  const stageOrder = options.filter((stage) => ui[stage.key]?.checked).map((stage) => stage.key);

  const setUnitFieldValue = useCallback((stage: string, valueKey: RepeatValueKey, unit: string, field: string, value: unknown) => {
    setValues((current) => setUnitValue(current, stage, valueKey, unit, field, value));
    setUi((current) => ({ ...current, [stage]: { ...current[stage], saved: false } }));
  }, []);
  const copyUnit = useCallback((stage: string, valueKey: RepeatValueKey, from: string, to: string) => {
    setValues((current) => copyUnitValues(current, stage, valueKey, from, to));
    setUi((current) => ({ ...current, [stage]: { ...current[stage], saved: false } }));
  }, []);

  const setFieldValue = useCallback((stageKey: string, fieldKey: string, value: unknown) => {
    setUi((cur) => ({ ...cur, [stageKey]: { ...cur[stageKey], saved: false } }));
    setValues((cur) => ({
      ...cur,
      [stageKey]: { ...(cur[stageKey] ?? {}), [fieldKey]: value },
    }));
  }, []);

  const toggleStage = useCallback((stageKey: string) => {
    setUi((cur) => {
      const stage = cur[stageKey];
      if (stage.checked) {
        return { ...cur, [stageKey]: { ...stage, checked: false, saved: false, open: false } };
      }
      // Selecting a stage opens it so its parameters are right there to review.
      return { ...cur, [stageKey]: { checked: true, saved: false, open: true } };
    });
  }, []);

  // One panel open at a time keeps the long list scannable.
  const expand = useCallback((key: string) => {
    setUi((cur) => {
      const opening = !cur[key].open;
      const next: Record<string, StageUi> = {};
      for (const [k, s] of Object.entries(cur)) next[k] = { ...s, open: k === key ? opening : false };
      return next;
    });
  }, []);

  // Per-stage "Continue": persist this stage (it must be in the committed selection
  // before its inputs can be saved server-side), then open its equipment / instrument
  // page. From there the user comes back here to do the next stage.
  const continueStage = useCallback(
    async (key: string) => {
      setBusyStage(key);
      setError(null);
      const selected = options.filter((option) => ui[option.key]?.checked).map((option) => option.key);
      const label = options.find((option) => option.key === key)?.label ?? key;
      try {
        await setStages(documentId, selected, {});
        for (const source of ["dispensing_rm", "dispensing_coating"]) {
          if (source !== key && selected.includes(source)) {
            await saveStageInputs(documentId, source, values[source] ?? {});
          }
        }
        await saveStageInputs(documentId, key, values[key] ?? {});
        await saveStageInputs(documentId, BATCH_YIELD_KEY, values[BATCH_YIELD_KEY] ?? {});
        navigate(
          `/documents/${encodeURIComponent(documentId)}/stage-input?stage=${encodeURIComponent(label)}`,
        );
      } catch (caught) {
        setError(getApiErrorMessage(caught, "Could not save this stage."));
      } finally {
        setBusyStage(null);
      }
    },
    [documentId, navigate, options, ui, values],
  );

  const advisories = useMemo(() => {
    const missing: string[] = [];
    for (const stage of options) {
      if (!ui[stage.key]?.checked) continue;
      for (const impliedKey of stage.implies) {
        if (!ui[impliedKey]?.checked && !missing.includes(impliedKey)) missing.push(impliedKey);
      }
    }
    const labels = missing.map((k) => options.find((o) => o.key === k)?.label ?? k);
    const text = missing.length
      ? `Coating usually needs ${labels.join(" and ")}. Add ${
          missing.length > 1 ? "them" : "it"
        } to this BMR?`
      : "";
    return { text, impliedKeys: missing };
  }, [options, ui]);

  const addImplied = useCallback(() => {
    setUi((cur) => {
      const next = { ...cur };
      for (const key of advisories.impliedKeys) next[key] = { ...next[key], checked: true };
      return next;
    });
  }, [advisories.impliedKeys]);

  const selectedKeys = useMemo(
    () => options.filter((s) => ui[s.key]?.checked).map((s) => s.key),
    [options, ui],
  );
  const pending = selectedKeys.filter((k) => !ui[k]?.saved);

  const save = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      // Commit the selection first — a stage must be selected before its inputs save.
      await setStages(documentId, selectedKeys, {});
      // Persist each selected stage's parameters (saved even if partly filled).
      for (const key of [...selectedKeys, BATCH_YIELD_KEY]) {
        await saveStageInputs(documentId, key, values[key] ?? {});
      }
      await reload();
      goToStep("generate-submit");
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not save the stage selection."));
    } finally {
      setIsSaving(false);
    }
  }, [documentId, goToStep, reload, selectedKeys, values]);

return (
    <div className="flex flex-col min-h-screen bg-background text-text">
      <AppHeader user={user} unit={user?.unitId ? { id: user.unitId } : null} />
      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />
        <main className="min-w-0 min-h-0 lg:h-full lg:overflow-y-auto">
          <div className="mx-auto space-y-5">
            <WizardHeader
              activeStepId="stages"
              completedStepIds={document?.completed_steps ?? []}
              onStepClick={goToStep}
              title="Select stage and stage inputs"
              description="Select stages and configure process inputs. Limits come from the Master Formula Card; parameters without limits are captured as 'to be recorded'."
              // identifier={document?.bmr_number ?? document?.draft_id ?? documentId}
              status="DRAFT"
              dosageForm={document?.dosage_form}
              docType={document?.doc_type}
            />

            {error ? (
              <div className="mx-8 flex items-start gap-2 rounded-panel border border-danger/30 bg-danger-soft p-4">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                <p className="text-small text-danger">{error}</p>
              </div>
            ) : null}

            {isLoading || !ready ? (
              <div className="mx-8 flex items-center justify-center gap-2 rounded-panel border border-border bg-surface p-16 text-subdued">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                <span className="text-small">Loading stages…</span>
              </div>
            ) : (
              <>
                <div className="mx-8 overflow-hidden rounded-card border border-border bg-surface">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-5 py-4">
                    <span className="text-h3 font-semibold">Manufacturing stages</span>
                    <span className="ml-auto text-micro font-medium text-subdued rounded-pill bg-muted px-3 py-1 font-mono text-mono-sm text-subdued">
                      {selectedKeys.length} of {options.length} selected
                    </span>
                  </div>

                  <div>
                    {options.map((stage, index) => (
                      <StageRow
                        key={stage.key}
                        stage={stage}
                        index={index}
                        s={ui[stage.key]}
                        form={formFor(stage.key)}
                        reference={reference}
                        values={values[stage.key] ?? {}}
                        busy={busyStage === stage.key}
                        onToggle={() => toggleStage(stage.key)}
                        onExpand={() => expand(stage.key)}
                        allValues={values}
                        stageOrder={stageOrder}
                        onFieldChange={(fieldKey, value) => setFieldValue(stage.key, fieldKey, value)}
                        onUnitFieldChange={(valueKey, unitKey, fieldKey, value) =>
                          setUnitFieldValue(stage.key, valueKey, unitKey, fieldKey, value)
                        }
                        onCopyUnit={(valueKey, fromKey, toKey) =>
                          copyUnit(stage.key, valueKey, fromKey, toKey)
                        }
                        onContinue={() => void continueStage(stage.key)}
                        onCancel={() => expand(stage.key)}
                      />
                    ))}
                  </div>

                  {advisories.text ? (
                    <div className="m-4 flex items-center gap-3 rounded-control border border-border bg-sunken p-3">
                      <Info className="size-4 shrink-0 text-subdued" aria-hidden="true" />
                      <span className="flex-1 text-small text-subdued">{advisories.text}</span>
                      <button
                        type="button"
                        onClick={addImplied}
                        className="inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-surface px-3 py-1.5 text-small font-semibold transition hover:bg-sunken"
                      >
                        <Plus className="size-4" aria-hidden="true" />
                        Add {advisories.impliedKeys.length > 1 ? "both stages" : "stage"}
                      </button>
                    </div>
                  ) : null}

                  {batchYieldForm && reference ? (
                    <div className="border-t border-border">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3">
                        <span className="text-small font-semibold">Batch yield reconciliation</span>
                      </div>
                      <div className="border-t border-dashed border-border-strong bg-background px-5 py-4">
                        <StageParamPanel
                          fields={batchYieldForm.fields}
                          values={values[BATCH_YIELD_KEY] ?? {}}
                          reference={reference}
                          onChange={(fieldKey, value) =>
                            setFieldValue(BATCH_YIELD_KEY, fieldKey, value)
                          }
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Sticky Footer moved outside the card to match Cover + BOM page */}
                <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t bg-surface p-3.5 shadow-auth">
                  <button
                    type="button"
                    onClick={() => goToStep("cover-bom")}
                    className="inline-flex items-center gap-2 rounded-control border border-border px-4 py-2 text-small font-semibold transition hover:bg-muted"
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    Back to Cover + BOM
                  </button>
                  <div className="flex flex-wrap items-center gap-3">
                    {selectedKeys.length === 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-small text-danger">
                        <AlertCircle className="size-4" aria-hidden="true" />
                        Select at least one stage.
                      </span>
                    ) : pending.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-small text-subdued">
                        <SlidersHorizontal className="size-4" aria-hidden="true" />
                        Open each stage's <b className="font-semibold">Continue</b> to set its
                        equipments and instruments.
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void save()}
                      disabled={selectedKeys.length === 0 || isSaving}
                      className="inline-flex items-center gap-2 rounded-control bg-primary px-4 py-2 text-small font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-border-strong"
                    >
                      {isSaving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                      Continue to review &amp; generate
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function StageRow({
  stage,
  index,
  s,
  form,
  reference,
  values,
  busy,
  onToggle,
  onExpand,
  onFieldChange,
  allValues,
  stageOrder,
  onUnitFieldChange,
  onCopyUnit,
  onContinue,
  onCancel,
}: {
  stage: StageOption;
  index: number;
  s: StageUi;
  form: StageForm | undefined;
  reference: StageInputsResponse | null;
  values: Record<string, unknown>;
  busy: boolean;
  onToggle: () => void;
  onExpand: () => void;
  onFieldChange: (fieldKey: string, value: unknown) => void;
  allValues: StageValues;
  stageOrder: string[];
  onUnitFieldChange: (valueKey: RepeatValueKey, unit: string, field: string, value: unknown) => void;
  onCopyUnit: (valueKey: RepeatValueKey, from: string, to: string) => void;
  onContinue: () => void;
  onCancel: () => void;
}) {
  const repeat = reference ? repeatFor(stage.key, reference, allValues) : null;
  const byUnit =
    (repeat && (values[repeat.valueKey] as Record<string, Record<string, unknown>>)) || {};

  const conditionSources = useMemo(
    () =>
      reference && s.open ? conditionSourcesFor(stage.key, reference, allValues, stageOrder) : {},
    [reference, s.open, stage.key, allValues, stageOrder],
  );

  return (
    <div className={`border-b border-sunken last:border-b-0 ${s.open ? "bg-accent-soft/50" : ""}`}>
      <div className="relative flex items-center gap-3 px-5">
        {s.checked ? (
          <span className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-primary" aria-hidden="true" />
        ) : null}
        <span className="w-5 shrink-0 text-right text-micro font-mono text-mono-sm tabular-nums text-subdued">
          {String(index + 1).padStart(2, "0")}
        </span>

        {/* Checkbox stands on its own — clicking it (and only it) toggles selection. */}
        <span className="relative size-[18px] shrink-0">
          <input
            type="checkbox"
            checked={s.checked}
            onChange={onToggle}
            className="size-[18px] appearance-none rounded border border-border-strong bg-surface checked:border-primary checked:bg-primary"
          />
          {s.checked ? (
            <Check
              className="pointer-events-none absolute inset-0 m-auto size-3 text-white"
              strokeWidth="3"
            />
          ) : null}
        </span>

        {/* Clicking the row label (and the rest of the row) toggles expand/collapse,
            NOT the checkbox. */}
        <button
          type="button"
          onClick={onExpand}
          disabled={!s.checked}
          className="flex flex-1 cursor-pointer items-center text-left min-h-[60px] disabled:cursor-not-allowed"
        >
          <span className={`text-small font-semibold ${!s.checked ? "text-subdued" : "text-text"}`}>
            {stage.label}
          </span>
        </button>

        <div className="flex items-center gap-2">
          {s.checked ? (
            s.saved ? (
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-[#15803D]/25 bg-[#E2F4E9] px-2 py-1 text-micro font-medium text-[#15803D]">
                <Check className="size-3.5" aria-hidden="true" />
                Reviewed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-[#B57614]/30 bg-[#FBEEDA] px-2 py-1 text-micro font-medium text-[#B57614]">
                <SquarePen className="size-3.5" aria-hidden="true" />
                Review params
              </span>
            )
          ) : null}
          {/* Always render the chevron, but disable it when the stage is not selected. */}
          <button
            type="button"
            onClick={onExpand}
            disabled={!s.checked}
            aria-expanded={s.open}
            title={s.checked ? "Set parameters" : "Select this stage to set parameters"}
            className="flex size-8 items-center justify-center rounded-control border border-border bg-surface transition hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface"
          >
            <ChevronDown
              className={`size-4 text-subdued transition ${s.open ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {s.checked && s.open ? (
        <div className="border-t border-dashed border-border-strong bg-background px-5 py-4">
          {form && reference && form.fields.length > 0 ? (
            repeat ? (
              <RepeatStagePanel
                axis={repeat.axis}
                slots={repeat.slots}
                fields={form.fields}
                reference={reference}
                byUnit={byUnit}
                conditionSources={conditionSources}
                onUnitFieldChange={(unitKey, fieldKey, value) =>
                  onUnitFieldChange(repeat.valueKey, unitKey, fieldKey, value)
                }
                onCopyUnit={(fromKey, toKey) => onCopyUnit(repeat.valueKey, fromKey, toKey)}
              />
            ) : (
              <StageParamPanel
                fields={form.fields}
                values={values}
                reference={reference}
                conditionSources={conditionSources}
                onChange={onFieldChange}
              />
            )
          ) : (
            <p className="text-small text-subdued">No parameters for this stage.</p>
          )}

          <div className="mt-4 flex items-center gap-3">
            <div className="ml-auto flex gap-2.5">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex h-8 items-center rounded-control px-3 text-small font-semibold text-subdued transition hover:bg-sunken"
              >
                Collapse
              </button>
              <button
                type="button"
                onClick={onContinue}
                disabled={busy}
                className="inline-flex h-8 items-center gap-1.5 rounded-control bg-primary px-3 text-small font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowRight className="size-4" aria-hidden="true" />
                )}
                Continue to stage params
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}