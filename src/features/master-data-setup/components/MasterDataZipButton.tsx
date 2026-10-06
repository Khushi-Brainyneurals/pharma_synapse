import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { downloadMasterDataZip } from "../../master-data/api/masterDataAdmin";

/**
 * Downloads the full master data (equipment + instrument + company info) as a ZIP, with a
 * real progress bar driven by the download's Content-Length.
 */
export function MasterDataZipButton() {
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setPct(0);
    setError(null);
    try {
      const blob = await downloadMasterDataZip(setPct);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "pharma-master-data.zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not download the master data ZIP."));
    } finally {
      setBusy(false);
      setPct(0);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy}
        className="inline-flex h-8 items-center gap-1.5 rounded-control border border-primary bg-accent-soft px-3 text-small font-semibold text-primary-dark transition hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="size-4" aria-hidden="true" />
        )}
        {busy ? `Preparing ZIP… ${pct}%` : "Download ZIP"}
      </button>
      {busy ? (
        <div className="h-1 w-40 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      {error ? <span className="text-micro text-danger">{error}</span> : null}
    </div>
  );
}
