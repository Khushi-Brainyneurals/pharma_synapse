import { create } from "zustand";
import { DOCUMENT_TYPE_OPTIONS, DOSAGE_FORM_OPTIONS } from "../../new-document/model/documentSelector.config";
import type { OtherDocumentsChecklistResponse, StageChecklistGroup, StageChecklistResponse, StageSlot } from "../api/masterDataDocuments.api";
import {
  BATCH_DOCS,
  EQUIPMENT_SEED,
  INSTRUMENT_SEED,
  STAGE_SECTIONS,
  type DocDef,
  type EquipmentRow,
  type InstrumentRow,
  type StageSection,
  type UploadedFile,
} from "../model/setup.model";

/**
 * State for the Master Data Setup wizard, synced with the backend per-Type master-data
 * checklist endpoints (/api/master-data/:productType/:docType/checklist and
 * /api/master-data/:productType/:docType/other-documents/checklist).
 */

const STORAGE_KEY = "pharma.masterData.selectedType";

function readInitialType(): { dosageFormId: string; documentTypeId: string } {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.dosageFormId === "string" && typeof parsed.documentTypeId === "string") {
          return {
            dosageFormId: parsed.dosageFormId || "tablet",
            documentTypeId: parsed.documentTypeId || "bmr",
          };
        }
      }
    }
  } catch {
    // ignore storage errors
  }
  return { dosageFormId: "tablet", documentTypeId: "bmr" };
}

function persistSelectedType(dosageFormId: string, documentTypeId: string) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ dosageFormId, documentTypeId }));
    }
  } catch {
    // ignore storage errors
  }
}

export function getSelectedTypeMeta(dosageFormId = "tablet", documentTypeId = "bmr") {
  const dosage = DOSAGE_FORM_OPTIONS.find((o) => o.id === dosageFormId || o.backendValue === dosageFormId);
  const docType = DOCUMENT_TYPE_OPTIONS.find((o) => o.id === documentTypeId || o.backendValue === documentTypeId);
  const dosageBackend = dosage?.backendValue ?? (dosageFormId || "tablet");
  const docBackend = docType?.backendValue ?? (documentTypeId || "bmr");
  const dosageLabel =
    dosage?.label ?? (dosageBackend ? dosageBackend.charAt(0).toUpperCase() + dosageBackend.slice(1) : "Tablet");
  const docShortLabel = docType?.shortLabel ?? docType?.label ?? (docBackend ? docBackend.toUpperCase() : "BMR");
  const docFullLabel = docType?.label ?? docShortLabel;
  return {
    dosageBackend,
    docBackend,
    dosageLabel,
    docShortLabel,
    docFullLabel,
    label: `${dosageLabel} · ${docShortLabel}`,
  };
}

const STAGE_KEY_META: Record<string, { title: string; note?: string }> = {
  dispensing: { title: "Dispensing of Raw Material" },
  dispensing_rm: { title: "Dispensing of Raw Material" },
  granulation: { title: "Granulation" },
  compression: { title: "Compression" },
  inspection_uncoated: { title: "Uncoated Tablet Inspection" },
  uncoated_inspection: { title: "Uncoated Tablet Inspection" },
  dispensing_coating: { title: "Dispensing of Coating Material" },
  coating: { title: "Coating" },
  inspection_coated: { title: "Coated Tablet Inspection" },
  coated_inspection: { title: "Coated Tablet Inspection" },
  batch_yield_reconciliation: { title: "Batch Yield Reconciliation" },
  reconciliation: { title: "Batch Yield Reconciliation" },
  packing: { title: "Packing" },
  primary_packing: { title: "Primary Packing" },
  secondary_packing: { title: "Secondary Packing" },
};

