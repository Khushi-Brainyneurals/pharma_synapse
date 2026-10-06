import { Lock, Plus, X } from "lucide-react";
import type {
  DurationValue,
  RangeValue,
  StageField,
  StageInputsResponse,
} from "../api/stageInputs.types";
import {
  CoatingParamsTable,
  IpqcTable,
  type CoatingParamRow,
  type IpqcRow,
} from "./IpqcTable";

const DURATION_UNITS = ["hours", "days"];

interface StageFieldInputProps {
  field: StageField;
  value: unknown;
  reference: StageInputsResponse;
  onChange: (key: string, value: unknown) => void;
  /** Compact row: label on the left, control on the right, no verbose help. */
  compact?: boolean;
}

/**
 * Renders whatever field the backend declared. No field list is hard-coded here —
 * screen #22 is a dynamic template, and adding a field to a stage must be a
 * backend-only change.
 */
export function StageFieldInput({ field, value, reference, onChange, compact }: StageFieldInputProps) {
  switch (field.type) {
    case "layer_config": {
      const saved = Array.isArray(value) ? value as { key: string; name?: string; lot_no?: string; colour?: string }[] : [];
      const slots = reference.layer_slots ?? [];
      return <Wrapper field={field} compact={compact}>
        <div className="grid gap-3 sm:grid-cols-2">
          {slots.map((slot) => {
            const current = saved.find((entry) => entry.key === slot.key) ?? slot;
            return <fieldset key={slot.key} className="rounded-control border border-border p-3">
              <legend className="text-small font-semibold">{slot.key}</legend>
              {(["name", "lot_no", "colour"] as const).map((key) => <label key={key} className="mt-2 block text-micro text-subdued">
                {{ name: "Layer name", lot_no: "Lot No.", colour: "Colour" }[key]}
                <input value={current[key] ?? ""} className={controlClass} onChange={(event) => {
                  // Keep the BOM identity and any inactive entries when editing a label.
                  const next = { ...current, key: slot.key, [key]: event.target.value };
                  onChange(field.key, saved.some((entry) => entry.key === slot.key)
                    ? saved.map((entry) => entry.key === slot.key ? next : entry) : [...saved, next]);
                }} />
              </label>)}
            </fieldset>;
          })}
        </div>
      </Wrapper>;
    }
    case "param_frequency": {
      const rows = Array.isArray(value) ? value as { parameter: string; frequency: string }[] : [];
      return <Wrapper field={field} compact={compact}>
        <div className="space-y-2">
          {(field.params ?? []).map((param) => {
            const current = rows.find((row) => row.parameter === param.name)?.frequency ?? "";
            const frequencies = [...new Set([...reference.ipqc_frequencies, ...(current ? [current] : [])])];
            return <label key={param.name} className="flex flex-wrap items-center justify-between gap-2 text-small">
              <span>{param.name}{param.spec ? <span className="ml-2 text-micro text-subdued">{param.spec}</span> : null}</span>
              <select className={controlClass} value={current} onChange={(event) => {
                const other = rows.filter((row) => row.parameter !== param.name);
                onChange(field.key, event.target.value ? [...other, { parameter: param.name, frequency: event.target.value }] : other);
              }}>
                <option value="">Select frequency…</option>
                {frequencies.map((frequency) => <option key={frequency} value={frequency}>{frequency}</option>)}
              </select>
            </label>;
          })}
          {!field.params?.length ? <p className="text-small text-subdued">No monitoring parameters available for this document.</p> : null}
        </div>
      </Wrapper>;
    }
    case "ipqc":
      return (
        <Wrapper field={field} compact={compact}>
          <IpqcTable
            rows={(value as IpqcRow[]) ?? []}
            frequencies={reference.ipqc_frequencies}
            onChange={(rows) => onChange(field.key, rows)}
          />
        </Wrapper>
      );

    case "coating_params":
      return (
        <Wrapper field={field} compact={compact}>
          <CoatingParamsTable
            rows={(value as CoatingParamRow[]) ?? []}
            placeholders={reference.coating_params}
            onChange={(rows) => onChange(field.key, rows)}
          />
        </Wrapper>
      );

    case "machine_setting":
      return (
        <Wrapper field={field} compact={compact}>
          <MachineSetting
            slots={Array.isArray(value) ? (value as string[]) : []}
            params={reference.machine_setting_params}
            onChange={(slots) => onChange(field.key, slots)}
          />
        </Wrapper>
      );

    case "layer_type":
      return (
        <Wrapper field={field} compact={compact}>
          <LayerType
            value={String(value ?? "")}
            options={field.options}
            layers={reference.layers}
            onChange={(next) => onChange(field.key, next)}
          />
        </Wrapper>
      );

    case "multiselect":
      return (
        <Wrapper field={field} compact={compact}>
          <MultiSelect
            value={Array.isArray(value) ? (value as string[]) : []}
            options={field.options}
            onChange={(next) => onChange(field.key, next)}
          />
        </Wrapper>
      );

    case "range":
      return (
        <Wrapper field={field} compact={compact}>
          <RangeInput
            value={(value as RangeValue) ?? { min: "", max: "" }}
            unit={field.unit}
            placeholder={field.placeholder}
            onChange={(next) => onChange(field.key, next)}
          />
        </Wrapper>
      );

    case "duration":
      return (
        <Wrapper field={field} compact={compact}>
          <DurationInput
            value={(value as DurationValue) ?? { value: "", unit: field.unit || "hours" }}
            defaultUnit={field.unit || "hours"}
            onChange={(next) => onChange(field.key, next)}
          />
        </Wrapper>
      );

    case "table":
      return (
        <Wrapper field={field} compact={compact}>
          <EditableTable
            columns={field.columns}
            rows={Array.isArray(value) ? (value as Record<string, string>[]) : []}
            onChange={(rows) => onChange(field.key, rows)}
          />
        </Wrapper>
      );

    default:
      return (
        <Wrapper field={field} compact={compact}>
          {field.type === "select" || field.type === "selection" ? (
            <select
              id={field.key}
              value={String(value ?? "")}
              onChange={(event) => onChange(field.key, event.target.value)}
              className={controlClass}
            >
              <option value="">Select…</option>
              {field.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={field.key}
              type={field.type === "number" ? "number" : "text"}
              inputMode={field.type === "number" ? "numeric" : undefined}
              value={String(value ?? "")}
              placeholder={field.placeholder}
              onChange={(event) => onChange(field.key, event.target.value)}
              // Values are measured quantities — mono with tabular figures.
              className={`${controlClass} font-mono tabular-nums`}
            />
          )}
        </Wrapper>
      );
  }
}

const controlClass =
  "mt-1.5 h-[36px] w-full rounded-control border border-border-strong bg-surface px-3 text-small focus:border-primary focus:outline-none";

/** Label + hint + provenance + help, the same on every field type. */
function Wrapper({
  field,
  children,
  compact,
}: {
  field: StageField;
  children: React.ReactNode;
  compact?: boolean;
}) {
  const labelBlock = (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <label htmlFor={field.key} className="text-small font-medium">
        {field.label}
        {field.required ? <span className="ml-0.5 text-danger">*</span> : null}
      </label>

      {field.hint ? <span className="text-micro text-subdued">{field.hint}</span> : null}

      {field.source ? (
        <span className="rounded-pill bg-sunken px-1.5 text-micro font-medium text-subdued">
          {field.source}
        </span>
      ) : null}
    </div>
  );

  // Compact: one clean row (label left, control right, no help) — matches the
  // in-process parameter rows on Select stages.
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <div className="min-w-0 sm:w-[210px]">{labelBlock}</div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    );
  }

  return (
    <div>
      {labelBlock}
      {children}
      {field.help ? <p className="mt-1.5 text-micro text-subdued">{field.help}</p> : null}
    </div>
  );
}

