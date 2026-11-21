import { Fragment, useId, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { SelectMenu } from "../../../../../shared/ui/SelectMenu";
import { ContentUniformitySection } from "./ContentUniformitySection";
import type { JsonRecord, ProcedureStage } from "../api/procedureSampling.api";

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
type EditableField =
  | "additional_cpp_rows"
  | "additional_cqa_rows"
  | "analytical_methodology"
  | "sampling_plan"
  | "compression_plan"
  | "sampling_diagram_labels";

const OTHER_CHALLENGE = "Other challenge";
const DEFAULT_CHALLENGE_OPTIONS = [
  "Low Speed",
  "High Speed",
  "Low Hardness",
  "High Hardness",
  OTHER_CHALLENGE,
];
const DEFAULT_SAMPLING_OPTIONS = [
  "Initial",
  "Middle",
  "End",
  OTHER_CHALLENGE,
];

export function ProcedureSamplingEditor({
  stage,
  stageKind,
  isDispensing,
  draft,
  compressionPlan,
  samplingGroups,
  samplingStages,
  availableTests,
  onSamplingPlanChange,
  onFieldChange,
}: {
  stage: ProcedureStage;
  stageKind: "dispensing" | "granulation" | "compression" | "normal";
  isDispensing: boolean;
  draft: JsonRecord;
  compressionPlan: JsonRecord;
  samplingGroups: SamplingPlanGroup[];
  samplingStages: string[];
  availableTests: string[];
  onSamplingPlanChange: (groups: SamplingPlanGroup[]) => void;
  onFieldChange: (field: EditableField, value: any) => void;
}) {
  return (
    <div className="grid gap-4">
      <InfoSection title="Equipment" rows={stage.equipment_details} />
      <InfoSection title="Instruments" rows={stage.instruments} />
      <ParameterSection
        title="Critical Process Parameters"
        sourceRows={stage.critical_process_parameters}
        rows={draft.additional_cpp_rows ?? []}
        onChange={(rows) => onFieldChange("additional_cpp_rows", rows)}
        disabled={false}
      />
      <ParameterSection
        title="Critical Quality Attributes"
        sourceRows={stage.critical_quality_attributes}
        rows={draft.additional_cqa_rows ?? []}
        onChange={(rows) => onFieldChange("additional_cqa_rows", rows)}
        disabled={false}
      />
      <AnalyticalSection
        rows={draft.analytical_methodology ?? []}
        onChange={(rows) => onFieldChange("analytical_methodology", rows)}
        disabled={false}
      />
      {isDispensing ? null : stageKind === "compression" ? (
        <CompressionSection
          plan={compressionPlan}
          availableTests={availableTests}
          onChange={(plan) => onFieldChange("compression_plan", plan)}
          disabled={false}
        />
      ) : (
        <SamplingSection
          groups={samplingGroups}
          stages={samplingStages}
          tests={availableTests}
          onChange={onSamplingPlanChange}
          disabled={false}
        />
      )}
      {!isDispensing && stageKind !== "compression" ? (
        <DiagramSection
          available={stage.available_sampling_diagrams ?? []}
          selected={draft.sampling_diagram_labels ?? []}
          onChange={(labels) => onFieldChange("sampling_diagram_labels", labels)}
          disabled={false}
        />
      ) : null}
    </div>
  );
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
        className={`flex items-center bg-muted/50 justify-between gap-3 px-4 py-3 ${open ? "border-b border-border" : ""}`}
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
/* ---------- Info tables (Equipment / Instruments) ---------- */

// Same widths for every info table, so columns line up across cards.
// Adjust the keys if your API uses different names for these fields.
const INFO_COLUMN_ORDER = ["name", "id_no", "operation_sop_no"];
const INFO_COLUMN_WIDTH: Record<string, string> = {
  name: "42%",
  id_no: "22%",
  operation_sop_no: "36%",
};

const thClass =
  "px-3 py-3 text-micro font-semibold uppercase tracking-wide text-text";
const tdClass = "px-3 py-3 align-middle text-small text-text";

function sortInfoColumns(keys: string[]): string[] {
  const rank = (key: string) => {
    const index = INFO_COLUMN_ORDER.indexOf(key.toLowerCase());
    return index === -1 ? INFO_COLUMN_ORDER.length : index;
  };
  return [...keys].sort((a, b) => rank(a) - rank(b));
}

function EmptyValue() {
  return <span className="text-text">—</span>;
}

function InfoSection({ title, rows }: { title: string; rows?: JsonRecord[] }) {
  const list = rows ?? [];
  const columns = sortInfoColumns([
    ...new Set(list.flatMap((row) => Object.keys(row))),
  ]);

  return (
    <Card title={title}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] table-fixed text-left">
          <colgroup>
            {columns.map((key) => (
              <col key={key} style={{ width: INFO_COLUMN_WIDTH[key.toLowerCase()] }} />
            ))}
          </colgroup>
          <thead className="bg-muted/40 border-b border-border text-micro uppercase text-text">
            <tr>
              {columns.map((key) => (
                <th key={key} scope="col" className={thClass}>
                  {label(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.length ? (
              list.map((row, i) => (
                <tr key={i} className="transition-colors hover:bg-muted/30">
                  {columns.map((key) => {
                    const text = display(row[key]);
                    return (
                      <td key={key} className={`${tdClass} break-words`}>
                        {text || <EmptyValue />}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="px-3 py-6 text-center text-small text-subdued"
                  colSpan={Math.max(columns.length, 1)}
                >
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

// Source table and editable table share these widths, so Parameter / Limit line up.
const PARAM_COLS = ["48%", "42%", "10%"];

function ParamColGroup() {
  return (
    <colgroup>
      {PARAM_COLS.map((width, i) => (
        <col key={i} style={{ width }} />
      ))}
    </colgroup>
  );
}

export function ParameterSection({
  title,
  sourceRows,
  rows,
  onChange,
  disabled,
  packing = false,
}: {
  title: string;
  sourceRows?: JsonRecord[];
  rows: JsonRecord[];
  onChange: (rows: JsonRecord[]) => void;
  disabled: boolean;
  packing?: boolean;
}) {
  const existing = (sourceRows ?? []).map((row) =>
    asString(row.parameter).trim().toLowerCase(),
  );
  const sourceGroups = groupParameterRows(sourceRows ?? []);
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
<Card title={title}>
  {/* ---------- Source rows (read only) ---------- */}
  {(sourceRows ?? []).length ? (
    <div className="mb-6">
      <div className="overflow-x-auto rounded-control border border-border">
        <table className="w-full min-w-[480px] table-fixed text-left text-small">
          <ParamColGroup />
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th scope="col" className={`${thClass} pl-6`}>Parameter</th>
              <th scope="col" className={thClass}>Limit</th>
              <th scope="col" className={thClass}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sourceGroups.groups.map((layerGroup, layerIndex) => (
              <Fragment key={`layer-${layerIndex}`}>
                {sourceGroups.hasLayer ? (
                  <tr className="border-t border-border bg-accent-soft">
                    <th
                      colSpan={3}
                      scope="colgroup"
                      className="px-4 py-2 text-left text-small font-semibold text-primary-dark "
                    >
                      {layerGroup.layer || "—"}
                    </th>
                  </tr>
                ) : null}
                {layerGroup.steps.map((stepGroup, stepIndex) => (
                  <Fragment key={`step-${stepIndex}`}>
                    <tr className="border-t border-border bg-muted/40">
                      <th
                        colSpan={3}
                        scope="colgroup"
                        className="border-l-2 border-l-primary px-4 py-2.5 text-left text-micro font-semibold uppercase tracking-wide text-primary-dark"
                      >
                        {stepGroup.step || "Other"}
                      </th>
                    </tr>
                    {stepGroup.rows.map((row, rowIndex) => (
                      <tr
                        key={`source-${layerIndex}-${stepIndex}-${rowIndex}`}
                        className="border-t border-border bg-surface transition-colors hover:bg-accent-soft/60"
                      >
                        <td className="break-words py-2.5 pl-6 pr-3 align-middle text-small text-text">
                          {display(row.parameter) || <EmptyValue />}
                        </td>
                        <td className="break-words px-3 py-2.5 align-middle text-small font-medium tabular-nums text-text">
                          {display(row.limit) || <EmptyValue />}
                        </td>
                        <td />
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ) : null}

  {/* ---------- Additional rows (editable) ---------- */}
  <div>
    <div className="mb-2 flex items-center justify-between gap-2">
      <h4 className="flex items-center gap-2 text-micro font-semibold uppercase tracking-wide text-primary-dark">
        {/* <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" /> */}
        Additional rows
      </h4>
      <span
        className={`min-w-6 rounded-full border px-2 py-0.5 text-center text-micro font-semibold ${
          rows.length
            ? "border-primary bg-primary text-white"
            : "border-border bg-muted/50 text-subdued"
        }`}
      >
        {rows.length}
      </span>
    </div>

    <div className="overflow-hidden rounded-control border border-border">
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] table-fixed text-left text-small">
            <ParamColGroup />
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th scope="col" className={thClass}>Parameter</th>
                <th scope="col" className={thClass}>Limit</th>
                <th scope="col" className={thClass}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, index) => (
                <tr
                  key={`add-${index}`}
                  className="transition-colors hover:bg-accent-soft/60"
                >
                  <td className="px-3 py-2">
                    <input
                      disabled={disabled}
                      aria-label={`${title} parameter ${index + 1}`}
                      className={inputClass}
                      value={row.parameter ?? ""}
                      onChange={(event) =>
                        updateAt(rows, index, { ...row, parameter: event.target.value }, onChange)
                      }
                      placeholder="Parameter"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      disabled={disabled}
                      aria-label={`${title} limit ${index + 1}`}
                      className={inputClass}
                      value={row.limit ?? ""}
                      onChange={(event) =>
                        updateAt(rows, index, { ...row, limit: event.target.value }, onChange)
                      }
                      placeholder="Limit"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      disabled={disabled}
                      type="button"
                      title="Remove row"
                      aria-label={`Remove ${title} row ${index + 1}`}
                      onClick={() => onChange(rows.filter((_, i) => i !== index))}
                      className="inline-flex size-9 items-center justify-center rounded-control text-danger transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:opacity-40"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-5 text-center">
          <p className="text-small font-medium text-text">No additional rows</p>
          <p className="mt-0.5 text-micro text-subdued">
            Add rows here for parameters that are not in the source list.
          </p>
        </div>
      )}

      {!disabled ? (
        <div className="border-t border-dashed border-primary/30 bg-accent-soft/60 px-3 py-2.5">
          <button
            type="button"
            onClick={() =>
              onChange([
                ...rows,
                packing ? { parameter: "", limit: "" } : {
                  parameter: "",
                  limit: "",
                  layer: "",
                  part_number: 1,
                  lot_number: 1,
                  processing_step: "",
                  coating_pass: "",
                  equipment_name: "",
                  equipment_id: "",
                  source_path: "",
                },
              ])
            }
            className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-1.5 text-small font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add row
          </button>
        </div>
      ) : null}
    </div>
  </div>

  {duplicate ? (
    <p
      role="alert"
      className="mt-3 rounded-control border border-danger/30 bg-danger/5 px-3 py-2 text-small text-danger"
    >
      Parameter names must be unique and cannot duplicate source rows.
    </p>
  ) : null}
</Card>
  );
}

function groupParameterRows(rows: JsonRecord[]) {
  const hasLayer = rows.some((row) => asString(row.layer).trim() !== "");
  const layers = new Map<string, Map<string, JsonRecord[]>>();

  for (const row of rows) {
    const layer = hasLayer ? asString(row.layer) : "";
    const step = asString(row.processing_step);
    const steps = layers.get(layer) ?? new Map<string, JsonRecord[]>();
    const stepRows = steps.get(step) ?? [];
    stepRows.push(row);
    steps.set(step, stepRows);
    layers.set(layer, steps);
  }

  return {
    hasLayer,
    groups: [...layers].map(([layer, steps]) => ({
      layer,
      steps: [...steps].map(([step, groupedRows]) => ({
        step,
        rows: groupedRows,
      })),
    })),
  };
}

export function AnalyticalSection({
  rows,
  onChange,
  disabled,
  qualityAttributes,
}: {
  rows: JsonRecord[];
  onChange: (rows: JsonRecord[]) => void;
  disabled: boolean;
  qualityAttributes?: string[];
}) {
  const [adding, setAdding] = useState(false);
  const [attribute, setAttribute] = useState("");
  const [method, setMethod] = useState("");
  const canAdd = attribute.trim() !== "" && method.trim() !== "";

  function closeForm() {
    setAdding(false);
    setAttribute("");
    setMethod("");
  }

  function commit() {
    if (!canAdd) return;
    onChange([
      ...rows,
      { quality_attribute: attribute.trim(), method_name: method.trim() },
    ]);
    closeForm();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      closeForm();
    }
  }

  return (
    <Card title="Analytical Methodology">
      <div className="overflow-hidden rounded-control">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] table-fixed text-left text-small">
              <colgroup>
                <col style={{ width: "45%" }} />
                <col style={{ width: "45%" }} />
              </colgroup>
              <thead className="border-b border-border text-text bg-muted/40">
                <tr>
                  <th scope="col" className={thClass}>Quality attribute</th>
                  <th scope="col" className={thClass}>Method name</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className="bg-surface transition-colors hover:bg-accent-soft/60"
                  >
                    <td className={`${tdClass} break-words`}>
                      {display(row.quality_attribute) || <EmptyValue />}
                    </td>
                    <td className={`${tdClass} break-words`}>
                      {display(row.method_name) || <EmptyValue />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-5 text-center">
            <p className="text-small font-medium text-text">
              No analytical methods are defined
            </p>
            {!disabled ? (
              <p className="mt-0.5 text-micro text-subdued">
                Use “Add method” below to add one.
              </p>
            ) : null}
          </div>
        )}

        {!disabled ? (
          <div className="border-t border-dashed border-primary/30 bg-accent-soft/60 px-3 py-2.5">
            {adding ? (
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                {qualityAttributes ? <SelectMenu
                  ariaLabel="Quality attribute"
                  placeholder="Select quality attribute"
                  value={attribute}
                  options={qualityAttributes}
                  disabled={disabled}
                  onChange={setAttribute}
                /> : <input
                  autoFocus
                  aria-label="Quality attribute"
                  className={inputClass}
                  value={attribute}
                  onChange={(e) => setAttribute(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Quality attribute"
                />}
                <input
                  aria-label="Method name"
                  className={inputClass}
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Method name"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!canAdd}
                    onClick={commit}
                    className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-2 text-small font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={closeForm}
                    className="rounded-control border border-border-strong bg-surface px-3 py-2 text-small font-semibold text-text transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-1.5 text-small font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Plus className="size-4" aria-hidden="true" />
                Add method
              </button>
            )}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
function SamplingSection({
  groups,
  stages,
  tests,
  onChange,
  disabled,
}: {
  groups: SamplingPlanGroup[];
  stages: string[];
  tests: string[];
  onChange: (groups: SamplingPlanGroup[]) => void;
  disabled: boolean;
}) {
  return (
    <Card title="Sampling Plan">
      <div className="grid gap-4">
        {groups.map((group, groupIndex) => {
          const layerLabel = group.layer.trim() || null;
          return (
            <section
              key={`${group.layer}-${groupIndex}`}
              aria-label={`Sampling rows for ${layerLabel}`}
              className="overflow-hidden rounded-control border border-border"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/50 px-3 py-2.5">
                <h3 className="text-small font-semibold">{layerLabel}</h3>
                {!disabled ? (
                  <button
                    type="button"
                    onClick={() =>
                      onChange(
                        groups.map((item, index) =>
                          index === groupIndex
                            ? {
                                ...item,
                                sampling_rows: [
                                  ...item.sampling_rows,
                                  {
                                    stage: "",
                                    sample_quantity: "",
                                    number_of_samples: 1,
                                    test: "",
                                  },
                                ],
                              }
                            : item,
                        ),
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-1.5 text-small font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Add row
                  </button>
                ) : null}
              </div>
              <SamplingRows
                rows={group.sampling_rows}
                stages={stages}
                tests={tests}
                onChange={(sampling_rows) =>
                  onChange(
                    groups.map((item, index) =>
                      index === groupIndex ? { ...item, sampling_rows } : item,
                    ),
                  )
                }
                disabled={disabled}
              />
            </section>
          );
        })}
      </div>
    </Card>
  );
}

function SamplingRows({
  rows,
  stages,
  tests,
  onChange,
  disabled,
}: {
  rows: SamplingRow[];
  stages: string[];
  tests: string[];
  onChange: (rows: SamplingRow[]) => void;
  disabled: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] table-fixed text-left text-small">
        <colgroup>
          <col style={{ width: "27%" }} />
          <col style={{ width: "21%" }} />
          <col style={{ width: "17%" }} />
          <col style={{ width: "27%" }} />
          <col style={{ width: "64px" }} />
        </colgroup>
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th scope="col" className={thClass}>Stage</th>
            <th scope="col" className={thClass}>Sample quantity</th>
            <th scope="col" className={thClass}>No. of samples</th>
            <th scope="col" className={thClass}>Test</th>
            <th scope="col" className={thClass}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, index) => (
            <tr
              key={row.id ?? index}
              className="transition-colors hover:bg-accent-soft/40"
            >
              <td className="px-3 py-2">
                <SelectMenu
                  ariaLabel={`Sampling stage ${index + 1}`}
                  placeholder="Select stage"
                  value={row.stage ?? ""}
                  options={withCurrentOption(stages, row.stage)}
                  disabled={disabled}
                  onChange={(v) => updateAt(rows, index, { ...row, stage: v }, onChange)}
                />
              </td>
              <td className="px-3 py-2">
                <TextCell
                  ariaLabel={`Sample quantity ${index + 1}`}
                  value={row.sample_quantity}
                  disabled={disabled}
                  onChange={(v) =>
                    updateAt(rows, index, { ...row, sample_quantity: v }, onChange)
                  }
                />
              </td>
              <td className="px-3 py-2">
                <TextCell
                  ariaLabel={`Number of samples ${index + 1}`}
                  type="number"
                  value={row.number_of_samples}
                  disabled={disabled}
                  onChange={(v) =>
                    updateAt(
                      rows,
                      index,
                      { ...row, number_of_samples: numberOrString(v) },
                      onChange,
                    )
                  }
                />
              </td>
              <td className="px-3 py-2">
                <SelectMenu
                  ariaLabel={`Sampling test ${index + 1}`}
                  placeholder="Select test"
                  value={row.test ?? ""}
                  options={withCurrentOption(tests, row.test)}
                  disabled={disabled}
                  onChange={(v) => updateAt(rows, index, { ...row, test: v }, onChange)}
                />
              </td>
              <td className="px-2 py-2 text-center">
                <button
                  type="button"
                  disabled={disabled}
                  title="Remove row"
                  aria-label={`Remove sampling row ${index + 1}`}
                  onClick={() => onChange(rows.filter((_, i) => i !== index))}
                  className="inline-flex size-9 items-center justify-center rounded-control text-danger transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:opacity-40"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center">
                <p className="text-small font-medium text-text">No sampling rows</p>
                {!disabled ? (
                  <p className="mt-0.5 text-micro text-subdued">
                    Use “Add row” below to add one.
                  </p>
                ) : null}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
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
  const availableTests = stageTests;
  const BLEND_LOADING_OPTIONS = [
    "Pneumatic conveying system",
    "Gravity feeding",
    "Manual loading",
  ];
  const [cuEnabled, setCuEnabled] = useState(
    (plan.acceptance_criteria ?? []).length > 0,
  );
  return (
    <Card title="Compression Plan">
      <div className="grid gap-5">
        <div className="grid gap-1.5">
          <span className="text-micro font-medium text-text mb-1">Blend loading</span>
          <SelectMenu
            ariaLabel="Blend loading"
            placeholder="Select blend loading"
            value={plan.blend_loading ?? ""}
            options={withCurrentOption(BLEND_LOADING_OPTIONS, plan.blend_loading)}
            disabled={disabled}
            onChange={(v) => onChange({ ...plan, blend_loading: v })}
          />
        </div>
        <CompressionRows
          title="Challenge studies"
          rows={plan.challenges ?? []}
          tests={availableTests}
          disabled={disabled}
          challengeOptions={DEFAULT_CHALLENGE_OPTIONS}
          onChange={(rows) => onChange({ ...plan, challenges: rows })}
        />
        <CompressionRows
          title="Sampling Points"
          rows={plan.sampling_points ?? []}
          tests={availableTests}
          disabled={disabled}
          challengeOptions={DEFAULT_SAMPLING_OPTIONS}
          onChange={(rows) => onChange({ ...plan, sampling_points: rows })}
        />
        <ContentUniformitySection
          value={{
            enabled: cuEnabled,
            terminology: plan.terminology,
            acceptance_criteria: plan.acceptance_criteria ?? [],
          }}
          runtimeHours={plan.machine_runtime_hours ?? ""}
          onRuntimeChange={(hours) =>
            onChange({ ...plan, machine_runtime_hours: hours })
          }
          onChange={(cu) => {
            setCuEnabled(cu.enabled);
            onChange({
              ...plan,
              terminology: cu.terminology,
              acceptance_criteria: cu.enabled ? cu.acceptance_criteria : [],
            });
          }}
          disabled={disabled}
        />
      </div>
    </Card>
  );
}

/* ---------- Challenge studies / Sampling points ---------- */

function LabeledInput({
  label: title,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number";
  placeholder?: string;
  disabled: boolean;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-small font-semibold">{title}</span>
      <input
        className={`${inputClass} h-9 px-3.5`}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        min={type === "number" ? 0 : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function TestsBox({
  available,
  selected,
  disabled,
  onChange,
}: {
  available: string[];
  selected: string[];
  disabled: boolean;
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();

  const toggle = (test: string) =>
    onChange(
      selected.includes(test)
        ? selected.filter((item) => item !== test)
        : [...selected, test],
    );

  return (
    <div className="grid gap-2">
      <span className="text-small font-semibold">Tests</span>

      <div className="flex min-h-[3rem] flex-wrap items-center gap-1.5 rounded-control border border-border bg-surface px-3.5 py-2">
        {selected.length === 0 ? (
          <span className="text-small text-subdued">No tests selected</span>
        ) : (
          selected.map((test) => (
            <span
              key={test}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-micro font-medium"
            >
              {test}
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${test}`}
                onClick={() => toggle(test)}
                className="text-subdued hover:text-text disabled:cursor-not-allowed"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      <div
        className="relative"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((value) => !value)}
          className={`${inputClass} flex h-9 items-center justify-between px-3.5 text-left`}
        >
          <span>Select tests</span>
          <ChevronDown
            className={`size-4 text-subdued transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>

        {open ? (
          <ul
            id={listId}
            className="absolute bottom-full z-20 mb-1 max-h-56 w-full overflow-y-auto rounded-control border border-border bg-surface p-1 shadow-sm"
          >
            {available.length === 0 ? (
              <li className="px-3 py-2 text-small text-subdued">
                No tests available
              </li>
            ) : (
              available.map((test) => (
                <li key={test}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-control px-3 py-2 text-small hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={selected.includes(test)}
                      onChange={() => toggle(test)}
                      className="size-4 accent-primary"
                    />
                    {test}
                  </label>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function CheckCard({
  badge,
  badgeClass,
  title,
  cardClass,
  children,
}: {
  badge: string;
  badgeClass: string;
  title: string;
  cardClass: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`grid content-start gap-4 rounded-card border p-5 ${cardClass}`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`rounded-control px-2.5 py-1 text-micro font-semibold ${badgeClass}`}
        >
          {badge}
        </span>
        <h5 className="text-small font-semibold">{title}</h5>
      </div>
      {children}
    </div>
  );
}

function CompressionRows({
  title,
  rows,
  tests,
  disabled,
  onChange,
  challengeOptions,
}: {
  title: string;
  rows: JsonRecord[];
  tests: string[];
  disabled: boolean;
  onChange: (rows: JsonRecord[]) => void;
  // When provided, each row gets a "Challenge study" dropdown (used for Challenge studies).
  challengeOptions?: string[];
}) {
  const [expanded, setExpanded] = useState(true);
  const bodyId = useId();
  const options = challengeOptions ?? null;
  const update = (i: number, value: JsonRecord) =>
    updateAt(rows, i, value, onChange);

  return (
    <section className="overflow-hidden rounded-card border border-border bg-surface">
      <header className="flex items-center gap-3 border-b border-border bg-muted/50 px-4 py-2">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
          onClick={() => setExpanded((value) => !value)}
          className="grid size-9 shrink-0 place-items-center rounded-control border border-border bg-surface text-subdued hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {expanded ? (
            <ChevronUp className="size-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-4" aria-hidden="true" />
          )}
        </button>
        <h4 className="text-small font-semibold">{title}</h4>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-micro font-semibold text-primary-dark">
          {rows.length}
        </span>
        <div className="ml-auto">
          <AddButton
            disabled={disabled}
            onClick={() => {
              setExpanded(true);
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
              ]);
            }}
          />
        </div>
      </header>

      {expanded ? (
        <div id={bodyId} className="divide-y divide-border">
          {rows.map((row, i) => {
            const name: string = row.name ?? "";
            // With a dropdown: anything not in the preset list counts as "Other challenge".
            const isOther = options
              ? !options.includes(name) || name === OTHER_CHALLENGE
              : true;
            const selectValue = options
              ? isOther
                ? OTHER_CHALLENGE
                : name
              : "";

            return (
              <div key={row.id ?? i} className="grid gap-5 p-5">
                {/* Top row: study / name / runtime / remove */}
                <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_auto]">
                  {options ? (
                    <div className="grid gap-1.5">
                      <span className="text-small font-semibold">
                        Challenge study
                      </span>
                      <SelectMenu
                        ariaLabel={`Challenge study ${i + 1}`}
                        placeholder="Select challenge"
                        value={selectValue}
                        options={options}
                        disabled={disabled}
                        onChange={(next) =>
                          update(i, {
                            ...row,
                            name: next === OTHER_CHALLENGE ? "" : next,
                          })
                        }
                      />
                    </div>
                  ) : null}

                  <LabeledInput
                    label={options ? "Specify challenge" : "Name"}
                    value={isOther && name !== OTHER_CHALLENGE ? name : ""}
                    placeholder={options ? "Enter challenge name" : "Enter name"}
                    disabled={disabled || !isOther}
                    onChange={(value) => update(i, { ...row, name: value })}
                  />

                  <LabeledInput
                    label="Run time (min)"
                    type="number"
                    value={row.runtime_minutes ?? ""}
                    placeholder="Minutes"
                    disabled={disabled}
                    onChange={(value) =>
                      update(i, {
                        ...row,
                        runtime_minutes: numberOrString(value),
                      })
                    }
                  />

                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(rows.filter((_, j) => i !== j))}
                    className="flex h-9 items-center justify-center gap-2 rounded-control px-3 text-small font-medium text-subdued transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>

                {/* IPQC and QC cards */}
                <div className="grid gap-4 lg:grid-cols-2">
                  <CheckCard
                    badge="IPQC"
                    badgeClass="bg-primary/10 text-primary-dark"
                    title="In-process check"
                    cardClass="border-primary/30"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <LabeledInput
                        label="Sample qty — LHS (tabs)"
                        type="number"
                        value={row.ipqc_lhs_quantity ?? ""}
                        placeholder="Qty"
                        disabled={disabled}
                        onChange={(value) =>
                          update(i, {
                            ...row,
                            ipqc_lhs_quantity: numberOrString(value),
                          })
                        }
                      />
                      <LabeledInput
                        label="Sample qty — RHS (tabs)"
                        type="number"
                        value={row.ipqc_rhs_quantity ?? ""}
                        placeholder="Qty"
                        disabled={disabled}
                        onChange={(value) =>
                          update(i, {
                            ...row,
                            ipqc_rhs_quantity: numberOrString(value),
                          })
                        }
                      />
                    </div>
                    <TestsBox
                      available={tests}
                      selected={row.ipqc_tests ?? []}
                      disabled={disabled}
                      onChange={(value) =>
                        update(i, { ...row, ipqc_tests: value })
                      }
                    />
                  </CheckCard>

                  <CheckCard
                    badge="QC"
                    badgeClass="bg-muted text-text"
                    title="Sent to QC"
                    cardClass="border-border"
                  >
                    <LabeledInput
                      label="Sample qty (tabs)"
                      type="number"
                      value={row.qc_quantity ?? ""}
                      placeholder="Qty"
                      disabled={disabled}
                      onChange={(value) =>
                        update(i, {
                          ...row,
                          qc_quantity: numberOrString(value),
                        })
                      }
                    />
                    <TestsBox
                      available={tests}
                      selected={row.qc_tests ?? []}
                      disabled={disabled}
                      onChange={(value) =>
                        update(i, { ...row, qc_tests: value })
                      }
                    />
                  </CheckCard>
                </div>
              </div>
            );
          })}

          {rows.length === 0 ? (
            <p className="px-5 py-6 text-small text-subdued">
              No {title.toLowerCase()} defined. Use Add to create one.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function PackingChallengeStudies({
  rows,
  tests,
  primary,
  onChange,
}: {
  rows: JsonRecord[];
  tests: string[];
  primary: boolean;
  onChange: (rows: JsonRecord[]) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const bodyId = useId();
  const update = (index: number, value: JsonRecord) => updateAt(rows, index, value, onChange);
  return <section className="overflow-hidden rounded-card border border-border bg-surface">
    <header className="flex items-center gap-3 border-b border-border bg-muted/50 px-4 py-2">
      <button type="button" aria-expanded={expanded} aria-controls={bodyId} aria-label={expanded ? "Collapse challenge studies" : "Expand challenge studies"} onClick={() => setExpanded((value) => !value)} className="grid size-9 shrink-0 place-items-center rounded-control border border-border bg-surface text-subdued hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        {expanded ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
      </button>
      <h4 className="text-small font-semibold">Challenge studies</h4>
      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-micro font-semibold text-primary-dark">{rows.length}</span>
      <div className="ml-auto"><AddButton onClick={() => {
        setExpanded(true);
        onChange([...rows, { id: crypto.randomUUID(), condition: "", type: "main", run_time_min: "", ipqc_sample_qty: "", ...(primary ? { sampling_point: "" } : {}), ipqc_tests: [], qc: { qc_sample_quantity: "", test: [], required: false } }]);
      }} /></div>
    </header>
    {expanded ? <div id={bodyId} className="divide-y divide-border">
      {rows.map((row, index) => <div key={row.id ?? index} className="grid gap-5 p-5">
        <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto]">
          <LabeledInput label="Condition" value={row.condition ?? ""} placeholder="Describe the challenge" disabled={false} onChange={(value) => update(index, { ...row, condition: value })} />
          <LabeledInput label="Study type / group" value={row.type ?? "main"} placeholder="main, repack, strip…" disabled={false} onChange={(value) => update(index, { ...row, type: value })} />
          <LabeledInput label="Run time (min)" value={row.run_time_min ?? ""} placeholder="Minutes" disabled={false} onChange={(value) => update(index, { ...row, run_time_min: value})} />
          <button type="button" title="Remove study" aria-label={`Remove challenge study ${index + 1}`} onClick={() => onChange(rows.filter((_, i) => i !== index))} className="flex h-9 items-center justify-center gap-2 rounded-control px-3 text-small font-medium text-subdued transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Trash2 className="size-4" aria-hidden="true" /></button>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <CheckCard badge="IPQC" badgeClass="bg-primary/10 text-primary-dark" title="In-process check" cardClass="border-primary/30">
            <div className="grid gap-3 sm:grid-cols-2">
              <LabeledInput label="Sample quantity" value={row.ipqc_sample_qty ?? ""} placeholder="e.g. 20 blisters" disabled={false} onChange={(value) => update(index, { ...row, ipqc_sample_qty: value })} />
              {primary ? <LabeledInput label="Sampling point" value={row.sampling_point ?? ""} placeholder="e.g. Prior to cartoning" disabled={false} onChange={(value) => update(index, { ...row, sampling_point: value })} /> : null}
            </div>
            <TestsBox available={tests} selected={row.ipqc_tests ?? []} disabled={false} onChange={(value) => update(index, { ...row, ipqc_tests: value })} />
          </CheckCard>
          <CheckCard badge="QC" badgeClass="bg-muted text-text" title="Sent to QC" cardClass="border-border">
            <LabeledInput label="Sample quantity" value={row.qc?.qc_sample_quantity ?? ""} placeholder="Optional" disabled={false} onChange={(value) => update(index, { ...row, qc: { ...(row.qc ?? {}), qc_sample_quantity: value, test: row.qc?.test ?? [], required: row.qc?.required ?? false } })} />
            <TestsBox available={tests} selected={row.qc?.test ?? []} disabled={false} onChange={(value) => update(index, { ...row, qc: { ...(row.qc ?? {}), qc_sample_quantity: row.qc?.qc_sample_quantity ?? "", test: value, required: row.qc?.required ?? false } })} />
          </CheckCard>
        </div>
      </div>)}
      {rows.length === 0 ? <p className="px-5 py-6 text-small text-subdued">No challenge studies defined. Use Add to create one.</p> : null}
    </div> : null}
  </section>;
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

function withCurrentOption(options: string[], current: unknown): string[] {
  const value = asString(current).trim();
  return value && !options.includes(value) ? [value, ...options] : options;
}
function asString(value: unknown): string {
  return value == null ? "" : String(value);
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
  "w-full min-w-0 rounded-control border border-border bg-surface px-3 py-2 text-small text-text outline-none transition-colors placeholder:text-subdued/60 focus:border-primary focus:ring-1 focus:ring-primary disabled:bg-muted disabled:text-subdued";
