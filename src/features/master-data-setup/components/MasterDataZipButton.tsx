import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import JSZip from "jszip";
import { getSelectedTypeMeta, useSetupStore } from "../state/setupStore";
import {
  getEquipments,
  getInstruments,
  backendEquipmentToEquipmentRow,
  backendInstrumentToInstrumentRow,
} from "../../master-data/api/equipmentInstrument.api";
import {
  DOC_CODE_TO_STAGE_KEY,
  getStageDocumentPreviewBlob,
  getOtherDocumentPreviewBlob,
} from "../api/masterDataDocuments.api";

function toCsvField(val: unknown): string {
  if (val == null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Downloads the full master data (live equipment database records + live instrument database records +
 * all real uploaded DOCX/PDF stage and batch documents fetched directly from backend preview endpoints)
 * packed cleanly into a single ZIP file.
 */
export function MasterDataZipButton() {
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setError(null);
    setStatusMessage("Exporting data…");

    try {
      const state = useSetupStore.getState();
      const typeMeta = getSelectedTypeMeta(state.dosageFormId, state.documentTypeId);
      const zip = new JSZip();

      // 1. Fetch live equipment and instruments from backend database
      setStatusMessage("Fetching live database records…");
      const [backendEquips, backendInstrs] = await Promise.all([
        getEquipments().catch(() => null),
        getInstruments().catch(() => null),
      ]);

      const liveEquipRows =
        backendEquips && backendEquips.length > 0
          ? backendEquips.map(backendEquipmentToEquipmentRow)
          : state.equipment;

      const liveInstrRows =
        backendInstrs && backendInstrs.length > 0
          ? backendInstrs.map(backendInstrumentToInstrumentRow)
          : state.instrument;

      // 2. Generate Equipment CSV from database records
      const equipHeaders = [
        "Sr",
        "Name of Machine",
        "Capacity",
        "Working Capacity",
        "M/C ID No",
        "Stage",
        "Processing Stage",
        "Process Steps",
        "CPP",
        "CQA",
      ].join(",");

      const equipLines = liveEquipRows
        .map((e) => {
          const stepsSummary = (e.steps ?? [])
            .map((s) => `${s.step} [CPP: ${(s.cpp ?? []).join("; ")} | CQA: ${(s.cqa ?? []).join("; ")}]`)
            .join(" || ");

          return [
            toCsvField(e.sr),
            toCsvField(e.name),
            toCsvField(e.capacity),
            toCsvField(e.workingCap),
            toCsvField(e.mcId),
            toCsvField(e.stage),
            toCsvField(e.procStage),
            toCsvField(stepsSummary || "—"),
            toCsvField(e.cpp || "—"),
            toCsvField(e.cqa || "—"),
          ].join(",");
        })
        .join("\n");

      zip.file("equipment-master.csv", equipHeaders + "\n" + equipLines);

      // 3. Generate Instrument CSV from database records
      const instrHeaders = [
        "Sr",
        "Name of Instrument",
        "Instrument ID No",
        "Location",
        "Stage(s)",
      ].join(",");

      const instrLines = liveInstrRows
        .map((i) =>
          [
            toCsvField(i.sr),
            toCsvField(i.name),
            toCsvField(i.instrumentId),
            toCsvField(i.location),
            toCsvField(Array.isArray(i.stages) ? i.stages.join(", ") : i.stages),
          ].join(","),
        )
        .join("\n");

      zip.file("instrument-master.csv", instrHeaders + "\n" + instrLines);

      // 4. Download real uploaded documents from backend preview endpoints
      setStatusMessage("Downloading documents from backend…");
      const stageFolder = zip.folder("stage-documents");
      const otherFolder = zip.folder("other-documents");

      const documentsManifest: Array<{
        category: "stage" | "other";
        code: string;
        stageKey?: string;
        filename: string;
        sizeBytes?: number;
      }> = [];

      // A. Stage documents
      const stageUploadEntries = Object.entries(state.uploads);
      for (let idx = 0; idx < stageUploadEntries.length; idx++) {
        const [docCode, fileData] = stageUploadEntries[idx];
        if (!fileData) continue;

        setStatusMessage(`Downloading stage docs (${idx + 1}/${stageUploadEntries.length})…`);
        const stageKey =
          fileData.stageKey ||
          DOC_CODE_TO_STAGE_KEY[docCode] ||
          "general";

        try {
          let blob: Blob | null = null;
          if (fileData.rawFile) {
            blob = fileData.rawFile;
          } else {
            blob = await getStageDocumentPreviewBlob(
              typeMeta.dosageBackend,
              typeMeta.docBackend,
              stageKey,
              docCode,
            );
          }

          if (blob && stageFolder) {
            const fileName = fileData.filename || `${docCode}.docx`;
            const cleanPath = `${stageKey}/${fileName}`;
            stageFolder.file(cleanPath, blob);
            documentsManifest.push({
              category: "stage",
              code: docCode,
              stageKey,
              filename: fileName,
              sizeBytes: blob.size,
            });
          }
        } catch (fetchErr) {
          console.warn(`[ZIP] Could not fetch stage document ${docCode}:`, fetchErr);
        }
      }

      // B. Other / Batch documents
      const batchUploadEntries = Object.entries(state.batchUploads);
      for (let idx = 0; idx < batchUploadEntries.length; idx++) {
        const [docCode, fileData] = batchUploadEntries[idx];
        if (!fileData) continue;

        setStatusMessage(`Downloading other docs (${idx + 1}/${batchUploadEntries.length})…`);
        try {
          let blob: Blob | null = null;
          if (fileData.rawFile) {
            blob = fileData.rawFile;
          } else {
            blob = await getOtherDocumentPreviewBlob(
              typeMeta.dosageBackend,
              typeMeta.docBackend,
              docCode,
            );
          }

          if (blob && otherFolder) {
            const fileName = fileData.filename || `${docCode}.docx`;
            otherFolder.file(fileName, blob);
            documentsManifest.push({
              category: "other",
              code: docCode,
              filename: fileName,
              sizeBytes: blob.size,
            });
          }
        } catch (fetchErr) {
          console.warn(`[ZIP] Could not fetch other document ${docCode}:`, fetchErr);
        }
      }

      // 5. Complete Master Data Manifest JSON
      const fullManifest = {
        exported_at: new Date().toISOString(),
        product_type: typeMeta.dosageBackend,
        document_type: typeMeta.docBackend,
        equipment_count: liveEquipRows.length,
        instrument_count: liveInstrRows.length,
        total_documents_included: documentsManifest.length,
        documents: documentsManifest,
      };
      zip.file("manifest.json", JSON.stringify(fullManifest, null, 2));

      // 6. Readme
      zip.file(
        "README.txt",
        [
          "Pharma Synapse Master Data Export",
          "======================================",
          `Exported: ${new Date().toLocaleString()}`,
          `Dosage Form: ${typeMeta.label} (${typeMeta.dosageBackend})`,
          `Document Type: ${typeMeta.docBackend.toUpperCase()}`,
          `Live Equipments Exported: ${liveEquipRows.length} rows`,
          `Live Instruments Exported: ${liveInstrRows.length} rows`,
          `Backend Documents Packed: ${documentsManifest.length} files`,
          "",
          "Folder Structure:",
          "- equipment-master.csv : Equipment database export",
          "- instrument-master.csv: Instrument database export",
          "- stage-documents/     : Stage document templates (.docx / .pdf)",
          "- other-documents/     : Batch-level and general document templates",
          "- manifest.json        : Export metadata & file index",
        ].join("\n"),
      );

      // 7. Generate and trigger download
      setStatusMessage("Compressing ZIP…");
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `pharma-master-data-${typeMeta.dosageBackend}-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (caught: any) {
      setError(caught?.message || "Could not generate master data ZIP.");
    } finally {
      setBusy(false);
      setStatusMessage(null);
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
        {statusMessage || "Download ZIP"}
      </button>
      {error ? <span className="text-micro text-danger">{error}</span> : null}
    </div>
  );
}
