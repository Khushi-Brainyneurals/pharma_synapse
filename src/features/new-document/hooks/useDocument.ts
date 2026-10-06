import { useCallback, useEffect, useState } from "react";
import { getDocument } from "../api/document.api";
import type { DocumentDetail } from "../api/document.types";

/**
 * The document's saved server state.
 *
 * Every wizard step reads from this rather than from router state, so navigating
 * BACK to a step shows what was actually saved instead of an empty form. Router
 * state doesn't survive a reload or a direct link; the server does.
 */
export function useDocument(documentId: string) {
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!documentId) {
      setIsLoading(false);
      return null;
    }

    setIsLoading(true);

    try {
      const next = await getDocument(documentId);
      setDocument(next);
      setError(null);
      return next;
    } catch {
      setError("This document could not be loaded.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { document, isLoading, error, reload };
}