function formatStageTitle(stageKey: string): string {
  return stageKey
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function mapBackendStagesToSections(stages: StageChecklistGroup[]): StageSection[] {
  return stages.map((stage: any) => {
    const meta = STAGE_KEY_META[stage.stage_key];
    const title = stage.stage_label || stage.label || stage.title || meta?.title || formatStageTitle(stage.stage_key);
    const note = stage.note ?? meta?.note;
    return {
      key: stage.stage_key,
      title,
      ...(note ? { note } : {}),
      docs: (stage.slots || []).map((slot: any) => ({
        code: slot.code,
        name: slot.label || slot.name || slot.code,
        required: slot.required ?? true,
      })),
    };
  });
}

export function mapBackendSlotsToBatchDocs(slots: StageSlot[]): DocDef[] {
  return slots.map((slot: any) => ({
    code: slot.code,
    name: slot.label || slot.name || slot.code,
    required: slot.required ?? true,
  }));
}

const initialType = readInitialType();

interface SetupState {
  dosageFormId: string;
  documentTypeId: string;
  stageSections: StageSection[];
  batchDocs: DocDef[];
  uploads: Record<string, UploadedFile | null>;
  batchUploads: Record<string, UploadedFile | null>;
  equipment: EquipmentRow[];
  instrument: InstrumentRow[];
  previewed: Record<string, true>;
  setDosageFormId: (id: string) => void;
  setDocumentTypeId: (id: string) => void;
  setSelectedType: (dosageFormId: string, documentTypeId: string) => void;
  setStageChecklistData: (res: StageChecklistResponse) => void;
  setOtherChecklistData: (res: OtherDocumentsChecklistResponse) => void;
  setUpload: (code: string, file: UploadedFile) => void;
  removeUpload: (code: string) => void;
  setBatchUpload: (code: string, file: UploadedFile) => void;
  removeBatchUpload: (code: string) => void;
  updateEquip: (sr: number, field: keyof EquipmentRow, value: any) => void;
  setEquipmentRows: (rows: EquipmentRow[]) => void;
  addEquipRow: () => void;
  removeEquipRow: (sr: number) => void;
  updateInstr: (sr: number, field: "name" | "instrumentId" | "location", value: string) => void;
  setInstrStages: (sr: number, stages: string[]) => void;
  setInstrumentRows: (rows: InstrumentRow[]) => void;
  addInstrRow: () => void;
  removeInstrRow: (sr: number) => void;
  markPreviewed: (code: string) => void;
}

export const useSetupStore = create<SetupState>((set) => ({
  dosageFormId: initialType.dosageFormId,
  documentTypeId: initialType.documentTypeId,
  stageSections: STAGE_SECTIONS,
  batchDocs: BATCH_DOCS,
  uploads: {},
  batchUploads: {},
  equipment: EQUIPMENT_SEED.map((r) => ({ ...r })),
  instrument: INSTRUMENT_SEED.map((r) => ({ ...r })),
  previewed: {},
  setDosageFormId: (id) =>
    set((s) => {
      if (s.dosageFormId === id) return s;
      persistSelectedType(id, s.documentTypeId);
      return {
        dosageFormId: id,
        uploads: {},
        batchUploads: {},
        previewed: {},
      };
    }),
  setDocumentTypeId: (id) =>
    set((s) => {
      if (s.documentTypeId === id) return s;
      persistSelectedType(s.dosageFormId, id);
      return {
        documentTypeId: id,
        uploads: {},
        batchUploads: {},
        previewed: {},
      };
    }),
  setSelectedType: (dosageFormId, documentTypeId) =>
    set((s) => {
      if (s.dosageFormId === dosageFormId && s.documentTypeId === documentTypeId) return s;
      persistSelectedType(dosageFormId, documentTypeId);
      return {
        dosageFormId,
        documentTypeId,
        uploads: {},
        batchUploads: {},
        previewed: {},
      };
    }),
  setStageChecklistData: (res) =>
    set((s) => {
      if (!res || !Array.isArray(res.stages)) return s;
      const stageSections = mapBackendStagesToSections(res.stages);
      const nextUploads: Record<string, UploadedFile | null> = {};
      for (const stage of res.stages) {
        for (const slot of stage.slots || []) {
          if (slot.uploaded) {
            const existing = s.uploads[slot.code];
            const fileName = slot.file_name || existing?.filename || `${slot.code}.docx`;
            const format: "PDF" | "DOCX" = fileName.toLowerCase().endsWith(".pdf") ? "PDF" : "DOCX";
            nextUploads[slot.code] = {
              filename: fileName,
              sizeKB: existing?.sizeKB ?? 24,
              by: slot.uploaded_by || existing?.by || "Master Data",
              at: slot.uploaded_at ? new Date(slot.uploaded_at).toLocaleDateString() : existing?.at || "Uploaded",
              format,
              stageKey: stage.stage_key,
              rawFile: existing?.rawFile,
              blobUrl: existing?.blobUrl,
            };
          } else {
            nextUploads[slot.code] = null;
          }
        }
      }
      return {
        stageSections,
        uploads: nextUploads,
      };
    }),
  setOtherChecklistData: (res) =>
    set((s) => {
      if (!res || !Array.isArray(res.slots)) return s;
      const batchDocs = mapBackendSlotsToBatchDocs(res.slots);
      const nextBatchUploads: Record<string, UploadedFile | null> = {};
      for (const slot of res.slots) {
        if (slot.uploaded) {
          const existing = s.batchUploads[slot.code];
          const fileName = slot.file_name || existing?.filename || `${slot.code}.docx`;
          const format: "PDF" | "DOCX" = fileName.toLowerCase().endsWith(".pdf") ? "PDF" : "DOCX";
          nextBatchUploads[slot.code] = {
            filename: fileName,
            sizeKB: existing?.sizeKB ?? 24,
            by: slot.uploaded_by || existing?.by || "Master Data",
            at: slot.uploaded_at ? new Date(slot.uploaded_at).toLocaleDateString() : existing?.at || "Uploaded",
            format,
            rawFile: existing?.rawFile,
            blobUrl: existing?.blobUrl,
          };
        } else {
          nextBatchUploads[slot.code] = null;
        }
      }
      return {
        batchDocs,
        batchUploads: nextBatchUploads,
      };
    }),
  setUpload: (code, file) => set((s) => ({ uploads: { ...s.uploads, [code]: file } })),
  removeUpload: (code) => set((s) => ({ uploads: { ...s.uploads, [code]: null } })),
  setBatchUpload: (code, file) => set((s) => ({ batchUploads: { ...s.batchUploads, [code]: file } })),
  removeBatchUpload: (code) => set((s) => ({ batchUploads: { ...s.batchUploads, [code]: null } })),
  setEquipmentRows: (rows) => set({ equipment: rows }),
  setInstrumentRows: (rows) => set({ instrument: rows }),
  updateEquip: (sr, field, value) =>
    set((s) => ({ equipment: s.equipment.map((r) => (r.sr === sr ? { ...r, [field]: value } : r)) })),
  addEquipRow: () =>
    set((s) => ({
      equipment: [
        ...s.equipment,
        {
          sr: Math.max(0, ...s.equipment.map((r) => r.sr)) + 1,
          name: "",
          capacity: "N/A",
          workingCap: "N/A",
          mcId: "",
          stage: "",
          procStage: "",
          cpp: "",
          cqa: "",
          isNew: true,
        },
      ],
    })),
  removeEquipRow: (sr) => set((s) => ({ equipment: s.equipment.filter((r) => r.sr !== sr) })),
  updateInstr: (sr, field, value) =>
    set((s) => ({ instrument: s.instrument.map((r) => (r.sr === sr ? { ...r, [field]: value } : r)) })),
  setInstrStages: (sr, stages) =>
    set((s) => ({ instrument: s.instrument.map((r) => (r.sr === sr ? { ...r, stages } : r)) })),
  addInstrRow: () =>
    set((s) => ({
      instrument: [
        ...s.instrument,
        { sr: Math.max(0, ...s.instrument.map((r) => r.sr)) + 1, name: "", instrumentId: "", location: "", stages: [], isNew: true },
      ],
    })),
  removeInstrRow: (sr) => set((s) => ({ instrument: s.instrument.filter((r) => r.sr !== sr) })),
  markPreviewed: (code) => set((s) => ({ previewed: { ...s.previewed, [code]: true } })),
}));
