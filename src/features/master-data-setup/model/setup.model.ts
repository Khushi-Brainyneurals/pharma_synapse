/**
 * Static definitions for the Master Data Setup wizard — the stage/document checklist,
 * the batch-level closing sections, and the seed rows for the equipment & instrument
 * list masters. In the product these render from the master-data configuration for the
 * selected Type; here they are representative (frontend build, role-gated).
 */

export interface DocDef {
  code: string; // DSP-01, GRN-03 …
  name: string;
  required: boolean;
}

export interface StageSection {
  key: string;
  title: string;
  note?: string;
  docs: DocDef[];
}

/** An uploaded blank master format (representative). */
export interface UploadedFile {
  filename: string;
  sizeKB: number;
  by: string;
  at: string;
  format: "PDF" | "DOCX";
  blobUrl?: string;
}

export const DOCUMENT_TYPE = { dosage: "Tablet", doc: "BMR", label: "Tablet · BMR" };

const doc = (code: string, name: string): DocDef => ({ code, name, required: true });

export const STAGE_SECTIONS: StageSection[] = [
  {
    key: "dispensing",
    title: "Dispensing",
    docs: [doc("DSP-01", "Line Clearance Check List"), doc("DSP-02", "In-Process Check List")],
  },
  {
    key: "granulation",
    title: "Granulation",
    docs: [
      doc("GRN-01", "Line Clearance Check List"),
      doc("GRN-02", "In-Process Check List"),
      doc("GRN-03", "Weigh IPC Bin / HDPE Container"),
      doc("GRN-04", "Sampling Plan of Lubricated Blend"),
      doc("GRN-05", "Yield Reconciliation — Granulation Stage"),
    ],
  },
  {
    key: "compression",
    title: "Compression",
    docs: [
      doc("CMP-01", "Line Clearance Check List"),
      doc("CMP-02", "In-Process Check List"),
      doc("CMP-03", "Dies & Punches Verification Record"),
      doc("CMP-04", "Machine Setting Record"),
      doc("CMP-05", "Hardness & Speed Challenge Study"),
      doc("CMP-06", "Metal Detector Challenge Test"),
      doc("CMP-07", "Compression Process Record"),
      doc("CMP-08", "Yield Reconciliation — Compression Stage"),
    ],
  },
  {
    key: "inspection_uncoated",
    title: "Tablet Inspection",
    note: "for uncoated tablets",
    docs: [
      doc("INU-01", "Line Clearance Check List"),
      doc("INU-02", "In-Process Check List"),
      doc("INU-03", "Visual Inspection Record"),
      doc("INU-04", "Sorting / De-dusting Record"),
      doc("INU-05", "Rejection Record"),
      doc("INU-06", "Yield Reconciliation — Inspection"),
    ],
  },
  {
    key: "dispensing_coating",
    title: "Dispensing",
    note: "for coating materials",
    docs: [doc("DSC-01", "Line Clearance Check List"), doc("DSC-02", "Coating Material Dispensing Sheet")],
  },
  {
    key: "coating",
    title: "Coating",
    docs: [
      doc("COT-01", "Line Clearance Check List"),
      doc("COT-02", "In-Process Check List"),
      doc("COT-03", "Coating Solution Preparation Record"),
      doc("COT-04", "Coating Process Record"),
      doc("COT-05", "Yield Reconciliation — Coating Stage"),
    ],
  },
  {
    key: "inspection_coated",
    title: "Tablet Inspection",
    note: "for coated tablets",
    docs: [
      doc("INC-01", "Line Clearance Check List"),
      doc("INC-02", "In-Process Check List"),
      doc("INC-03", "Visual Inspection Record"),
      doc("INC-04", "Sorting / De-dusting Record"),
      doc("INC-05", "Rejection Record"),
      doc("INC-06", "Yield Reconciliation — Inspection"),
    ],
  },
];

/** Total mandatory stage documents (34). */
export const STAGE_DOC_COUNT = STAGE_SECTIONS.reduce((n, s) => n + s.docs.length, 0);

export const BATCH_DOCS: DocDef[] = [
  doc("BAT-01", "Batch Yield Reconciliation"),
  doc("BAT-02", "Deviation / Any Other Observation"),
  doc("BAT-03", "Batch Manufacturing Record / Batch Release Checklist for Q.A"),
  doc("BAT-04", "Change History"),
];

