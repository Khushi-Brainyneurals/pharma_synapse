export const ROUTES = {
  /** The first screen: the public module map. */
  modules: "/",
  dashboard: "/dashboard",
  documents: "/documents",
  login: "/login",
  newDocument: "/new",
  documentInputs: "/documents/:documentId/inputs",
  documentPreview: "/documents/:documentId/preview",
  documentCoverBom: "/documents/:documentId/cover-bom",
  documentStages: "/documents/:documentId/stages",
  documentStageInput: "/documents/:documentId/stage-input",
  documentGenerate: "/documents/:documentId/generate",
  companyInfo: "/settings/company",
  masterData: "/settings/master-data",
  masterDataSetup: "/master-data-setup",
  versionHistory: "/versions",
  notifications: "/notifications",
  auditTrail: "/audit",
  queue: "/queue",
  employees: "/settings/employees",
  setPassword: "/set-password",
  documentReview: "/documents/:documentId/review",
  documentFinalize: "/documents/:documentId/finalize",
} as const;

export function getDocumentInputsRoute(documentId: string) {
  return `/documents/${encodeURIComponent(documentId)}/inputs`;
}

export function getDocumentSelectRoute(documentId: string) {
  return `/documents/${encodeURIComponent(documentId)}/pvp-pvr/select-document`;
}

export function getPvpCoverDetailsRoute(documentId: string) {
  return `/documents/${encodeURIComponent(documentId)}/pvp-pvr/cover-details`;
}

export function getPvpProcessBomRoute(documentId: string) {
  return `/documents/${encodeURIComponent(documentId)}/pvp-pvr/process-bom`;
}

export function getPvpCppCqaRoute(documentId: string) {
  return `/documents/${encodeURIComponent(documentId)}/pvp-pvr/cpp-cqa`;
}

export function getPvpProcedureSamplingRoute(documentId: string) {
  return `/documents/${encodeURIComponent(documentId)}/pvp-pvr/procedure-sampling`;
}

export function getPvpProcedureGenerationRoute(
  documentId: string,
  sectionKey: string,
  regenerate: boolean,
) {
  const query = new URLSearchParams({
    section_key: sectionKey,
    mode: regenerate ? "regenerate" : "generate",
  });
  return `${getPvpProcedureSamplingRoute(documentId)}/generate?${query}`;
}

export function getDocumentCoverBomRoute(documentId: string) {
  return `/documents/${encodeURIComponent(documentId)}/cover-bom`;
}

/** Sign-in route for one module, or the plain sign-in when no module is given. */
export function getLoginRoute(moduleKey?: string) {
  return moduleKey ? `${ROUTES.login}?module=${encodeURIComponent(moduleKey)}` : ROUTES.login;
}
