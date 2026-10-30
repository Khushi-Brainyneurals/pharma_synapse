import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { AppHeader } from "../../../../../app/layout/AppHeader";
import { AppSidebar } from "../../../../../app/layout/AppSidebar";
import { getApiErrorMessage } from "../../../../../shared/api/apiError";
import { Callout } from "../../../../../shared/ui/Callout";
import { useAuthStore } from "../../../../auth/state/auth.store";
import { DocumentStepper } from "../../../selection/components/DocumentStepper";
import { SelectionStrip } from "../../../selection/components/SelectionStrip";
import { useDocument } from "../../../selection/hooks/useDocument";
import { useDocumentSelectorData } from "../../../selection/hooks/useDocumentSelectorData";
import { useStepNavigation } from "../../../selection/hooks/useStepNavigation";
import { PVP_PVR_DOCUMENT_STEPS } from "../../../selection/model/documentSelector.config";
import {
  getPvpBom,
  getPvpMaterialSpecifications,
  getPvpProcessFlow,
  updatePvpMaterialSpecifications,
  type PvpBomRow,
  type PvpMaterialSpecificationRow,
} from "../api/processBom.api";

type TabId = "process-flow" | "bom" | "material-specifications";
const TABS: { id: TabId; label: string }[] = [
  { id: "process-flow", label: "Process Flow" },
  { id: "bom", label: "Bill of Materials" },
  { id: "material-specifications", label: "Input Material Specification" },
];

// BOM fields returned by the API that should not be shown as table columns.
const HIDDEN_BOM_COLUMNS = ["is_api", "is_compensated", "is_avg_weight", "notes", "functional_category", "part", "layer"];

const PANEL_CLASS = "bg-muted/50 px-4 py-5 sm:px-6 lg:px-8";

