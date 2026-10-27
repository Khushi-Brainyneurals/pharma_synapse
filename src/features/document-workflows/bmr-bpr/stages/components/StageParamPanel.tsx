import { Check, Copy, PencilSparkles, RulerDimensionLine, X } from "lucide-react";
import { useState } from "react";
import type {
  RangeValue,
  StageField,
  StageInputsResponse,
} from "../../stage-input/api/stageInputs.types";
import { layerSlots, type ConditionSources } from "../model/stageRepeats";
import { StageFieldInput } from "../../stage-input/components/StageFieldInput";

/**
 * Select-stages in-process parameter panel — the designed "common params" layout
 * (Granulation process setup). Each parameter is a row:
 *   • acceptance-limit params (range) → tick + Limit / Record-only + Range / NMT / NLT
 *   • user-input params (number)      → tick + a "User input" value
 *   • everything else (tables, IPQC, machine settings…) renders its own control
 * The tick / mode / limit-type live in a `__param_meta` blob on the stage's values, so
 * they persist without changing the field value shapes the pipeline consumes.
 */

type Mode = "limit" | "record";
type Ltype = "range" | "nmt" | "nlt";
interface ParamMeta {
  enabled: boolean;
  mode: Mode;
  ltype: Ltype;
}

const META_KEY = "__param_meta";
const LIMIT_TYPES = new Set(["range"]);
const USER_INPUT_TYPES = new Set(["number"]);

function readMeta(values: Record<string, unknown>, key: string): ParamMeta {
  const all = (values[META_KEY] as Record<string, Partial<ParamMeta>> | undefined) ?? {};
  const m = all[key] ?? {};
  return { enabled: m.enabled ?? true, mode: m.mode ?? "limit", ltype: m.ltype ?? "range" };
}

interface StageParamPanelProps {
  fields: StageField[];
  values: Record<string, unknown>;
  reference: StageInputsResponse;
  onChange: (fieldKey: string, value: unknown) => void;
  conditionSources?: ConditionSources;
}

export function StageParamPanel({ fields, values, reference, onChange, conditionSources = {} }: StageParamPanelProps) {
  const visibleFields = fields.filter((field) => {
    const layers = layerSlots(reference, values);
    if (field.type === "layer_config") return layers.length > 0;
    if (field.key === "lot_no" && fields.some((item) => item.type === "layer_config")) return layers.length === 0;
    return true;
  });
  const setMeta = (key: string, patch: Partial<ParamMeta>) => {
    const all = { ...((values[META_KEY] as Record<string, ParamMeta> | undefined) ?? {}) };
    all[key] = { ...readMeta(values, key), ...patch };
    onChange(META_KEY, all);
  };

  const isCheckboxParam = (field: StageField) =>
    LIMIT_TYPES.has(field.type) || USER_INPUT_TYPES.has(field.type);

  const active = visibleFields.filter(
    (field) => !isCheckboxParam(field) || readMeta(values, field.key).enabled,
  ).length;

  return (
    <div className="flex flex-col gap-2">
      {visibleFields.map((field) => (
        <div key={field.key}>
        <ParamRow
          key={field.key}
          field={field}
          meta={readMeta(values, field.key)}
          value={values[field.key]}
          reference={{ ...reference, layer_slots: layerSlots(reference, values) }}
          onChange={onChange}
          setMeta={setMeta}
        />
        {conditionSources[field.key]?.length ? <label className="mt-1 block text-micro text-subdued">
          Copy a recorded limit
          <select value="" className="ml-2 rounded-control border border-border bg-surface p-1" onChange={(event) => {
            if (event.target.value === "") return;
            const source = conditionSources[field.key][Number(event.target.value)];
            onChange(field.key, structuredClone(source.value));
            setMeta(field.key, { enabled: true, mode: "limit", ltype: "range", ...source.meta });
          }}>
            <option value="">Choose source…</option>
            {conditionSources[field.key].map((source, index) => <option key={index} value={index}>{source.label}</option>)}
          </select>
        </label> : null}
        </div>
      ))}
      <p className="mt-1 text-micro text-subdued">
        {active} of {visibleFields.length} parameters active
      </p>
    </div>
  );
}

