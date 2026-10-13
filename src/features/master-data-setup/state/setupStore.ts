import { create } from "zustand";
import { DOCUMENT_TYPE_OPTIONS, DOSAGE_FORM_OPTIONS } from "../../new-document/model/documentSelector.config";
import {
  BATCH_DOCS,
  EQUIPMENT_SEED,
  INSTRUMENT_SEED,
  STAGE_SECTIONS,
  type EquipmentRow,
  type InstrumentRow,
  type UploadedFile,
} from "../model/setup.model";

/**
 * In-memory state for the Master Data Setup wizard, so the six steps share one draft as
 * the user moves between them. Seeded with a realistic part-done set (Dispensing,
 * Granulation and Compression stage documents uploaded; three of four batch documents),
 * standing in for a real per-Type master-data draft on the backend.
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

function mkFile(base: string, format: "PDF" | "DOCX", sizeKB: number, at: string): UploadedFile {
  return { filename: `${base}.${format.toLowerCase()}`, sizeKB, by: "A. Mehta (Reviewer QA)", at: `17 Jul 2026 · ${at}`, format };
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// Seed the first three stages + most batch docs as already uploaded.
const SEED_STAGE_KEYS = new Set(["dispensing", "granulation", "compression"]);
const seedUploads: Record<string, UploadedFile | null> = {};
let clock = 2;
for (const section of STAGE_SECTIONS) {
  const done = SEED_STAGE_KEYS.has(section.key);
  for (const d of section.docs) {
    seedUploads[d.code] = done
      ? mkFile(slug(`${d.name} ${section.title}`), d.code.startsWith("GRN-05") ? "DOCX" : "PDF", 600 + ((clock * 37) % 900), `11:${String(clock++).padStart(2, "0")}`)
      : null;
  }
}

const seedBatch: Record<string, UploadedFile | null> = {};
BATCH_DOCS.forEach((d, i) => {
  seedBatch[d.code] = i === 2 // BAT-03 left pending
    ? null
    : mkFile(slug(d.name), i === 1 ? "DOCX" : "PDF", 200 + i * 210, `12:${18 + i * 3}`);
});

const initialType = readInitialType();
const isInitialDefaultBmr = initialType.dosageFormId === "tablet" && initialType.documentTypeId === "bmr";

interface SetupState {
  dosageFormId: string;
  documentTypeId: string;
  uploads: Record<string, UploadedFile | null>;
  batchUploads: Record<string, UploadedFile | null>;
  equipment: EquipmentRow[];
  instrument: InstrumentRow[];
  previewed: Record<string, true>;
  setDosageFormId: (id: string) => void;
  setDocumentTypeId: (id: string) => void;
  setSelectedType: (dosageFormId: string, documentTypeId: string) => void;
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
  uploads: isInitialDefaultBmr ? seedUploads : {},
  batchUploads: isInitialDefaultBmr ? seedBatch : {},
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
