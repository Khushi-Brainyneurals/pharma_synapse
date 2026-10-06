import { LucideIcon } from "lucide-react";
import type { AuthenticatedUser } from "../../auth/api/auth.types";

export interface UnitContext {
  id: string;
  name?: string;
}

export interface DocumentOption {
  id: string;
  backendValue: string;
  label: string;
  shortLabel?: string;
  description: string;
  available: boolean;
  unavailableReason?: string;
  icon: LucideIcon;
}
  
export interface DocumentStep {
  id: string;
  label: string;
}

export interface SidebarItem {
  id: string;
  label: string;
}

export interface DocumentSelectorConfig {
  dosageForms: DocumentOption[];
  documentTypes: DocumentOption[];
  steps: DocumentStep[];
}

export interface DocumentSelectorState {
  dosageFormId: string | null;
  documentTypeId: string | null;
}

export interface DocumentSelectorContext {
  user: AuthenticatedUser;
  unit: UnitContext | null;
  config: DocumentSelectorConfig;
}

export type DocumentSelectorScenario =
  | "default"
  | "loading"
  | "no-unit"
  | "empty-config"
  | "creation-error";