/**
 * The 8 compression tolerances.
 *
 * ORDER IS LOAD-BEARING: the pipeline consumes these positionally, so all 8 slots are
 * always kept — a blank stays a blank rather than collapsing the list and shifting every
 * later tolerance onto the wrong parameter.
 */
function MachineSetting({
  slots,
  params,
  onChange,
}: {
  slots: string[];
  params: string[];
  onChange: (slots: string[]) => void;
}) {
  const filled = params.map((_, index) => slots[index] ?? "");

  return (
    <div className="mt-2 grid gap-3 sm:grid-cols-2">
      {params.map((param, index) => (
        <div key={param}>
          <label className="block text-micro text-subdued" htmlFor={`ms-${index}`}>
            {index + 1}. {param}
          </label>
          <input
            id={`ms-${index}`}
            type="text"
            value={filled[index]}
            placeholder="Template default"
            onChange={(event) => {
              const next = [...filled];
              next[index] = event.target.value;
              onChange(next);
            }}
            className="mt-1 h-[34px] w-full rounded-control border border-border-strong bg-surface px-2.5 font-mono text-small tabular-nums focus:border-primary focus:outline-none"
          />
        </div>
      ))}
    </div>
  );
}

/** Acceptance range — min – max, with the field's unit. */
function RangeInput({
  value,
  unit,
  placeholder,
  onChange,
}: {
  value: RangeValue;
  unit: string;
  placeholder: string;
  onChange: (value: RangeValue) => void;
}) {
  const [minPh, maxPh] = placeholder.includes("–")
    ? placeholder.split("–").map((part) => part.trim())
    : ["min", "max"];

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <input
        type="text"
        inputMode="decimal"
        value={value.min ?? ""}
        placeholder={minPh}
        onChange={(event) => onChange({ ...value, min: event.target.value })}
        className="h-[36px] w-24 rounded-control border border-border-strong bg-surface px-3 text-center font-mono text-small tabular-nums focus:border-primary focus:outline-none"
      />
      <span className="font-mono text-small text-subdued">–</span>
      <input
        type="text"
        inputMode="decimal"
        value={value.max ?? ""}
        placeholder={maxPh}
        onChange={(event) => onChange({ ...value, max: event.target.value })}
        className="h-[36px] w-24 rounded-control border border-border-strong bg-surface px-3 text-center font-mono text-small tabular-nums focus:border-primary focus:outline-none"
      />
      {unit ? <span className="text-small text-subdued">{unit}</span> : null}
    </div>
  );
}

