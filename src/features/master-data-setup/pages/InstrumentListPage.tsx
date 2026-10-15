import { AlertCircle, CheckCircle2, Download, Loader2, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { masterDataAccess } from "../access";
import { HowThisWorks } from "../components/HowThisWorks";
import { MasterDataApprovalCard } from "../components/MasterDataApprovalCard";
import { SetupShell } from "../components/SetupShell";
import { StepFooter } from "../components/StepFooter";
import { STEPS, type InstrumentRow } from "../model/setup.model";
import { printListPdf } from "../exportPdf";
import { getSelectedTypeMeta, useSetupStore } from "../state/setupStore";
import { useAuthStore } from "../../auth/state/auth.store";
import { USER_ROLE_LABELS } from "../../auth/model/roles";
import { useNotificationsStore } from "../../notifications/state/notifications.store";
import {
  backendInstrumentToInstrumentRow,
  decideInstrumentApproval,
  getInstrumentApproval,
  getInstruments,
  saveInstruments,
  submitInstrumentApproval,
  type ApprovalState,
  type BackendInstrumentRow,
} from "../../master-data/api/equipmentInstrument.api";

export function InstrumentListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canEdit = masterDataAccess(user?.role).canEdit;
  const dosageFormId = useSetupStore((s) => s.dosageFormId);
  const documentTypeId = useSetupStore((s) => s.documentTypeId);
  const typeMeta = getSelectedTypeMeta(dosageFormId, documentTypeId);
  const rows = useSetupStore((s) => s.instrument);
  const update = useSetupStore((s) => s.updateInstr);
  const setStages = useSetupStore((s) => s.setInstrStages);
  const addRow = useSetupStore((s) => s.addInstrRow);
  const removeRow = useSetupStore((s) => s.removeInstrRow);
  const setInstrumentRows = useSetupStore((s) => s.setInstrumentRows);

  const [searchQuery, setSearchQuery] = useState("");
  const [approval, setApproval] = useState<ApprovalState | null>(null);
  const [isApprovalLoading, setIsApprovalLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [deletedRowIds, setDeletedRowIds] = useState<number[]>([]);
  const [serverBaseline, setServerBaseline] = useState<BackendInstrumentRow[]>([]);
  const [canonicalBaseline, setCanonicalBaseline] = useState<BackendInstrumentRow[]>(() => {
    try {
      const raw = localStorage.getItem("master_data_approved_baseline_instrument");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [submittedChanges, setSubmittedChanges] = useState<{ key: string; field: string; existing: string; proposed: string }[]>(() => {
    try {
      const raw = localStorage.getItem("master_data_pending_diffs_instrument");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const loadApproval = useCallback(async () => {
    setIsApprovalLoading(true);
    try {
      const state = await getInstrumentApproval();
      setApproval(state);
      const currentStatus = state.status?.toLowerCase();
      if (currentStatus === "approved") {
        localStorage.removeItem("master_data_pending_diffs_instrument");
        setSubmittedChanges([]);
        try {
          const serverRows = await getInstruments();
          if (serverRows && serverRows.length > 0) {
            setCanonicalBaseline(serverRows);
            localStorage.setItem("master_data_approved_baseline_instrument", JSON.stringify(serverRows));
          }
        } catch {
          // Non-blocking
        }
      } else if (currentStatus === "pending") {
        try {
          const raw = localStorage.getItem("master_data_pending_diffs_instrument");
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
      const serverRows = await getInstruments();
      if (serverRows && serverRows.length > 0) {
        setServerBaseline(serverRows);
        const mapped = serverRows.map(backendInstrumentToInstrumentRow);
        setInstrumentRows(mapped);

        // If no baseline stored in localStorage yet, treat initial server rows as baseline
        const existingBaseline = localStorage.getItem("master_data_approved_baseline_instrument");
        if (!existingBaseline || existingBaseline === "[]") {
          setCanonicalBaseline(serverRows);
          localStorage.setItem("master_data_approved_baseline_instrument", JSON.stringify(serverRows));
        }
      }
    } catch {
      // Offline fallback
    }
  }, [setInstrumentRows]);

  useEffect(() => {
    void loadApproval();
    void loadServerRows();
  }, [loadApproval, loadServerRows]);

  const idCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rows) {
      const id = r.instrumentId.trim();
      if (id) m[id] = (m[id] ?? 0) + 1;
    }
    return m;
  }, [rows]);

  const rowValid = (r: InstrumentRow) =>
    Boolean(r.name.trim()) && Boolean(r.instrumentId.trim()) && idCounts[r.instrumentId.trim()] === 1;
  const complete = rows.filter(rowValid).length;
  const issues = rows.filter((r) => !r.instrumentId.trim() || idCounts[r.instrumentId.trim()] > 1).length;
  const hasErrors = issues > 0 || rows.some((r) => !r.name.trim());

  // Search filter - Page 19 requirement
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.instrumentId.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q) ||
        (Array.isArray(r.stages) ? r.stages.join(", ") : String(r.stages)).toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

  // Diff comparison against canonical approved baseline (or fallback to server baseline)
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
        (item) => (r.instrumentId && item.instrument_id_no === r.instrumentId.trim()) || (item.sr_no != null && item.sr_no === r.sr),
      );
      if (!b) {
        diffs.push({
          key: r.instrumentId || `Row ${r.sr}`,
          field: "New Instrument",
          existing: "(none)",
          proposed: `${r.name || "Untitled"} (${r.instrumentId || "No ID"})`,
        });
        return;
      }
      if (b.instrument_id_no) seenBaselineIds.add(b.instrument_id_no);
      else if (b.sr_no != null) seenBaselineIds.add(`sr-${b.sr_no}`);

      if (norm(b.name_of_instrument) !== norm(r.name)) {
        diffs.push({
          key: r.instrumentId || `Row ${r.sr}`,
          field: "Instrument Name",
          existing: b.name_of_instrument,
          proposed: r.name,
        });
      }
      if (norm(b.instrument_id_no) !== norm(r.instrumentId)) {
        diffs.push({
          key: r.instrumentId || `Row ${r.sr}`,
          field: "Instrument ID No.",
          existing: b.instrument_id_no || "—",
          proposed: r.instrumentId || "—",
        });
      }
      if (norm(b.location) !== norm(r.location)) {
        diffs.push({
          key: r.instrumentId || `Row ${r.sr}`,
          field: "Location",
          existing: b.location || "—",
          proposed: r.location || "—",
        });
      }
      const stageStr = Array.isArray(r.stages) ? r.stages.join(", ") : String(r.stages || "");
      if (norm(b.stage) !== norm(stageStr)) {
        diffs.push({
          key: r.instrumentId || `Row ${r.sr}`,
          field: "Stage(s)",
          existing: b.stage || "—",
          proposed: stageStr || "—",
        });
      }
    });

    // Detect removed rows
    baseline.forEach((b) => {
      const id = b.instrument_id_no || (b.sr_no != null ? `sr-${b.sr_no}` : "");
      if (id && !seenBaselineIds.has(id)) {
        diffs.push({
          key: b.instrument_id_no || `Row ${b.sr_no ?? "—"}`,
          field: "Row Deletion",
          existing: b.name_of_instrument,
          proposed: "(removed from master)",
        });
      }
    });

    return diffs;
  }, [rows, canonicalBaseline, serverBaseline]);

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
      await saveInstruments(rows, deletedRowIds);
      setDeletedRowIds([]);
      await loadServerRows();
      await loadApproval();
      setSaveSuccessMessage("Instrument changes saved successfully.");
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      setSaveErrorMessage(err.message || "Failed to save instrument list.");
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
          if (removed && !snapshot.some((s) => s.field === "Row Deletion" && s.existing === removed.name_of_instrument)) {
            snapshot.push({
              key: removed.instrument_id_no || `ID ${id}`,
              field: "Row Deletion",
              existing: removed.name_of_instrument,
              proposed: "(removed from master)",
            });
          }
        });
      }

      await saveInstruments(rows, deletedRowIds);
      setDeletedRowIds([]);
      const updated = await submitInstrumentApproval();
      setApproval(updated);
      await loadApproval();
      await loadServerRows();

      const finalSnapshot = snapshot.length > 0
        ? snapshot
        : [{
            key: "MD-INST",
            field: "Instrument Master",
            existing: "Current baseline",
            proposed: `${rows.length} rows verified & submitted for sign-off`,
          }];

      setSubmittedChanges(finalSnapshot);
      try {
        localStorage.setItem("master_data_pending_diffs_instrument", JSON.stringify(finalSnapshot));
      } catch {
        // Ignore
      }

      // Generate notification for Approver
      const diffCount = snapshot.length;
      useNotificationsStore.getState().addNotification({
        id: `notif-inst-submit-${Date.now()}`,
        category: "md",
        md: { id: "MD-INST", line: "Instrument Master" },
        actor: user?.username || "Reviewer QA",
        actorRole: user?.role ? (USER_ROLE_LABELS[user.role] ?? user.role) : "QA Reviewer",
        action: "Instrument list submitted for approval",
        state: "pending",
        comment: diffCount > 0
          ? `${diffCount} modification${diffCount === 1 ? "" : "s"} submitted for Approver review`
          : "Instrument master list submitted for Approver sign-off",
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        needsAction: true,
        open: "Review diff",
        to: "/master-data-setup/instruments",
      });

      setSaveSuccessMessage("Instrument list submitted for approval.");
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err: any) {
      setSaveErrorMessage(err.message || "Failed to submit instrument list.");
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
        await saveInstruments(rows, deletedRowIds);
        setDeletedRowIds([]);
      }
      navigate(STEPS[0].route);
    } catch (err: any) {
      setSaveErrorMessage(err.message || "Failed to save instrument changes before continuing.");
    } finally {
      setIsNavigating(false);
    }
  };

  const handleDecide = useCallback(async (decision: "approved" | "rejected", reason?: string) => {
    const updated = await decideInstrumentApproval(decision, reason);
    setApproval(updated);
    await loadApproval();
    if (decision === "approved") {
      setSubmittedChanges([]);
      try {
        localStorage.removeItem("master_data_pending_diffs_instrument");
        const currentRows = await getInstruments();
        if (currentRows && currentRows.length > 0) {
          setCanonicalBaseline(currentRows);
          localStorage.setItem("master_data_approved_baseline_instrument", JSON.stringify(currentRows));
        }
      } catch {
        // Ignore
      }

      useNotificationsStore.getState().addNotification({
        id: `notif-inst-approved-${Date.now()}`,
        category: "md",
        md: { id: "MD-INST", line: "Instrument Master" },
        actor: user?.username || "Approver",
        actorRole: user?.role ? (USER_ROLE_LABELS[user.role] ?? user.role) : "Approver",
        action: "Instrument list approved",
        state: "approved",
        comment: "Instrument master list approved and effective",
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        needsAction: false,
        open: "Open",
        to: "/master-data-setup/instruments",
      });
    } else {
      useNotificationsStore.getState().addNotification({
        id: `notif-inst-rejected-${Date.now()}`,
        category: "md",
        md: { id: "MD-INST", line: "Instrument Master" },
        actor: user?.username || "Approver",
        actorRole: user?.role ? (USER_ROLE_LABELS[user.role] ?? user.role) : "Approver",
        action: "Instrument list rejected",
        state: "rejected",
        comment: reason || "Returned for corrections",
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        needsAction: true,
        open: "Edit list",
        to: "/master-data-setup/instruments",
      });
    }
  }, [loadApproval, user]);

  const downloadPdf = () =>
    printListPdf({
      title: `Instrument List Master — ${typeMeta.label}`,
      subtitle: "Master data · Instruments — measurement & IPQC",
      columns: ["Sr. No.", "Name of Instrument", "Instrument ID No.", "Location", "Stage(s)"],
      rows: rows.map((r) => [
        String(r.sr),
        r.name,
        r.instrumentId,
        r.location,
        Array.isArray(r.stages) ? r.stages.join(" · ") : r.stages,
      ]),
      by: user ? `${user.username} (${USER_ROLE_LABELS[user.role]})` : "—",
    });

  return (
    <SetupShell
      step="instruments"
      title="Instrument list master"
      description=""
    >
      {canEdit ? (
        <HowThisWorks
          items={[
            <>Click a white cell and type — instrument name, ID, location.</>,
            <>Columns with <span className="font-semibold text-danger-ink">*</span> are compulsory · IDs must be unique.</>,
            <>More balances or testers? <span className="font-semibold">Add instrument row</span> · type stage(s) where it appears.</>,
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
            placeholder="Search instrument by name, ID, location or stage..."
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

      <div className="overflow-hidden rounded-panel border border-border bg-surface">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="text-base font-semibold">Instruments — measurement &amp; IPQC</p>
            <p className="mt-0.5 max-w-2xl text-micro text-subdued">
              White cells are yours to fill; the grey Sr. No. column is automatic. Type stage(s) to decide where each
              instrument appears in the Doc Engine.
            </p>
          </div>
          <p className="shrink-0 text-right">
            <span className={`font-mono text-small font-semibold tabular-nums ${complete === rows.length ? "text-approved-fg" : "text-draft-fg"}`}>
              {complete} / {rows.length}
            </span>
            <span className="block text-[10px] uppercase tracking-overline text-subdued">Rows complete</span>
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-small">
            <thead>
              <tr className="border-b border-border bg-muted text-micro uppercase tracking-overline text-subdued">
                <th scope="col" className="w-16 px-2 py-3 font-semibold text-center">Sr. No.</th>
                <th scope="col" className="min-w-48 px-2 py-3 font-semibold">Name of instrument {canEdit ? <span className="text-danger">*</span> : null}</th>
                <th scope="col" className="px-2 py-3 font-semibold">Instrument ID no. {canEdit ? <span className="text-danger">*</span> : null}</th>
                <th scope="col" className="px-2 py-3 font-semibold">Location</th>
                <th scope="col" className="px-2 py-3 font-semibold">Stage</th>
                {canEdit ? <th scope="col" className="w-16 px-2 py-3 font-semibold"><span className="sr-only">Actions</span></th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRows.map((r, index) => {
                const idDup = r.instrumentId.trim() !== "" && idCounts[r.instrumentId.trim()] > 1;
                const idMissing = r.instrumentId.trim() === "";
                const nameMissing = r.name.trim() === "";
                const stageValue = Array.isArray(r.stages) ? r.stages.join(", ") : String(r.stages || "");

                return (
                  <tr key={r.sr} className="align-top hover:bg-sunken/20">
                    <td className="bg-muted/60 px-2 py-2 font-mono text-mono-sm text-subdued text-center align-middle">
                      <span className="inline-flex items-center gap-1.5">
                        {index + 1}
                        {r.isNew ? (
                          <span className="rounded-pill bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary-dark">
                            New
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <Cell
                      value={r.name}
                      onChange={(v) => update(r.sr, "name", v)}
                      canEdit={canEdit}
                      invalid={nameMissing}
                      hint={nameMissing && canEdit ? "Required" : undefined}
                      placeholder="e.g. Weighing Balance"
                    />
                    <Cell
                      value={r.instrumentId}
                      onChange={(v) => update(r.sr, "instrumentId", v)}
                      canEdit={canEdit}
                      mono
                      invalid={idMissing || idDup}
                      hint={idMissing ? "ID required" : idDup ? "Duplicate ID" : undefined}
                      placeholder="e.g. WH/01"
                    />
                    <Cell
                      value={r.location}
                      onChange={(v) => update(r.sr, "location", v)}
                      canEdit={canEdit}
                      placeholder="e.g. Dispensing area-1"
                    />
                    {/* Free-text stage input as per PDF Page 18 ("remove selection, let user type") */}
                    <Cell
                      value={stageValue}
                      onChange={(v) => {
                        const parts = v.split(",").map((p) => p.trim()).filter(Boolean);
                        setStages(r.sr, parts);
                      }}
                      canEdit={canEdit}
                      placeholder="e.g. Granulation, Compression"
                    />
                    {canEdit ? (
                      <td className="px-2 py-2 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(r.sr)}
                          className="inline-flex size-8 items-center justify-center rounded-control text-danger transition hover:bg-danger-soft focus:outline-none focus:ring-2 focus:ring-primary"
                          aria-label={`Remove row ${index + 1}`}
                        >
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
            <button
              type="button"
              onClick={addRow}
              className="rounded-control border border-dashed border-border px-3 py-1.5 text-small font-semibold text-subdued hover:border-primary hover:text-primary"
            >
              + Add instrument row
            </button>
            <span className="ml-2 text-micro text-subdued">
              New rows need name + unique instrument ID; type stages comma-separated.
            </span>
          </div>
        ) : null}
      </div>

      {/* Instrument Approval Card - Page 14, 18, 21 */}
      <MasterDataApprovalCard
        entityName="Instrument"
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
                <Loader2 className="size-3.5 animate-spin" /> Saving instrument changes…
              </span>
            ) : isSubmitting ? (
              <span className="flex items-center gap-1.5 text-primary font-medium">
                <Loader2 className="size-3.5 animate-spin" /> Submitting instruments for approval…
              </span>
            ) : isNavigating ? (
              <span className="flex items-center gap-1.5 text-primary font-medium">
                <Loader2 className="size-3.5 animate-spin" /> Saving changes…
              </span>
            ) : issues ? (
              <span className="text-danger-ink">
                {issues} row(s) need a valid, unique ID — resolve to continue.
              </span>
            ) : (
              <span className="text-subdued">
                <span className="font-mono tabular-nums text-text">{complete}</span> / {rows.length} rows complete
              </span>
            )
          }
          backTo={STEPS[2].route}
          backLabel="Equipment list"
          continueTo={STEPS[0].route}
          continueLabel="Continue to dependent data (Type)"
          onContinue={handleContinue}
          isContinuing={isNavigating}
          disabled={hasErrors}
          disabledReason={hasErrors ? "Fix errors in table before continuing" : undefined}
        />
      ) : (
        <StepFooter
          note="Viewing the instrument master — read only."
          backTo={STEPS[2].route}
          backLabel="Equipment list"
          continueTo={STEPS[0].route}
          continueLabel="View dependent data (Type)"
        />
      )}
    </SetupShell>
  );
}

function Cell({
  value,
  onChange,
  canEdit,
  mono,
  invalid,
  hint,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  canEdit: boolean;
  mono?: boolean;
  invalid?: boolean;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <td className="px-2 py-2">
      {canEdit ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`min-h-9 w-full rounded-control border bg-surface px-2.5 py-1.5 text-sm text-text transition placeholder:text-subdued/70 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
            mono ? "font-mono tabular-nums" : ""
          } ${
            invalid
              ? "border-danger focus:border-danger text-danger"
              : "border-border focus:border-primary"
          }`}
        />
      ) : (
        <span className={`block px-2.5 py-1.5 ${mono ? "font-mono tabular-nums" : ""} ${value ? "text-text" : "text-subdued/60"}`}>
          {value || "—"}
        </span>
      )}
      {hint ? <span className="mt-0.5 block text-micro font-medium text-danger">{hint}</span> : null}
    </td>
  );
}
