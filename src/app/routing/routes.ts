export const ROUTES = {
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

export function getDocumentCoverBomRoute(documentId: string) {
  return `/documents/${encodeURIComponent(documentId)}/cover-bom`;
}
