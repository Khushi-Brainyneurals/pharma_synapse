import { Check, Loader2, Save, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { replaceMasterRows, type MasterKind } from "../../master-data/api/masterDataAdmin";

/**
 * "Save" for a master-data table. Transforms the current setup rows to the backend shape
 * (via `buildRows`) and replaces the active set — committed directly, so the Stage-input
 * dropdowns every role sees reflect the edit on their next load. Shown to editors only.
 */
export function SaveMasterButton({
  kind,
  noun,
  buildRows,
}: {
  kind: MasterKind;
  noun: string;
  buildRows: () => Record<string, unknown>[];
}) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  const onSave = async () => {
    setState("saving");
    setMessage("");
    try {
      const rows = buildRows();
      if (rows.length === 0) {
        setState("error");
        setMessage(`Add at least one ${noun} before saving.`);
        return;
      }
      const result = await replaceMasterRows(kind, rows);
      setState("saved");
      setMessage(`Saved ${result.count} ${noun}${result.count === 1 ? "" : "s"} · live for all roles`);
    } catch (caught) {
      setState("error");
      setMessage(getApiErrorMessage(caught, "Could not save the master data."));
    }
  };

  return (
    <div className="flex items-center gap-2">
      {message ? (
        <span
          className={`inline-flex items-center gap-1 text-micro font-semibold ${
            state === "error" ? "text-danger-ink" : "text-approved-fg"
          }`}
        >
          {state === "error" ? (
            <TriangleAlert className="size-3.5" aria-hidden="true" />
          ) : (
            <Check className="size-3.5" aria-hidden="true" />
          )}
          {message}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onSave}
        disabled={state === "saving"}
        className="inline-flex h-8 items-center gap-1.5 rounded-control bg-primary px-3 text-small font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
      >
        {state === "saving" ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Save className="size-4" aria-hidden="true" />
        )}
        {state === "saving" ? "Saving…" : "Save details"}
      </button>
    </div>
  );
}
