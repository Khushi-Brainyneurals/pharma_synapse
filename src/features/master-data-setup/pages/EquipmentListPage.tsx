import { Download, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { masterDataAccess } from "../access";
import { HowThisWorks } from "../components/HowThisWorks";
import { MasterDataApprovalCard } from "../components/MasterDataApprovalCard";
import { SetupShell } from "../components/SetupShell";
import { StepFooter } from "../components/StepFooter";
import { STEPS, type EquipmentRow } from "../model/setup.model";
import { printListPdf } from "../exportPdf";
import { useSetupStore } from "../state/setupStore";
import { useAuthStore } from "../../auth/state/auth.store";
import { USER_ROLE_LABELS } from "../../auth/model/roles";
import { EquipmentMasterTable } from "../components/EquipmentMasterTable";
import {
  backendEquipmentToEquipmentRow,
  decideEquipmentApproval,
  getEquipmentApproval,
  getEquipments,
  saveEquipments,
  submitEquipmentApproval,
  type ApprovalState,
  type BackendEquipmentRow,
} from "../../master-data/api/equipmentInstrument.api";

export function EquipmentListPage() {
  const user = useAuthStore((s) => s.user);
  const canEdit = masterDataAccess(user?.role).canEdit;
  const rows = useSetupStore((s) => s.equipment);
  const update = useSetupStore((s) => s.updateEquip);
  const setEquipmentRows = useSetupStore((s) => s.setEquipmentRows);
  const addRow = useSetupStore((s) => s.addEquipRow);
  const removeRow = useSetupStore((s) => s.removeEquipRow);

  const [searchQuery, setSearchQuery] = useState("");
  const [approval, setApproval] = useState<ApprovalState | null>(null);
  const [isApprovalLoading, setIsApprovalLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [serverBaseline, setServerBaseline] = useState<BackendEquipmentRow[]>([]);

  // Load approval state and backend rows if available
  const loadApproval = useCallback(async () => {
    setIsApprovalLoading(true);
    try {
      const state = await getEquipmentApproval();
      setApproval(state);
    } catch {
      // Non-blocking
    } finally {
      setIsApprovalLoading(false);
    }
  }, []);

  const loadServerRows = useCallback(async () => {
    try {
      const serverRows = await getEquipments();
      if (serverRows && serverRows.length > 0) {
        setServerBaseline(serverRows);
        const mapped = serverRows.map(backendEquipmentToEquipmentRow);
        setEquipmentRows(mapped);
      }
    } catch {
      // Offline fallback: retains seed in setupStore
    }
  }, [setEquipmentRows]);

  useEffect(() => {
    void loadApproval();
    void loadServerRows();
  }, [loadApproval, loadServerRows]);

  const idCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rows) {
      const id = r.mcId.trim();
      if (id) m[id] = (m[id] ?? 0) + 1;
    }
    return m;
  }, [rows]);

  const rowValid = (r: EquipmentRow) =>
    Boolean(r.name.trim()) && Boolean(r.mcId.trim()) && idCounts[r.mcId.trim()] === 1;
  const complete = rows.filter(rowValid).length;
  const missingIds = rows.filter((r) => !r.mcId.trim()).length;
  const dupIds = Object.values(idCounts).filter((n) => n > 1).length;
  const hasErrors = missingIds > 0 || dupIds > 0 || rows.some((r) => !r.name.trim());

  // Search filter - Page 19 requirement
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.mcId.toLowerCase().includes(q) ||
        r.stage.toLowerCase().includes(q) ||
        r.procStage.toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

  // Compute diff against server baseline - Page 21 requirement
  const changes = useMemo(() => {
    if (!serverBaseline.length) return [];
    const diffs: { key: string; field: string; existing: string; proposed: string }[] = [];
    rows.forEach((r) => {
      const base = serverBaseline.find(
        (b) => b.machine_id_no === r.mcId.trim() || b.sr_no === r.sr,
      );
      if (!base) {
        diffs.push({
          key: r.mcId || `Row ${r.sr}`,
          field: "New Equipment",
          existing: "(none)",
          proposed: `${r.name} (${r.mcId})`,
        });
        return;
      }
      if (base.name_of_machine !== r.name.trim()) {
        diffs.push({
          key: r.mcId || `Row ${r.sr}`,
          field: "Machine Name",
          existing: base.name_of_machine,
          proposed: r.name,
        });
      }
      if ((base.capacity || "") !== (r.capacity === "N/A" ? "" : r.capacity.trim())) {
        diffs.push({
          key: r.mcId || `Row ${r.sr}`,
          field: "Capacity",
          existing: base.capacity || "—",
          proposed: r.capacity || "—",
        });
      }
      if ((base.stage || "") !== r.stage.trim()) {
        diffs.push({
          key: r.mcId || `Row ${r.sr}`,
          field: "Stage",
          existing: base.stage || "—",
          proposed: r.stage || "—",
        });
      }
      const existingCqa = (base as any).cqa || "—";
      const proposedCqa = r.cqa && r.cqa !== "N/A" ? r.cqa : "—";
      if (existingCqa !== proposedCqa) {
        diffs.push({
          key: r.mcId || `Row ${r.sr}`,
          field: "CQA",
          existing: existingCqa,
          proposed: proposedCqa,
        });
      }
    });
    return diffs;
  }, [rows, serverBaseline]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveEquipments(rows);
      await loadServerRows();
      await loadApproval();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    await saveEquipments(rows);
    const updated = await submitEquipmentApproval();
    setApproval(updated);
  };

  const handleDecide = async (decision: "approved" | "rejected", reason?: string) => {
    const updated = await decideEquipmentApproval(decision, reason);
    setApproval(updated);
  };

  const downloadPdf = () =>
    printListPdf({
      title: "Equipment List Master — Tablet · BMR",
      subtitle: "Master data · Equipment — machines & processing stages",
      columns: [
        "Sr.",
        "Name of Machine",
        "Capacity",
        "Working Cap.",
        "M/C ID No.",
        "Stage",
        "Processing Stage",
        "CPP",
        "CQA",
      ],
      rows: rows.map((r) => [
        String(r.sr),
        r.name,
        r.capacity,
        r.workingCap,
        r.mcId,
        r.stage,
        r.procStage,
        r.cpp,
        r.cqa || "—",
      ]),
      by: user ? `${user.username} (${USER_ROLE_LABELS[user.role]})` : "—",
      landscape: true,
    });

  return (
    <SetupShell
      step="equipment"
      title="Equipment list master"
      description=""
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

      {/* Action and Search bar - Page 19 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subdued" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search equipment by name, ID or stage..."
            className="h-9 w-full rounded-control border border-border bg-surface pl-9 pr-3 text-small text-text placeholder:text-subdued focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <p className="mr-2 text-micro font-semibold uppercase tracking-overline text-subdued">
            {rows.length} rows · seeded from BMR template
          </p>
          <button
            type="button"
            onClick={downloadPdf}
            className="inline-flex h-8 items-center gap-1.5 rounded-control border border-border px-3 text-small font-semibold text-subdued hover:bg-muted"
          >
            <Download className="size-4" aria-hidden="true" /> Download list (PDF)
          </button>
        </div>
      </div>

      {/* Equipment Table with filtered rows */}
      <EquipmentMasterTable
        rows={filteredRows}
        totalCount={rows.length}
        completeCount={complete}
        canEdit={canEdit && approval?.status?.toLowerCase() !== "pending"}
        idCounts={idCounts}
        onUpdate={update}
        onAddRow={addRow}
        onRemoveRow={removeRow}
      />

      {/* Equipment Approval Card - Page 14, 18, 21 */}
      <MasterDataApprovalCard
        entityName="Equipment"
        approval={approval}
        isLoading={isApprovalLoading}
        isSaving={isSaving}
        hasErrors={hasErrors}
        changes={changes}
        onSave={handleSave}
        onSubmit={handleSubmit}
        onDecide={handleDecide}
      />

      {canEdit ? (
        <StepFooter
          note={
            missingIds || dupIds ? (
              <span className="text-danger-ink">
                {missingIds} M/C ID missing · {dupIds} duplicate — resolve to continue.
              </span>
            ) : (
              <>
                Autosaved · <span className="font-mono tabular-nums">{complete}</span> / {rows.length} rows complete
              </>
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