export interface MasterDataStep {
  step: string;
  cpp: string[];
}

export interface EquipmentRow {
  sr: number;
  name: string;
  capacity: string;
  workingCap: string;
  mcId: string;
  /** Manufacturing stage (Dispensing / Granulation / Compression / …) — from the master Excel. */
  stage: string;
  /** Processing sub-stage(s) for this machine, comma-separated. */
  procStage: string;
  cpp: string;
  steps?: MasterDataStep[];
  isNew?: boolean;
}

export const EQUIPMENT_SEED: EquipmentRow[] = [
  { sr: 1, name: "Dispensing Booth (RLAF)", capacity: "N/A", workingCap: "N/A", mcId: "D-11", stage: "Dispensing", procStage: "Dispensing", cpp: "" },
  { sr: 2, name: "Dispensing Booth (RLAF)", capacity: "N/A", workingCap: "N/A", mcId: "D-12", stage: "Dispensing", procStage: "Dispensing", cpp: "" },
  { sr: 3, name: "Sifter", capacity: "N/A", workingCap: "N/A", mcId: "Gr-1", stage: "Granulation", procStage: "Sifting, Wet screening, Semi dry screening, Sifting and sizing process, Final sifting, Dry Screening", cpp: "" },
  { sr: 4, name: "Multi Mill", capacity: "N/A", workingCap: "N/A", mcId: "Gr-2", stage: "Granulation", procStage: "Sifting, Wet screening, Semi dry screening, Sifting and sizing process, FInal sifting, Dry Screening", cpp: "Impeller Speed (RPM)" },
  { sr: 5, name: "Rapid Mixer Granulator (RMG)", capacity: "150 Lit.", workingCap: "120 Lit.", mcId: "Gr-4", stage: "Granulation", procStage: "Dry Mixing, Wet Granulation", cpp: "Speed of Impeller, Speed of chopper, Mixing time, Binder solution addition time, Kneading time, Total time for wet granulation process, Quantity of Extra vehicle added, Quantity of total added vehicle, Ampere load at the end of granulation" },
  { sr: 6, name: "Fluid Bed Dryer (FBD)", capacity: "60 Kg", workingCap: "N/A", mcId: "Gr-5", stage: "Granulation", procStage: "Semi Drying, Final Drying, Drying", cpp: "Inlet Temperature, Exhaust Temperature, Inlet Air flow, Semi Drying time, final Drying time, LOD" },
  { sr: 7, name: "Octagonal Blender", capacity: "500 Lit.", workingCap: "200 Kg", mcId: "Gr-6", stage: "Granulation", procStage: "Dry Mixing, Pre-lubrication, Lubrication, Final Mixing", cpp: "Mixing time, Mixing speed" },
  { sr: 8, name: "Mass Mixer", capacity: "50 Kg", workingCap: "N/A", mcId: "GR-7", stage: "Granulation", procStage: "Dry Mixing, Wet Granulation, Pre-lubrication, Lubrication, Final Mixing", cpp: "Mixing time, Mixing speed, Binder solution addition time, Kneading time, Total time for wet granulation process, Quantity of Extra added vehicle, Quantity of total added vehicle, Mass Mixer speed" },
  { sr: 9, name: "Paste Kettle", capacity: "50 Lits", workingCap: "N/A", mcId: "GR-8", stage: "Granulation", procStage: "Paste preparation", cpp: "Temperature" },
  { sr: 10, name: "Fluid bed Processor (FBP)", capacity: "500 lits", workingCap: "250 lits", mcId: "GR-9", stage: "granulation-1", procStage: "Pre-Heating of dry mix, Mixing, Binding with drying, Wet Granulation, Final Drying, Drying", cpp: "Inlet Temperature, Product bed Temperature, Outlet temperature, Outlet damper, Srray rate, Peristaltic Pump, Atomization air pressure, Solution spraying time, Binding with drying time, Outlet Temperature, Inlet Air flow, final Drying time, LOD" },
  { sr: 11, name: "Stirrer", capacity: "N/A", workingCap: "N/A", mcId: "GR-10", stage: "Granulation", procStage: "Binder Preparation, Binding solution preparation,", cpp: "stirrer speed" },
  { sr: 12, name: "Pneumatic Conveyance System", capacity: "N/A", workingCap: "N/A", mcId: "GR-11", stage: "Granulation", procStage: "material sifting", cpp: "" },
  { sr: 13, name: "Sifter", capacity: "N/A", workingCap: "N/A", mcId: "GR-12", stage: "Granulation", procStage: "Sifting, Wet screening, Semi dry screening, Sifting and sizing process, Final sifting, Dry Screening", cpp: "" },
  { sr: 14, name: "Multi Mill", capacity: "N/A", workingCap: "N/A", mcId: "GR-13", stage: "Granulation", procStage: "Sifting, Wet screening, Semi dry screening, Sifting and sizing process, FInal sifting, Dry Screening", cpp: "Impeller Speed (RPM)" },
  { sr: 15, name: "Rapid Mixer Granulator (RMG)", capacity: "150 Lit.", workingCap: "120 Lit.", mcId: "GR/14", stage: "Granulation", procStage: "Dry Mixing, Wet Granulation", cpp: "Speed of Impeller, Speed of chopper, Mixing time, Binder solution addition time, Kneading time, Total time for wet granulation process, Quantity of Extra vehicle added, Quantity of total added vehicle, Ampere load at the end of granulation" },
  { sr: 16, name: "Fluid Bed Dryer (FBD)", capacity: "60 Kg", workingCap: "N/A", mcId: "GR/15", stage: "Granulation", procStage: "Semi Drying, Final Drying, Drying", cpp: "Inlet Temperature, Exhaust Temperature, Inlet Air flow, Semi Drying time, final Drying time, LOD" },
  { sr: 17, name: "Octagonal Blender", capacity: "500 Lit.", workingCap: "200 Kg", mcId: "GR/15", stage: "Granulation", procStage: "Dry Mixing, Pre-lubrication, Lubrication, Final Mixing", cpp: "Mixing time, Mixing speed" },
  { sr: 18, name: "Mass Mixer", capacity: "50 Kg", workingCap: "N/A", mcId: "GR/16", stage: "Granulation", procStage: "Dry Mixing, Wet Granulation, Pre-lubrication, Lubrication, Final Mixing", cpp: "Mixing time, Mixing speed, Binder solution addition time, Kneading time, Total time for wet granulation process, Quantity of Extra added vehicle, Quantity of total added vehicle, Mass Mixer speed" },
  { sr: 19, name: "Paste Kettle", capacity: "50 Lits", workingCap: "N/A", mcId: "GR/17", stage: "Granulation", procStage: "Paste preparation", cpp: "Temperature" },
  { sr: 20, name: "Fluid bed Processor (FBP)", capacity: "500 lits", workingCap: "250 lits", mcId: "GR/18", stage: "Granulation", procStage: "Pre-Heating of dry mix, Mixing, Binding with drying, Wet Granulation, Final Drying, Drying", cpp: "Inlet Temperature, Product bed Temperature, Outlet temperature, Outlet damper, Srray rate, Peristaltic Pump, Atomization air pressure, Solution spraying time, Binding with drying time, Outlet Temperature, Inlet Air flow, final Drying time, LOD" },
  { sr: 21, name: "Stirrer", capacity: "N/A", workingCap: "N/A", mcId: "GR/19", stage: "Granulation", procStage: "Binder Preparation, Binding solution preparation,", cpp: "stirrer speed" },
  { sr: 22, name: "Pneumatic Conveyance System", capacity: "N/A", workingCap: "N/A", mcId: "GR/20", stage: "Granulation", procStage: "material sifting", cpp: "" },
  { sr: 23, name: "Single rotary Compression Machine", capacity: "25 station", workingCap: "N/A", mcId: "CM/01", stage: "Compression", procStage: "Compression", cpp: "Turret speed, Feeder speed, compaction force" },
  { sr: 24, name: "Double Rotary compression machine", capacity: "55 station", workingCap: "N/A", mcId: "CM/02", stage: "Compression", procStage: "Compression", cpp: "Turret speed, Feeder speed, Die fill depth, Upper punch penetration, Pre-compaction force, Main compaction force, Pre tablet cylindrical height, Main tablet cylindrical height" },
  { sr: 25, name: "45 – D Double Rotary Comp. M/C Cadpress-IV", capacity: "45 station", workingCap: "N/A", mcId: "CM/11", stage: "Compression", procStage: "Compression", cpp: "" },
  { sr: 26, name: "27 – D  Double Rotary M/C", capacity: "27 station", workingCap: "N/A", mcId: "CM/12", stage: "Compression", procStage: "Compression", cpp: "" },
  { sr: 27, name: "Dust extractor", capacity: "N/A", workingCap: "N/A", mcId: "CM/07", stage: "Compression", procStage: "Compression", cpp: "" },
  { sr: 28, name: "Pneumatic Conveyance System", capacity: "N/A", workingCap: "N/A", mcId: "CM/03", stage: "Compression", procStage: "Compression", cpp: "" },
  { sr: 29, name: "Combo De-Duster Cum Metal detector System", capacity: "N/A", workingCap: "N/A", mcId: "CM/04", stage: "Compression", procStage: "Compression", cpp: "Angle of discharge of metal detector, Defect Threshold" },
  { sr: 30, name: "Punch set", capacity: "N/A", workingCap: "N/A", mcId: "CM/09", stage: "Compression", procStage: "Compression", cpp: "" },
  { sr: 31, name: "Pneumatic Conveyance System", capacity: "N/A", workingCap: "N/A", mcId: "CM/10", stage: "Compression", procStage: "Compression", cpp: "" },
  { sr: 32, name: "Inspection Belt with ADU", capacity: "N/A", workingCap: "N/A", mcId: "TI/01", stage: "Inspection", procStage: "Inspection", cpp: "" },
  { sr: 33, name: "Auto coater", capacity: "48 \"", workingCap: "N/A", mcId: "CT/01", stage: "Coating", procStage: "Coating", cpp: "Spray Gun, Nozzle diameter, Inlet Air Flow, Pan speed (RPM), Peristaltic Pump speed (RPM), Inlet Temperature, Exhaust air Temperature, Bed Temperature, Gun to bed distance, Compressed air pressure, Spray Rate" },
  { sr: 34, name: "Solution tank with stirrer", capacity: "N/A", workingCap: "N/A", mcId: "CT/03", stage: "Coating", procStage: "Coating", cpp: "stirrer speed" },
  { sr: 35, name: "Stirrer", capacity: "N/A", workingCap: "N/A", mcId: "CT/04", stage: "Coating", procStage: "Coating", cpp: "stirrer speed" },
  { sr: 36, name: "Auto coater", capacity: "48 \"", workingCap: "N/A", mcId: "CT/02", stage: "Coating", procStage: "Coating", cpp: "Spray Gun, Nozzle diameter, Inlet Air Flow, Pan speed (RPM), Peristaltic Pump speed (RPM), Inlet Temperature, Exhaust air Temperature, Bed Temperature, Gun to bed distance, Compressed air pressure, Spray Rate" },
  { sr: 37, name: "Solution tank with stirrer", capacity: "N/A", workingCap: "N/A", mcId: "CT/05", stage: "Coating", procStage: "Coating", cpp: "stirrer speed" },
  { sr: 38, name: "Stirrer", capacity: "N/A", workingCap: "N/A", mcId: "CT/06", stage: "Coating", procStage: "Coating", cpp: "stirrer speed" },
  { sr: 39, name: "AF-40 T Capsule M/C", capacity: "N/A", workingCap: "N/A", mcId: "CP/01", stage: "Capsule", procStage: "Capsule", cpp: "Machine speed" },
  { sr: 40, name: "Dust Extractor (ADU)", capacity: "N/A", workingCap: "N/A", mcId: "CP/02", stage: "Capsule", procStage: "Capsule", cpp: "" },
  { sr: 41, name: "Capsule Sorter / Elevator", capacity: "N/A", workingCap: "N/A", mcId: "CP/03", stage: "Capsule", procStage: "Capsule", cpp: "" },
  { sr: 42, name: "Capsule Polishing & Sorter M/C", capacity: "N/A", workingCap: "N/A", mcId: "CP/04", stage: "Capsule", procStage: "Capsule", cpp: "" },
  { sr: 43, name: "Cone Blender", capacity: "500 Lit.", workingCap: "250 kg", mcId: "CP/05", stage: "Capsule", procStage: "Capsule", cpp: "Mixing time, Blender speed" },
  { sr: 44, name: "Blister Pack M/C", capacity: "N/A", workingCap: "N/A", mcId: "PK/01", stage: "Primary Packing", procStage: "Primary Packing", cpp: "Machine speed, Sealing roller Temperature" },
  { sr: 45, name: "Conveyor Belt", capacity: "N/A", workingCap: "N/A", mcId: "PK/02", stage: "Secondary Packing", procStage: "Secondary Packing", cpp: "Machine speed" },
  { sr: 46, name: "Strip Pack M/C", capacity: "N/A", workingCap: "N/A", mcId: "PK/03", stage: "Primary Packing", procStage: "Primary Packing", cpp: "Machine speed, Sealing roller Temperature" },
  { sr: 47, name: "Print and Spect machine", capacity: "N/A", workingCap: "N/A", mcId: "PK/04", stage: "Secondary Packing", procStage: "Secondary Packing", cpp: "Machine speed" },
  { sr: 48, name: "EZPCR- Scanner-500 M/C", capacity: "N/A", workingCap: "N/A", mcId: "PK/05", stage: "Secondary Packing", procStage: "Secondary Packing", cpp: "Machine speed" },
];

