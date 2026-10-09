import { Check, PencilSparkles, Plus, RulerDimensionLine, Trash2 } from "lucide-react";
import { useState } from "react";
import type { JsonSchema } from "../api/stageInputs.types";
import { emptyItem, resolveSchema, schemaOptions } from "../model/schemaForm";

interface Props {
  schema: JsonSchema;
  values: Record<string, unknown>;
  layers: string[];
  stageKey?: string;
  scopeLabel?: "Layer" | "Coating type";
  showScopeSelection?: boolean;
  onChange: (key: string, value: unknown) => void;
}

const HIDDEN_SECTIONS = new Set(["equipment_list", "instrument_list", "user"]);
const PARAMETER_DISPLAY: Record<string, { label: string; unit: string }> = {
  temperature: { label: "Temperature", unit: "°C" },
  relative_humidity: { label: "Relative humidity", unit: "%RH" },
  differential_pressure: { label: "Differential pressure", unit: "Pa" },
  holding_period: { label: "Holding period", unit: "" },
  yield: { label: "Yield", unit: "%" },
};

export function SchemaStagePanel({ schema, values, layers, stageKey, scopeLabel = "Layer", showScopeSelection = true, onChange }: Props) {
  const root = resolveSchema(schema, schema);
  const fields = Object.entries(root.properties || {}).filter(([key]) => !HIDDEN_SECTIONS.has(key));

  if (fields.length === 0) {
    return <p className="text-small text-subdued">No process parameters are required for this stage.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {fields.map(([key, field]) =>
        key === "parameters" ? (
          <div key={key} className="contents">
            <ParameterRows
              root={schema}
              schema={field}
              value={Array.isArray(values[key]) ? values[key] as Record<string, unknown>[] : []}
              layers={layers}
              scopeLabel={scopeLabel}
              showScopeSelection={showScopeSelection}
              onChange={(value) => onChange(key, value)}
            />
          </div>
        ) : (
          <SchemaField
            key={key}
            root={schema}
            schema={field}
            fieldKey={key}
            value={values[key]}
            required={root.required?.includes(key) || false}
            topLevel
            layers={layers}
            tabLayerRows={stageKey === "granulation"}
            layerLotSizeNames={stageKey === "dispensing_rm" && layers.length > 1 ? layers : []}
            scopeLabel={scopeLabel}
            showScopeSelection={showScopeSelection}
            onChange={(value) => onChange(key, value)}
          />
        ),
      )}
    </div>
  );
}

