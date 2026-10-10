import { Download, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { masterDataAccess } from "../access";
import { HowThisWorks } from "../components/HowThisWorks";
import { MasterDataApprovalCard } from "../components/MasterDataApprovalCard";
import { SetupShell } from "../components/SetupShell";
import { StepFooter } from "../components/StepFooter";
import { STEPS, type InstrumentRow } from "../model/setup.model";
import { printListPdf } from "../exportPdf";
import { useSetupStore } from "../state/setupStore";
import { useAuthStore } from "../../auth/state/auth.store";
import { USER_ROLE_LABELS } from "../../auth/model/roles";
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
  const user = useAuthStore((s) => s.user);
  const canEdit = masterDataAccess(user?.role).canEdit;
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
  const [serverBaseline, setServerBaseline] = useState<BackendInstrumentRow[]>([]);

  const loadApproval = useCallback(async () => {
    setIsApprovalLoading(true);
    try {
      const state = await getInstrumentApproval();
      setApproval(state);
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

  // Diff comparison against server baseline - Page 21 requirement
  const changes = useMemo(() => {
    if (!serverBaseline.length) return [];
    const diffs: { key: string; field: string; existing: string; proposed: string }[] = [];
    rows.forEach((r) => {
      const base = serverBaseline.find(
        (b) => b.instrument_id_no === r.instrumentId.trim() || b.sr_no === r.sr,
      );
      if (!base) {
        diffs.push({
          key: r.instrumentId || `Row ${r.sr}`,
          field: "New Instrument",
          existing: "(none)",
          proposed: `${r.name} (${r.instrumentId})`,
        });
        return;
      }
      if (base.name_of_instrument !== r.name.trim()) {
        diffs.push({
          key: r.instrumentId || `Row ${r.sr}`,
          field: "Instrument Name",
          existing: base.name_of_instrument,
          proposed: r.name,
        });
      }
      if ((base.location || "") !== r.location.trim()) {
        diffs.push({
          key: r.instrumentId || `Row ${r.sr}`,
          field: "Location",
          existing: base.location || "—",
          proposed: r.location || "—",
        });
      }
      const stageStr = Array.isArray(r.stages) ? r.stages.join(", ") : String(r.stages);
      if ((base.stage || "") !== stageStr) {
        diffs.push({
          key: r.instrumentId || `Row ${r.sr}`,
          field: "Stage(s)",
          existing: base.stage || "—",
          proposed: stageStr || "—",
        });
      }
    });
    return diffs;
  }, [rows, serverBaseline]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveInstruments(rows);
      await loadServerRows();
      await loadApproval();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    await saveInstruments(rows);
    const updated = await submitInstrumentApproval();
    setApproval(updated);
  };

  const handleDecide = async (decision: "approved" | "rejected", reason?: string) => {
    const updated = await decideInstrumentApproval(decision, reason);
    setApproval(updated);
  };

  const downloadPdf = () =>
    printListPdf({
      title: "Instrument List Master — Tablet · BMR",
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
                          onClick={() => removeRow(r.sr)}
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
        hasErrors={hasErrors}
        changes={changes}
        onSave={handleSave}
        onSubmit={handleSubmit}
        onDecide={handleDecide}
      />

      {canEdit ? (
        <StepFooter
          note={
            issues ? (
              <span className="text-danger-ink">
                {issues} row(s) need a valid, unique ID — resolve to continue.
              </span>
            ) : (
              <>
                Autosaved · <span className="font-mono tabular-nums">{complete}</span> / {rows.length} rows complete
              </>
            )
          }
          backTo={STEPS[2].route}
          backLabel="Equipment list"
          continueTo={STEPS[4].route}
          continueLabel="Continue to other documents"
        />
      ) : (
        <StepFooter
          note="Viewing the instrument master — read only."
          backTo={STEPS[2].route}
          backLabel="Equipment list"
          continueTo={STEPS[5].route}
          continueLabel="Back to Master data"
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