/** The configured processing-stage list the Equipment "Processing stage" dropdown picks
 *  from (one per machine). */
export const EQUIP_STAGES: string[] = [
  "Dispensing",
  "Granulation",
  "granulation-1",
  "Compression",
  "Inspection",
  "Coating",
  "Capsule",
  "Primary Packing",
  "Secondary Packing",
];

/** The stage list the Instrument "Stage(s)" multi-select picks from — one instrument can
 *  serve several stages, driving where it appears in the Doc Engine. From the master Excel. */
export const INSTR_STAGES: string[] = [
  "Dispensing",
  "Granulation",
  "Compression",
  "Coating",
  "Capsule",
  "Secondary packing",
];

export interface InstrumentRow {
  sr: number;
  name: string;
  instrumentId: string;
  location: string;
  /** One instrument can serve several stages. */
  stages: string[];
  /** Marks a just-added row (the "NEW" chip in the design). */
  isNew?: boolean;
}

export const INSTRUMENT_SEED: InstrumentRow[] = [
  { sr: 1, name: "Weighing Balance", instrumentId: "WH/01", location: "Dispensing area-1", stages: ["Dispensing"] },
  { sr: 2, name: "Weighing Balance", instrumentId: "WH/02", location: "Dispensing area-1", stages: ["Dispensing"] },
  { sr: 3, name: "Weighing Balance", instrumentId: "WH/03", location: "Dispensing area-1", stages: ["Dispensing"] },
  { sr: 4, name: "Weighing Balance", instrumentId: "WH/04", location: "Dispensing area-2", stages: ["Dispensing"] },
  { sr: 5, name: "Weighing Balance", instrumentId: "WH/05", location: "Dispensing area-2", stages: ["Dispensing"] },
  { sr: 6, name: "Weighing Balance", instrumentId: "WH/06", location: "Dispensing area-2", stages: ["Dispensing"] },
  { sr: 7, name: "Weighing Balance", instrumentId: "PR/01", location: "Production day store", stages: ["Dispensing"] },
  { sr: 8, name: "Weighing Balance", instrumentId: "PR/02", location: "Production day store", stages: ["Dispensing"] },
  { sr: 9, name: "Weighing Balance", instrumentId: "PR/03", location: "Granulation area -1", stages: ["Granulation"] },
  { sr: 10, name: "Weighing Balance", instrumentId: "PR/04", location: "Granulation area -2", stages: ["Granulation"] },
  { sr: 11, name: "Weighing Balance", instrumentId: "PR/05", location: "Granulation area -3", stages: ["Granulation"] },
  { sr: 12, name: "General Instrument", instrumentId: "PR/06", location: "IPQC room", stages: ["Granulation", "Compression", "Coating"] },
  { sr: 13, name: "IPQC General Instrument", instrumentId: "PR/07", location: "IPQC room", stages: ["Granulation"] },
  { sr: 14, name: "IPQC General Instrument", instrumentId: "PR/08", location: "IPQC room", stages: ["Compression", "Coating", "Capsule"] },
  { sr: 15, name: "IPQC General Instrument", instrumentId: "PR/09", location: "IPQC room", stages: ["Compression"] },
  { sr: 16, name: "IPQC General Instrument", instrumentId: "PR/10", location: "IPQC room", stages: ["Compression"] },
  { sr: 17, name: "IPQC General Instrument", instrumentId: "PR/11", location: "IPQC room", stages: ["Compression", "Coating", "Capsule"] },
  { sr: 18, name: "Weighing Balance", instrumentId: "PR/12", location: "Compression", stages: ["Compression"] },
  { sr: 19, name: "Weighing Balance", instrumentId: "PR/13", location: "Coating", stages: ["Coating"] },
  { sr: 20, name: "Weighing Balance", instrumentId: "PR/14", location: "Capsule", stages: ["Capsule"] },
  { sr: 21, name: "Weighing Balance", instrumentId: "PR/15", location: "Capsule", stages: ["Capsule"] },
  { sr: 22, name: "Weighing Balance", instrumentId: "PR/16", location: "Secondary packing", stages: ["Secondary packing"] },
  { sr: 23, name: "Check weigher", instrumentId: "PR/17", location: "Secondary packing", stages: ["Secondary packing"] },
  { sr: 24, name: "Leak Test apparatus", instrumentId: "PR/18", location: "Secondary packing", stages: ["Secondary packing"] },
  { sr: 25, name: "IPQC General Instrument", instrumentId: "PR/19", location: "IPQC room", stages: ["Compression", "Coating", "Capsule"] },
  { sr: 26, name: "IPQC General Instrument", instrumentId: "PR/20", location: "IPQC room", stages: ["Compression"] },
  { sr: 27, name: "IPQC General Instrument", instrumentId: "PR/21", location: "IPQC room", stages: ["Compression", "Coating", "Capsule"] },
  { sr: 28, name: "IPQC General Instrument", instrumentId: "PR/22", location: "IPQC room", stages: ["Compression"] },
  { sr: 29, name: "IPQC General Instrument", instrumentId: "PR/23", location: "IPQC room", stages: ["Granulation", "Compression", "Coating"] },
  { sr: 30, name: "IPQC General Instrument", instrumentId: "PR/24", location: "IPQC room", stages: ["Compression", "Coating", "Capsule"] },
  { sr: 31, name: "IPQC General Instrument", instrumentId: "PR/25", location: "IPQC room", stages: ["Compression", "Coating", "Capsule"] },
  { sr: 32, name: "IPQC General Instrument", instrumentId: "PR/26", location: "IPQC room", stages: ["Compression", "Coating", "Capsule"] },
  { sr: 33, name: "Weighing Balance", instrumentId: "PR/27", location: "Secondary packing", stages: ["Secondary packing"] },
];

