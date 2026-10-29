import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getDocumentSelectRoute, getPvpCoverDetailsRoute, getPvpProcessBomRoute, ROUTES } from "../../../../app/routing/routes";

/** Wizard step id → route. One map, so Back, Next and the stepper can't disagree. */
const STEP_ROUTES: Record<string, (documentId: string) => string> = {
  type: () => ROUTES.newDocument,
  "select-document": (id) => getDocumentSelectRoute(id),
  inputs: (id) => `/documents/${encodeURIComponent(id)}/inputs`,
  "cover-details": (id) => getPvpCoverDetailsRoute(id),
  "cover-bom": (id) => `/documents/${encodeURIComponent(id)}/cover-bom`,
  "process-bom": (id) => getPvpProcessBomRoute(id),
  stages: (id) => `/documents/${encodeURIComponent(id)}/stages`,
  "cpp-cqa": (id) => `/documents/${encodeURIComponent(id)}/stages`,
  "stage-input": (id) => `/documents/${encodeURIComponent(id)}/stage-input`,
  "procedure-sampling": (id) => `/documents/${encodeURIComponent(id)}/stage-input`,
  "generate-submit": (id) => `/documents/${encodeURIComponent(id)}/generate`,
};

export function useStepNavigation(documentId: string) {
  const navigate = useNavigate();

  const goToStep = useCallback(
    (stepId: string) => {
      const route = STEP_ROUTES[stepId];
      if (route) {
        navigate(route(documentId));
      }
    },
    [documentId, navigate],
  );

  return { goToStep, isStepRoutable: (stepId: string) => stepId in STEP_ROUTES };
}
