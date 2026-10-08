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
  getEquipmentInputs,
  getMasterData,
  setEquipmentInputs,
  type EquipmentEntry,
  type EquipmentMaster,
  type InstrumentMaster,
  type MasterData,
} from "../api/masterData";

type Mode = "equipment" | "instrument";

export function StageInputPage() {
  const { documentId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const forStage = searchParams.get("stage") ?? "";
  const user = useAuthStore((state) => state.user);
  const { goToStep } = useStepNavigation(documentId);
  const { document: documentState } = useDocument(documentId);

  const [master, setMaster] = useState<MasterData | null>(null);
  const [entries, setEntries] = useState<EquipmentEntry[]>([]);
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [md, existing] = await Promise.all([
          getMasterData(),
          getEquipmentInputs(documentId).catch(() => []),
        ]);
        if (cancelled) return;
        setMaster(md);
        setEntries(existing);
      } catch (caught) {
        if (!cancelled) setError(getApiErrorMessage(caught, "Could not load the master data."));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  // A machine name can exist under more than one stage (e.g. Stirrer in Granulation and in
  // Coating), so the lookup is scoped to the selected stage — that fixes the right IDs / CPPs.
  const equipment = useMemo<EquipmentMaster | null>(
    () =>
      mode === "equipment"
        ? master?.equipments.find(
            (e) => e.name === name && (!forStage || stageRelated(e.stage, forStage)),
          ) ?? null
        : null,
    [master, mode, name, forStage],
  );
  const instrument = useMemo<InstrumentMaster | null>(
    () => (mode === "instrument" ? master?.instruments.find((i) => i.name === name) ?? null : null),
    [master, mode, name],
  );
  const instrumentUnit = useMemo(
    () => instrument?.units.find((u) => u.id === id) ?? null,
    [instrument, id],
  );

  // Stage-specific list. Equipment is filtered by its manufacturing stage; an instrument
  // shows if any of its units serves this stage. Matching is tolerant (freeform names) with
  // a fall back to the full list so a naming mismatch never hides everything.
  const nameOptions = useMemo(() => {
    if (mode === "equipment") {
      const all = master?.equipments ?? [];
      const related = forStage ? all.filter((e) => stageRelated(e.stage, forStage)) : all;
      return [...new Set((related.length > 0 ? related : all).map((e) => e.name))];
    }
    const all = master?.instruments ?? [];
    const related = forStage
      ? all.filter((i) => i.units.some((u) => stageRelated(u.stage, forStage)))
      : all;
    return (related.length > 0 ? related : all).map((i) => i.name);
  }, [master, mode, forStage]);
  // Equipment ID shows every M/C ID for the chosen (stage-scoped) name.
  const idOptions = useMemo(() => {
    if (mode === "equipment") return equipment?.ids ?? [];
    return instrument?.units.map((u) => u.id) ?? [];
  }, [mode, equipment, instrument]);

  const stages = equipment?.stages ?? [];
  const cpps = stages.find((s) => s.stage === procStage)?.cpps ?? [];

  const resetForm = useCallback((keepMode = true) => {
    if (!keepMode) setMode("equipment");
    setName("");
    setId("");
    setProcStage("");
    setCpp({});
  }, []);

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    setName("");
    setId("");
    setProcStage("");
    setCpp({});
  }, []);

  const chooseName = useCallback((value: string) => {
    setName(value);
    setId("");
    setProcStage("");
    setCpp({});
  }, []);

  const chooseId = useCallback((value: string) => setId(value), []);

  const canAdd = mode === "equipment" ? Boolean(name && id && procStage) : Boolean(name && id);

  // The "Added" list mirrors the active tab: on Equipment it shows only equipment, on
  // Instrument only instruments. Real indices are kept so removal targets the right entry.
  const visibleEntries = useMemo(
    () => entries.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.mode === mode),
    [entries, mode],
  );

  const buildDraftEntry = useCallback(
    (): EquipmentEntry =>
      mode === "equipment"
        ? { mode, name, id, stage: forStage, proc_stage: procStage, cpp }
        : { mode, name, id, stage: forStage, proc_stage: "", cpp: {} },
    [mode, name, id, forStage, procStage, cpp],
  );

  const addEntry = useCallback(() => {
    if (!canAdd) return;
    setEntries((cur) => [...cur, buildDraftEntry()]);
    resetForm();
  }, [canAdd, buildDraftEntry, resetForm]);

  const removeEntry = useCallback((index: number) => {
    setEntries((cur) => cur.filter((_, i) => i !== index));
  }, []);

  // Persist everything recorded so far, folding an unsaved-but-complete draft in so
  // nothing is silently lost. Returns the full saved list.
  const persistAll = useCallback(async (): Promise<EquipmentEntry[]> => {
    const all = [...entries, ...(canAdd ? [buildDraftEntry()] : [])];
    await setEquipmentInputs(documentId, all);
    return all;
  }, [entries, canAdd, buildDraftEntry, documentId]);

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
      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />
        <main className="min-w-0 min-h-0 p-4 lg:p-6 lg:h-full lg:overflow-y-auto">
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
                  {forStage ? <span className="text-subdued"> — {forStage}</span> : null}
                </h1>
                <p className="mt-1 max-w-xl text-small text-subdued">
                  Record the equipment and instruments used{forStage ? ` for ${forStage}` : ""}. Pick
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
                                    Object.keys(entry.cpp).length
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

                {/* type toggle */}
                <div className="inline-flex rounded-pill border border-border bg-sunken p-0.5">
                  {(["equipment", "instrument"] as Mode[]).map((m) => (
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
                </div>

                {/* selection */}
                <section className="rounded-card border border-border bg-surface p-5">
                  <h2 className="mb-4 text-micro font-bold uppercase tracking-wide text-subdued">
                    {mode === "equipment" ? "Equipment" : "Instrument"} selection
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Combo
                      label={`${mode === "equipment" ? "Equipment" : "Instrument"} name`}
                      value={name}
                      options={nameOptions}
                      onChange={chooseName}
                    />
                    <Combo
                      label={`${mode === "equipment" ? "Equipment" : "Instrument"} ID`}
                      value={id}
                      options={idOptions}
                      onChange={chooseId}
                    />
                  </div>

                  {mode === "equipment" && equipment ? (
                    <DetailBox
                      items={[
                        ["Stage", equipment.stage || "—"],
                        ["Capacity", equipment.capacity],
                        ["Working capacity", equipment.working_capacity],
                      ]}
                    />
                  ) : null}
                  {mode === "instrument" && instrumentUnit ? (
                    <DetailBox
                      items={[["Stage", instrumentUnit.stage || "—"]]}
                    />
                  ) : null}
                </section>

                {/* processing stage (equipment only) */}
                {mode === "equipment" ? (
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
                {mode === "equipment" ? (
                  <section className="rounded-card border border-border bg-surface p-5">
                    <div className="mb-3 flex items-baseline gap-2">
                      <h2 className="text-small font-semibold">Critical process parameters</h2>
                      {procStage ? (
                        <span className="font-mono text-micro text-subdued">
                          {name} · {cleanStageName(procStage)}
                        </span>
                      ) : null}
                    </div>
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
                                {meta.unit ? (
                                  <span className="rounded-sm bg-sunken px-1.5 py-0.5 font-mono text-micro text-subdued">
                                    {meta.unit}
                                  </span>
                                ) : null}
                              </span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={cpp[param] ?? ""}
                                placeholder={meta.ex ? `EX: ${meta.ex}` : "Enter value"}
                                onChange={(e) => setCpp((c) => ({ ...c, [param]: e.target.value }))}
                                className="h-[38px] w-full rounded-control border border-border-strong bg-surface px-3 font-mono text-small tabular-nums placeholder:font-sans placeholder:italic placeholder:text-subdued focus:border-primary focus:outline-none focus:ring-2 focus:ring-accent-soft"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={addEntry}
                    disabled={!canAdd}
                    className="inline-flex h-9 items-center gap-1.5 rounded-control border border-border-strong bg-surface px-4 text-small font-semibold transition hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Add to document
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveStay()}
                    disabled={isSaving || (entries.length === 0 && !canAdd)}
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
                </div>

                <WizardFooter
                  onBack={() => goToStep("stages")}
                  backLabel="Back without saving"
                  onNext={() => void save()}
                  nextLabel="Save & back to stages"
                  isBusy={isSaving}
                  isNextDisabled={entries.length === 0 && !canAdd}
                  hint={
                    entries.length === 0 && !canAdd
                      ? "Add at least one equipment or instrument"
                      : `${entries.length + (canAdd ? 1 : 0)} item${
                          entries.length + (canAdd ? 1 : 0) === 1 ? "" : "s"
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

/**
 * Whether a master-data processing stage belongs to the wizard stage the user is on.
 * Freeform names ("Wet Granulation", "Dry Mixing") don't map 1:1 to the 7 canonical
 * stages, so we match on the significant words of the selected stage.
 */
function stageRelated(masterStage: string, forStage: string): boolean {
  const target = cleanStageName(forStage).toLowerCase();
  if (!target) return true;
  const words = target.split(/[^a-z0-9]+/).filter((word) => word.length > 3);
  if (words.length === 0) return true;
  const master = cleanStageName(masterStage).toLowerCase();
  return words.some((word) => master.includes(word));
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
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
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
                  "No options"
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
