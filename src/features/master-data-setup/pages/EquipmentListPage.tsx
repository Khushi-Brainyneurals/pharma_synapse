import { Download } from "lucide-react";
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
import { EquipmentMasterTable } from "../components/EquipmentMasterTable";

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

      <div className="space-y-4">
        <div className="rounded-panel border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold">Equipment — machines &amp; processing stages</p>
              <p className="mt-0.5 max-w-3xl text-small text-subdued">
                {canEdit
                  ? "White cells are yours to fill; the grey Sr. No. column is automatic. CPP names are editable per machine (comma-separated)."
                  : "List of machines, processing stages, and critical process parameters configured for this document set."}
              </p>
            </div>
            <p className="shrink-0 text-right">
              <span className={`font-mono text-small font-semibold tabular-nums ${complete === rows.length ? "text-approved-fg" : "text-draft-fg"}`}>
                {complete} / {rows.length}
              </span>
              <span className="block text-[10px] uppercase tracking-overline text-subdued">Rows complete</span>
            </p>
          </div>
        </div>

        <EquipmentMasterTable
          rows={rows}
          canEdit={canEdit}
          idCounts={idCounts}
          onUpdate={update}
          onAddRow={addRow}
          onRemoveRow={removeRow}
        />
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
