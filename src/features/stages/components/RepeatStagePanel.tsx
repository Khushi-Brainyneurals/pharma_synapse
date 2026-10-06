import { useState } from "react";
import type { RepeatSlot, StageField, StageInputsResponse } from "../../stage-input/api/stageInputs.types";
import type { ConditionSources } from "../model/stageRepeats";
import { StageParamPanel } from "./StageParamPanel";

export function RepeatStagePanel({ axis, slots, fields, reference, byUnit, conditionSources, onUnitFieldChange, onCopyUnit }: {
  axis: string;
  slots: RepeatSlot[];
  fields: StageField[];
  reference: StageInputsResponse;
  byUnit: Record<string, Record<string, unknown>>;
  conditionSources: ConditionSources;
  onUnitFieldChange: (unit: string, field: string, value: unknown) => void;
  onCopyUnit: (from: string, to: string) => void;
}) {
  const [selected, setSelected] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  const active = slots.find((slot) => slot.key === selected) ?? slots[0];
  if (!active) return null;
  const sources = slots.filter((slot) => slot.key !== active.key && Object.keys(byUnit[slot.key] ?? {}).length > 0);
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label={`Inputs per ${axis}`} className="flex flex-wrap gap-2">
        {slots.map((slot) => <button key={slot.key} type="button" role="tab" aria-selected={active.key === slot.key}
          onClick={() => { setSelected(slot.key); setCopyFrom(""); }}
          className={`rounded-control border px-3 py-2 text-small ${active.key === slot.key ? "border-primary bg-accent-soft font-semibold" : "border-border bg-surface"}`}>
          {slot.name}
        </button>)}
      </div>
      <p className="text-small text-subdued">{active.name}{active.lot_no ? ` · Lot ${active.lot_no}` : ""}{active.colour ? ` · ${active.colour}` : ""}</p>
      {sources.length ? <div className="flex flex-wrap items-center gap-2">
        <label className="text-small">Copy inputs from
          <select value={copyFrom} onChange={(event) => setCopyFrom(event.target.value)} className="ml-2 rounded-control border border-border bg-surface p-2">
            <option value="">Select {axis}…</option>
            {sources.map((slot) => <option key={slot.key} value={slot.key}>{slot.name}</option>)}
          </select>
        </label>
        <button type="button" disabled={!sources.some((slot) => slot.key === copyFrom)} onClick={() => onCopyUnit(copyFrom, active.key)}
          className="rounded-control border border-border px-3 py-2 text-small disabled:opacity-50">Copy to {active.name}</button>
        <span className="text-micro text-subdued">Replaces this {axis}'s inputs.</span>
      </div> : null}
      <StageParamPanel fields={fields} values={byUnit[active.key] ?? {}} reference={reference} conditionSources={conditionSources}
        onChange={(field, value) => onUnitFieldChange(active.key, field, value)} />
    </div>
  );
}
