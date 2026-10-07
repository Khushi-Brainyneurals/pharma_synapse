import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Dialog } from "../../../shared/ui/Dialog";

export interface MasterDataStep {
  step: string;
  cpp: string[];
}

interface StepsEditorDialogProps {
  machineName: string;
  processingStage: string;
  steps: MasterDataStep[];
  canEdit: boolean;
  onSave: (steps: MasterDataStep[]) => void;
  onClose: () => void;
}

/**
 * Step names come from Processing stage and are fixed here - only the CPP
 * list under each step is editable.
 */
export function StepsEditorDialog({
  machineName,
  processingStage,
  steps,
  canEdit,
  onSave,
  onClose,
}: StepsEditorDialogProps) {
  const [draft, setDraft] = useState<MasterDataStep[]>(() =>
    steps.map((item) => ({ step: item.step, cpp: [...item.cpp] })),
  );
  const [openSteps, setOpenSteps] = useState<Set<string>>(() => new Set(steps.map((item) => item.step)));

  function toggleStep(name: string) {
    setOpenSteps((current) => {
      const next = new Set(current);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  function updateCpp(stepIndex: number, cppIndex: number, value: string) {
    setDraft((current) =>
      current.map((item, i) =>
        i === stepIndex ? { ...item, cpp: item.cpp.map((v, j) => (j === cppIndex ? value : v)) } : item,
      ),
    );
  }

  function addCpp(stepIndex: number) {
    setDraft((current) =>
      current.map((item, i) => (i === stepIndex ? { ...item, cpp: [...item.cpp, ""] } : item)),
    );
  }

  function removeCpp(stepIndex: number, cppIndex: number) {
    setDraft((current) =>
      current.map((item, i) =>
        i === stepIndex ? { ...item, cpp: item.cpp.filter((_, j) => j !== cppIndex) } : item,
      ),
    );
  }

  function handleSave() {
    onSave(
      draft.map((item) => ({
        step: item.step,
        cpp: item.cpp.map((value) => value.trim()).filter(Boolean),
      })),
    );
  }

  return (
    <Dialog title={`Process steps - ${machineName || "Untitled machine"}`} size="lg" onClose={onClose}>
      <div className="mb-4 rounded-control border border-border bg-muted/40 p-3">
        <p className="text-micro font-semibold uppercase tracking-overline text-subdued">Processing stage</p>
        <p className="mt-1 text-small text-text">{processingStage.trim() || "Not set"}</p>
      </div>

      {draft.length === 0 ? (
        <p className="text-small text-subdued">
          Add a processing stage in the table to generate steps here — step names come from comma-separated stages.
        </p>
      ) : (
        <div className="space-y-3">
          {draft.map((item, stepIndex) => {
            const isOpen = openSteps.has(item.step);

            return (
              <div key={item.step} className="rounded-control border border-border">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-muted/40"
                  onClick={() => toggleStep(item.step)}
                >
                  <span className="flex items-center gap-2 text-small font-semibold text-text">
                    <ChevronDown
                      className={`size-4 shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                      aria-hidden="true"
                    />
                    {item.step}
                  </span>
                  <span className="text-micro text-subdued">
                    {item.cpp.length} CPP{item.cpp.length === 1 ? "" : "s"}
                  </span>
                </button>

                {isOpen ? (
                  <div className="space-y-2 border-t border-border px-3 py-3">
                    <p className="text-micro font-semibold uppercase tracking-overline text-subdued">CPP</p>

                    {item.cpp.length === 0 ? (
                      <p className="text-micro text-subdued">No critical process parameters yet.</p>
                    ) : (
                      item.cpp.map((value, cppIndex) => (
                        <div key={cppIndex} className="flex items-center gap-2">
                          <input
                            value={value}
                            disabled={!canEdit}
                            placeholder="e.g. Speed of impeller"
                            aria-label={`${item.step} CPP ${cppIndex + 1}`}
                            className="min-h-9 w-full rounded-control border border-border bg-surface px-2.5 py-1.5 text-sm text-text transition placeholder:text-subdued/70 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:border-transparent disabled:bg-transparent"
                            onChange={(event) => updateCpp(stepIndex, cppIndex, event.target.value)}
                          />
                          {canEdit ? (
                            <button
                              type="button"
                              aria-label={`Remove ${item.step} CPP ${cppIndex + 1}`}
                              title={`Remove ${item.step} CPP ${cppIndex + 1}`}
                              className="inline-flex size-9 shrink-0 items-center justify-center rounded-control text-danger transition hover:bg-danger-soft focus:outline-none focus:ring-2 focus:ring-primary"
                              onClick={() => removeCpp(stepIndex, cppIndex)}
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
                      ))
                    )}

                    {canEdit ? (
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1.5 rounded-control border border-border bg-surface px-3 text-small font-medium text-text transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
                        onClick={() => addCpp(stepIndex)}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                        Add CPP
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-control border border-border bg-surface px-4 text-small font-semibold text-text transition hover:bg-muted"
          onClick={onClose}
        >
          {canEdit ? "Cancel" : "Close"}
        </button>
        {canEdit ? (
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-control bg-primary px-4 text-small font-semibold text-white transition hover:bg-primary-dark"
            onClick={handleSave}
          >
            Done
          </button>
        ) : null}
      </div>
    </Dialog>
  );
}

