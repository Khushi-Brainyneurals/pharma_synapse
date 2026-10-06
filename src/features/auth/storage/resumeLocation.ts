/** Saved wizard subpages belong to one document and one signed-in user. */
const PREFIX = "bmr.client.document-location";
const LEGACY_KEY = "bmr.client.resume";
const STEP_PATHS: Record<string, string> = {
  type: "inputs", inputs: "inputs", preview: "preview", "cover-bom": "cover-bom",
  stages: "stages", "stage-input": "stage-input", "generate-submit": "generate",
};
const ORDER = ["inputs", "preview", "cover-bom", "stages", "stage-input", "generate"];
const keyFor = (username: string, documentId: string) => `${PREFIX}:${encodeURIComponent(username)}:${encodeURIComponent(documentId)}`;

function wizardPath(documentId: string, path: string): boolean {
  const prefix = `/documents/${encodeURIComponent(documentId)}/`;
  if (!path.startsWith(prefix)) return false;
  const step = path.slice(prefix.length).split(/[?#]/)[0];
  return ORDER.includes(step);
}

export function saveDocumentLocation(username: string, documentId: string, path: string) {
  if (!username || !documentId || !wizardPath(documentId, path)) return;
  try { window.localStorage.setItem(keyFor(username, documentId), path); } catch { /* best effort */ }
}

export function getDocumentLocation(username: string, documentId: string, resumeStep: string): string | null {
  if (!username || !documentId) return null;
  try {
    let path = window.localStorage.getItem(keyFor(username, documentId));
    if (!path) {
      const legacy = JSON.parse(window.localStorage.getItem(LEGACY_KEY) ?? "null");
      if (legacy?.username === username && typeof legacy.path === "string") path = legacy.path;
    }
    if (!path || !wizardPath(documentId, path)) return null;
    const savedStep = path.split("/")[3].split(/[?#]/)[0];
    const furthest = STEP_PATHS[resumeStep];
    // Refine the server's current step; never jump forward or resume an earlier state.
    if (savedStep === furthest || (furthest === "stages" && savedStep === "stage-input")) return path;
  } catch { /* unavailable storage or an invalid legacy entry */ }
  return null;
}

export function clearDocumentLocation(username: string, documentId: string) {
  try {
    window.localStorage.removeItem(keyFor(username, documentId));
    const legacy = JSON.parse(window.localStorage.getItem(LEGACY_KEY) ?? "null");
    if (legacy?.username === username && typeof legacy.path === "string" && wizardPath(documentId, legacy.path)) {
      window.localStorage.removeItem(LEGACY_KEY);
    }
  } catch { /* best effort */ }
}
