import { Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { EquipmentRow } from "../model/setup.model";

interface EquipmentMasterTableProps {
  rows: EquipmentRow[];
  canEdit: boolean;
  idCounts: Record<string, number>;
  onUpdate: (sr: number, field: keyof EquipmentRow, value: string) => void;
  onAddRow: () => void;
  onRemoveRow: (sr: number) => void;
}

function parseChips(value: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function EquipmentMasterTable({
  rows,
  canEdit,
  idCounts,
  onUpdate,
  onAddRow,
  onRemoveRow,
}: EquipmentMasterTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  // Extract all distinct stages for filtering dropdown
  const distinctStages = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.stage.trim()) {
        set.add(r.stage.trim());
      }
    }
    return Array.from(set).sort();
  }, [rows]);

  // Filter rows by search term and selected stage
  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesStage = stageFilter === "all" || r.stage.trim() === stageFilter;
      if (!matchesStage) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.mcId.toLowerCase().includes(q) ||
        r.stage.toLowerCase().includes(q) ||
        r.procStage.toLowerCase().includes(q) ||
        r.cpp.toLowerCase().includes(q)
      );
    });
  }, [rows, searchTerm, stageFilter]);

  return (
    <div className="space-y-3">
      {/* Search and Stage Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative min-w-[240px] max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subdued" aria-hidden="true" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter machine, ID, stage or CPP..."
              className="h-9 w-full rounded-control border border-border bg-surface pl-9 pr-8 text-small placeholder:text-subdued/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-subdued hover:text-text"
                aria-label="Clear filter"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {distinctStages.length > 0 ? (
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="h-9 rounded-control border border-border bg-surface px-3 text-small text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All stages ({distinctStages.length})</option>
              {distinctStages.map((stg) => (
                <option key={stg} value={stg}>
                  {stg}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <p className="text-micro font-medium text-subdued">
          Showing <span className="font-semibold text-text">{filteredRows.length}</span> of {rows.length} rows
        </p>
      </div>

      {/* Main Formatted Table */}
      <div className="overflow-x-auto rounded-panel border border-border bg-surface shadow-sm">
        <table className="w-full min-w-[1100px] border-collapse text-left text-small">
          <thead className="border-b border-border bg-muted/80 text-micro uppercase tracking-wider text-subdued font-semibold">
            <tr>
              <th scope="col" className="w-14 min-w-[56px] px-3 py-3 text-center">
                Sr.
              </th>
              <th scope="col" className="w-60 min-w-[220px] px-3 py-3">
                Name of machine {canEdit ? <span className="text-danger">*</span> : null}
              </th>
              <th scope="col" className="w-28 min-w-[100px] px-3 py-3">
                Capacity
              </th>
              <th scope="col" className="w-28 min-w-[100px] px-3 py-3">
                Working cap.
              </th>
              <th scope="col" className="w-32 min-w-[115px] px-3 py-3">
                M/C ID no. {canEdit ? <span className="text-danger">*</span> : null}
              </th>
              <th scope="col" className="w-36 min-w-[130px] px-3 py-3">
                Stage
              </th>
              <th scope="col" className="w-72 min-w-[260px] px-3 py-3">
                Processing stage
              </th>
              <th scope="col" className="w-80 min-w-[280px] px-3 py-3">
                CPP
              </th>
              {canEdit ? (
                <th scope="col" className="w-14 min-w-[56px] px-2 py-3 text-center">
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={canEdit ? 9 : 8}
                  className="px-4 py-12 text-center text-small text-subdued"
                >
                  {searchTerm || stageFilter !== "all"
                    ? "No equipment rows match your filter."
                    : "No equipment rows found."}
                </td>
              </tr>
            ) : (
              filteredRows.map((r, index) => {
                const idDup = r.mcId.trim() !== "" && idCounts[r.mcId.trim()] > 1;
                const idMissing = r.mcId.trim() === "";
                const nameMissing = r.name.trim() === "";
                const procChips = parseChips(r.procStage);
                const cppChips = parseChips(r.cpp);

                return (
                  <tr
                    key={r.sr}
                    className="align-top transition-colors hover:bg-muted/40"
                  >
                    {/* Sr. No. */}
                    <td className="w-14 min-w-[56px] bg-muted/30 px-3 py-3 text-center font-mono text-mono-sm tabular-nums text-subdued">
                      {index + 1}
                    </td>

                    {/* Name of machine */}
                    <td className="w-60 min-w-[220px] px-3 py-2.5">
                      {canEdit ? (
                        <div>
                          <input
                            type="text"
                            value={r.name}
                            onChange={(e) => onUpdate(r.sr, "name", e.target.value)}
                            placeholder="e.g. Dispensing Booth"
                            aria-label={`Machine name, row ${r.sr}`}
                            className={`min-h-9 w-full rounded-control border bg-surface px-2.5 py-1.5 text-sm text-text transition focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                              nameMissing
                                ? "border-danger focus:border-danger bg-danger-soft/20"
                                : "border-border focus:border-primary"
                            }`}
                          />
                          {nameMissing ? (
                            <p className="mt-1 text-micro font-medium text-danger">Machine name required</p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="font-semibold text-text leading-snug block">
                          {r.name || "—"}
                        </span>
                      )}
                    </td>

                    {/* Capacity */}
                    <td className="w-28 min-w-[100px] px-3 py-2.5">
                      {canEdit ? (
                        <input
                          type="text"
                          value={r.capacity}
                          onChange={(e) => onUpdate(r.sr, "capacity", e.target.value)}
                          placeholder="e.g. 150 Lit."
                          aria-label={`Capacity, row ${r.sr}`}
                          className="min-h-9 w-full rounded-control border border-border bg-surface px-2.5 py-1.5 text-sm text-text transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      ) : (
                        <span className={`text-small ${r.capacity === "N/A" ? "text-subdued font-mono text-xs" : "text-text"}`}>
                          {r.capacity || "—"}
                        </span>
                      )}
                    </td>

                    {/* Working Capacity */}
                    <td className="w-28 min-w-[100px] px-3 py-2.5">
                      {canEdit ? (
                        <input
                          type="text"
                          value={r.workingCap}
                          onChange={(e) => onUpdate(r.sr, "workingCap", e.target.value)}
                          placeholder="e.g. 120 Lit."
                          aria-label={`Working capacity, row ${r.sr}`}
                          className="min-h-9 w-full rounded-control border border-border bg-surface px-2.5 py-1.5 text-sm text-text transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      ) : (
                        <span className={`text-small ${r.workingCap === "N/A" ? "text-subdued font-mono text-xs" : "text-text"}`}>
                          {r.workingCap || "—"}
                        </span>
                      )}
                    </td>

                    {/* M/C ID No. */}
                    <td className="w-32 min-w-[115px] px-3 py-2.5">
                      {canEdit ? (
                        <div>
                          <input
                            type="text"
                            value={r.mcId}
                            onChange={(e) => onUpdate(r.sr, "mcId", e.target.value)}
                            placeholder="e.g. D-11"
                            aria-label={`M/C ID no., row ${r.sr}`}
                            className={`min-h-9 w-full rounded-control border bg-surface px-2.5 py-1.5 font-mono text-sm transition focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                              idMissing || idDup
                                ? "border-danger focus:border-danger bg-danger-soft/20 text-danger"
                                : "border-border focus:border-primary text-text"
                            }`}
                          />
                          {idMissing ? (
                            <p className="mt-1 text-micro font-medium text-danger">ID required</p>
                          ) : idDup ? (
                            <p className="mt-1 text-micro font-medium text-danger">Duplicate ID</p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="inline-flex items-center rounded bg-muted/80 px-2 py-0.5 font-mono text-xs font-semibold text-text border border-border/50">
                          {r.mcId || "—"}
                        </span>
                      )}
                    </td>

                    {/* Stage */}
                    <td className="w-36 min-w-[130px] px-3 py-2.5">
                      {canEdit ? (
                        <input
                          type="text"
                          value={r.stage}
                          onChange={(e) => onUpdate(r.sr, "stage", e.target.value)}
                          placeholder="e.g. Granulation"
                          aria-label={`Stage, row ${r.sr}`}
                          className="min-h-9 w-full rounded-control border border-border bg-surface px-2.5 py-1.5 text-sm text-text transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      ) : (
                        <span className="inline-flex items-center rounded-pill bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary-dark">
                          {r.stage || "—"}
                        </span>
                      )}
                    </td>

                    {/* Processing stage */}
                    <td className="w-72 min-w-[260px] px-3 py-2.5">
                      {canEdit ? (
                        <textarea
                          rows={2}
                          value={r.procStage}
                          onChange={(e) => onUpdate(r.sr, "procStage", e.target.value)}
                          placeholder="Processing stage(s), comma-separated"
                          aria-label={`Processing stages, row ${r.sr}`}
                          className="w-full resize-y rounded-control border border-border bg-surface px-2.5 py-1.5 text-sm text-text transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      ) : (
                        <div className="flex flex-wrap gap-1.5 py-0.5">
                          {procChips.length > 0 ? (
                            procChips.map((chip, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center rounded-pill border border-border/70 bg-muted/90 px-2.5 py-0.5 text-xs font-medium text-text shadow-2xs"
                              >
                                {chip}
                              </span>
                            ))
                          ) : (
                            <span className="text-subdued/50 italic text-xs">—</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* CPP */}
                    <td className="w-80 min-w-[280px] px-3 py-2.5">
                      {canEdit ? (
                        <textarea
                          rows={2}
                          value={r.cpp}
                          onChange={(e) => onUpdate(r.sr, "cpp", e.target.value)}
                          placeholder="CPP names, comma-separated (optional)"
                          aria-label={`CPPs, row ${r.sr}`}
                          className="w-full resize-y rounded-control border border-border bg-surface px-2.5 py-1.5 text-sm text-text transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      ) : (
                        <div className="flex flex-wrap gap-1.5 py-0.5">
                          {cppChips.length > 0 ? (
                            cppChips.map((chip, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center rounded-pill border border-primary/25 bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-primary-dark shadow-2xs"
                              >
                                {chip}
                              </span>
                            ))
                          ) : (
                            <span className="text-subdued/50 italic text-xs">—</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Row Actions */}
                    {canEdit ? (
                      <td className="w-14 min-w-[56px] px-2 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => onRemoveRow(r.sr)}
                          className="inline-flex size-8 items-center justify-center rounded-control text-subdued transition hover:bg-danger-soft hover:text-danger focus:outline-none focus:ring-2 focus:ring-primary"
                          aria-label={`Remove row ${r.sr}`}
                          title={`Remove row ${r.sr}`}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Add row footer */}
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-border bg-surface px-4 py-3">
            <button
              type="button"
              onClick={onAddRow}
              className="inline-flex items-center gap-1.5 rounded-control border border-primary/30 bg-primary/5 px-3 py-1.5 text-small font-semibold text-primary transition hover:bg-primary/10 hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <Plus className="size-4" aria-hidden="true" />
              Add equipment row
            </button>
            <p className="text-micro text-subdued">
              New rows need machine name and unique M/C ID.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
