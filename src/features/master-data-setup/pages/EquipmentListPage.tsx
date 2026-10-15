import { AlertCircle, CheckCircle2, Download, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { masterDataAccess } from "../access";
import { HowThisWorks } from "../components/HowThisWorks";
import { MasterDataApprovalCard } from "../components/MasterDataApprovalCard";
import { SetupShell } from "../components/SetupShell";
import { StepFooter } from "../components/StepFooter";
import { STEPS, type EquipmentRow } from "../model/setup.model";
import { printListPdf } from "../exportPdf";
import { getSelectedTypeMeta, useSetupStore } from "../state/setupStore";
import { useAuthStore } from "../../auth/state/auth.store";
import { USER_ROLE_LABELS } from "../../auth/model/roles";
import { useNotificationsStore } from "../../notifications/state/notifications.store";
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
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canEdit = masterDataAccess(user?.role).canEdit;
  const dosageFormId = useSetupStore((s) => s.dosageFormId);
  const documentTypeId = useSetupStore((s) => s.documentTypeId);
  const typeMeta = getSelectedTypeMeta(dosageFormId, documentTypeId);
  const rows = useSetupStore((s) => s.equipment);
  const update = useSetupStore((s) => s.updateEquip);
  const setEquipmentRows = useSetupStore((s) => s.setEquipmentRows);
  const addRow = useSetupStore((s) => s.addEquipRow);
  const removeRow = useSetupStore((s) => s.removeEquipRow);

  const [searchQuery, setSearchQuery] = useState("");
  const [approval, setApproval] = useState<ApprovalState | null>(null);
  const [isApprovalLoading, setIsApprovalLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [deletedRowIds, setDeletedRowIds] = useState<number[]>([]);
  const [serverBaseline, setServerBaseline] = useState<BackendEquipmentRow[]>([]);
  const [canonicalBaseline, setCanonicalBaseline] = useState<BackendEquipmentRow[]>(() => {
    try {
      const raw = localStorage.getItem("master_data_approved_baseline_equipment");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [submittedChanges, setSubmittedChanges] = useState<{ key: string; field: string; existing: string; proposed: string }[]>(() => {
    try {
      const raw = localStorage.getItem("master_data_pending_diffs_equipment");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Load approval state and backend rows if available
  const loadApproval = useCallback(async () => {
    setIsApprovalLoading(true);
    try {
      const state = await getEquipmentApproval();
      setApproval(state);
      const currentStatus = state.status?.toLowerCase();
      if (currentStatus === "approved") {
        localStorage.removeItem("master_data_pending_diffs_equipment");
        setSubmittedChanges([]);
        try {
          const serverRows = await getEquipments();
          if (serverRows && serverRows.length > 0) {
            setCanonicalBaseline(serverRows);
            localStorage.setItem("master_data_approved_baseline_equipment", JSON.stringify(serverRows));
          }
        } catch {
          // Non-blocking
        }
      } else if (currentStatus === "pending") {
        try {
          const raw = localStorage.getItem("master_data_pending_diffs_equipment");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setSubmittedChanges(parsed);
            }
          }
        } catch {
          // Non-blocking
        }
      }
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

        // If no baseline stored in localStorage yet, treat initial server rows as baseline
        const existingBaseline = localStorage.getItem("master_data_approved_baseline_equipment");
        if (!existingBaseline || existingBaseline === "[]") {
          setCanonicalBaseline(serverRows);
          localStorage.setItem("master_data_approved_baseline_equipment", JSON.stringify(serverRows));
        }
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

  // Compute diff against canonical approved baseline (or fallback to server baseline)
  const changes = useMemo(() => {
    const isApproved = approval?.status?.toLowerCase() === "approved";
    const baseline = isApproved ? serverBaseline : (canonicalBaseline.length > 0 ? canonicalBaseline : serverBaseline);
    if (!baseline.length) return [];
    const diffs: { key: string; field: string; existing: string; proposed: string }[] = [];

    const norm = (v?: string | null) => {
      const s = (v ?? "").trim();
      return !s || s === "N/A" || s === "—" ? "" : s;
    };

    // Track which baseline rows still exist
    const seenBaselineIds = new Set<string>();

    rows.forEach((r) => {
      const b = baseline.find(
        (item) => (r.mcId && item.machine_id_no === r.mcId.trim()) || (item.sr_no != null && item.sr_no === r.sr),
      );
      if (!b) {
        diffs.push({
          key: r.mcId || `Row ${r.sr}`,
          field: "New Equipment",
          existing: "(none)",
          proposed: `${r.name || "Untitled"} (${r.mcId || "No ID"})`,
        });
        return;
      }
      if (b.machine_id_no) seenBaselineIds.add(b.machine_id_no);
      else if (b.sr_no != null) seenBaselineIds.add(`sr-${b.sr_no}`);

      if (norm(b.name_of_machine) !== norm(r.name)) {
        diffs.push({
          key: r.mcId || `Row ${r.sr}`,
          field: "Machine Name",
          existing: b.name_of_machine,
          proposed: r.name,
        });
      }
      if (norm(b.capacity) !== norm(r.capacity)) {
        diffs.push({
          key: r.mcId || `Row ${r.sr}`,
          field: "Capacity",
          existing: b.capacity || "—",
          proposed: r.capacity || "—",
        });
      }
      if (norm(b.working_capacity) !== norm(r.workingCap)) {
        diffs.push({
          key: r.mcId || `Row ${r.sr}`,
          field: "Working Capacity",
          existing: b.working_capacity || "—",
          proposed: r.workingCap || "—",
        });
      }
      if (norm(b.machine_id_no) !== norm(r.mcId)) {
        diffs.push({
          key: r.mcId || `Row ${r.sr}`,
          field: "M/C ID No.",
          existing: b.machine_id_no || "—",
          proposed: r.mcId || "—",
        });
      }
      if (norm(b.stage) !== norm(r.stage)) {
        diffs.push({
          key: r.mcId || `Row ${r.sr}`,
          field: "Stage",
          existing: b.stage || "—",
          proposed: r.stage || "—",
        });
      }
      if (norm(b.processing_stage) !== norm(r.procStage)) {
        diffs.push({
          key: r.mcId || `Row ${r.sr}`,
          field: "Processing Stage",
          existing: b.processing_stage || "—",
          proposed: r.procStage || "—",
        });
      }
      if (norm(b.cpp) !== norm(r.cpp)) {
        diffs.push({
          key: r.mcId || `Row ${r.sr}`,
          field: "CPP",
          existing: b.cpp || "—",
          proposed: r.cpp || "—",
        });
      }
      if (norm(b.cqa) !== norm(r.cqa)) {
        diffs.push({
          key: r.mcId || `Row ${r.sr}`,
          field: "CQA",
          existing: b.cqa || "—",
          proposed: r.cqa || "—",
        });
      }
    });

    // Detect removed rows
    baseline.forEach((b) => {
      const id = b.machine_id_no || (b.sr_no != null ? `sr-${b.sr_no}` : "");
      if (id && !seenBaselineIds.has(id)) {
        diffs.push({
          key: b.machine_id_no || `Row ${b.sr_no ?? "—"}`,
          field: "Row Deletion",
          existing: b.name_of_machine,
          proposed: "(removed from master)",
        });
      }
    });

    return diffs;
  }, [rows, approval, canonicalBaseline, serverBaseline]);

  const handleRemoveRow = useCallback(
    (sr: number) => {
      const row = rows.find((r) => r.sr === sr);
      if (row?._row_id != null) {
        setDeletedRowIds((prev) => (prev.includes(row._row_id!) ? prev : [...prev, row._row_id!]));
      }
      removeRow(sr);
    },
    [removeRow, rows],
  );

  const handleSave = useCallback(async () => {
    if (isSaving || isSubmitting) return;
    setIsSaving(true);
    setSaveErrorMessage(null);
    setSaveSuccessMessage(null);
    try {
      await saveEquipments(rows, deletedRowIds);
      setDeletedRowIds([]);
      await loadServerRows();
      await loadApproval();
      setSaveSuccessMessage("Equipment changes saved successfully.");
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      setSaveErrorMessage(err.message || "Failed to save equipment list.");
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, isSubmitting, rows, deletedRowIds, loadServerRows, loadApproval]);

  const handleSubmit = useCallback(async () => {
    if (hasErrors || isSubmitting || isSaving) return;
    setIsSubmitting(true);
    setSaveErrorMessage(null);
    setSaveSuccessMessage(null);
    try {
      const snapshot = changes.length > 0 ? [...changes] : [];
      if (deletedRowIds.length > 0) {
        deletedRowIds.forEach((id) => {
          const removed = (canonicalBaseline.length > 0 ? canonicalBaseline : serverBaseline).find(
            (b) => b._row_id === id,
          );
          if (removed && !snapshot.some((s) => s.field === "Row Deletion" && s.existing === removed.name_of_machine)) {
            snapshot.push({
              key: removed.machine_id_no || `ID ${id}`,
              field: "Row Deletion",
              existing: removed.name_of_machine,
              proposed: "(removed from master)",
            });
          }
        });
      }

      await saveEquipments(rows, deletedRowIds);
      setDeletedRowIds([]);
      const updated = await submitEquipmentApproval();
      setApproval(updated);
      await loadApproval();
      await loadServerRows();

      const finalSnapshot = snapshot.length > 0
        ? snapshot
        : [{
            key: "MD-EQUIP",
            field: "Equipment Master",
            existing: "Current baseline",
            proposed: `${rows.length} rows verified & submitted for sign-off`,
          }];

      setSubmittedChanges(finalSnapshot);
      try {
        localStorage.setItem("master_data_pending_diffs_equipment", JSON.stringify(finalSnapshot));
      } catch {
        // Ignore
      }

      // Generate notification for Approver
      const diffCount = snapshot.length;
      useNotificationsStore.getState().addNotification({
        id: `notif-equip-submit-${Date.now()}`,
        category: "md",
        md: { id: "MD-EQUIP", line: "Equipment Master" },
        actor: user?.username || "Reviewer QA",
        actorRole: user?.role ? (USER_ROLE_LABELS[user.role] ?? user.role) : "QA Reviewer",
        action: "Equipment list submitted for approval",
        state: "pending",
        comment: diffCount > 0
          ? `${diffCount} modification${diffCount === 1 ? "" : "s"} submitted for Approver review`
          : "Equipment master list submitted for Approver sign-off",
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        needsAction: true,
        open: "Review diff",
        to: "/master-data-setup/equipment",
      });

      setSaveSuccessMessage("Equipment list submitted for approval.");
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      setSaveErrorMessage(err.message || "Failed to submit equipment list.");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [hasErrors, isSubmitting, isSaving, changes, deletedRowIds, canonicalBaseline, serverBaseline, rows, loadApproval, loadServerRows, user]);

  const handleContinue = async () => {
    if (isSaving || isNavigating) return;
    if (hasErrors) return;
    setIsNavigating(true);
    setSaveErrorMessage(null);
    try {
      if (canEdit && (changes.length > 0 || deletedRowIds.length > 0)) {
        await saveEquipments(rows, deletedRowIds);
        setDeletedRowIds([]);
      }
      navigate(STEPS[3].route);
    } catch (err: any) {
      setSaveErrorMessage(err.message || "Failed to save equipment changes before continuing.");
    } finally {
      setIsNavigating(false);
    }
  };

  const handleDecide = useCallback(async (decision: "approved" | "rejected", reason?: string) => {
    const updated = await decideEquipmentApproval(decision, reason);
    setApproval(updated);
    await loadApproval();
    if (decision === "approved") {
      setSubmittedChanges([]);
      try {
        localStorage.removeItem("master_data_pending_diffs_equipment");
        const currentRows = await getEquipments();
        if (currentRows && currentRows.length > 0) {
          setCanonicalBaseline(currentRows);
          localStorage.setItem("master_data_approved_baseline_equipment", JSON.stringify(currentRows));
        }
      } catch {
        // Ignore
      }

      useNotificationsStore.getState().addNotification({
        id: `notif-equip-approved-${Date.now()}`,
        category: "md",
        md: { id: "MD-EQUIP", line: "Equipment Master" },
        actor: user?.username || "Approver",
        actorRole: user?.role ? (USER_ROLE_LABELS[user.role] ?? user.role) : "Approver",
        action: "Equipment list approved",
        state: "approved",
        comment: "Equipment master list approved and effective",
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        needsAction: false,
        open: "Open",
        to: "/master-data-setup/equipment",
      });
    } else {
      useNotificationsStore.getState().addNotification({
        id: `notif-equip-rejected-${Date.now()}`,
        category: "md",
        md: { id: "MD-EQUIP", line: "Equipment Master" },
        actor: user?.username || "Approver",
        actorRole: user?.role ? (USER_ROLE_LABELS[user.role] ?? user.role) : "Approver",
        action: "Equipment list rejected",
        state: "rejected",
        comment: reason || "Returned for corrections",
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        needsAction: true,
        open: "Edit list",
        to: "/master-data-setup/equipment",
      });
    }
  }, [loadApproval, user]);

  const downloadPdf = () =>
    printListPdf({
      title: `Equipment List Master — ${typeMeta.label}`,
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

      {/* Success / Error notification alerts */}
      {saveSuccessMessage && (
        <div className="flex items-center gap-2 rounded-control border border-emerald-300 bg-emerald-50 p-3 text-small text-emerald-800">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}
      {saveErrorMessage && (
        <div className="flex items-center gap-2 rounded-control border border-danger/30 bg-danger-soft p-3 text-small text-danger-ink">
          <AlertCircle className="size-4 shrink-0 text-danger" />
          <span>{saveErrorMessage}</span>
        </div>
      )}

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
        onRemoveRow={handleRemoveRow}
      />

      {/* Equipment Approval Card - Page 14, 18, 21 */}
      <MasterDataApprovalCard
        entityName="Equipment"
        approval={approval}
        isLoading={isApprovalLoading}
        isSaving={isSaving}
        isSubmitting={isSubmitting}
        hasErrors={hasErrors}
        changes={
          Boolean(approval?.status && ["pending", "submitted", "in_review"].includes(approval.status.toLowerCase()))
            ? (submittedChanges.length > 0 ? submittedChanges : changes)
            : changes
        }
        onSave={handleSave}
        onSubmit={handleSubmit}
        onDecide={handleDecide}
      />

      {canEdit ? (
        <StepFooter
          note={
            isSaving ? (
              <span className="flex items-center gap-1.5 text-primary font-medium">
                <Loader2 className="size-3.5 animate-spin" /> Saving equipment changes…
              </span>
            ) : isSubmitting ? (
              <span className="flex items-center gap-1.5 text-primary font-medium">
                <Loader2 className="size-3.5 animate-spin" /> Submitting equipment for approval…
              </span>
            ) : isNavigating ? (
              <span className="flex items-center gap-1.5 text-primary font-medium">
                <Loader2 className="size-3.5 animate-spin" /> Saving changes…
              </span>
            ) : missingIds || dupIds ? (
              <span className="text-danger-ink">
                {missingIds} M/C ID missing · {dupIds} duplicate — resolve to continue.
              </span>
            ) : (
              <span className="text-subdued">
                <span className="font-mono tabular-nums text-text">{complete}</span> / {rows.length} rows complete
              </span>
            )
          }
          backTo={STEPS[6].route}
          backLabel="Company info"
          continueTo={STEPS[3].route}
          continueLabel="Continue to instrument list"
          onContinue={handleContinue}
          isContinuing={isNavigating}
          disabled={hasErrors}
          disabledReason={hasErrors ? "Fix errors in table before continuing" : undefined}
        />
      ) : (
        <StepFooter
          note="Viewing the equipment master — read only."
          backTo={STEPS[6].route}
          backLabel="Company info"
          continueTo={STEPS[3].route}
          continueLabel="View instrument list"
        />
      )}
    </SetupShell>
  );
}
