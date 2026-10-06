import type { AuthenticatedUser } from "../../auth/api/auth.types";
import {
  DOCUMENT_SELECTOR_STEPS,
  DOCUMENT_TYPE_OPTIONS,
  DOSAGE_FORM_OPTIONS,
} from "../model/documentSelector.config";
import type {
  DocumentSelectorContext,
  DocumentSelectorScenario,
  UnitContext,
} from "../model/documentSelector.types";

const LOAD_DELAY_MS = 350;

export async function loadDocumentSelectorContext(
  user: AuthenticatedUser,
  scenario: DocumentSelectorScenario,
): Promise<DocumentSelectorContext> {
  await wait(LOAD_DELAY_MS);

  const unit = resolveUnitContext(user, scenario);

  return {
    user,
    unit,
    config: {
      dosageForms: DOSAGE_FORM_OPTIONS,
      documentTypes: scenario === "empty-config" ? [] : DOCUMENT_TYPE_OPTIONS,
      steps: DOCUMENT_SELECTOR_STEPS,
    },
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

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