function ParamRow({
  field,
  meta,
  value,
  reference,
  onChange,
  setMeta,
}: {
  field: StageField;
  meta: ParamMeta;
  value: unknown;
  reference: StageInputsResponse;
  onChange: (fieldKey: string, value: unknown) => void;
  setMeta: (key: string, patch: Partial<ParamMeta>) => void;
}) {
  const isLimit = LIMIT_TYPES.has(field.type);
  const isUserInput = USER_INPUT_TYPES.has(field.type);

  const range = (value as RangeValue) ?? { min: "", max: "" };
  const setRange = (patch: Partial<RangeValue>) => onChange(field.key, { ...range, ...patch });

  // Tables, IPQC, machine settings, layer type, select, duration — render their own
  // labelled control (no tick / limit treatment).
  if (!isLimit && !isUserInput) {
    return (
      <div className="rounded-control border border-border bg-surface px-3 py-2.5">
        <StageFieldInput field={field} value={value} reference={reference} onChange={onChange} compact />
      </div>
    );
  }

  const enabled = meta.enabled;

  return (
    <div
      className={`rounded-control border border-border bg-surface px-3 py-2.5 transition ${
        enabled ? "" : "opacity-55"
      }`}
    >
      {/* 1. Added `justify-between` here */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* enable checkbox + name */}
        <label className="flex min-w-0 cursor-pointer items-center gap-2.5 sm:w-[210px]">
            <span className="relative size-[18px] shrink-0">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setMeta(field.key, { enabled: event.target.checked })}
              className="size-[18px] appearance-none rounded border border-border-strong bg-surface checked:border-primary checked:bg-primary"
            />
            {enabled ? (
              <Check
                className="pointer-events-none absolute inset-0 m-auto size-3 text-white"
                strokeWidth="3"
              />
            ) : null}
          </span>
          <span className="truncate text-text text-small font-medium">{field.label}</span>
          {field.unit ? (
            <span className="shrink-0 font-mono text-micro text-subdued">{field.unit}</span>
          ) : null}
        </label>

        {isLimit ? (
          <LimitControls
            meta={meta}
            range={range}
            enabled={enabled}
            onMode={(mode) => setMeta(field.key, { mode })}
            onLtype={(ltype) => {
              // Single-bound limits clear the unused side.
              if (ltype === "nmt") setRange({ min: "" });
              if (ltype === "nlt") setRange({ max: "" });
              setMeta(field.key, { ltype });
            }}
            onRange={setRange}
          />
        ) : (
          /* 2. Removed `flex-1` from this div so it hugs the right side */
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 rounded-sm bg-accent-soft px-1.5 py-1 text-micro font-semibold uppercase tracking-wide text-primary-dark">
              User input
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={String(value ?? "")}
              disabled={!enabled}
              placeholder={field.placeholder || "value"}
              onChange={(event) => onChange(field.key, event.target.value)}
              className="h-[30px] w-28 rounded-control border border-border-strong bg-surface px-2.5 font-mono text-small tabular-nums focus:border-primary focus:outline-none disabled:bg-sunken"
            />
            {field.unit ? <span className="font-mono text-micro text-subdued">{field.unit}</span> : null}
          </div>
        )}
      </div>
    </div>
  );
}

function LimitControls({
  meta,
  range,
  enabled,
  onMode,
  onLtype,
  onRange,
}: {
  meta: ParamMeta;
  range: RangeValue;
  enabled: boolean;
  onMode: (mode: Mode) => void;
  onLtype: (ltype: Ltype) => void;
  onRange: (patch: Partial<RangeValue>) => void;
}) {
  return (
    <>
      {/* Limit / Record-only segmented toggle */}
      <div className="inline-flex shrink-0 rounded-control border border-border bg-white p-1">
        {(["limit", "record"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            disabled={!enabled}
            onClick={() => onMode(m)}
            className={`rounded-[4px] px-2.5 py-1 text-micro font-semibold transition ${
              meta.mode === m
                ? "bg-accent-soft text-primary shadow-sm"
                : "text-subdued hover:text-text"
            } disabled:opacity-50`}
          >
            {m === "limit" ? (
              <span className="flex items-center gap-1.5">
                <RulerDimensionLine className="size-3.5" />
                Limit
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <PencilSparkles className="size-3.5" />
                Record only
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex min-w-[370px] flex-wrap items-center gap-2">
        {meta.mode === "limit" ? (
          <>
            <select
              value={meta.ltype}
              disabled={!enabled}
              onChange={(event) => onLtype(event.target.value as Ltype)}
              className="h-[30px] rounded-control border border-border-strong bg-surface pl-2.5 pr-7 text-text text-micro font-medium focus:border-primary focus:outline-none disabled:opacity-50"
            >
              <option value="range">Range (min–max)</option>
              <option value="nmt">Not more than (NMT)</option>
              <option value="nlt">Not less than (NLT)</option>
            </select>

            {meta.ltype === "range" ? (
              <>
                <NumInput value={range.min} placeholder="min" disabled={!enabled} onChange={(v) => onRange({ min: v })} />
                <span className="font-mono text-micro text-subdued">–</span>
                <NumInput value={range.max} placeholder="max" disabled={!enabled} onChange={(v) => onRange({ max: v })} />
              </>
            ) : meta.ltype === "nmt" ? (
              <>
                <span className="rounded-[4px] bg-accent-soft px-2 py-1.5 font-mono text-micro font-semibold text-primary-dark">
                  NMT ≤
                </span>
                <NumInput value={range.max} placeholder="value" disabled={!enabled} onChange={(v) => onRange({ max: v })} />
              </>
            ) : (
              <>
                <span className="rounded-[4px] bg-accent-soft px-2 py-1.5 font-mono text-micro font-semibold text-primary-dark">
                  NLT ≥
                </span>
                <NumInput value={range.min} placeholder="value" disabled={!enabled} onChange={(v) => onRange({ min: v })} />
              </>
            )}
          </>
        ) : (
          <span className="text-small text-subdued">
            To be recorded during execution — no acceptance limit
          </span>
        )}
      </div>
    </>
  );
}

function NumInput({
  value,
  placeholder,
  disabled,
  onChange,
}: {
  value: string;
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value ?? ""}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-[30px] w-20 rounded-control border border-border-strong bg-surface px-2.5 font-mono text-small tabular-nums focus:border-primary focus:outline-none disabled:bg-sunken"
    />
  );
}
