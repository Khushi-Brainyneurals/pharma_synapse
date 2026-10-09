import { AlertCircle, ArrowLeft, Check, ChevronDown, Loader2, Plus, Save, Wrench, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { useAuthStore } from "../../auth/state/auth.store";
import { AppHeader } from "../../new-document/components/AppHeader";
import { AppSidebar } from "../../new-document/components/AppSidebar";
import { WizardFooter } from "../../new-document/components/WizardFooter";
import { useDocument } from "../../new-document/hooks/useDocument";
import { useStepNavigation } from "../../new-document/hooks/useStepNavigation";
import {
  cppMeta,
  getMasterData,
  type EquipmentEntry,
  type EquipmentMaster,
  type InstrumentMaster,
  type MasterData,
} from "../api/masterData";
import { getStageForm, saveStageInputs } from "../api/stageInputs.api";
import type { StageForm } from "../api/stageInputs.types";
import {
  collectStageAssetScopes,
  resolveSchema,
  type StageAssetScope,
} from "../model/schemaForm";
import {
  areCppValuesComplete,
  areScopedCppValuesComplete,
} from "../model/cppValidation";
import { filterByStage } from "../model/stageMatch";

type Mode = "equipment" | "instrument";

export function StageInputPage() {
  const { documentId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const forStage = searchParams.get("stage") ?? "";
  const stageLabel = searchParams.get("label") ?? forStage.replace(/_/g, " ");
  const user = useAuthStore((state) => state.user);
  const { goToStep } = useStepNavigation(documentId);
  const { document: documentState } = useDocument(documentId);

  const [master, setMaster] = useState<MasterData | null>(null);
  const [stageForm, setStageForm] = useState<StageForm | null>(null);
  const [entries, setEntries] = useState<EquipmentEntry[]>([]);
  const [activeScopeKey, setActiveScopeKey] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The current draft entry being built in the form.
  const [mode, setMode] = useState<Mode>("equipment");
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  // The processing sub-stage chosen for the machine (equipment only), e.g. "Wet Granulation".
  const [procStage, setProcStage] = useState("");
  const [cpp, setCpp] = useState<Record<string, string>>({});
  const [cppByScope, setCppByScope] = useState<Record<string, Record<string, string>>>({});
  const [activeCppScopeKey, setActiveCppScopeKey] = useState("");
  const [layer, setLayer] = useState("");

  const assetScopes = useMemo(
    () => stageForm?.schema
      ? collectStageAssetScopes(stageForm.schema, stageForm.values)
      : [],
    [stageForm],
  );
  const coatingScopes = useMemo(
    () => assetScopes.filter((scope) => scope.key.startsWith("coat:")),
    [assetScopes],
  );
  const isCoatingScoped = coatingScopes.length > 0;
  const activeScope = assetScopes.find((scope) => scope.key === activeScopeKey) ?? assetScopes[0];
  const activeCppScope = coatingScopes.find((scope) => scope.key === activeCppScopeKey)
    ?? coatingScopes[0];
  const supportsEquipment = Boolean(activeScope?.schema.properties?.equipment_list);
  const supportsInstrument = Boolean(activeScope?.schema.properties?.instrument_list);
  const equipmentItemSchema = stageForm?.schema && activeScope?.schema.properties?.equipment_list?.items
    ? resolveSchema(stageForm.schema, activeScope.schema.properties.equipment_list.items)
    : null;
  const instrumentItemSchema = stageForm?.schema && activeScope?.schema.properties?.instrument_list?.items
    ? resolveSchema(stageForm.schema, activeScope.schema.properties.instrument_list.items)
    : null;
  const equipmentHasProcessing = Boolean(
    equipmentItemSchema?.properties?.processing_step || equipmentItemSchema?.properties?.cpp_values,
  );
  const supportsLayer = Boolean((mode === "equipment" ? equipmentItemSchema : instrumentItemSchema)?.properties?.layer);

  useEffect(() => {
    let cancelled = false;
    if (!documentState?.dosage_form || !documentState.doc_type || !forStage) return;
    const productType = documentState.dosage_form;
    const docType = documentState.doc_type;
    setIsLoading(true);
    setError(null);
    setMaster(null);
    setStageForm(null);
    setEntries([]);
    setActiveScopeKey("");
    setName("");
    setId("");
    setProcStage("");
    setCpp({});
    setCppByScope({});
    setActiveCppScopeKey("");
    setLayer("");
    void (async () => {
      try {
        const [md, form] = await Promise.all([
          getMasterData(),
          getStageForm(documentId, forStage, stageLabel, productType, docType, {
            layers: documentState.layers,
            coatingTypes: documentState.coating_types,
          }),
        ]);
        if (cancelled) return;
        setMaster(md);
        setStageForm(form);
        const masterErrors = [
          md.errors.equipments
            ? getApiErrorMessage(md.errors.equipments, "Could not load equipment master data.")
            : "",
          md.errors.instruments
            ? getApiErrorMessage(md.errors.instruments, "Could not load instrument master data.")
            : "",
        ].filter(Boolean);
        setError(masterErrors.length ? masterErrors.join(" ") : null);
        const scopes = form.schema ? collectStageAssetScopes(form.schema, form.values) : [];
        const selectionScope = scopes.find((scope) => scope.key === "stage") ?? scopes[0];
        const firstCoatingScope = scopes.find((scope) => scope.key.startsWith("coat:"));
        setActiveScopeKey(selectionScope?.key || "");
        setActiveCppScopeKey(firstCoatingScope?.key || "");
        setEntries(scopes.flatMap((scope) => entriesFromScope(scope, form.values, forStage)));
        const firstMode = selectionScope?.schema.properties?.equipment_list ? "equipment" : "instrument";
        setMode(firstMode);
      } catch (caught) {
        if (!cancelled) setError(getApiErrorMessage(caught, "Could not load the master data."));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId, documentState?.dosage_form, documentState?.doc_type, forStage, stageLabel]);

  const filteredEquipment = useMemo(
    () => filterByStage(master?.equipments ?? [], stageLabel),
    [master, stageLabel],
  );
  const filteredInstruments = useMemo(
    () => filterByStage(master?.instruments ?? [], stageLabel),
    [master, stageLabel],
  );

  // Names can occur in multiple stages and under multiple IDs. Work only with the rows
  // filtered by the human-readable stage label, then resolve the exact selected ID.
  const equipment = useMemo<EquipmentMaster | null>(
    () =>
      mode === "equipment"
        ? filteredEquipment.find(
            (row) => row.name_of_machine === name && (!id || row.machine_id_no === id),
          ) ?? null
        : null,
    [filteredEquipment, mode, name, id],
  );
  const instrument = useMemo<InstrumentMaster | null>(
    () =>
      mode === "instrument"
        ? filteredInstruments.find(
            (row) => row.name_of_instrument === name && (!id || row.instrument_id_no === id),
          ) ?? null
        : null,
    [filteredInstruments, mode, name, id],
  );

  // Both selectors use only rows whose backend `stage` contains the current stage label.
  const nameOptions = useMemo(() => {
    if (mode === "equipment") {
      return [...new Set(filteredEquipment.map((row) => row.name_of_machine))];
    }
    return [...new Set(filteredInstruments.map((row) => row.name_of_instrument))];
  }, [filteredEquipment, filteredInstruments, mode]);

  const idOptions = useMemo(() => {
    if (mode === "equipment") {
      return filteredEquipment
        .filter((row) => row.name_of_machine === name)
        .map((row) => row.machine_id_no)
        .filter((value, index, values) => values.indexOf(value) === index);
    }
    return filteredInstruments
      .filter((row) => row.name_of_instrument === name)
      .map((row) => row.instrument_id_no)
      .filter((value, index, values) => values.indexOf(value) === index);
  }, [filteredEquipment, filteredInstruments, mode, name]);

  const stages = equipment?.steps.map((item) => ({ stage: item.step, cpps: item.cpp })) ?? [];
  const cpps = stages.find((s) => s.stage === procStage)?.cpps ?? [];
  const currentCpp = isCoatingScoped
    ? cppByScope[activeCppScope?.key || ""] ?? {}
    : cpp;
  const cppComplete = isCoatingScoped
    ? areScopedCppValuesComplete(
        cpps,
        coatingScopes.map((scope) => scope.key),
        cppByScope,
      )
    : areCppValuesComplete(cpps, cpp);

  const resetForm = useCallback((keepMode = true) => {
    if (!keepMode) setMode("equipment");
    setName("");
    setId("");
    setProcStage("");
    setCpp({});
    setCppByScope({});
    setLayer("");
  }, []);

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    setName("");
    setId("");
    setProcStage("");
    setCpp({});
    setCppByScope({});
    setLayer("");
  }, []);

  const switchScope = useCallback((scope: StageAssetScope) => {
    setActiveScopeKey(scope.key);
    setMode(scope.schema.properties?.equipment_list ? "equipment" : "instrument");
    setName("");
    setId("");
    setProcStage("");
    setCpp({});
    setCppByScope({});
    setLayer("");
  }, []);

  const chooseName = useCallback((value: string) => {
    setName(value);
    setId("");
    setProcStage("");
    setCpp({});
    setCppByScope({});
  }, []);

  const chooseId = useCallback((value: string) => {
    setId(value);
    setProcStage("");
    setCpp({});
    setCppByScope({});
  }, []);

  const canAdd = mode === "equipment"
    ? Boolean(name && id && (!equipmentHasProcessing || procStage) && cppComplete)
    : Boolean(name && id);
  const hasDraftValues = Boolean(
    name
      || id
      || procStage
      || layer
      || Object.values(cpp).some((value) => value.trim())
      || Object.values(cppByScope).some((values) =>
        Object.values(values).some((value) => value.trim()),
      ),
  );
  const hasIncompleteDraft = hasDraftValues && !canAdd;

  // Coating stores one schema row per coating type, but presents the shared selection once.
  const visibleEntries = useMemo(() => {
    const candidates = entries.map((entry, index) => ({ entry, index })).filter(
      ({ entry }) => entry.mode === mode
        && (isCoatingScoped ? entry.scope?.startsWith("coat:") : entry.scope === activeScope?.key),
    );
    if (!isCoatingScoped) return candidates;
    const seen = new Set<string>();
    return candidates.filter(({ entry }) => {
      const key = entryIdentity(entry);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [entries, mode, isCoatingScoped, activeScope?.key]);
  const recordedCount = useMemo(
    () => isCoatingScoped
      ? new Set(entries.map(entryIdentity)).size
      : entries.length,
    [entries, isCoatingScoped],
  );

  const buildDraftEntries = useCallback(
    (): EquipmentEntry[] => {
      const scopes = isCoatingScoped
        ? assetScopes
        : activeScope
          ? [activeScope]
          : [];
      return scopes.map((scope) => mode === "equipment"
        ? {
            mode,
            name,
            id,
            layer,
            stage: forStage,
            proc_stage: procStage,
            cpp: isCoatingScoped ? cppByScope[scope.key] ?? {} : cpp,
            scope: scope.key,
          }
        : {
            mode,
            name,
            id,
            layer,
            stage: forStage,
            proc_stage: "",
            cpp: {},
            scope: scope.key,
          });
    }, [
      activeScope,
      assetScopes,
      cpp,
      cppByScope,
      forStage,
      id,
      isCoatingScoped,
      layer,
      mode,
      name,
      procStage,
    ],
  );

  const addEntry = useCallback(() => {
    if (!canAdd) return;
    setEntries((cur) => [...cur, ...buildDraftEntries()]);
    resetForm();
  }, [canAdd, buildDraftEntries, resetForm]);

  const removeEntry = useCallback((index: number) => {
    setEntries((cur) => {
      const target = cur[index];
      if (!target || !isCoatingScoped) return cur.filter((_, i) => i !== index);
      const identity = entryIdentity(target);
      return cur.filter((entry) => entryIdentity(entry) !== identity);
    });
  }, [isCoatingScoped]);

  // Persist everything recorded so far, folding an unsaved-but-complete draft in so
  // nothing is silently lost. Returns the full saved list.
  const persistAll = useCallback(async (): Promise<EquipmentEntry[]> => {
    if (hasIncompleteDraft) {
      throw new Error("Complete every required equipment, processing stage, and CPP value before saving.");
    }
    const all = [...entries, ...(canAdd ? buildDraftEntries() : [])];
    if (!stageForm?.schema) throw new Error("Stage schema is not loaded.");
    const toPayloadRow = (entry: EquipmentEntry) => ({
      name: entry.name,
      id: entry.id,
      layer: entry.layer || "",
      stage: entry.stage,
      processing_step: entry.proc_stage,
      cpp_values: entry.cpp,
    });
    const nextValues = structuredClone(stageForm.values);
    for (const scope of assetScopes) {
      const target = objectAtPath(nextValues, scope.path);
      if (scope.schema.properties?.equipment_list) {
        target.equipment_list = all
          .filter((entry) => entry.scope === scope.key && entry.mode === "equipment")
          .map(toPayloadRow);
      }
      if (scope.schema.properties?.instrument_list) {
        target.instrument_list = all
          .filter((entry) => entry.scope === scope.key && entry.mode === "instrument")
          .map(toPayloadRow);
      }
    }
    await saveStageInputs(documentId, forStage, nextValues, stageForm.schema);
    setStageForm({ ...stageForm, values: nextValues, has_saved_values: true });
    return all;
  }, [entries, canAdd, hasIncompleteDraft, buildDraftEntries, documentId, forStage, stageForm, assetScopes]);

  // Save and STAY — persist, keep the saved list, and clear the form so the user can
  // record another equipment / instrument for this stage.
  const saveStay = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      setEntries(await persistAll());
      resetForm();
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not save the stage inputs."));
    } finally {
      setIsSaving(false);
    }
  }, [persistAll, resetForm]);

  // Save and return to Select stages.
  const save = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      await persistAll();
      goToStep("stages");
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not save the stage inputs."));
    } finally {
      setIsSaving(false);
    }
  }, [persistAll, goToStep]);

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader user={user} unit={user?.unitId ? { id: user.unitId } : null} />
      <div className="flex">
        <AppSidebar user={user} />
        <main className="min-w-0 flex-1 p-4 lg:p-6">
          <div className="mx-auto max-w-3xl space-y-5">
            <header className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <button
                  type="button"
                  onClick={() => goToStep("stages")}
                  className="mb-2 inline-flex items-center gap-1.5 text-small font-semibold text-primary transition hover:text-primary-dark"
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Back to select stages
                </button>
                <h1 className="text-h1 font-semibold">
                  Equipment &amp; instruments
                  {forStage ? <span className="text-subdued"> — {stageLabel}</span> : null}
                </h1>
                <p className="mt-1 max-w-xl text-small text-subdued">
                  Record the equipment and instruments used{forStage ? ` for ${stageLabel}` : ""}. Pick
                  one, load its details and CPP values from the master, and add it — repeat for each,
                  then go back to select stages.
                </p>
              </div>
              {documentState?.bmr_number ? (
                <span className="rounded-pill bg-accent-soft px-3 py-1.5 font-mono text-micro text-primary-dark">
                  {documentState.bmr_number}
                </span>
              ) : null}
            </header>

            {error ? (
              <div className="flex items-start gap-2 rounded-panel border border-danger/30 bg-danger-soft p-4">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                <p className="text-small text-danger">{error}</p>
              </div>
            ) : null}

            {isLoading ? (
              <div className="flex items-center justify-center gap-2 rounded-panel border border-border bg-surface p-16 text-subdued">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                <span className="text-small">Loading master data…</span>
              </div>
            ) : (
              <>
                {assetScopes.length > 1 && !isCoatingScoped ? (
                  <section className="rounded-card border border-border bg-surface p-4">
                    <p className="mb-2 text-micro font-bold uppercase tracking-wide text-subdued">
                      Applies to
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {assetScopes.map((scope) => (
                        <button
                          key={scope.key}
                          type="button"
                          onClick={() => switchScope(scope)}
                          className={`rounded-pill border px-4 py-1.5 text-small font-semibold capitalize transition ${
                            activeScope?.key === scope.key
                              ? "border-primary bg-primary text-white"
                              : "border-border-strong bg-surface text-subdued hover:border-primary hover:text-primary-dark"
                          }`}
                        >
                          {scope.label}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                {visibleEntries.length > 0 ? (
                  <section className="overflow-hidden rounded-card border border-border bg-surface">
                    <div className="border-b border-border px-5 py-3 text-small font-semibold capitalize">
                      Added {mode} · {visibleEntries.length}
                    </div>
                    <ul className="divide-y divide-sunken">
                      {visibleEntries.map(({ entry, index }) => (
                        <li key={index} className="flex items-center gap-3 px-5 py-3">
                          <Wrench className="size-4 shrink-0 text-subdued" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-small font-semibold">
                              {entry.name}{" "}
                              <span className="font-mono text-micro text-subdued">{entry.id}</span>
                            </p>
                            <p className="truncate text-micro text-subdued">
                              {entry.mode === "equipment"
                                ? `${entry.stage}${
                                    entry.proc_stage ? ` · ${cleanStageName(entry.proc_stage)}` : ""
                                  }${
                                    isCoatingScoped
                                      ? ` · ${coatingScopes.length} coating type${coatingScopes.length === 1 ? "" : "s"}`
                                      : Object.keys(entry.cpp).length
                                      ? ` · ${Object.keys(entry.cpp).length} CPP`
                                      : ""
                                  }`
                                : `Instrument · ${entry.stage || "—"}`}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeEntry(index)}
                            title="Remove"
                            className="flex size-8 items-center justify-center rounded-control text-subdued transition hover:bg-sunken hover:text-danger"
                          >
                            <X className="size-4" aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {assetScopes.length === 0 ? (
                  <div className="rounded-card border border-border bg-surface p-5 text-small text-subdued">
                    This stage does not define equipment or instrument inputs.
                  </div>
                ) : null}

                {/* type toggle */}
                {supportsEquipment || supportsInstrument ? <div className="inline-flex rounded-pill border border-border bg-sunken p-0.5">
                  {(["equipment", "instrument"] as Mode[]).filter((m) => m === "equipment" ? supportsEquipment : supportsInstrument).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => switchMode(m)}
                      className={`rounded-pill px-5 py-1.5 text-small font-semibold capitalize transition ${
                        mode === m ? "bg-primary text-white shadow-sm" : "text-subdued"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div> : null}

                {/* selection */}
                {supportsEquipment || supportsInstrument ? <section className="rounded-card border border-border bg-surface p-5">
                  <h2 className="mb-4 text-micro font-bold uppercase tracking-wide text-subdued">
                    {mode === "equipment" ? "Equipment" : "Instrument"} selection
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Combo
                      label={`${mode === "equipment" ? "Equipment" : "Instrument"} name`}
                      value={name}
                      options={nameOptions}
                      onChange={chooseName}
                      emptyText={
                        mode === "equipment"
                          ? "No equipment available for this stage"
                          : "No instruments available for this stage"
                      }
                    />
                    <Combo
                      label={`${mode === "equipment" ? "Equipment" : "Instrument"} ID`}
                      value={id}
                      options={idOptions}
                      onChange={chooseId}
                    />
                  </div>
                  {supportsLayer && (documentState?.layers?.length || 0) > 1 ? (
                    <div className="mt-4 max-w-sm">
                      <Combo label="Layer (optional — blank applies to all)" value={layer} options={["", ...(documentState?.layers || [])]} onChange={setLayer} />
                    </div>
                  ) : null}

                  {mode === "equipment" && equipment ? (
                    <DetailBox
                      items={[
                        ["Stage", equipment.stage || "—"],
                        ["Capacity", equipment.capacity],
                        ["Working capacity", equipment.working_capacity],
                      ]}
                    />
                  ) : null}
                  {mode === "instrument" && instrument ? (
                    <DetailBox
                      items={[["Stage", instrument.stage || "—"]]}
                    />
                  ) : null}
                </section> : null}

                {/* processing stage (equipment only) */}
                {mode === "equipment" && equipmentHasProcessing ? (
                  <section className="rounded-card border border-border bg-surface p-5">
                    <h2 className="mb-3 text-micro font-bold uppercase tracking-wide text-subdued">
                      Processing stage
                    </h2>
                    {!equipment ? (
                      <p className="text-small italic text-subdued">
                        Select equipment above to load its stages.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {stages.map((s) => (
                          <button
                            key={s.stage}
                            type="button"
                            onClick={() => {
                              setProcStage(s.stage);
                              setCpp({});
                               setCppByScope({});
                            }}
                            className={`rounded-pill border px-4 py-1.5 text-small font-medium transition ${
                              procStage === s.stage
                                ? "border-primary bg-primary text-white"
                                : "border-border-strong bg-surface text-subdued hover:border-primary hover:text-primary-dark"
                            }`}
                          >
                            {cleanStageName(s.stage)}
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                ) : null}

                {/* CPP (equipment only) */}
                {mode === "equipment" && equipmentHasProcessing ? (
                  <section className="rounded-card border border-border bg-surface p-5">
                    <div className="mb-3 flex items-baseline gap-2">
                      <h2 className="text-small font-semibold">Critical process parameters</h2>
                      {procStage ? (
                        <span className="font-mono text-micro text-subdued">
                          {name} · {cleanStageName(procStage)}
                        </span>
                      ) : null}
                    </div>
                    {isCoatingScoped ? (
                      <div className="mb-4 border-b border-border">
                        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Coating type">
                          {coatingScopes.map((scope) => (
                            <button
                              key={scope.key}
                              type="button"
                              role="tab"
                              aria-selected={activeCppScope?.key === scope.key}
                              onClick={() => setActiveCppScopeKey(scope.key)}
                              className={`border-b-2 px-4 py-2 text-small font-semibold capitalize transition ${
                                activeCppScope?.key === scope.key
                                  ? "border-primary text-primary-dark"
                                  : "border-transparent text-subdued hover:border-border-strong hover:text-text"
                              }`}
                            >
                              {scope.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {!equipment ? (
                      <p className="text-small italic text-subdued">
                        Select equipment, then a stage, to record CPP values.
                      </p>
                    ) : !procStage ? (
                      <p className="text-small italic text-subdued">
                        Select a stage above to load its parameters.
                      </p>
                    ) : cpps.length === 0 ? (
                      <p className="text-small italic text-subdued">No CPP recorded for this stage.</p>
                    ) : (
                      <div>
                        {cpps.map((param) => {
                          const meta = cppMeta(param);
                          return (
                            <div
                              key={param}
                              className="grid grid-cols-1 items-center gap-3 border-t border-border py-3 first:border-t-0 sm:grid-cols-[1fr_210px]"
                            >
                              <span className="flex flex-wrap items-center gap-2 text-small">
                                {param}
                                <span className="text-danger" aria-hidden="true">*</span>
                                {meta.unit ? (
                                  <span className="rounded-sm bg-sunken px-1.5 py-0.5 font-mono text-micro text-subdued">
                                    {meta.unit}
                                  </span>
                                ) : null}
                              </span>
                              <input
                                type="text"
                                inputMode="decimal"
                                required
                                aria-required="true"
                                value={currentCpp[param] ?? ""}
                                placeholder={meta.ex ? `EX: ${meta.ex}` : "Enter value"}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (isCoatingScoped && activeCppScope) {
                                    setCppByScope((current) => ({
                                      ...current,
                                      [activeCppScope.key]: {
                                        ...(current[activeCppScope.key] ?? {}),
                                        [param]: value,
                                      },
                                    }));
                                  } else {
                                    setCpp((current) => ({ ...current, [param]: value }));
                                  }
                                }}
                                className="h-[38px] w-full rounded-control border border-border-strong bg-surface px-3 font-mono text-small tabular-nums placeholder:font-sans placeholder:italic placeholder:text-subdued focus:border-primary focus:outline-none focus:ring-2 focus:ring-accent-soft"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {equipment && procStage && cpps.length > 0 && !cppComplete ? (
                      <p className="mt-3 text-micro font-medium text-danger">
                        Complete every CPP value{isCoatingScoped ? " in every coating-type tab" : ""} before adding this equipment.
                      </p>
                    ) : null}
                  </section>
                ) : null}

                {supportsEquipment || supportsInstrument ? <div className="flex flex-wrap justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={addEntry}
                    disabled={!canAdd}
                    title={hasIncompleteDraft ? "Complete all required fields and CPP values" : undefined}
                    className="inline-flex h-9 items-center gap-1.5 rounded-control border border-border-strong bg-surface px-4 text-small font-semibold transition hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Add to document
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveStay()}
                    disabled={isSaving || hasIncompleteDraft || (recordedCount === 0 && !canAdd)}
                    title="Save what you've recorded and add another equipment or instrument"
                    className="inline-flex h-9 items-center gap-1.5 rounded-control bg-primary px-4 text-small font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-border-strong"
                  >
                    {isSaving ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Save className="size-4" aria-hidden="true" />
                    )}
                    Save &amp; add another
                  </button>
                </div> : null}

                <WizardFooter
                  onBack={() => goToStep("stages")}
                  backLabel="Back without saving"
                  onNext={() => void save()}
                  nextLabel="Save & back to stages"
                  isBusy={isSaving}
                  isNextDisabled={hasIncompleteDraft || ((supportsEquipment || supportsInstrument) && recordedCount === 0 && !canAdd)}
                  hint={
                    hasIncompleteDraft
                      ? "Complete all required fields and CPP values"
                      : recordedCount === 0 && !canAdd
                      ? "Add at least one equipment or instrument"
                      : `${recordedCount + (canAdd ? 1 : 0)} item${
                          recordedCount + (canAdd ? 1 : 0) === 1 ? "" : "s"
                        } recorded`
                  }
                />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function valueAtPath(root: Record<string, unknown>, path: (string | number)[]): unknown {
  return path.reduce<unknown>((current, segment) => {
    if (typeof segment === "number") return Array.isArray(current) ? current[segment] : undefined;
    return current && typeof current === "object"
      ? (current as Record<string, unknown>)[segment]
      : undefined;
  }, root);
}

function objectAtPath(root: Record<string, unknown>, path: (string | number)[]): Record<string, unknown> {
  const value = valueAtPath(root, path);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The selected stage section is unavailable.");
  }
  return value as Record<string, unknown>;
}

function entryIdentity(entry: EquipmentEntry): string {
  return [entry.mode, entry.name, entry.id, entry.layer || "", entry.proc_stage].join("\u0000");
}

function entriesFromScope(
  scope: StageAssetScope,
  values: Record<string, unknown>,
  stageKey: string,
): EquipmentEntry[] {
  const container = valueAtPath(values, scope.path);
  const object = container && typeof container === "object" && !Array.isArray(container)
    ? container as Record<string, unknown>
    : {};
  const rows = (key: "equipment_list" | "instrument_list") =>
    Array.isArray(object[key]) ? object[key] as Record<string, unknown>[] : [];
  const cppValues = (row: Record<string, unknown>): Record<string, string> => {
    const raw = row.cpp_values ?? row.cpp;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return Object.fromEntries(Object.entries(raw as Record<string, unknown>).map(([key, value]) => [key, String(value ?? "")]));
  };

  return [
    ...rows("equipment_list").map((row): EquipmentEntry => ({
      mode: "equipment",
      name: String(row.name || ""),
      id: String(row.id || ""),
      layer: String(row.layer || ""),
      stage: String(row.stage || stageKey),
      proc_stage: String(row.processing_step || row.proc_stage || ""),
      cpp: cppValues(row),
      scope: scope.key,
    })),
    ...rows("instrument_list").map((row): EquipmentEntry => ({
      mode: "instrument",
      name: String(row.name || ""),
      id: String(row.id || ""),
      layer: String(row.layer || ""),
      stage: String(row.stage || stageKey),
      proc_stage: "",
      cpp: {},
      scope: scope.key,
    })),
  ];
}

/**
 * Master-data processing-stage names carry trailing qualifiers in brackets, e.g.
 * "Sifting (If Sieve (#) mentioned in process)" or "Dispensing Booth (RLAF)". Show the
 * clean name; the raw value is still what's stored, so pipeline stage-matching is intact.
 */
function cleanStageName(raw: string): string {
  if (!raw) return "";
  const cleaned = raw.split("(")[0].replace(/\s+/g, " ").trim().replace(/[,/]+$/, "").trim();
  return cleaned || raw.replace(/\s+/g, " ").trim();
}

function DetailBox({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-6 rounded-control bg-sunken px-4 py-3">
      {items.map(([label, value]) => (
        <div key={label} className="flex flex-col">
          <span className="text-micro font-semibold uppercase tracking-wide text-subdued">
            {label}
          </span>
          <span className="font-mono text-small">{value}</span>
        </div>
      ))}
    </div>
  );
}

function Combo({
  label,
  value,
  options,
  onChange,
  emptyText = "No options",
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = options.filter((o) => o.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-micro font-semibold text-subdued">
        {label} <span className="text-danger">*</span>
      </label>
      <div ref={ref} className="relative">
        <div className="flex h-[38px] items-center rounded-control border border-border-strong bg-surface pl-3 pr-1 focus-within:border-primary focus-within:ring-2 focus-within:ring-accent-soft">
          <input
            type="text"
            value={query}
            placeholder="Select or type…"
            autoComplete="off"
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onBlur={() => query !== value && onChange(query.trim())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onChange(query.trim());
                setOpen(false);
              }
              if (e.key === "Escape") setOpen(false);
            }}
            className="min-w-0 flex-1 bg-transparent text-small outline-none placeholder:text-subdued"
          />
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => {
              e.preventDefault();
              setOpen((o) => !o);
            }}
            className="flex size-7 items-center justify-center text-subdued"
          >
            <ChevronDown className="size-4" aria-hidden="true" />
          </button>
        </div>
        {open ? (
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-64 overflow-auto rounded-control border border-border-strong bg-surface p-1 shadow-overlay">
            {filtered.length === 0 ? (
              <div className="px-2.5 py-2 text-small text-subdued">
                {query ? (
                  <>
                    Use custom value “<b className="text-primary-dark">{query}</b>”
                  </>
                ) : (
                  emptyText
                )}
              </div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(opt);
                    setQuery(opt);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-small transition hover:bg-accent-soft hover:text-primary-dark"
                >
                  {opt === value ? <Check className="size-3.5 text-primary" aria-hidden="true" /> : null}
                  {opt}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