function ParameterRows({ root, schema, value, layers, scopeLabel = "Layer", showScopeSelection = true, rowLabels = [], onChange }: {
  root: JsonSchema;
  schema: JsonSchema;
  value: Record<string, unknown>[];
  layers: string[];
  scopeLabel?: "Layer" | "Coating type";
  showScopeSelection?: boolean;
  rowLabels?: string[];
  onChange: (value: Record<string, unknown>[]) => void;
}) {
  const item = resolveSchema(root, resolveSchema(root, schema).items || {});
  const properties = item.properties || {};
  const nameOptions = properties.name ? schemaOptions(resolveSchema(root, properties.name)) : [];
  const update = (index: number, key: string, next: unknown) =>
    onChange(value.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: next } : row));
  const active = value.filter((row) => row.enabled !== false).length;

  if (value.length === 0) {
    return (
      <div className="rounded-control border border-border bg-surface px-4 py-4">
        <p className="text-small text-subdued">No process parameters are configured for this stage.</p>
        <button type="button" onClick={() => onChange([emptyItem(root, item) as Record<string, unknown>])} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-control border border-border-strong px-3 text-small font-semibold hover:bg-sunken">
          <Plus className="size-3.5" /> Add parameter
        </button>
      </div>
    );
  }

  return (
    <>
      {value.map((row, index) => {
        const name = String(row.name || "");
        const presentation = { ...(PARAMETER_DISPLAY[name] || {
          label: name ? name.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Parameter",
          unit: "",
        }) };
        if (rowLabels[index]) presentation.label = rowLabels[index];
        const enabled = row.enabled !== false;
        const mode = String(row.mode || "record_only");
        const kind = String(row.kind || "range");
        const isHolding = name === "holding_period";
        const isKnownName = Boolean(name && nameOptions.includes(name));

        return (
          <div key={`${name}-${index}`} className={`rounded-control border border-border bg-surface px-4 py-3 transition ${enabled ? "" : "opacity-55"}`}>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <label className="flex min-w-0 cursor-pointer items-center gap-2.5 sm:w-[210px]">
                <span className="relative size-[18px] shrink-0">
                  <input type="checkbox" checked={enabled} onChange={(event) => update(index, "enabled", event.target.checked)} className="size-[18px] appearance-none rounded border border-border-strong bg-surface checked:border-primary checked:bg-primary" />
                  {enabled ? <Check className="pointer-events-none absolute inset-0 m-auto size-3 text-white" strokeWidth="3" /> : null}
                </span>
                {name ? (
                  <>
                    <span className="truncate text-small font-medium text-text">{presentation.label}</span>
                    {presentation.unit ? <span className="shrink-0 font-mono text-micro text-subdued">{presentation.unit}</span> : null}
                  </>
                ) : (
                  <FieldControl root={root} schema={properties.name || { type: "string" }} fieldKey="name" value={row.name} onChange={(next) => update(index, "name", next)} />
                )}
              </label>

              {isHolding ? (
                <div className="flex flex-wrap items-center gap-2 min-w-[370px]">
                  {/* <span className="rounded-sm bg-accent-soft px-2 py-1 text-micro font-semibold uppercase tracking-wide text-primary-dark">User input</span> */}
                  <NumInput value={String(row.value || "")} placeholder="value" disabled={!enabled} onChange={(next) => update(index, "value", next)} />
                  <select value={String(row.unit || "hours")} disabled={!enabled} onChange={(event) => update(index, "unit", event.target.value)} className="h-[34px] rounded-control border border-border-strong bg-surface px-2 text-small focus:border-primary focus:outline-none disabled:bg-sunken">
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              ) : (
                <>
                  <ModeToggle mode={mode} enabled={enabled} onChange={(next) => onChange(value.map((current, rowIndex) => rowIndex === index ? {
                    ...current,
                    mode: next,
                    ...(next === "limit" && !current.kind ? { kind: "range" } : {}),
                  } : current))} />
                  <LimitValueControls row={row} mode={mode} kind={kind} enabled={enabled} onChange={(key, next) => update(index, key, next)} />
                </>
              )}

              {showScopeSelection && scopeLabel !== "Coating type" && layers.length > 1 && properties.layer ? (
                <select value={String(row.layer || "")} disabled={!enabled} title="Apply to layer" onChange={(event) => update(index, "layer", event.target.value)} className="h-[34px] rounded-control border border-border-strong bg-surface px-2 text-small focus:border-primary focus:outline-none disabled:bg-sunken">
                  <option value="">All layers</option>
                  {layers.map((layer) => <option key={layer} value={layer}>{layer}</option>)}
                </select>
              ) : null}
              {!isKnownName && nameOptions.length === 0 ? (
                <button type="button" title="Remove parameter" onClick={() => onChange(value.filter((_, rowIndex) => rowIndex !== index))} className="flex size-8 items-center justify-center rounded-control text-subdued hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
              ) : null}
            </div>
          </div>
        );
      })}
      <p className="mt-1 text-micro text-subdued">{active} of {value.length} parameters active</p>
    </>
  );
}

function ModeToggle({ mode, enabled, onChange }: { mode: string; enabled: boolean; onChange: (mode: string) => void }) {
  return (
    <div className="inline-flex shrink-0 rounded-control border border-border bg-white p-1">
      <button type="button" disabled={!enabled} onClick={() => onChange("limit")} className={`rounded-[4px] px-2.5 py-1 text-micro font-semibold transition ${mode === "limit" ? "bg-accent-soft text-primary shadow-sm" : "text-subdued hover:text-text"} disabled:opacity-50`}>
        <span className="flex items-center gap-1.5"><RulerDimensionLine className="size-3.5" />Limit</span>
      </button>
      <button type="button" disabled={!enabled} onClick={() => onChange("record_only")} className={`rounded-[4px] px-2.5 py-1 text-micro font-semibold transition ${mode !== "limit" ? "bg-accent-soft text-primary shadow-sm" : "text-subdued hover:text-text"} disabled:opacity-50`}>
        <span className="flex items-center gap-1.5"><PencilSparkles className="size-3.5" />Record only</span>
      </button>
    </div>
  );
}

