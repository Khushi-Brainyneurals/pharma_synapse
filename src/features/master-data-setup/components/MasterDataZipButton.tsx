import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import JSZip from "jszip";
import { useSetupStore } from "../state/setupStore";

/**
 * Downloads the full master data (equipment + instrument + setup draft) as a ZIP client-side.
 * Works seamlessly whether online or offline without relying on a missing backend zip endpoint.
 */
export function MasterDataZipButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const state = useSetupStore.getState();
      const zip = new JSZip();

      // 1. Equipment CSV
      const equipHeaders = "Sr,Name of Machine,Capacity,Working Capacity,M/C ID No,Stage,Processing Stage,CPP\n";
      const equipLines = state.equipment
        .map(
          (e) =>
            `"${e.sr}","${e.name.replace(/"/g, '""')}","${e.capacity}","${e.workingCap}","${e.mcId}","${e.stage}","${e.procStage}","${(e.cpp || "").replace(/"/g, '""')}"`,
        )
        .join("\n");
      zip.file("equipment-master.csv", equipHeaders + equipLines);

      // 2. Instrument CSV
      const instrHeaders = "Sr,Name of Instrument,Instrument ID No,Location,Stages\n";
      const instrLines = state.instrument
        .map(
          (i) =>
            `"${i.sr}","${i.name.replace(/"/g, '""')}","${i.instrumentId}","${i.location}","${Array.isArray(i.stages) ? i.stages.join(", ") : i.stages}"`,
        )
        .join("\n");
      zip.file("instrument-master.csv", instrHeaders + instrLines);

      // 3. Complete Master Data JSON
      const fullJson = JSON.stringify(
        {
          exported_at: new Date().toISOString(),
          equipment: state.equipment,
          instrument: state.instrument,
          batch_uploads: state.batchUploads,
          stage_uploads: state.uploads,
        },
        null,
        2,
      );
      zip.file("master-data.json", fullJson);

      // 4. Readme text
      zip.file(
        "README.txt",
        `Pharma Synapse Master Data Export\nExported: ${new Date().toLocaleString()}\nEquipment count: ${state.equipment.length}\nInstrument count: ${state.instrument.length}\n`,
      );

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `pharma-master-data-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (caught: any) {
      setError(caught?.message || "Could not generate master data ZIP.");
    } finally {
      setBusy(false);
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
        {busy ? "Creating ZIP…" : "Download ZIP"}
      </button>
      {error ? <span className="text-micro text-danger">{error}</span> : null}
    </div>
  );
}
