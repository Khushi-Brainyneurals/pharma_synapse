import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { AuthenticatedUser } from "../../auth/api/auth.types";
import type {
  DocumentSelectorContext,
  DocumentSelectorScenario,
} from "../model/documentSelector.types";
import { loadDocumentSelectorContext } from "../services/documentSelector.service";

interface DocumentSelectorDataState {
  context: DocumentSelectorContext | null;
  isLoading: boolean;
  error: string | null;
  scenario: DocumentSelectorScenario;
}

const SCENARIOS: DocumentSelectorScenario[] = [
  "default",
  "loading",
  "no-unit",
  "empty-config",
  "creation-error",
];

export function useDocumentSelectorData(user: AuthenticatedUser | null): DocumentSelectorDataState {
  const [searchParams] = useSearchParams();
  const scenario = useMemo(
    () => parseScenario(searchParams.get("state") ?? searchParams.get("mockState")),
    [searchParams],
  );
  const [context, setContext] = useState<DocumentSelectorContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    if (!user) {
      setContext(null);
      setIsLoading(false);
      return;
    }

    setError(null);
    setIsLoading(true);

    if (scenario === "loading") {
      setContext(null);
      return () => {
        isCurrent = false;
      };
    }

    loadDocumentSelectorContext(user, scenario)
      .then((nextContext) => {
        if (!isCurrent) {
          return;
        }

        setContext(nextContext);
        setIsLoading(false);
      })
      .catch(() => {
        if (!isCurrent) {
          return;
        }

        setContext(null);
        setError("Document configuration could not be loaded. Try again.");
        setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [scenario, user]);

  return { context, isLoading, error, scenario };
}

function parseScenario(value: string | null): DocumentSelectorScenario {
  if (value && SCENARIOS.includes(value as DocumentSelectorScenario)) {
    return value as DocumentSelectorScenario;
  }

  return "default";
}
