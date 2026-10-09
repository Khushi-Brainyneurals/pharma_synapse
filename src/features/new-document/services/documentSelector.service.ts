import type { AuthenticatedUser } from "../../auth/api/auth.types";
import { FileText } from "lucide-react";
import { getOptions } from "../api/document.api";
import {
  DOCUMENT_SELECTOR_STEPS,
  DOCUMENT_TYPE_OPTIONS,
  DOSAGE_FORM_OPTIONS,
} from "../model/documentSelector.config";
import type {
  DocumentSelectorContext,
  DocumentSelectorScenario,
  DocumentOption,
  UnitContext,
} from "../model/documentSelector.types";

export async function loadDocumentSelectorContext(
  user: AuthenticatedUser,
  scenario: DocumentSelectorScenario,
): Promise<DocumentSelectorContext> {
  const unit = resolveUnitContext(user, scenario);
  const options = await getOptions();
  const dosageForms = options.supported_dosage_forms.map((value) =>
    optionForBackendValue(DOSAGE_FORM_OPTIONS, value),
  );
  const documentTypes = options.supported_doc_types.map((value) =>
    optionForBackendValue(DOCUMENT_TYPE_OPTIONS, value, true),
  );

  return {
    user,
    unit,
    config: {
      dosageForms,
      documentTypes: scenario === "empty-config" ? [] : documentTypes,
      steps: DOCUMENT_SELECTOR_STEPS,
    },
  };
}

function optionForBackendValue(options: DocumentOption[], value: string, useShortLabel = false): DocumentOption {
  const normalized = value.replace(/-/g, "_").toLowerCase();
  const template = options.find((option) =>
    option.backendValue.replace(/-/g, "_").toLowerCase() === normalized,
  );
  if (template) return { ...template, backendValue: value, available: true, unavailableReason: undefined };
  const label = value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return {
    id: value.replace(/_/g, "-"),
    backendValue: value,
    label,
    shortLabel: useShortLabel ? value.toUpperCase() : undefined,
    description: "",
    available: true,
    icon: options[0]?.icon || FileText,
  };
}

function resolveUnitContext(
  user: AuthenticatedUser,
  scenario: DocumentSelectorScenario,
): UnitContext | null {
  if (scenario === "no-unit") {
    return null;
  }

  return {
    id: user.unitId ?? "UNIT-03",
    name: user.unitName ?? undefined,
  };
}
