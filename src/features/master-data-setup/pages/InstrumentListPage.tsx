import { Download, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { masterDataAccess } from "../access";
import { HowThisWorks } from "../components/HowThisWorks";
import { MasterDataZipButton } from "../components/MasterDataZipButton";
import { MultiStageSelect } from "../components/MultiStageSelect";
import { SaveMasterButton } from "../components/SaveMasterButton";
import { SetupShell } from "../components/SetupShell";
import { instrRowsToMaster } from "../masterDataSync";
import { StepFooter } from "../components/StepFooter";
import { INSTR_STAGES, STEPS, type InstrumentRow } from "../model/setup.model";
import { printListPdf } from "../exportPdf";
import { useSetupStore } from "../state/setupStore";
import { useAuthStore } from "../../auth/state/auth.store";
import { USER_ROLE_LABELS } from "../../auth/model/roles";

const CELL = "border border-border/70 px-2 py-1.5 align-top";

export function InstrumentListPage() {
  const user = useAuthStore((s) => s.user);
  const canEdit = masterDataAccess(user?.role).canEdit;
  const rows = useSetupStore((s) => s.instrument);
  const update = useSetupStore((s) => s.updateInstr);
  const setStages = useSetupStore((s) => s.setInstrStages);
  const addRow = useSetupStore((s) => s.addInstrRow);
  const removeRow = useSetupStore((s) => s.removeInstrRow);

  const idCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rows) {
      const id = r.instrumentId.trim();
      if (id) m[id] = (m[id] ?? 0) + 1;
    }
    return m;
  }, [rows]);

  const rowValid = (r: InstrumentRow) => Boolean(r.name.trim()) && Boolean(r.instrumentId.trim()) && idCounts[r.instrumentId.trim()] === 1;
  const complete = rows.filter(rowValid).length;
  const issues = rows.filter((r) => !r.instrumentId.trim() || idCounts[r.instrumentId.trim()] > 1).length;

  const downloadPdf = () =>
    printListPdf({
      title: "Instrument List Master — Tablet · BMR",
      subtitle: "Master data · Instruments — measurement & IPQC",
      columns: ["Sr. No.", "Name of Instrument", "Instrument ID No.", "Location", "Stage(s)"],
      rows: rows.map((r) => [String(r.sr), r.name, r.instrumentId, r.location, r.stages.join(" · ")]),
      by: user ? `${user.username} (${USER_ROLE_LABELS[user.role]})` : "—",
    });

  return (
    <SetupShell
      step="instruments"
      title="Instrument list master"
      description="Same as the equipment table — click a white cell and type. One instrument can serve several stages. Nothing goes live until the Approver signs it off."
    >
      {canEdit ? (
        <HowThisWorks
          items={[
            <>Click a white cell and type — instrument name, ID, location.</>,
            <>Columns with <span className="font-semibold text-danger-ink">*</span> are compulsory · IDs must be unique.</>,
            <>More balances or testers? <span className="font-semibold">Add instrument row</span> · stage(s) decide where it appears.</>,
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
            <SaveMasterButton kind="instruments" noun="instrument" buildRows={() => instrRowsToMaster(rows)} />
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-panel border border-border bg-surface">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="text-base font-semibold">Instruments — measurement &amp; IPQC</p>
            <p className="mt-0.5 max-w-2xl text-micro text-subdued">
              White cells are yours to fill; the grey Sr. No. column is automatic. Stage(s) column decides where each
              instrument appears in the Doc Engine.
            </p>
          </div>
          <p className="shrink-0 text-right">
            <span className={`font-mono text-small font-semibold tabular-nums ${complete === rows.length ? "text-approved-fg" : "text-draft-fg"}`}>{complete} / {rows.length}</span>
            <span className="block text-[10px] uppercase tracking-overline text-subdued">Rows complete</span>
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-small">
            <colgroup>
              <col style={{ width: "6%" }} />
              <col style={{ width: "28%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "22%" }} />
              {canEdit ? <col style={{ width: "4%" }} /> : null}
            </colgroup>
            <thead>
              <tr className="bg-sunken/60 text-left text-micro uppercase tracking-overline text-subdued">
                <th className={`${CELL} text-center`}>Sr. No.</th>
                <th className={CELL}>Name of instrument <span className="text-danger-ink">*</span></th>
                <th className={CELL}>Instrument ID no. <span className="text-danger-ink">*</span></th>
                <th className={CELL}>Location</th>
                <th className={CELL}>Stage(s)</th>
                {canEdit ? <th className={CELL} /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const idDup = r.instrumentId.trim() !== "" && idCounts[r.instrumentId.trim()] > 1;
                const idMissing = r.instrumentId.trim() === "";
                const nameMissing = r.name.trim() === "";
                return (
                  <tr key={r.sr} className="hover:bg-sunken/30">
                    <td className={`${CELL} bg-sunken/50 text-center align-middle`}>
                      <span className="font-mono tabular-nums text-subdued">{r.sr}</span>
                      {r.isNew ? (
                        <span className="ml-1 rounded bg-inreview-bg px-1 py-0.5 text-[9px] font-bold uppercase text-inreview-fg">New</span>
                      ) : null}
                    </td>
                    <Cell value={r.name} onChange={(v) => update(r.sr, "name", v)} canEdit={canEdit} invalid={nameMissing} />
                    <Cell
                      value={r.instrumentId}
                      onChange={(v) => update(r.sr, "instrumentId", v)}
                      canEdit={canEdit}
                      mono
                      invalid={idMissing || idDup}
                      hint={idMissing ? "ID required" : idDup ? "Duplicate ID" : undefined}
                    />
                    <Cell value={r.location} onChange={(v) => update(r.sr, "location", v)} canEdit={canEdit} />
                    <td className={CELL}>
                      <MultiStageSelect value={r.stages} options={INSTR_STAGES} onChange={(next) => setStages(r.sr, next)} readOnly={!canEdit} />
                    </td>
                    {canEdit ? (
                      <td className={`${CELL} text-center align-middle`}>
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
              + Add instrument row
            </button>
            <span className="ml-2 text-micro text-subdued">New rows need name + unique instrument ID; stage mapping supports multiple stages per instrument.</span>
          </div>
        ) : null}
      </div>

      {canEdit ? (
        <StepFooter
          note={issues ? <span className="text-danger-ink">{issues} row(s) need a valid, unique ID — resolve to continue.</span> : <>Autosaved · <span className="font-mono tabular-nums">{complete}</span> / {rows.length} rows complete</>}
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
}: {
  value: string;
  onChange: (v: string) => void;
  canEdit: boolean;
  mono?: boolean;
  invalid?: boolean;
  hint?: string;
}) {
  return (
    <td className={`${CELL} ${invalid ? "bg-danger-soft/40" : ""}`}>
      {canEdit ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`h-6 w-full bg-transparent text-small outline-none ${mono ? "font-mono tabular-nums" : ""} ${invalid ? "text-danger-ink" : "text-text"}`}
        />
      ) : (
        <span className={`block ${mono ? "font-mono tabular-nums" : ""} ${value ? "text-text" : "text-subdued/60"}`}>{value || "—"}</span>
      )}
      {hint ? <span className="mt-0.5 block text-[10px] font-semibold text-danger-ink">{hint}</span> : null}
    </td>
  );
}
