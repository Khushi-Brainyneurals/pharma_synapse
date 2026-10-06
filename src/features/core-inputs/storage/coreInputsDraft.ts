/**
 * Core-inputs form autosave.
 *
 * The wizard saves each step to the server on submit — but a form the user has *typed
 * but not yet submitted* is only local React state, so leaving the flow (or logging
 * out) loses it. This persists the typed values to localStorage on every change and
 * restores them on return, so nothing has to be re-entered.
 *
 * Kept DELIBERATELY to the serializable fields only. File objects (the MFC/PP PDFs)
 * cannot be stored in the browser; once core inputs are submitted the files live on
 * the server, and the form treats already-stored files as satisfied.
 *
 * Survives logout on purpose — logout clears only the auth session key, not these.
 * The draft is per-document (keyed by id) and cleared once the step is submitted.
 */

export interface CoreInputsDraft {
  batchSize: string;
  batchType: string;
  commercialMode: string;
  headerFooterSize: string;
  footerSize: string;
  footerTemplateNo: string;
}

const KEY_PREFIX = "bmr.client.coreInputs.draft.";

function keyFor(documentId: string): string {
  return `${KEY_PREFIX}${documentId}`;
}

function storageAvailable(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

/** True when at least one field carries a value worth persisting. */
export function isDraftEmpty(draft: CoreInputsDraft): boolean {
  return Object.values(draft).every((value) => !value || !value.trim());
}

export function loadCoreInputsDraft(documentId: string): CoreInputsDraft | null {
  if (!storageAvailable() || !documentId) {
    return null;
  }

  const raw = window.localStorage.getItem(keyFor(documentId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CoreInputsDraft>;
    return {
      batchSize: parsed.batchSize ?? "",
      batchType: parsed.batchType ?? "",
      commercialMode: parsed.commercialMode ?? "",
      headerFooterSize: parsed.headerFooterSize ?? "",
      footerSize: parsed.footerSize ?? "",
      footerTemplateNo: parsed.footerTemplateNo ?? "",
    };
  } catch {
    window.localStorage.removeItem(keyFor(documentId));
    return null;
  }
}

export function saveCoreInputsDraft(documentId: string, draft: CoreInputsDraft): void {
  if (!storageAvailable() || !documentId) {
    return;
  }

  // Nothing typed yet — don't leave an empty draft lying around.
  if (isDraftEmpty(draft)) {
    window.localStorage.removeItem(keyFor(documentId));
    return;
  }

  try {
    window.localStorage.setItem(keyFor(documentId), JSON.stringify(draft));
  } catch {
    // Quota or private-mode failure — losing an autosave is not worth crashing over.
  }
}

export function clearCoreInputsDraft(documentId: string): void {
  if (!storageAvailable() || !documentId) {
    return;
  }
  window.localStorage.removeItem(keyFor(documentId));
}
