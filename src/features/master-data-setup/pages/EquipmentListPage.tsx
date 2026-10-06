import { Download, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { masterDataAccess } from "../access";
import { HowThisWorks } from "../components/HowThisWorks";
import { MasterDataZipButton } from "../components/MasterDataZipButton";
import { SaveMasterButton } from "../components/SaveMasterButton";
import { SetupShell } from "../components/SetupShell";
import { equipRowsToMaster } from "../masterDataSync";
import { StepFooter } from "../components/StepFooter";
import { STEPS, type EquipmentRow } from "../model/setup.model";
import { printListPdf } from "../exportPdf";
import { useSetupStore } from "../state/setupStore";
import { useAuthStore } from "../../auth/state/auth.store";
import { USER_ROLE_LABELS } from "../../auth/model/roles";

const CELL = "border border-border/70 px-2 py-1 align-top";

export function EquipmentListPage() {
  const user = useAuthStore((s) => s.user);
  const canEdit = masterDataAccess(user?.role).canEdit;
  const rows = useSetupStore((s) => s.equipment);
  const update = useSetupStore((s) => s.updateEquip);
  const addRow = useSetupStore((s) => s.addEquipRow);
  const removeRow = useSetupStore((s) => s.removeEquipRow);

  const idCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rows) {
      const id = r.mcId.trim();
      if (id) m[id] = (m[id] ?? 0) + 1;
    }
    return m;
  }, [rows]);

  const rowValid = (r: EquipmentRow) => Boolean(r.name.trim()) && Boolean(r.mcId.trim()) && idCounts[r.mcId.trim()] === 1;
  const complete = rows.filter(rowValid).length;
  const missingIds = rows.filter((r) => !r.mcId.trim()).length;
  const dupIds = Object.values(idCounts).filter((n) => n > 1).length;

  const downloadPdf = () =>
    printListPdf({
      title: "Equipment List Master — Tablet · BMR",
      subtitle: "Master data · Equipment — machines & processing stages",
      columns: ["Sr.", "Name of Machine", "Capacity", "Working Cap.", "M/C ID No.", "Stage", "Processing Stage", "CPP"],
      rows: rows.map((r) => [String(r.sr), r.name, r.capacity, r.workingCap, r.mcId, r.stage, r.procStage, r.cpp]),
      by: user ? `${user.username} (${USER_ROLE_LABELS[user.role]})` : "—",
      landscape: true,
    });

  return (
    <SetupShell
      step="equipment"
      title="Equipment list master"
      description="Fill this table the same way as your Excel — click a white cell and type. Grey cells are fixed. Nothing goes live until the Approver signs it off, so it's safe to correct as you go."
    >
      {canEdit ? (
        <HowThisWorks
          items={[
            <>Click a white cell and type — machine name, capacity, ID, stage.</>,
            <>Columns with <span className="font-semibold text-danger-ink">*</span> are compulsory · write <span className="font-mono">N/A</span> where not applicable.</>,
            <>More machines? <span className="font-semibold">Add equipment row</span> · fix any red cell before Continue.</>,
          ]}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-micro font-semibold uppercase tracking-overline text-subdued">{rows.length} rows · seeded from BMR template</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={downloadPdf} className="inline-flex h-8 items-center gap-1.5 rounded-control border border-border px-3 text-small font-semibold text-subdued hover:bg-muted">
            <Download className="size-4" aria-hidden="true" /> Download list (PDF)
          </button>
          <MasterDataZipButton />
          {canEdit ? (
            <SaveMasterButton kind="equipments" noun="machine" buildRows={() => equipRowsToMaster(rows)} />
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-panel border border-border bg-surface">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="text-base font-semibold">Equipment — machines &amp; processing stages</p>
            <p className="mt-0.5 max-w-3xl text-micro text-subdued">
              White cells are yours to fill; the grey Sr. No. column is automatic. CPP names are editable per machine
              (comma-separated) — their limit values are entered later in stage inputs.
            </p>
          </div>
          <p className="shrink-0 text-right">
            <span className={`font-mono text-small font-semibold tabular-nums ${complete === rows.length ? "text-approved-fg" : "text-draft-fg"}`}>{complete} / {rows.length}</span>
            <span className="block text-[10px] uppercase tracking-overline text-subdued">Rows complete</span>
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-small">
            <thead>
              <tr className="bg-sunken/60 text-left text-micro uppercase tracking-overline text-subdued">
                <th className={`${CELL} w-12 text-center`}>Sr.</th>
                <th className={CELL}>Name of machine <span className="text-danger-ink">*</span></th>
                <th className={CELL}>Capacity</th>
                <th className={CELL}>Working cap.</th>
                <th className={CELL}>M/C ID no. <span className="text-danger-ink">*</span></th>
                <th className={CELL}>Stage</th>
                <th className={CELL}>Processing stage</th>
                <th className={CELL}>CPP</th>
                {canEdit ? <th className={`${CELL} w-10`} /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const idDup = r.mcId.trim() !== "" && idCounts[r.mcId.trim()] > 1;
                const idMissing = r.mcId.trim() === "";
                const nameMissing = r.name.trim() === "";
                return (
                  <tr key={r.sr} className="hover:bg-sunken/30">
                    <td className={`${CELL} bg-sunken/50 text-center font-mono tabular-nums text-subdued`}>{r.sr}</td>
                    <ECell value={r.name} onChange={(v) => update(r.sr, "name", v)} canEdit={canEdit} invalid={nameMissing} />
                    <ECell value={r.capacity} onChange={(v) => update(r.sr, "capacity", v)} canEdit={canEdit} />
                    <ECell value={r.workingCap} onChange={(v) => update(r.sr, "workingCap", v)} canEdit={canEdit} />
                    <ECell
                      value={r.mcId}
                      onChange={(v) => update(r.sr, "mcId", v)}
                      canEdit={canEdit}
                      mono
                      invalid={idMissing || idDup}
                      hint={idMissing ? "ID required" : idDup ? "Duplicate ID" : undefined}
                      placeholder="e.g. DS/01/01"
                    />
                    <ECell value={r.stage} onChange={(v) => update(r.sr, "stage", v)} canEdit={canEdit} placeholder="e.g. Granulation" />
                    <ECell value={r.procStage} onChange={(v) => update(r.sr, "procStage", v)} canEdit={canEdit} multiline placeholder="Processing stage(s)" />
                    <ECell value={r.cpp} onChange={(v) => update(r.sr, "cpp", v)} canEdit={canEdit} multiline placeholder="Add CPPs (optional)" />
                    {canEdit ? (
                      <td className={`${CELL} text-center`}>
                        <button type="button" onClick={() => removeRow(r.sr)} className="text-subdued hover:text-danger-ink" aria-label={`Remove row ${r.sr}`}>
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {canEdit ? (
          <div className="border-t border-border px-4 py-3">
            <button type="button" onClick={addRow} className="rounded-control border border-dashed border-border px-3 py-1.5 text-small font-semibold text-subdued hover:border-primary hover:text-primary">
              + Add equipment row
            </button>
            <span className="ml-2 text-micro text-subdued">New rows need name + unique M/C ID; stage mapping picks from the configured stage list.</span>
          </div>
        ) : null}
      </div>

      {canEdit ? (
        <StepFooter
          note={
            missingIds || dupIds ? (
              <span className="text-danger-ink">{missingIds} M/C ID missing · {dupIds} duplicate — resolve to continue.</span>
            ) : (
              <>Autosaved · <span className="font-mono tabular-nums">{complete}</span> / {rows.length} rows complete</>
            )
          }
          backTo={STEPS[1].route}
          backLabel="Stage documents"
          continueTo={STEPS[3].route}
          continueLabel="Continue to instrument list"
        />
      ) : (
        <StepFooter
          note="Viewing the equipment master — read only."
          backTo={STEPS[5].route}
          backLabel="Master data"
          continueTo={STEPS[3].route}
          continueLabel="View instrument list"
        />
      )}
    </SetupShell>
  );
}

function ECell({
  value,
  onChange,
  canEdit,
  mono,
  multiline,
  invalid,
  hint,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  canEdit: boolean;
  mono?: boolean;
  multiline?: boolean;
  invalid?: boolean;
  hint?: string;
  placeholder?: string;
}) {
  const base = `w-full resize-none bg-transparent text-small outline-none ${mono ? "font-mono tabular-nums" : ""} ${invalid ? "text-danger-ink" : "text-text"} placeholder:text-subdued/60`;
  return (
    <td className={`${CELL} ${invalid ? "bg-danger-soft/40" : ""}`}>
      {canEdit ? (
        multiline ? (
          <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={base} />
        ) : (
          <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${base} h-6`} />
        )
      ) : (
        <span className={`block ${mono ? "font-mono tabular-nums" : ""} ${value ? "text-text" : "text-subdued/60"}`}>{value || "—"}</span>
      )}
      {hint ? <span className="mt-0.5 block text-[10px] font-semibold text-danger-ink">{hint}</span> : null}
    </td>
  );
}
