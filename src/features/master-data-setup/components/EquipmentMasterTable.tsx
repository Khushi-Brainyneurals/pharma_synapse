import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { EquipmentRow, MasterDataStep } from "../model/setup.model";
import { StepsEditorDialog } from "./StepsEditorDialog";

interface EquipmentMasterTableProps {
  rows: EquipmentRow[];
  totalCount?: number;
  completeCount?: number;
  canEdit: boolean;
  idCounts: Record<string, number>;
  onUpdate: (sr: number, field: keyof EquipmentRow, value: any) => void;
  onAddRow: () => void;
  onRemoveRow: (sr: number) => void;
}

function deriveStepsFromProcessingStage(
  processingStage: string,
  existingSteps: MasterDataStep[],
): MasterDataStep[] {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const part of processingStage.split(",")) {
    const trimmed = part.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    names.push(trimmed);
  }

  return names.map((name) => {
    const existing = existingSteps.find((item) => item.step === name);
    return {
      step: name,
      cpp: existing?.cpp ?? [],
      cqa: existing?.cqa ?? [],
    };
  });
}

function getRowSteps(row: EquipmentRow): MasterDataStep[] {
  if (row.steps && row.steps.length > 0) {
    return row.steps;
  }

  const parts = row.procStage
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return [];
  }

  const cpps =
    row.cpp && row.cpp !== "N/A"
      ? row.cpp
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
      : [];

  const cqas =
    row.cqa && row.cqa !== "N/A"
      ? row.cqa
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
      : [];

  if (parts.length === 1) {
    return [{ step: parts[0], cpp: cpps, cqa: cqas }];
  }

  const cppPerPart = Math.ceil(cpps.length / parts.length);
  const cqaPerPart = Math.ceil(cqas.length / parts.length);
  return parts.map((name, idx) => ({
    step: name,
    cpp: cpps.slice(idx * cppPerPart, (idx + 1) * cppPerPart),
    cqa: cqas.slice(idx * cqaPerPart, (idx + 1) * cqaPerPart),
  }));
}