export type StepGroup = "static" | "dependent";

// Master data is presented as two sub-screens: STATIC data (company info + the equipment
// and instrument masters, which don't depend on a product) and DEPENDENT data (everything
// keyed to the Type: the stage/other document formats and the preview).
//
// NOTE: the order of the first six entries is load-bearing — the step pages navigate by
// positional index (STEPS[n].route). New steps (e.g. company) are APPENDED so those
// indices stay valid; display order is controlled by STEP_GROUPS below, not this array.
export const STEPS = [
  { key: "type", label: "Type", route: "/master-data-setup", group: "dependent" },
  { key: "stages", label: "Stage documents", route: "/master-data-setup/stages", group: "dependent" },
  { key: "equipment", label: "Equipment list", route: "/master-data-setup/equipment", group: "static" },
  { key: "instruments", label: "Instrument list", route: "/master-data-setup/instruments", group: "static" },
  { key: "batch", label: "Other documents", route: "/master-data-setup/batch-docs", group: "dependent" },
  { key: "preview", label: "Preview", route: "/master-data-setup/preview", group: "dependent" },
  // Company info is the canonical company page, so this step links out to it.
  { key: "company", label: "Company info", route: "/settings/company", group: "static" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];

/** The two Master Data sub-screens, each listing its steps in display order. */
export const STEP_GROUPS: { key: StepGroup; label: string; steps: StepKey[] }[] = [
  { key: "static", label: "Static data", steps: ["company", "equipment", "instruments"] },
  { key: "dependent", label: "Dependent data", steps: ["type", "stages", "batch", "preview"] },
];