function LimitValueControls({ row, mode, kind, enabled, onChange }: {
  row: Record<string, unknown>;
  mode: string;
  kind: string;
  enabled: boolean;
  onChange: (key: string, value: unknown) => void;
}) {
  if (mode !== "limit") {
    return <span className="min-w-[370px] text-small text-subdued">To be recorded during execution — no acceptance limit</span>;
  }
  return (
    <div className="flex min-w-[370px] flex-wrap items-center gap-2">
      <select value={kind} disabled={!enabled} onChange={(event) => {
        const next = event.target.value;
        if (next === "nmt") onChange("min", "");
        if (next === "nlt") onChange("max", "");
        onChange("kind", next);
      }} className="h-[34px] rounded-control border border-border-strong bg-surface pl-2.5 pr-7 text-micro font-medium text-text focus:border-primary focus:outline-none disabled:opacity-50">
        <option value="range">Range (min–max)</option>
        <option value="nmt">Not more than (NMT)</option>
        <option value="nlt">Not less than (NLT)</option>
      </select>
      {kind === "range" ? (
        <><NumInput value={String(row.min || "")} placeholder="min" disabled={!enabled} onChange={(next) => onChange("min", next)} /><span className="font-mono text-micro text-subdued">–</span><NumInput value={String(row.max || "")} placeholder="max" disabled={!enabled} onChange={(next) => onChange("max", next)} /></>
      ) : kind === "nmt" ? (
        <><span className="rounded-[4px] bg-accent-soft px-2 py-1.5 font-mono text-micro font-semibold text-primary-dark">NMT ≤</span><NumInput value={String(row.value || "")} placeholder="value" disabled={!enabled} onChange={(next) => onChange("value", next)} /></>
      ) : (
        <><span className="rounded-[4px] bg-accent-soft px-2 py-1.5 font-mono text-micro font-semibold text-primary-dark">NLT ≥</span><NumInput value={String(row.value || "")} placeholder="value" disabled={!enabled} onChange={(next) => onChange("value", next)} /></>
      )}
    </div>
  );
}

function NumInput({ value, placeholder, disabled, onChange }: { value: string; placeholder: string; disabled: boolean; onChange: (value: string) => void }) {
  return <input type="text" inputMode="decimal" value={value} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="h-[34px] w-20 rounded-control border border-border-strong bg-surface px-2.5 font-mono text-small tabular-nums focus:border-primary focus:outline-none disabled:bg-sunken" />;
}

function IpqcRows({ rows, frequencies, onChange }: {
  rows: Record<string, unknown>[];
  frequencies: string[];
  onChange: (value: unknown) => void;
}) {
  const update = (index: number, key: string, value: string) =>
    onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  return (
    <section className="overflow-hidden rounded-control border border-border bg-surface">
      <div className="border-b border-border px-4 py-3 text-small font-semibold">IPQC frequency</div>
      {rows.length === 0 ? <p className="px-4 py-4 text-small text-subdued">No IPQC parameters defined by this schema.</p> : (
        <div className="divide-y divide-border">{rows.map((row, index) => <div key={`${row.parameter}-${index}`} className="grid items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_240px]"><input value={String(row.parameter || "")} onChange={(event) => update(index, "parameter", event.target.value)} className="h-9 rounded-control border border-border-strong bg-surface px-3 text-small" /><select value={String(row.frequency || "")} onChange={(event) => update(index, "frequency", event.target.value)} className="h-9 rounded-control border border-border-strong bg-surface px-3 text-small"><option value="">Select frequency…</option>{frequencies.map((frequency) => <option key={frequency} value={frequency}>{frequency}</option>)}</select></div>)}</div>
      )}
    </section>
  );
}

