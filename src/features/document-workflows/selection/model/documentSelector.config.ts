import type { DocumentOption, DocumentStep, SidebarItem } from "./documentSelector.types";
import {
  ClipboardCheck,
  Droplets,
  FileCheck2,
  FileText,
  Syringe,
  Package,
  Pill,
  TubeLotion,
  Tablets,
  Bubbles,
  FileChartLine,
} from "lucide-react";

export const RELEASE_TOOLTIP =
  "Not in this release. Tablet · BMR is the current release.";

export const DOCUMENT_SELECTOR_STEPS: DocumentStep[] = [
  { id: "type", label: "Type" },
  { id: "inputs", label: "Core inputs" },
  { id: "cover-bom", label: "Cover Page" },
  { id: "stages", label: "Select stage & stage inputs" },
  { id: "generate-submit", label: "Generate & submit" },
];

export const PVP_PVR_DOCUMENT_STEPS: DocumentStep[] = [
  { id: "type", label: "Type" },
  { id: "select-document", label: "Select document" },
  { id: "cover-details", label: "Cover & basic details" },
  { id: "process-bom", label: "Process flow & BOM" },
  { id: "cpp-cqa", label: "CPP + CQA" },
  { id: "procedure-sampling", label: "Procedure & sampling plan" },
  { id: "generate-submit", label: "Generate & submit" },
];

/** Pick the document workflow after the user's document type is known. */
export function getDocumentWorkflowSteps(docType?: string | null): DocumentStep[] {
  const normalized = docType?.trim().toLowerCase().replace(/[_\s]+/g, "-");
  return normalized === "pvp" || normalized === "pvr" || normalized === "pvp-pvr"
    ? PVP_PVR_DOCUMENT_STEPS
    : DOCUMENT_SELECTOR_STEPS;
}

/** Convert shared page route IDs to the matching label in the PVP/PVR workflow. */
export function getWorkflowStepId(stepId: string, docType?: string | null): string {
  if (getDocumentWorkflowSteps(docType) !== PVP_PVR_DOCUMENT_STEPS) {
    return stepId;
  }

  const pvpStepIds: Record<string, string> = {
    inputs: "select-document",
    "cover-bom": "process-bom",
    stages: "cpp-cqa",
    "stage-input": "procedure-sampling",
  };
  return pvpStepIds[stepId] ?? stepId;
}

export const DOSAGE_FORM_OPTIONS: DocumentOption[] = [
  {
    id: "tablet",
    backendValue: "tablet",
    label: "Tablet",
    description: "",
    available: true,
    icon: Tablets,
  },
  {
    id: "capsule",
    backendValue: "capsule",
    label: "Capsule",
    description: "",
    available: false,
    unavailableReason: RELEASE_TOOLTIP,
    icon: Pill,
  },
  {
    id: "cream_ointment",
    backendValue: "cream_ointment",
    label: "Cream / Ointment",
    description: "",
    available: false,
    unavailableReason: RELEASE_TOOLTIP,
    icon: TubeLotion,
  },
  {
    id: "injection",
    backendValue: "injection",
    label: "Injection",
    description: "",
    available: false,
    unavailableReason: RELEASE_TOOLTIP,
    icon: Syringe,
  },
  {
    id: "powder",
    backendValue: "powder",
    label: "Powder",
    description: "",
    available: false,
    unavailableReason: RELEASE_TOOLTIP,
    icon: Bubbles,
  },
  {
    id: "oral-liquid",
    backendValue: "oral_liquid",
    label: "Oral Liquid",
    description: "",
    available: false,
    unavailableReason: RELEASE_TOOLTIP,
    icon: Droplets,
  },
];

export const DOCUMENT_TYPE_OPTIONS: DocumentOption[] = [
  {
    id: "bmr",
    backendValue: "bmr",
    label: "Batch Manufacturing Record",
    shortLabel: "BMR",
    description: "",
    available: true,
    icon: FileText,
  },
  {
    id: "bpr",
    backendValue: "bpr",
    label: "Batch Packaging Record",
    shortLabel: "BPR",
    description: "",
    available: true,
    icon: Package,
  },
  {
    id: "pvp",
    backendValue: "pvp",
    label: "Process Validation Protocol",
    shortLabel: "PVP",
    description: "",
    available: true,
    icon: ClipboardCheck,
  },
  {
    id: "pvr",
    backendValue: "pvr",
    label: "Process Validation Report",
    shortLabel: "PVR",
    description: "",
    available: true,
    icon: FileCheck2,
  },
    {
    id: "cpv",
    backendValue: "cpv",
    label: "Continuous Process Verification Report",
    shortLabel: "CPV",
    description: "",
    available: true,
    icon: FileChartLine,
  },
];

export const DOCUMENT_SIDEBAR_ITEMS: SidebarItem[] = [
  // { id: "new-document", label: "New document" },
  { id: "version-history", label: "Version history" },
  { id: "notifications", label: "Notifications" },
  { id: "audit-trail", label: "Audit trail" },
  // A single "Master data" entry — it opens the master-data setup (or, for a preparer, its
  // read-only preview). There is no separate "Master data setup" item.
  { id: "master-data", label: "Master data" },
];
