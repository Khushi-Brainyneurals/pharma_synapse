import { useId, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
// Put this file next to PvpProcedureSamplingPage.tsx so these paths match.
import { SelectMenu } from "../../../../../shared/ui/SelectMenu";

/* ---------- Types & defaults ---------- */

export type Terminology = "set" | "tier";
export type CriterionKind = "range" | "rsd" | "l1_l2";
export type CriterionTarget = "both" | "first" | "second";

export type Criterion = {
  kind: CriterionKind;
  target: CriterionTarget;
  minimum?: number | string;
  maximum?: number | string;
  l1?: number | string;
  l2?: number | string;
};

export type ContentUniformity = {
  enabled: boolean;
  terminology: Terminology;
  acceptance_criteria: Criterion[];
};

export const DEFAULT_CRITERIA: Criterion[] = [
  { kind: "range", target: "both", minimum: 85, maximum: 115 },
  { kind: "rsd", target: "first", maximum: 6 },
  { kind: "l1_l2", target: "second", l1: 15, l2: 25 },
];

export function normalizeContentUniformity(value: unknown): ContentUniformity {
  const v = (value && typeof value === "object" ? value : {}) as Partial<ContentUniformity>;
  return {
    enabled: Boolean(v.enabled),
    terminology: v.terminology === "tier" ? "tier" : "set",
    acceptance_criteria: Array.isArray(v.acceptance_criteria)
      ? v.acceptance_criteria
      : [],
  };
}

/* ---------- Fixed rules (driven by machine run time) ---------- */

const names = (t: Terminology) =>
  t === "set"
    ? { first: "Set I", second: "Set II" }
    : { first: "Tier 1", second: "Tier 2" };

const RULES = {
  short: {
    badge: "≤ 2 h",
    intervals: 20,
    tabletsPerInterval: 7,
    total: 140,
    selection: "3 random tabs / interval",
    firstQty: "4 tabs / interval",
    summary: (n: { first: string; second: string }) =>
      `20 intervals × 7 tabs = 140 · 3 random tabs / interval → ${n.first} · 4 tabs / interval → ${n.second}`,
  },
  long: {
    badge: "> 2 h",
    intervals: 40,
    tabletsPerInterval: 3,
    total: 120,
    selection: "20 random intervals",
    firstQty: "20 random intervals",
    summary: (n: { first: string; second: string }) =>
      `40 intervals × 3 tabs = 120 · 20 random intervals → ${n.first} · other 20 intervals → ${n.second}`,
  },
} as const;

function getRuleKey(hours: unknown): "short" | "long" | null {
  if (hours === "" || hours == null) return null;
  const h = Number(hours);
  if (!Number.isFinite(h)) return null;
  return h <= 2 ? "short" : "long";
}

/* ---------- Criteria helpers ---------- */

const KIND_LABEL: Record<CriterionKind, string> = {
  range: "Range (% of label claim)",
  rsd: "% RSD",
  l1_l2: "L1 & L2 (acceptance value)",
};
const KIND_BY_LABEL = Object.fromEntries(
  Object.entries(KIND_LABEL).map(([k, v]) => [v, k]),
) as Record<string, CriterionKind>;

function newCriterion(kind: CriterionKind): Criterion {
  if (kind === "range") return { kind, target: "both", minimum: "", maximum: "" };
  if (kind === "rsd") return { kind, target: "first", maximum: "" };
  return { kind, target: "second", l1: "", l2: "" };
}

// Switching kind keeps the target but swaps the limit fields.
function changeKind(row: Criterion, kind: CriterionKind): Criterion {
  return { ...newCriterion(kind), target: row.target };
}

const toNum = (v: string): number | string =>
  v === "" ? "" : Number.isFinite(Number(v)) ? Number(v) : v;

const inputClass =
  "w-full min-w-0 rounded-control border border-border bg-surface px-3 py-2 text-small text-text outline-none transition-colors placeholder:text-subdued/60 focus:border-primary focus:ring-1 focus:ring-primary disabled:bg-muted disabled:text-subdued";

/* ---------- Small pieces ---------- */

function ReadOnlyField({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-small font-semibold">{label}</span>
      <div className="flex h-10 items-center rounded-control border border-border bg-muted/40 px-3.5 text-small text-text">
        {value}
      </div>
    </div>
  );
}

function RadioDot({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-4 shrink-0 place-items-center rounded-full border ${
        active ? "border-primary" : "border-border-strong"
      }`}
    >
      {active ? <span className="size-2 rounded-full bg-primary" /> : null}
    </span>
  );
}

function LimitInput({
  prefix,
  value,
  ariaLabel,
  disabled,
  onChange,
}: {
  prefix: string;
  value: number | string | undefined;
  ariaLabel: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-1 items-center gap-2">
      <span className="text-small text-subdued">{prefix}</span>
      <input
        type="number"
        aria-label={ariaLabel}
        disabled={disabled}
        className={inputClass}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/* ---------- Main section ---------- */

export function ContentUniformitySection({
  value,
  runtimeHours,
  onRuntimeChange,
  onChange,
  disabled,
}: {
  value: unknown;
  runtimeHours: number | string;
  onRuntimeChange: (hours: number | string) => void;
  onChange: (value: ContentUniformity) => void;
  disabled: boolean;
}) {
  const cu = normalizeContentUniformity(value);
  const [expanded, setExpanded] = useState(true);
  const bodyId = useId();
  const n = names(cu.terminology);
  const ruleKey = getRuleKey(runtimeHours);
  const rule = ruleKey ? RULES[ruleKey] : null;

  const patch = (next: Partial<ContentUniformity>) =>
    onChange({ ...cu, ...next });

  const setCriteria = (rows: Criterion[]) =>
    patch({ acceptance_criteria: rows });
  const updateRow = (i: number, row: Criterion) =>
    setCriteria(cu.acceptance_criteria.map((r, j) => (j === i ? row : r)));

  const targetOptions: Record<CriterionTarget, string> = {
    both: "Both",
    first: n.first,
    second: n.second,
  };
  const targetByLabel = Object.fromEntries(
    Object.entries(targetOptions).map(([k, v]) => [v, k]),
  ) as Record<string, CriterionTarget>;

  function toggleEnabled(enabled: boolean) {
    patch({
      enabled,
      // Seed the example criteria the first time it is switched on.
      acceptance_criteria: cu.acceptance_criteria
    });
  }

  return (
    <section className="overflow-hidden rounded-card border border-border bg-surface">
      <header className="flex items-center gap-3 border-b border-border bg-muted/50 px-4 py-2">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          aria-label={
            expanded
              ? "Collapse Content uniformity"
              : "Expand Content uniformity"
          }
          onClick={() => setExpanded((v) => !v)}
          className="grid size-9 shrink-0 place-items-center rounded-control border border-border bg-surface text-subdued hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {expanded ? (
            <ChevronUp className="size-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-4" aria-hidden="true" />
          )}
        </button>
        <h4 className="text-small font-semibold">
          Content uniformity — stratified sampling
        </h4>
      </header>

      {expanded ? (
        <div id={bodyId} className="grid gap-5 p-5">
          <label className="inline-flex w-fit cursor-pointer items-center gap-2.5 text-small font-semibold">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              disabled={disabled}
              checked={cu.enabled}
              onChange={(e) => toggleEnabled(e.target.checked)}
            />
            Include content uniformity by stratified sampling
          </label>

          {cu.enabled ? (
            <>
              {/* 1. Terminology / sample analysis */}
              <div className="grid gap-3 rounded-card border border-border p-5">
                <h5 className="text-small font-semibold">1. Sample analysis</h5>
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Terminology">
                  {(
                    [
                      {
                        id: "set" as const,
                        title: "Set I / Set II",
                        text: "Set I to QC. If it fails, Set II (reserve) is studied as part of investigation.",
                      },
                      {
                        id: "tier" as const,
                        title: "Tier 1 / Tier 2",
                        text: "Tier 1 to QC. If it fails, Tier 2 (reserve) is analysed and judged with its own criteria.",
                      },
                    ]
                  ).map((opt) => {
                    const active = cu.terminology === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={disabled}
                        onClick={() => patch({ terminology: opt.id })}
                        className={`grid gap-1 rounded-control border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 ${
                          active
                            ? "border-primary bg-primary/5"
                            : "border-border bg-surface hover:bg-muted/50"
                        }`}
                      >
                        <span
                          className={`text-small font-semibold ${active ? "text-primary-dark" : "text-text"}`}
                        >
                          {opt.title}
                        </span>
                        <span className="text-small text-subdued">{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Run time & sampling */}
              <div className="grid gap-5 rounded-card border border-border p-5">
                <h5 className="text-small font-semibold">2. Run time &amp; sampling</h5>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
                  <div className="grid content-start gap-1.5">
                    <span className="text-small font-semibold">Machine run time</span>
                    <div className="">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        aria-label="Machine run time in hours"
                        disabled={disabled}
                        className={`${inputClass} h-10 max-w-[160px] px-3.5`}
                        value={runtimeHours ?? ""}
                        onChange={(e) => onRuntimeChange(toNum(e.target.value))}
                      />
                      
                    </div>
                    <span className="text-small text-subdued">H at optimum speed</span>
                  </div>

                  {/* The two fixed rules. The matching one is highlighted. */}
                  <div className="grid gap-2" role="radiogroup" aria-label="Sampling rule for this run time">
                    {(["short", "long"] as const).map((key) => {
                      const active = ruleKey === key;
                      return (
                        <div
                          key={key}
                          role="radio"
                          aria-checked={active}
                          className={`flex items-center gap-3 rounded-control border px-4 py-3 text-small ${
                            active
                              ? "border-primary bg-primary/5"
                              : "border-border bg-surface"
                          }`}
                        >
                          <RadioDot active={active} />
                          <span className="font-semibold">{RULES[key].badge}</span>
                          <span className="min-w-0 text-micro text-subdued">
                            {RULES[key].summary(n)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {rule ? (
                  <div className="grid gap-4 sm:grid-cols-4">
                    <ReadOnlyField label="Number of intervals" value={rule.intervals} />
                    <ReadOnlyField label="Tablets per interval" value={rule.tabletsPerInterval} />
                    <ReadOnlyField label={`${n.first}`} value={rule.selection} />
                    <ReadOnlyField
                      label={`${n.second}`}
                      value={rule.firstQty}
                    />
                  </div>
                ) : (
                  <p className="text-small text-subdued">
                    Enter the machine run time to see the sampling rule.
                  </p>
                )}

                {rule ? (
                  <p className="text-small text-subdued">
                    Following the company rule for this run time.
                  </p>
                ) : null}
              </div>

              {/* 3. Acceptance criteria */}
              <div className="grid gap-3">
                <div>
                  <h5 className="text-small font-semibold">Acceptance criteria</h5>
                  <p className="mt-0.5 text-micro text-subdued">
                    Define the criteria and specify which {cu.terminology === "set" ? "set" : "tier"} they apply to.
                  </p>
                </div>

                <div className="overflow-hidden rounded-card border border-border">
                  {cu.acceptance_criteria.length ? (
                    <div className="divide-y divide-border">
                      {cu.acceptance_criteria.map((row, i) => (
                        <div
                          key={i}
                          className="grid items-end gap-3 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.1fr)_minmax(0,1fr)_auto]"
                        >
                          <div className="grid gap-1.5">
                            <span className="text-small font-semibold">Criterion</span>
                            <SelectMenu
                              ariaLabel={`Criterion ${i + 1}`}
                              placeholder="Select criterion"
                              value={KIND_LABEL[row.kind] ?? ""}
                              options={Object.values(KIND_LABEL)}
                              disabled={disabled}
                              onChange={(label) =>
                                updateRow(i, changeKind(row, KIND_BY_LABEL[label]))
                              }
                            />
                          </div>

                          <div className="grid gap-1.5">
                            <span className="text-small font-semibold">Limits</span>
                            <div className="flex items-center gap-2">
                              {row.kind === "range" ? (
                                <>
                                  <LimitInput
                                    prefix="Min"
                                    ariaLabel={`Minimum ${i + 1}`}
                                    value={row.minimum}
                                    disabled={disabled}
                                    onChange={(v) => updateRow(i, { ...row, minimum: toNum(v) })}
                                  />
                                  <LimitInput
                                    prefix="Max"
                                    ariaLabel={`Maximum ${i + 1}`}
                                    value={row.maximum}
                                    disabled={disabled}
                                    onChange={(v) => updateRow(i, { ...row, maximum: toNum(v) })}
                                  />
                                </>
                              ) : null}
                              {row.kind === "rsd" ? (
                                <LimitInput
                                  prefix="NMT"
                                  ariaLabel={`Maximum % RSD ${i + 1}`}
                                  value={row.maximum}
                                  disabled={disabled}
                                  onChange={(v) => updateRow(i, { ...row, maximum: toNum(v) })}
                                />
                              ) : null}
                              {row.kind === "l1_l2" ? (
                                <>
                                  <LimitInput
                                    prefix="L1"
                                    ariaLabel={`L1 ${i + 1}`}
                                    value={row.l1}
                                    disabled={disabled}
                                    onChange={(v) => updateRow(i, { ...row, l1: toNum(v) })}
                                  />
                                  <span className="text-subdued">—</span>
                                  <LimitInput
                                    prefix="L2"
                                    ariaLabel={`L2 ${i + 1}`}
                                    value={row.l2}
                                    disabled={disabled}
                                    onChange={(v) => updateRow(i, { ...row, l2: toNum(v) })}
                                  />
                                </>
                              ) : null}
                            </div>
                          </div>

                          <div className="grid gap-1.5">
                            <span className="text-small font-semibold">Applies to</span>
                            <SelectMenu
                              ariaLabel={`Applies to ${i + 1}`}
                              placeholder="Select"
                              value={targetOptions[row.target] ?? ""}
                              options={Object.values(targetOptions)}
                              disabled={disabled}
                              onChange={(label) =>
                                updateRow(i, { ...row, target: targetByLabel[label] })
                              }
                            />
                          </div>

                          <button
                            type="button"
                            disabled={disabled}
                            title="Remove criterion"
                            aria-label={`Remove criterion ${i + 1}`}
                            onClick={() =>
                              setCriteria(cu.acceptance_criteria.filter((_, j) => j !== i))
                            }
                            className="inline-flex size-10 items-center justify-center rounded-control border border-border text-subdued transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:opacity-40"
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="px-4 py-5 text-center text-small text-subdued">
                      No acceptance criteria yet. Use the buttons below to add one.
                    </p>
                  )}
                </div>

                {!disabled ? (
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { kind: "range", label: "Add range" },
                        { kind: "rsd", label: "Add % RSD" },
                        { kind: "l1_l2", label: "Add L1 & L2" },
                      ] as const
                    ).map((b) => (
                      <button
                        key={b.kind}
                        type="button"
                        onClick={() =>
                          setCriteria([...cu.acceptance_criteria, newCriterion(b.kind)])
                        }
                        className="inline-flex items-center gap-1.5 rounded-control border border-dashed border-primary/50 bg-surface px-4 py-2 text-small font-semibold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <Plus className="size-4" aria-hidden="true" />
                        {b.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}