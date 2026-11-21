import { Plus, Trash2 } from "lucide-react";
import type { JsonRecord, ProcedureStage } from "../api/procedureSampling.api";
import { AnalyticalSection, PackingChallengeStudies, ParameterSection } from "./ProcedureSamplingEditor";

type Study = JsonRecord & { id: string; condition: string; type: string };

export function PackingStageEditor({
  stage,
  draft,
  onFieldChange,
  readOnly = false,
}: {
  stage: ProcedureStage;
  draft: JsonRecord;
  onFieldChange: (field: string, value: any) => void;
  readOnly?: boolean;
}) {
  const primary = stage.section_key === "primary_packing";
  const equipment = stage.equipment_details ?? [];
  const challenges = (draft.challenge_parameters ?? []) as JsonRecord[];
  const studies = (draft.challenge_studies ?? []) as Study[];
  const sopNumbers = (draft.equipment_sop_numbers ?? []) as JsonRecord[];
  const cqaRows = primary ? stage.critical_quality_attributes ?? [] : [];
  const tests = (stage.available_tests ?? []).map((item: any) =>
    typeof item === "string" ? item : String(item.name ?? item.test ?? item.label ?? ""),
  ).filter(Boolean);

  const updateRow = (rows: JsonRecord[], index: number, field: string, value: any, callback: (next: JsonRecord[]) => void) =>
    callback(rows.map((row, i) => i === index ? { ...row, [field]: value } : row));

  if (readOnly) return <div className="grid gap-4"><ReadOnlyRows title="Equipment" rows={equipment} /><ReadOnlyRows title="Instruments" rows={stage.instruments ?? []} /><p className="rounded-control border border-border bg-muted/40 p-3 text-small text-subdued">Packing material dispensing is sourced from the BPR and is read-only.</p></div>;

  if (!primary) return <div className="grid gap-4">
    <ReadOnlyRows title="Equipment" rows={equipment} />
    <ReadOnlyRows title="Instruments" rows={stage.instruments ?? []} />
    <ParameterSection title="Critical Process Parameters" sourceRows={stage.critical_process_parameters} rows={draft.additional_cpp_rows ?? []} onChange={(rows) => onFieldChange("additional_cpp_rows", rows)} disabled={false} packing />
  </div>;

  return (
    <div className="grid gap-4">
      <ReadOnlyRows title="Equipment" rows={equipment} />
      <ReadOnlyRows title="Instruments" rows={stage.instruments ?? []} />
      <ParameterSection title="Critical Process Parameters" sourceRows={stage.critical_process_parameters} rows={draft.additional_cpp_rows ?? []} onChange={(rows) => onFieldChange("additional_cpp_rows", rows)} disabled={false} packing />
      {primary ? <>
        <ParameterSection title="Critical Quality Attributes" sourceRows={cqaRows} rows={draft.additional_cqa_rows ?? []} onChange={(rows) => onFieldChange("additional_cqa_rows", rows)} disabled={false} packing />
        <AnalyticalSection rows={draft.analytical_methodology ?? []} onChange={(rows) => onFieldChange("analytical_methodology", rows)} disabled={false} qualityAttributes={[...new Set([...cqaRows, ...(draft.additional_cqa_rows ?? [])].map((row: JsonRecord) => String(row.parameter ?? "")).filter(Boolean))]} />
      </> : null}
      <Card title="Equipment SOP numbers">
        <div className="grid gap-3">
          {sopNumbers.map((row, index) => <div key={`${row.id_no}-${index}`} className="grid items-end gap-3 rounded-control border border-border p-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="grid gap-1 text-micro font-medium text-text">Equipment
              <select className={inputClass} aria-label={`Equipment for SOP number ${index + 1}`} value={row.id_no ?? ""} onChange={(e) => onFieldChange("equipment_sop_numbers", sopNumbers.map((item, i) => i === index ? { ...item, id_no: e.target.value } : item))}>
                <option value="">Select equipment</option>
                {equipment.map((item: JsonRecord) => <option key={item.id_no} value={item.id_no} disabled={sopNumbers.some((other, i) => i !== index && String(other.id_no) === String(item.id_no))}>{item.name} ({item.id_no})</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-micro font-medium text-text">Operation SOP number
              <input className={inputClass} aria-label={`SOP number ${index + 1}`} value={row.operation_sop_no ?? ""} onChange={(e) => onFieldChange("equipment_sop_numbers", sopNumbers.map((item, i) => i === index ? { ...item, operation_sop_no: e.target.value } : item))} placeholder="Enter SOP number" />
            </label>
            <button type="button" title="Remove SOP number" aria-label={`Remove SOP number ${index + 1}`} className="mb-1 inline-flex size-9 items-center justify-center rounded-control text-danger hover:bg-danger-soft" onClick={() => onFieldChange("equipment_sop_numbers", sopNumbers.filter((_, i) => i !== index))}><Trash2 className="size-4" /></button>
          </div>)}
          <button type="button" disabled={sopNumbers.length >= equipment.length} className="inline-flex w-fit items-center gap-1.5 rounded-control bg-primary px-3 py-1.5 text-small font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50" onClick={() => {
            const usedIds = new Set(sopNumbers.map((row) => String(row.id_no)));
            const nextEquipment = equipment.find((item: JsonRecord) => !usedIds.has(String(item.id_no)));
            if (nextEquipment) onFieldChange("equipment_sop_numbers", [...sopNumbers, { id_no: nextEquipment.id_no, operation_sop_no: "" }]);
          }}><Plus className="size-4" /> Add SOP number</button>
        </div>
      </Card>
      <Card title="Challenge parameters">
        <p className="mb-3 text-micro text-subdued">Select only parameters listed for the same equipment in the source BPR.</p>
        <div className="grid gap-3">
          {challenges.map((row, index) => <div key={`${row.equipment_id}-${row.parameter}-${index}`} className="grid grid-cols-12 items-end gap-2 rounded-control border border-border p-3">
            <label className="col-span-4 grid gap-1 text-micro text-subdued">Parameter<select className={inputClass} value={`${row.equipment_id ?? ""}::${row.parameter ?? ""}`} onChange={(e) => {
              const [equipmentId, ...parts] = e.target.value.split("::");
              onFieldChange("challenge_parameters", challenges.map((current, i) => i === index ? { ...current, equipment_id: equipmentId, parameter: parts.join("::") } : current));
            }}><option value="">Choose source CPP</option>{challengeOptions(stage).map((option) => <option key={`${option.equipment_id}-${option.parameter}`} value={`${option.equipment_id}::${option.parameter}`}>{option.parameter}</option>)}</select></label>
            <label className="col-span-2 grid gap-1 text-micro text-subdued">Low<input className={inputClass} value={row.low ?? ""} onChange={(e) => updateRow(challenges, index, "low", e.target.value, (next) => onFieldChange("challenge_parameters", next))} /></label>
            <label className="col-span-2 grid gap-1 text-micro text-subdued">High<input className={inputClass} value={row.high ?? ""} onChange={(e) => updateRow(challenges, index, "high", e.target.value, (next) => onFieldChange("challenge_parameters", next))} /></label>
            <label className="col-span-3 grid gap-1 text-micro text-subdued">Printed CPP range<input className={inputClass} value={row.cpp_range ?? ""} onChange={(e) => updateRow(challenges, index, "cpp_range", e.target.value, (next) => onFieldChange("challenge_parameters", next))} placeholder="e.g. 15 to 25 SPM" /></label>
            <button type="button" aria-label="Remove CPP range" className="col-span-1 mb-2 justify-self-center text-danger" onClick={() => onFieldChange("challenge_parameters", challenges.filter((_, i) => i !== index))}><Trash2 className="size-4" /></button>
          </div>)}
          <button type="button" className="w-36 inline-flex items-center gap-1.5 rounded-control bg-primary px-3 py-1.5 text-small font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" onClick={() => onFieldChange("challenge_parameters", [...challenges, { parameter: "", equipment_id: "", low: "", high: "", cpp_range: "" }])}><Plus className="size-4" /> Add CPP range</button>
        </div>
      </Card>
      <PackingChallengeStudies rows={studies} tests={tests} primary={primary} onChange={(rows) => onFieldChange("challenge_studies", rows)} />
    </div>
  );
}

function challengeOptions(stage: ProcedureStage): JsonRecord[] {
  const available = stage.available_challenge_parameters ?? [];
  if (available.length) return available.flatMap((item: any) => {
    if (typeof item === "string") return (stage.equipment_details ?? []).flatMap((equipment: any) => {
      const source = (equipment.cpp_values ?? equipment.critical_process_parameters ?? []).map((row: any) => typeof row === "string" ? row : row.parameter);
      return source.includes(item) ? [{ equipment_id: equipment.id_no ?? "", equipment_name: equipment.name ?? "Equipment", parameter: item }] : [];
    });
    return [{
      equipment_id: item.equipment_id ?? item.id_no ?? item.equipment_id_no ?? "",
      equipment_name: item.equipment_name ?? item.equipment ?? item.name ?? "Equipment",
      parameter: item.parameter ?? item.cpp_name ?? item.name ?? "",
    }];
  });
  return (stage.critical_process_parameters ?? []).map((item: any) => ({ equipment_id: item.equipment_id ?? "", equipment_name: item.equipment_name ?? "Equipment", parameter: item.parameter ?? "" }));
}

function ReadOnlyRows({ title, rows }: { title: string; rows: JsonRecord[] }) {
  return <Card title={title}><div className="grid gap-2">{rows.length ? rows.map((row, i) => <div key={i} className="grid grid-cols-3 gap-2 border-b border-border py-2 text-small last:border-b-0">{["name", "id_no", "operation_sop_no"].map((key) => <span key={key}>{row[key] || "—"}</span>)}</div>) : <p className="text-small text-subdued">No data provided.</p>}</div></Card>;
}
function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="overflow-hidden rounded-card border border-border bg-surface"><h3 className="border-b border-border bg-muted/50 px-4 py-3 text-small font-semibold">{title}</h3><div className="p-4">{children}</div></section>; }
const inputClass = "w-full min-w-0 rounded-control border border-border bg-surface px-3 py-2 text-small text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary";