function DynamicMap({ root, schema, value, title, lockedKeys = false, onChange }: {
  root: JsonSchema;
  schema: JsonSchema;
  value: Record<string, unknown>;
  title: string;
  lockedKeys?: boolean;
  onChange: (value: unknown) => void;
}) {
  const additional = typeof schema.additionalProperties === "object" ? schema.additionalProperties : { type: "string" };
  const resolvedAdditional = resolveSchema(root, additional);
  const complex = resolvedAdditional.type === "object" || Boolean(resolvedAdditional.properties);
  const rename = (oldKey: string, newKey: string) => {
    const trimmed = newKey.trim();
    if (!trimmed || trimmed === oldKey || trimmed in value) return;
    onChange(Object.fromEntries(Object.entries(value).map(([key, item]) => key === oldKey ? [trimmed, item] : [key, item])));
  };
  const add = () => {
    let index = 1;
    while (`New item ${index}` in value) index += 1;
    onChange({ ...value, [`New item ${index}`]: emptyItem(root, additional) });
  };
  return (
    <section className="rounded-control border border-border bg-surface p-4 sm:col-span-2">
      <div className="mb-3 flex items-center"><span className="text-small font-semibold">{title}</span>{!lockedKeys ? <button type="button" onClick={add} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-control border border-border-strong px-3 text-small font-semibold hover:bg-sunken"><Plus className="size-3.5" /> Add</button> : null}</div>
      <div className="space-y-3">{Object.entries(value).map(([key, item]) => (
        <div key={key} className={`relative rounded-control bg-background p-3 ${lockedKeys ? "" : "pr-12"}`}>
          {lockedKeys ? <div className="mb-2 text-small font-semibold capitalize">{key.replace(/_/g, " ")}</div> : <input defaultValue={key} onBlur={(event) => rename(key, event.target.value)} className="mb-2 h-8 w-full rounded-control border border-border-strong bg-surface px-2 text-small font-semibold" />}
          {complex ? <SchemaField root={root} schema={additional} fieldKey={key} value={item} required={false} onChange={(next) => onChange({ ...value, [key]: next })} /> : <FieldControl root={root} schema={additional} value={item} onChange={(next) => onChange({ ...value, [key]: next })} />}
          {!lockedKeys ? <button type="button" title="Remove" onClick={() => onChange(Object.fromEntries(Object.entries(value).filter(([entryKey]) => entryKey !== key)))} className="absolute right-2 top-2 flex size-8 items-center justify-center text-subdued hover:text-danger"><Trash2 className="size-4" /></button> : null}
        </div>
      ))}</div>
    </section>
  );
}

function titleFromKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function SchemaField({ root, schema, fieldKey = "", value, required, topLevel = false, layers = [], tabLayerRows = false, layerLotSizeNames = [], scopeLabel = "Layer", showScopeSelection = true, onChange }: {
  root: JsonSchema;
  schema: JsonSchema;
  fieldKey?: string;
  value: unknown;
  required: boolean;
  topLevel?: boolean;
  layers?: string[];
  tabLayerRows?: boolean;
  layerLotSizeNames?: string[];
  scopeLabel?: "Layer" | "Coating type";
  showScopeSelection?: boolean;
  onChange: (value: unknown) => void;
}) {
  const node = resolveSchema(root, schema);
  if (topLevel && fieldKey === "lot_size" && layerLotSizeNames.length > 1) {
    return (
      <LayerLotSizeInputs
        layers={layerLotSizeNames}
        value={value}
        required={required}
        onChange={onChange}
      />
    );
  }
  if (node.type === "array") {
    const rows = Array.isArray(value) ? value : [];
    if (fieldKey === "ipqc_table") {
      return <IpqcRows rows={rows as Record<string, unknown>[]} frequencies={root.x_ui_reference?.frequency_options || []} onChange={onChange} />;
    }
    const item = resolveSchema(root, node.items || {});
    if (fieldKey === "layers" && item.properties) {
      return (
        <LayerRows
          root={root}
          item={item}
          rows={rows}
          layers={layers}
          tabbed={tabLayerRows && rows.length > 1}
          scopeLabel={scopeLabel}
          showScopeSelection={showScopeSelection}
          onChange={onChange}
        />
      );
    }
    return (
      <section className="rounded-control border border-border bg-surface p-4">
        <div className="mb-3 flex items-center"><span className="text-small font-semibold">{node.title || "Items"}{required ? <span className="text-danger"> *</span> : null}</span><button type="button" onClick={() => onChange([...rows, emptyItem(root, node.items)])} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-control border border-border-strong px-3 text-small font-semibold hover:bg-sunken"><Plus className="size-3.5" /> Add</button></div>
        <div className="space-y-3">{rows.map((row, index) => <div key={index} className="relative rounded-control bg-background p-3 pr-12"><SchemaField root={root} schema={node.items || {}} value={row} required={false} layers={layers} tabLayerRows={tabLayerRows} scopeLabel={scopeLabel} showScopeSelection={showScopeSelection} onChange={(next) => onChange(rows.map((item, i) => i === index ? next : item))} /><button type="button" title="Remove" onClick={() => onChange(rows.filter((_, i) => i !== index))} className="absolute right-2 top-2 flex size-8 items-center justify-center text-subdued hover:text-danger"><Trash2 className="size-4" /></button></div>)}</div>
      </section>
    );
  }
  if (node.type === "object" || node.properties) {
    const object = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    const isParameter = Boolean(node.properties?.name && node.properties?.enabled && node.properties?.mode);
    if (isParameter) {
      return <ParameterRows root={root} schema={{ type: "array", items: schema, title: node.title }} value={[object]} layers={layers} scopeLabel={scopeLabel} showScopeSelection={showScopeSelection} rowLabels={[titleFromKey(fieldKey)]} onChange={(next) => onChange(next[0] || {})} />;
    }
    if (node.additionalProperties && Object.keys(node.properties || {}).length === 0) {
      return <DynamicMap root={root} schema={node} value={object} title={node.title || titleFromKey(fieldKey)} lockedKeys={fieldKey === "coat_passes"} onChange={onChange} />;
    }
    return <div className="grid gap-3 rounded-control border border-border bg-surface p-4 sm:grid-cols-2">{Object.entries(node.properties || {}).filter(([key]) => !HIDDEN_SECTIONS.has(key)).map(([key, child]) => key === "parameters" ? <div key={key} className="sm:col-span-2"><ParameterRows root={root} schema={child} value={Array.isArray(object[key]) ? object[key] as Record<string, unknown>[] : []} layers={layers} scopeLabel={scopeLabel} showScopeSelection={showScopeSelection} onChange={(next) => onChange({ ...object, [key]: next })} /></div> : <SchemaField key={key} root={root} schema={child} fieldKey={key} value={object[key]} required={node.required?.includes(key) || false} layers={layers} tabLayerRows={tabLayerRows} scopeLabel={scopeLabel} showScopeSelection={showScopeSelection} onChange={(next) => onChange({ ...object, [key]: next })} />)}</div>;
  }
  if (topLevel) {
    return <div className="flex items-center gap-5 rounded-control border border-border bg-surface px-4 py-3 sm:grid-cols-[minmax(180px,320px)_1fr]"><span className="text-small font-semibold">{node.title || "Value"}{required ? <span className="text-danger"> *</span> : null}</span><FieldControl root={root} schema={node} fieldKey={fieldKey} value={value} onChange={onChange} /></div>;
  }
  return <CompactField root={root} schema={node} fieldKey={fieldKey} value={value} required={required} onChange={onChange} />;
}

function LayerRows({ root, item, rows, layers, tabbed, scopeLabel, showScopeSelection, onChange }: {
  root: JsonSchema;
  item: JsonSchema;
  rows: unknown[];
  layers: string[];
  tabbed: boolean;
  scopeLabel: "Layer" | "Coating type";
  showScopeSelection: boolean;
  onChange: (value: unknown) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedIndex = Math.min(activeIndex, Math.max(rows.length - 1, 0));
  const layerName = (row: unknown, index: number) => {
    const object = row && typeof row === "object" && !Array.isArray(row)
      ? row as Record<string, unknown>
      : {};
    return String(object.layer || layers[index] || (rows.length === 1 ? "Single layer" : `Layer ${index + 1}`));
  };
  const renderLayer = (row: unknown, index: number, showHeading: boolean) => {
    const object = row && typeof row === "object" && !Array.isArray(row)
      ? row as Record<string, unknown>
      : {};
    const name = layerName(row, index);
    return (
      <div key={`${name}-${index}`} className={tabbed ? "p-4" : "rounded-control border border-border bg-surface p-4"}>
        {showHeading ? (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-small font-semibold">{name || "Single layer"}</span>
            <span className="rounded-pill bg-muted px-2 py-0.5 text-micro text-subdued">MFC layer</span>
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          {Object.entries(item.properties || {})
            .filter(([key]) => !HIDDEN_SECTIONS.has(key) && key !== "layer")
            .map(([key, child]) => key === "parameters" ? (
              <ParameterRows
                key={key}
                root={root}
                schema={child}
                value={Array.isArray(object[key]) ? object[key] as Record<string, unknown>[] : []}
                layers={[]}
                scopeLabel={scopeLabel}
                showScopeSelection={showScopeSelection}
                onChange={(next) => onChange(rows.map((entry, rowIndex) => rowIndex === index ? { ...object, [key]: next } : entry))}
              />
            ) : (
              <SchemaField
                key={key}
                root={root}
                schema={child}
                fieldKey={key}
                value={object[key]}
                required={item.required?.includes(key) || false}
                showScopeSelection={showScopeSelection}
                onChange={(next) => onChange(rows.map((entry, rowIndex) => rowIndex === index ? { ...object, [key]: next } : entry))}
              />
            ))}
        </div>
      </div>
    );
  };

  if (!tabbed) {
    return <section className="space-y-3">{rows.map((row, index) => renderLayer(row, index, true))}</section>;
  }

  return (
    <section className="overflow-hidden rounded-control border border-border bg-surface">
      <div className="border-b border-border px-4">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Granulation layers">
          {rows.map((row, index) => {
            const name = layerName(row, index);
            const active = index === selectedIndex;
            return (
              <button
                key={`${name}-${index}`}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveIndex(index)}
                className={`shrink-0 border-b-2 px-4 py-3 text-small font-semibold transition ${
                  active
                    ? "border-primary text-primary-dark"
                    : "border-transparent text-subdued hover:border-border-strong hover:text-text"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>
      <div role="tabpanel">
        {rows[selectedIndex] !== undefined
          ? renderLayer(rows[selectedIndex], selectedIndex, false)
          : null}
      </div>
    </section>
  );
}

function LayerLotSizeInputs({ layers, value, required, onChange }: {
  layers: string[];
  value: unknown;
  required: boolean;
  onChange: (value: unknown) => void;
}) {
  const current = String(value ?? "").split(",");
  const update = (index: number, nextValue: string) => {
    const next = layers.map((_, layerIndex) => current[layerIndex]?.trim() ?? "");
    next[index] = nextValue;
    onChange(next.join(","));
  };

  return (
    <section className="rounded-control border border-border bg-surface px-4 py-3">
      <p className="mb-3 text-small font-semibold">
        Lot size{required ? <span className="text-danger"> *</span> : null}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {layers.map((layer, index) => (
          <label key={`${layer}-${index}`} className="flex min-w-0 flex-col gap-1.5">
            <span className="truncate text-micro font-semibold text-subdued" title={layer}>
              {layer}<span className="text-danger"> *</span>
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={current[index]?.trim() ?? ""}
              placeholder="Enter lot size"
              onChange={(event) => update(index, event.target.value)}
              className="h-10 w-full rounded-control border border-border-strong bg-surface px-3 font-mono text-small text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-accent-soft"
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function FieldControl({ root, schema, fieldKey = "", value, onChange }: { root: JsonSchema; schema: JsonSchema; fieldKey?: string; value: unknown; onChange: (value: unknown) => void }) {
  const node = resolveSchema(root, schema);
  const referenceOptions = fieldKey === "in_process_checks_frequency"
    ? root.x_ui_reference?.in_process_checks_frequency_options || []
    : [];
  const options = referenceOptions.length ? referenceOptions : schemaOptions(node);
  if (node.type === "boolean") return <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-primary" />;
  if (options.length) return <select value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="h-10 w-28 rounded-control border border-border-strong bg-surface px-3 text-small text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-accent-soft"><option value="">Select…</option>{options.filter(Boolean).map((option) => <option key={option} value={option}>{option.replace(/_/g, " ")}</option>)}</select>;
  return <input type={node.type === "number" || node.type === "integer" ? "number" : "text"} value={String(value ?? "")} placeholder={node.description ? "Enter value" : ""} onChange={(event) => onChange(event.target.value)} className="h-10 w-28 rounded-control border border-border-strong bg-surface px-3 font-mono text-small text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-accent-soft" />;
}

function CompactField({ root, schema, fieldKey = "", value, required = false, onChange }: { root: JsonSchema; schema: JsonSchema; fieldKey?: string; value: unknown; required?: boolean; onChange: (value: unknown) => void }) {
  const node = resolveSchema(root, schema);
  return <label className="flex min-w-0 flex-col gap-1.5 text-micro font-semibold text-subdued"><span>{node.title || "Value"}{required ? <span className="text-danger"> *</span> : null}</span><FieldControl root={root} schema={node} fieldKey={fieldKey} value={value} onChange={onChange} /></label>;
}
