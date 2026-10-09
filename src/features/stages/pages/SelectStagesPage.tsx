import {
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronDown,
  Loader2,
  SlidersHorizontal,
  SquarePen,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { useAuthStore } from "../../auth/state/auth.store";
import { generateDocument } from "../../generate/api/generate.api";
import { getStages, setStages } from "../../new-document/api/document.api";
import type { StageOption } from "../../new-document/api/document.types";
import { AppHeader } from "../../new-document/components/AppHeader";
import { AppSidebar } from "../../new-document/components/AppSidebar";
import { WizardHeader } from "../../new-document/components/WizardHeader";
import { useDocument } from "../../new-document/hooks/useDocument";
import { useStepNavigation } from "../../new-document/hooks/useStepNavigation";
import { getStageForm, saveStageInputs } from "../../stage-input/api/stageInputs.api";
import type { StageForm } from "../../stage-input/api/stageInputs.types";
import { SchemaStagePanel } from "../../stage-input/components/SchemaStagePanel";
import { schemaHasAssetInputs, validateSchema } from "../../stage-input/model/schemaForm";

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
  const { document, isLoading } = useDocument(documentId);

  const [options, setOptions] = useState<StageOption[]>([]);
  const [forms, setForms] = useState<Record<string, StageForm>>({});
  const [ui, setUi] = useState<Record<string, StageUi>>({});
  const [values, setValues] = useState<StageValues>({});
  const [ready, setReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [busyStage, setBusyStage] = useState<string | null>(null);
  const [loadingSchemas, setLoadingSchemas] = useState<Record<string, boolean>>({});
  const [schemaErrors, setSchemaErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const stageLoadPromises = useRef<Partial<Record<string, Promise<StageForm>>>>({});

  useEffect(() => {
    let cancelled = false;

    if (!document?.dosage_form || !document.doc_type) return;
    setReady(false);
    setError(null);
    void (async () => {
      try {
        const stagesResponse = await getStages(document.dosage_form!, document.doc_type!);
        if (cancelled) return;
        if (!stagesResponse.supported) throw new Error(stagesResponse.message || "This document type is not supported.");
        setOptions(stagesResponse.stages);
        setForms({});
        setValues({});

        const alreadyConfigured = document?.stages && document.stages.length > 0;
        const selectedKeys = new Set(
          alreadyConfigured ? document!.stages : [],
        );

        const nextUi: Record<string, StageUi> = {};
        for (const stage of stagesResponse.stages) {
          const isSelected = selectedKeys.has(stage.key);
          nextUi[stage.key] = {
            checked: isSelected,
            // A stage that was already selected on a saved document counts as reviewed.
            saved: Boolean(alreadyConfigured && isSelected),
            open: false,
          };
        }
        setUi(nextUi);
        setReady(true);
      } catch (caught) {
        if (!cancelled) setError(getApiErrorMessage(caught, "Could not load the stage list."));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [document, documentId]);

  const formFor = useCallback((key: string) => forms[key], [forms]);

  const ensureStageLoaded = useCallback(async (key: string): Promise<StageForm> => {
    if (forms[key]) return forms[key];
    if (stageLoadPromises.current[key]) return stageLoadPromises.current[key];
    const stage = options.find((option) => option.key === key);
    if (!stage || !document?.dosage_form || !document.doc_type) throw new Error("Document stage context is unavailable.");
    const productType = document.dosage_form;
    const docType = document.doc_type;
    setLoadingSchemas((current) => ({ ...current, [key]: true }));
    setSchemaErrors((current) => ({ ...current, [key]: "" }));
    const request = (async () => {
      const form = await getStageForm(documentId, key, stage.label, productType, docType, {
        layers: document.layers,
        coatingTypes: document.coating_types,
      });
      setForms((current) => ({ ...current, [key]: form }));
      setValues((current) => ({ ...current, [key]: form.values }));
      return form;
    })();
    stageLoadPromises.current[key] = request;
    try {
      return await request;
    } catch (caught) {
      const message = getApiErrorMessage(caught, `Could not load inputs for ${stage.label}.`);
      setSchemaErrors((current) => ({ ...current, [key]: message }));
      throw caught;
    } finally {
      delete stageLoadPromises.current[key];
      setLoadingSchemas((current) => ({ ...current, [key]: false }));
    }
  }, [document, documentId, forms, options]);

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
        await setStages(documentId, selected);
        const form = await ensureStageLoaded(key);
        const problems = form.schema ? validateSchema(form.schema, values[key] ?? form.values, {
          stageKey: key,
          layers: document?.layers,
        }) : [];
        if (problems.length) throw new Error(problems[0]);
        await saveStageInputs(documentId, key, values[key] ?? form.values, form.schema);
        setUi((current) => ({ ...current, [key]: { ...current[key], saved: true, open: false } }));
        const hasAssetInputs = Boolean(form.schema && schemaHasAssetInputs(form.schema));
        if (!hasAssetInputs) return;
        navigate(
          `/documents/${encodeURIComponent(documentId)}/stage-input?stage=${encodeURIComponent(key)}&label=${encodeURIComponent(label)}`,
        );
      } catch (caught) {
        setError(getApiErrorMessage(caught, "Could not save this stage."));
      } finally {
        setBusyStage(null);
      }
    },
    [document?.layers, documentId, ensureStageLoaded, navigate, options, ui, values],
  );

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
      await setStages(documentId, selectedKeys);
      // Every selected stage is schema-backed before advancing; already-loaded stages reuse their cache.
      for (const key of selectedKeys) {
        const form = forms[key] ?? await ensureStageLoaded(key);
        if (!form.schema) continue;
        const problems = validateSchema(form.schema, values[key] ?? form.values, {
          stageKey: key,
          layers: document?.layers,
        });
        if (problems.length) throw new Error(`${form.label}: ${problems[0]}`);
        await saveStageInputs(documentId, key, values[key] ?? form.values, form.schema);
      }
      // Start the build only after every selected stage has been validated and saved.
      // The Generate page takes over by polling progress, then loads the preview on completion.
      await generateDocument(documentId);
      goToStep("generate-submit");
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not save the stage selection."));
    } finally {
      setIsSaving(false);
    }
  }, [document?.layers, documentId, ensureStageLoaded, forms, goToStep, selectedKeys, values]);

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
                        values={values[stage.key] ?? {}}
                        busy={busyStage === stage.key}
                        loading={Boolean(loadingSchemas[stage.key])}
                        loadError={schemaErrors[stage.key]}
                        layers={
                          stage.key === "dispensing_coating"
                            ? document?.coating_types ?? []
                            : document?.layers ?? []
                        }
                        onToggle={() => {
                          toggleStage(stage.key);
                          if (!ui[stage.key]?.checked) void ensureStageLoaded(stage.key).catch(() => undefined);
                        }}
                        onExpand={() => {
                          expand(stage.key);
                          if (!ui[stage.key]?.open) void ensureStageLoaded(stage.key).catch(() => undefined);
                        }}
                        onFieldChange={(fieldKey, value) => setFieldValue(stage.key, fieldKey, value)}
                        onContinue={() => void continueStage(stage.key)}
                        onCancel={() => expand(stage.key)}
                      />
                    ))}
                  </div>

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
  values,
  busy,
  loading,
  loadError,
  layers,
  onToggle,
  onExpand,
  onFieldChange,
  onContinue,
  onCancel,
}: {
  stage: StageOption;
  index: number;
  s: StageUi;
  form: StageForm | undefined;
  values: Record<string, unknown>;
  busy: boolean;
  loading: boolean;
  loadError?: string;
  layers: string[];
  onToggle: () => void;
  onExpand: () => void;
  onFieldChange: (fieldKey: string, value: unknown) => void;
  onContinue: () => void;
  onCancel: () => void;
}) {
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
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-small text-subdued"><Loader2 className="size-4 animate-spin" />Loading stage schema and saved values…</div>
          ) : loadError ? (
            <div className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger-soft p-3 text-small text-danger"><AlertCircle className="mt-0.5 size-4 shrink-0" />{loadError}</div>
          ) : form?.schema ? (
            <SchemaStagePanel
              schema={form.schema}
              values={values}
              layers={layers}
              stageKey={stage.key}
              scopeLabel={stage.key === "dispensing_coating" ? "Coating type" : "Layer"}
              showScopeSelection={false}
              onChange={onFieldChange}
            />
          ) : (
            <p className="text-small text-subdued">Open this stage again to load its inputs.</p>
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
                disabled={busy || loading || Boolean(loadError) || !form?.schema}
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