export function PvpProcessBomPage() {
  const { documentId = "" } = useParams();
  const user = useAuthStore((state) => state.user);
  const { context, isLoading: isLoadingContext } = useDocumentSelectorData(user);
  const { document } = useDocument(documentId);
  const { goToStep } = useStepNavigation(documentId);
  const [activeTab, setActiveTab] = useState<TabId>("process-flow");

  const [flowUrl, setFlowUrl] = useState<string | null>(null);
  const [flowLoading, setFlowLoading] = useState(true);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [flowRetry, setFlowRetry] = useState(0);

  const [bom, setBom] = useState<PvpBomRow[]>([]);
  const [bomLoading, setBomLoading] = useState(true);
  const [bomError, setBomError] = useState<string | null>(null);
  const [bomRetry, setBomRetry] = useState(0);

  const [specifications, setSpecifications] = useState<PvpMaterialSpecificationRow[]>([]);
  const [savedSelections, setSavedSelections] = useState<string[]>([]);
  const [specLoading, setSpecLoading] = useState(true);
  const [specError, setSpecError] = useState<string | null>(null);
  const [specRetry, setSpecRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setFlowLoading(true);
    setFlowError(null);
    setFlowUrl(null);
    void getPvpProcessFlow(documentId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setFlowUrl(objectUrl);
      })
      .catch((error: unknown) => {
        if (!cancelled) setFlowError(getApiErrorMessage(error, "Unable to load the process flow."));
      })
      .finally(() => { if (!cancelled) setFlowLoading(false); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId, flowRetry]);

  useEffect(() => {
    let cancelled = false;
    setBomLoading(true);
    setBomError(null);
    void getPvpBom(documentId)
      .then((rows) => { if (!cancelled) setBom(rows); })
      .catch((error: unknown) => {
        if (!cancelled) setBomError(getApiErrorMessage(error, "Unable to load the bill of materials."));
      })
      .finally(() => { if (!cancelled) setBomLoading(false); });
    return () => { cancelled = true; };
  }, [documentId, bomRetry]);

  useEffect(() => {
    let cancelled = false;
    setSpecLoading(true);
    setSpecError(null);
    void getPvpMaterialSpecifications(documentId)
      .then((rows) => {
        if (cancelled) return;
        setSpecifications(rows);
        setSavedSelections(rows.map((row) => row.selected_specification_no));
        setSaveError(null);
        setSaveMessage(null);
      })
      .catch((error: unknown) => {
        if (!cancelled) setSpecError(getApiErrorMessage(error, "Unable to load input material specifications."));
      })
      .finally(() => { if (!cancelled) setSpecLoading(false); });
    return () => { cancelled = true; };
  }, [documentId, specRetry]);

  const currentSelections = specifications.map((row) => row.selected_specification_no);
  const isDirty = currentSelections.some((value, index) => value !== savedSelections[index]);
  const bomColumns = useMemo(() => getBomColumns(bom), [bom]);

  function changeSpecification(index: number, value: string) {
    setSpecifications((rows) => rows.map((row, rowIndex) =>
      rowIndex === index ? { ...row, selected_specification_no: value } : row,
    ));
    setSaveError(null);
    setSaveMessage(null);
  }

  async function saveSpecifications() {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const selections = specifications.flatMap((row, index) =>
        row.selected_specification_no === savedSelections[index]
          ? []
          : [{
              serial_number: row.serial_number,
              material_name: row.material_name,
              specification_no: row.selected_specification_no,
            }],
      );
      await updatePvpMaterialSpecifications(documentId, selections);
      setSavedSelections(specifications.map((row) => row.selected_specification_no));
      setSaveMessage("Specification selections saved.");
    } catch (error) {
      setSaveError(getApiErrorMessage(error, "Unable to save specification selections."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader user={user} unit={context?.unit ?? null} isLoadingUnit={isLoadingContext} />
      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />
        <main className="min-w-0 lg:h-full lg:overflow-y-auto">
          <section className="mx-auto bg-surface shadow-sm">
            <div className="px-4 py-4 sm:px-6 lg:px-8">
              <DocumentStepper steps={PVP_PVR_DOCUMENT_STEPS} activeStepId="process-bom" onStepClick={goToStep} />
            </div>
            <SelectionStrip dosageForm={document?.dosage_form} docType={document?.doc_type} identifier={document?.bmr_number ?? document?.draft_id} />
            <div>
              <div className="flex flex-col items-start justify-between border-b border-border p-5 pb-5">
                <p className="text-micro font-semibold uppercase tracking-overline text-primary">Step 4 of 7</p>
                <h1 className="mt-1 text-h1 font-semibold">Process Flow &amp; BOM</h1>
                <p className="mt-1.5 text-small text-subdued">Review the source process flow and bill of materials, then select specifications for input materials.</p>
              </div>

              <div
                className="grid grid-cols-1 gap-3 bg-muted/50 px-4 py-4 sm:grid-cols-3 sm:px-6 lg:px-8"
                role="tablist"
                aria-label="Process flow and BOM sections"
              >
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    id={`${tab.id}-tab`}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    aria-controls={`${tab.id}-panel`}
                    onClick={() => setActiveTab(tab.id)}
                    className={tabClass(activeTab === tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <section id="process-flow-panel" role="tabpanel" aria-labelledby="process-flow-tab" hidden={activeTab !== "process-flow"} className={PANEL_CLASS}>
                {flowLoading ? <LoadingPanel label="Loading process flow…" /> : null}
                {!flowLoading && flowError ? <Callout tone="danger" title="Process flow unavailable"><p>{flowError}</p><button className="mt-2 font-semibold underline" type="button" onClick={() => setFlowRetry((value) => value + 1)}>Try again</button></Callout> : null}
                {!flowLoading && !flowError && flowUrl ? (
                  <div className="overflow-auto rounded-card border border-border bg-surface p-3 sm:p-5">
                    <img src={flowUrl} alt="PVP/PVR process flow" className="mx-auto h-auto max-w-full object-contain" />
                  </div>
                ) : null}
              </section>

              <section id="bom-panel" role="tabpanel" aria-labelledby="bom-tab" hidden={activeTab !== "bom"} className={PANEL_CLASS}>
                {bomLoading ? <LoadingPanel label="Loading bill of materials…" /> : null}
                {!bomLoading && bomError ? <Callout tone="danger" title="Bill of materials unavailable"><p>{bomError}</p><button className="mt-2 font-semibold underline" type="button" onClick={() => setBomRetry((value) => value + 1)}>Try again</button></Callout> : null}
                {!bomLoading && !bomError && bom.length === 0 ? <EmptyPanel message="No bill of materials were returned for this document." /> : null}
                {!bomLoading && !bomError && bom.length > 0 ? <BomTable rows={bom} columns={bomColumns} /> : null}
              </section>

              <section id="material-specifications-panel" role="tabpanel" aria-labelledby="material-specifications-tab" hidden={activeTab !== "material-specifications"} className={PANEL_CLASS}>
                {specLoading ? <LoadingPanel label="Loading input material specifications…" /> : null}
                {!specLoading && specError ? <Callout tone="danger" title="Input material specifications unavailable"><p>{specError}</p><button className="mt-2 font-semibold underline" type="button" onClick={() => setSpecRetry((value) => value + 1)}>Try again</button></Callout> : null}
                {!specLoading && !specError && specifications.length === 0 ? <EmptyPanel message="No input material specifications were returned for this document." /> : null}
                {!specLoading && !specError && specifications.length > 0 ? (
                  <MaterialSpecificationTable rows={specifications} saving={saving} onChange={changeSpecification} />
                ) : null}
                {saveError ? <div className="mt-4"><Callout tone="danger" title="Save failed">{saveError}</Callout></div> : null}
                {saveMessage ? <p className="mt-4 text-small text-success" role="status">{saveMessage}</p> : null}
                {!specLoading && !specError && specifications.length > 0 ? (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <p className="text-small text-subdued">{isDirty ? "Specification changes are not saved." : "All specification selections are saved."}</p>
                    <button type="button" onClick={() => void saveSpecifications()} disabled={!isDirty || saving} className="rounded-control bg-primary px-5 py-2.5 text-small font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                      {saving ? "Saving…" : "Save specifications"}
                    </button>
                  </div>
                ) : null}
              </section>

              <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-3 border-t border-border bg-surface p-3.5 shadow-auth sm:flex-row sm:justify-between">
                <button type="button" className="rounded-control border border-border px-4 py-2 text-small font-semibold text-subdued" onClick={() => goToStep("cover-details")}>Back</button>
                <button type="button" className="rounded-control bg-primary px-4 py-2 text-small font-semibold text-white" onClick={() => goToStep("cpp-cqa")}>Continue to CPP+CQA</button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function tabClass(active: boolean): string {
  const base = [
    "flex w-full items-center justify-center rounded-control border",
    "px-4 py-3 text-small font-semibold transition-colors",
  ].join(" ");
  const selected = "border-primary/25 bg-accent-soft text-primary-dark";
  const idle = "border-[#dce3e8] bg-white text-[#536273] hover:border-[#9acdcc]";

  return [base, active ? selected : idle].join(" ");
}

function LoadingPanel({ label }: { label: string }) {
  return <div className="flex min-h-36 items-center justify-center gap-3 rounded-panel border border-border bg-muted text-small text-subdued" role="status"><span className="size-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" aria-hidden="true" />{label}</div>;
}

function EmptyPanel({ message }: { message: string }) {
  return <div className="rounded-panel border border-border bg-muted px-5 py-10 text-center text-small text-subdued">{message}</div>;
}

function BomTable({ rows, columns }: { rows: PvpBomRow[]; columns: string[] }) {
  const groups = groupBomRows(rows);
  return (
    <section className="overflow-hidden rounded-card border border-border bg-surface shadow-sm">
      <header className="border-b border-border px-5 py-4">
        <h2 className="text-h2 font-semibold">Bill of Materials</h2>
        <p className="mt-0.5 text-small text-subdued">{rows.length} source rows · read only</p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-small">
          <thead><tr className="text-left text-micro uppercase tracking-overline text-subdued">{columns.map((column) => <th key={column} className={`border border-border bg-surface px-3 py-2.5 font-semibold ${isNumericColumn(column) ? "text-right" : ""}`}>{columnLabel(column)}</th>)}</tr></thead>
          <tbody>
            {groups.map((group, groupIndex) => <Fragment key={`${group.title || "ungrouped"}-${groupIndex}`}>
              {group.title ? <tr key={`${group.title}-header`}><td colSpan={columns.length} className="border border-border bg-primary/10 px-3 py-1.5 text-center text-micro font-semibold uppercase tracking-overline text-text">{group.part}{group.part && group.layer ? " " : ""}{group.layer ? <span className="font-normal normal-case tracking-normal text-subdued">{group.layer}</span> : null}</td></tr> : null}
              {group.rows.map(({ row, index }) => { const total = isTotalRow(row); return <tr key={`${group.title}-${index}`} className={total ? "bg-muted/50 font-semibold" : "hover:bg-muted/50"}>{columns.map((column) => <td key={column} className={`border border-border px-3 py-2 align-top ${isNumericColumn(column) ? "text-right tabular-nums" : ""}`}>{total ? totalDisplayValue(column, row[column]) : displayValue(row[column])}</td>)}</tr>; })}
            </Fragment>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MaterialSpecificationTable({ rows, saving, onChange }: { rows: PvpMaterialSpecificationRow[]; saving: boolean; onChange: (index: number, value: string) => void }) {
  return (
    <section className="overflow-hidden rounded-card border border-border bg-surface shadow-sm">
      <header className="border-b border-border px-5 py-4"><h2 className="text-h2 font-semibold">Input Material Specification</h2><p className="mt-0.5 text-small text-subdued">Choose an available specification for each material. Rows without approved choices have no selectable specification.</p></header>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-small">
          <thead><tr className="text-left text-micro uppercase tracking-overline text-subdued"><th className="w-20 border border-border bg-muted px-3 py-2.5 font-semibold">Serial No.</th><th className="min-w-[16rem] border border-border bg-muted px-3 py-2.5 font-semibold">Material Name</th><th className="min-w-[12rem] border border-border bg-muted px-3 py-2.5 font-semibold">Functional Category</th><th className="min-w-[18rem] border border-border bg-muted px-3 py-2.5 font-semibold">Specification Selection</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={`${row.serial_number}-${index}`} className="hover:bg-muted/50">
            <td className="border border-border px-3 py-2.5 tabular-nums">{row.serial_number || "—"}</td>
            <td className="border border-border px-3 py-2.5">{row.material_name || "—"}</td>
            <td className="border border-border px-3 py-2.5">{row.functional_category || "—"}</td>
            <td className="border border-border px-3 py-2">
              <select aria-label={`Specification for ${row.material_name || `row ${row.serial_number}`}`} disabled={saving || row.available_specifications.length === 0} value={row.selected_specification_no} onChange={(event) => onChange(index, event.target.value)} className="min-h-10 w-full rounded-control border border-border bg-surface px-3 py-2 text-small text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:text-subdued">
                <option value="">{row.available_specifications.length ? "Select a specification" : "No approved specifications"}</option>
                {row.available_specifications.map((option, optionIndex) => <option key={`${option.specification_no}-${optionIndex}`} value={option.specification_no}>{option.specification_no}{option.material_name ? ` — ${option.material_name}` : ""}</option>)}
                {row.selected_specification_no && !row.available_specifications.some((option) => option.specification_no === row.selected_specification_no) ? <option value={row.selected_specification_no}>{row.selected_specification_no}</option> : null}
              </select>
            </td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function getBomColumns(rows: PvpBomRow[]): string[] {
  const preferred = ["sr_no", "material_code", "ingredient_name", "specification", "label_claim_mg_per_tab", "qty_per_mfc_batch", "qty_required_production", "uom"];
  const keys = new Set(rows.flatMap((row) => Object.keys(row)).filter((key) => !HIDDEN_BOM_COLUMNS.includes(key)));
  return [...preferred.filter((key) => keys.has(key)), ...[...keys].filter((key) => !preferred.includes(key))];
}

function groupBomRows(rows: PvpBomRow[]) {
  const groups = new Map<string, { title: string; part: string; layer: string; rows: { row: PvpBomRow; index: number }[] }>();
  rows.forEach((row, index) => {
    const part = stringValue(row.part);
    const layer = stringValue(row.layer);
    const title = [part, layer].filter(Boolean).join(" · ");
    const key = title || "__ungrouped__";
    const group = groups.get(key) ?? { title: key === "__ungrouped__" ? "" : title, part, layer, rows: [] };
    group.rows.push({ row, index });
    groups.set(key, group);
  });
  return [...groups.values()];
}

function columnLabel(key: string) {
  const labels: Record<string, string> = {
    sr_no: "Sr. No.", material_code: "Material Code", ingredient_name: "Ingredients", name: "Ingredients",
    specification: "Spec.", label_claim_mg_per_tab: "Label Claim mg./Tab", qty_per_mfc_batch: "Qty. per MFC batch",
    qty_required_production: "Qty. Required", functional_category: "Functional Category", is_api: "API",
    is_compensated: "Compensated", is_avg_weight: "Average weight", uom: "UOM", part: "Part", layer: "Layer", notes: "Notes",
  };
  return labels[key] ?? key.replace(/_/g, " ");
}

function displayValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isNumericColumn(key: string) {
  return ["sr_no", "label_claim_mg_per_tab", "qty_per_mfc_batch", "qty_required_production"].includes(key);
}

// A row whose serial number is 0 is a total row (e.g. "Average weight of ... layer").
function isTotalRow(row: PvpBomRow): boolean {
  const value = row.sr_no as unknown;
  return value != null && String(value).trim() !== "" && Number(value) === 0;
}

function totalDisplayValue(column: string, value: unknown): string {
  if (column === "sr_no") return "";
  return value == null ? "" : displayValue(value) === "—" ? "" : displayValue(value);
}

function stringValue(value: unknown): string {
  return value == null ? "" : String(value);
}
