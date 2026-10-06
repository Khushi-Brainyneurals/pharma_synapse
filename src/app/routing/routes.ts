export const ROUTES = {
  login: "/login",
  newDocument: "/new",
  statusBoard: "/session",
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
} as const;

export function getDocumentInputsRoute(documentId: string) {
  return `/documents/${encodeURIComponent(documentId)}/inputs`;
}

export function getDocumentPreviewRoute(documentId: string) {
  return `/documents/${encodeURIComponent(documentId)}/preview`;
}

export function getDocumentCoverBomRoute(documentId: string) {
  return `/documents/${encodeURIComponent(documentId)}/cover-bom`;
}