function summarizeSteps(steps: MasterDataStep[]): string {
  if (steps.length === 0) {
    return "Manage steps";
  }

  const cppCount = steps.reduce((sum, item) => sum + item.cpp.length, 0);
  const cqaCount = steps.reduce((sum, item) => sum + (item.cqa?.length ?? 0), 0);
  const parts = [`${steps.length} step${steps.length === 1 ? "" : "s"}`];
  parts.push(`${cppCount} CPP${cppCount === 1 ? "" : "s"}`);
  if (cqaCount > 0) {
    parts.push(`${cqaCount} CQA${cqaCount === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}

export function EquipmentMasterTable({
  rows,
  canEdit,
  idCounts,
  onUpdate,
  onAddRow,
  onRemoveRow,
}: EquipmentMasterTableProps) {
  const [stepsDialog, setStepsDialog] = useState<{
    rowSr: number;
    machineName: string;
    processingStage: string;
    steps: MasterDataStep[];
  } | null>(null);

  function handleProcStageChange(rowSr: number, newProcStage: string) {
    const row = rows.find((r) => r.sr === rowSr);
    const currentSteps = row ? getRowSteps(row) : [];
    const nextSteps = deriveStepsFromProcessingStage(newProcStage, currentSteps);
    onUpdate(rowSr, "procStage", newProcStage);
    onUpdate(rowSr, "steps", nextSteps);
    const nextCpp = nextSteps.flatMap((s) => s.cpp).join(", ");
    const nextCqa = nextSteps.flatMap((s) => s.cqa ?? []).join(", ");
    onUpdate(rowSr, "cpp", nextCpp);
    onUpdate(rowSr, "cqa", nextCqa);
  }

  function openStepsEditor(row: EquipmentRow) {
    setStepsDialog({
      rowSr: row.sr,
      machineName: row.name,
      processingStage: row.procStage,
      steps: getRowSteps(row),
    });
  }

  function handleSaveSteps(newSteps: MasterDataStep[]) {
    if (!stepsDialog) return;
    const rowSr = stepsDialog.rowSr;
    onUpdate(rowSr, "steps", newSteps);
    const nextCpp = newSteps.flatMap((s) => s.cpp).join(", ");
    const nextCqa = newSteps.flatMap((s) => s.cqa ?? []).join(", ");
    onUpdate(rowSr, "cpp", nextCpp);
    onUpdate(rowSr, "cqa", nextCqa);
    setStepsDialog(null);
  }

  return (
    <div className="overflow-hidden rounded-panel border border-border bg-surface shadow-xs">
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-3.5">
        <div>
          <p className="text-base font-semibold text-text">
            Equipment / Machine
          </p>
          <p className="mt-0.5 text-small text-subdued">
            Sr. No. is derived from row order. Steps come from Processing stage - manage their CPPs
            from the Process steps column.
          </p>
        </div>
        <span className="rounded-pill bg-muted px-3 py-1 font-mono text-mono-sm text-subdued">
          {rows.length} {rows.length === 1 ? "row" : "rows"}
        </span>
      </div>

      {/* Table with rounded-control box inputs */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-small">
          <thead className="border-b border-border bg-muted text-micro uppercase tracking-overline text-subdued">
            <tr>
              <th scope="col" className="w-16 px-2 py-3 font-semibold text-center">
                Sr. No.
              </th>
              <th scope="col" className="min-w-52 px-2 py-3 font-semibold">
                Name of machine {canEdit ? <span className="ml-1 text-danger">*</span> : null}
              </th>
              <th scope="col" className="px-2 py-3 font-semibold">
                Capacity
              </th>
              <th scope="col" className="px-2 py-3 font-semibold">
                Working capacity
              </th>
              <th scope="col" className="px-2 py-3 font-semibold">
                M/C ID No. {canEdit ? <span className="ml-1 text-danger">*</span> : null}
              </th>
              <th scope="col" className="px-2 py-3 font-semibold">
                Stage
              </th>
              <th scope="col" className="min-w-44 px-2 py-3 font-semibold">
                Processing stage
              </th>
              <th scope="col" className="min-w-44 px-2 py-3 font-semibold">
                Process steps, CPPs &amp; CQAs
              </th>
              {canEdit ? (
                <th scope="col" className="w-16 px-2 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={canEdit ? 9 : 8}
                  className="px-4 py-10 text-center text-small text-subdued"
                >
                  No rows have been added to this list yet.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const steps = getRowSteps(row);
                const isNameEmpty = !row.name.trim();
                const isIdEmpty = !row.mcId.trim();
                const isIdDup = (idCounts[row.mcId.trim()] ?? 0) > 1;

                return (
                  <tr key={row.sr} className="align-top hover:bg-sunken/20">
                    {/* Sr. No. */}
                    <td className="bg-muted/60 px-2 py-2 font-mono text-mono-sm text-subdued text-center align-middle">
                      <span className="inline-flex items-center gap-1.5">
                        {index + 1}
                        {row.isNew ? (
                          <span className="rounded-pill bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary-dark">
                            New
                          </span>
                        ) : null}
                      </span>
                    </td>

                    {/* Name of machine */}
                    <td className="min-w-52 px-2 py-2">
                      <input
                        value={row.name}
                        disabled={!canEdit}
                        placeholder={canEdit ? "Machine name" : undefined}
                        aria-label={`Name of machine, row ${index + 1}`}
                        className={`min-h-9 w-full rounded-control border bg-surface px-2.5 py-1.5 text-sm text-text transition placeholder:text-subdued/70 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:text-text ${
                          isNameEmpty && canEdit
                            ? "border-danger focus:border-danger text-danger"
                            : "border-border focus:border-primary"
                        }`}
                        onChange={(e) => onUpdate(row.sr, "name", e.target.value)}
                      />
                    </td>

                    {/* Capacity */}
                    <td className="px-2 py-2">
                      <input
                        value={row.capacity === "N/A" ? "" : row.capacity}
                        disabled={!canEdit}
                        placeholder={canEdit ? "e.g. 100 kg" : undefined}
                        aria-label={`Capacity, row ${index + 1}`}
                        className="min-h-9 w-full rounded-control border border-border bg-surface px-2.5 py-1.5 text-sm text-text transition placeholder:text-subdued/70 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:text-text focus:border-primary"
                        onChange={(e) => onUpdate(row.sr, "capacity", e.target.value)}
                      />
                    </td>

                    {/* Working Capacity */}
                    <td className="px-2 py-2">
                      <input
                        value={row.workingCap === "N/A" ? "" : row.workingCap}
                        disabled={!canEdit}
                        placeholder={canEdit ? "e.g. 80 kg" : undefined}
                        aria-label={`Working capacity, row ${index + 1}`}
                        className="min-h-9 w-full rounded-control border border-border bg-surface px-2.5 py-1.5 text-sm text-text transition placeholder:text-subdued/70 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:text-text focus:border-primary"
                        onChange={(e) => onUpdate(row.sr, "workingCap", e.target.value)}
                      />
                    </td>

                    {/* M/C ID No. */}
                    <td className="px-2 py-2">
                      <input
                        value={row.mcId}
                        disabled={!canEdit}
                        placeholder={canEdit ? "Unique ID" : undefined}
                        aria-label={`M/C ID No., row ${index + 1}`}
                        className={`min-h-9 w-full rounded-control border bg-surface px-2.5 py-1.5 text-sm text-text transition placeholder:text-subdued/70 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:text-text ${
                          (isIdEmpty || isIdDup) && canEdit
                            ? "border-danger focus:border-danger text-danger"
                            : "border-border focus:border-primary"
                        }`}
                        onChange={(e) => onUpdate(row.sr, "mcId", e.target.value)}
                      />
                    </td>

                    {/* Stage */}
                    <td className="px-2 py-2">
                      <input
                        value={row.stage}
                        disabled={!canEdit}
                        placeholder={canEdit ? "e.g. Granulation" : undefined}
                        aria-label={`Stage, row ${index + 1}`}
                        className="min-h-9 w-full rounded-control border border-border bg-surface px-2.5 py-1.5 text-sm text-text transition placeholder:text-subdued/70 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:text-text focus:border-primary"
                        onChange={(e) => onUpdate(row.sr, "stage", e.target.value)}
                      />
                    </td>

                    {/* Processing stage */}
                    <td className="min-w-44 px-2 py-2">
                      <input
                        value={row.procStage}
                        disabled={!canEdit}
                        placeholder={canEdit ? "e.g. Compression" : undefined}
                        aria-label={`Processing stage, row ${index + 1}`}
                        className="min-h-9 w-full rounded-control border border-border bg-surface px-2.5 py-1.5 text-sm text-text transition placeholder:text-subdued/70 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:text-text focus:border-primary"
                        onChange={(e) => handleProcStageChange(row.sr, e.target.value)}
                      />
                    </td>

                    {/* Process steps, CPPs & CQAs */}
                    <td className="min-w-44 px-2 py-2">
                      <button
                        type="button"
                        aria-label={`Process steps, CPPs & CQAs, row ${index + 1}`}
                        className="min-h-9 w-full rounded-control border border-border bg-surface px-2.5 py-1.5 text-left text-sm text-text transition hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        onClick={() => openStepsEditor(row)}
                      >
                        {summarizeSteps(steps)}
                      </button>
                    </td>

                    {/* Action - Delete row */}
                    {canEdit ? (
                      <td className="px-2 py-2 text-center align-middle">
                        <button
                          type="button"
                          aria-label={`Remove row ${index + 1}`}
                          title={`Remove row ${index + 1}`}
                          className="inline-flex size-8 items-center justify-center rounded-control text-danger transition hover:bg-danger-soft focus:outline-none focus:ring-2 focus:ring-primary"
                          onClick={() => onRemoveRow(row.sr)}
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
      </div>

      {/* Add row footer */}
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-control border border-border bg-surface px-3.5 text-small font-semibold text-text transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
            onClick={onAddRow}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add equipment row
          </button>
          <p className="text-micro text-subdued">
            New rows need machine name and unique M/C ID.
          </p>
        </div>
      ) : null}

      {/* Steps and CPP Editor Modal Dialog */}
      {stepsDialog ? (
        <StepsEditorDialog
          machineName={stepsDialog.machineName}
          processingStage={stepsDialog.processingStage}
          steps={stepsDialog.steps}
          canEdit={canEdit}
          onSave={handleSaveSteps}
          onClose={() => setStepsDialog(null)}
        />
      ) : null}
    </div>
  );
}