/** Duration — a numeric amount + a unit. */
function DurationInput({
  value,
  defaultUnit,
  onChange,
}: {
  value: DurationValue;
  defaultUnit: string;
  onChange: (value: DurationValue) => void;
}) {
  const units = DURATION_UNITS.includes(defaultUnit)
    ? DURATION_UNITS
    : [defaultUnit, ...DURATION_UNITS];

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <input
        type="text"
        inputMode="decimal"
        value={value.value ?? ""}
        placeholder="24"
        onChange={(event) => onChange({ ...value, value: event.target.value })}
        className="h-[36px] w-24 rounded-control border border-border-strong bg-surface px-3 text-center font-mono text-small tabular-nums focus:border-primary focus:outline-none"
      />
      <select
        value={value.unit || defaultUnit}
        onChange={(event) => onChange({ ...value, unit: event.target.value })}
        className="h-[36px] rounded-control border border-border-strong bg-surface px-3 text-small focus:border-primary focus:outline-none"
      >
        {units.map((unit) => (
          <option key={unit} value={unit}>
            {unit}
          </option>
        ))}
      </select>
    </div>
  );
}

/** A generic editable table: fixed columns, user-added rows. */
function EditableTable({
  columns,
  rows,
  onChange,
}: {
  columns: string[];
  rows: Record<string, string>[];
  onChange: (rows: Record<string, string>[]) => void;
}) {
  const setCell = (index: number, column: string, cellValue: string) => {
    const next = rows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, [column]: cellValue } : row,
    );
    onChange(next);
  };

  const addRow = () => onChange([...rows, Object.fromEntries(columns.map((c) => [c, ""]))]);
  const removeRow = (index: number) => onChange(rows.filter((_, rowIndex) => rowIndex !== index));

  return (
    <div className="mt-2 overflow-x-auto rounded-control border border-border">
      <table className="w-full min-w-[320px] border-collapse text-small">
        <thead>
          <tr className="bg-sunken text-left">
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 font-semibold text-subdued">
                {column}
              </th>
            ))}
            <th className="w-10 px-2 py-2" aria-label="Remove" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} className="px-3 py-3 text-micro text-subdued">
                No rows yet — add one below.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index} className="border-t border-border">
                {columns.map((column) => (
                  <td key={column} className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row[column] ?? ""}
                      onChange={(event) => setCell(index, column, event.target.value)}
                      className="h-[32px] w-full rounded-control border border-border-strong bg-surface px-2 text-small focus:border-primary focus:outline-none"
                    />
                  </td>
                ))}
                <td className="px-2 py-1.5 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    aria-label={`Remove row ${index + 1}`}
                    className="rounded-sm p-1 text-subdued transition hover:bg-danger-soft hover:text-danger"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 py-1.5 text-micro font-semibold transition hover:bg-sunken"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add row
        </button>
      </div>
    </div>
  );
}

/**
 * An ordered multi-select rendered as toggle chips. Selection order is preserved so a
 * coating sequence (seal → film → enteric) reads in the order it is applied; the chip
 * shows its 1-based position.
 */
function MultiSelect({
  value,
  options,
  onChange,
}: {
  value: string[];
  options: string[];
  onChange: (value: string[]) => void;
}) {
  const toggle = (option: string) => {
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
  };

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      {options.map((option) => {
        const index = value.indexOf(option);
        const selected = index >= 0;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(option)}
            className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-small font-medium transition ${
              selected
                ? "border-[#15803D]/30 bg-[#E2F4E9] text-[#15803D]"
                : "border-border-strong bg-surface text-subdued hover:border-primary hover:text-primary-dark"
            }`}
          >
            {selected ? (
              <span className="inline-flex size-4 items-center justify-center rounded-full bg-[#15803D] text-[10px] font-bold leading-none text-white">
                {index + 1}
              </span>
            ) : null}
            {option}
          </button>
        );
      })}
    </div>
  );
}

/** Layer type + the layer names, which are READ-ONLY: they come from the BOM. */
function LayerType({
  value,
  options,
  layers,
  onChange,
}: {
  value: string;
  options: string[];
  layers: string[];
  onChange: (value: string) => void;
}) {
  const detected = layers.length > 1 ? "Bi-layer" : "Single layer";

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-3">
      <select
        value={value || detected}
        onChange={(event) => onChange(event.target.value)}
        className="h-[36px] rounded-control border border-border-strong bg-surface px-3 text-small focus:border-primary focus:outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      {layers.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {layers.map((layer) => (
            <span
              key={layer}
              className="inline-flex items-center gap-1 rounded-pill bg-sunken px-2 py-1 text-micro font-medium text-subdued"
              title="Read from the BOM — not editable here"
            >
              <Lock className="size-3" aria-hidden="true" />
              {layer}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
