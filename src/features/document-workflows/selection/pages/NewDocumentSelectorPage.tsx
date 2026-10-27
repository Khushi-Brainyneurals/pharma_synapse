import { FileText } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDocumentInputsRoute, ROUTES } from "../../../../app/routing/routes";
import { getApiErrorMessage } from "../../../../shared/api/apiError";
import { LoadingSpinner } from "../../../../shared/ui/LoadingSpinner";
import { USER_ROLE_LABELS, USER_ROLES } from "../../../auth/model/roles";
import { useAuthStore } from "../../../auth/state/auth.store";
import { createBmrDocument } from "../api/documents.api";
import { AppHeader } from "../../../../app/layout/AppHeader";
import { AppSidebar } from "../../../../app/layout/AppSidebar";
import { DocumentOptionCard } from "../components/DocumentOptionCard";
import { DocumentStepper } from "../components/DocumentStepper";
import { GuardPanel } from "../components/GuardPanel";
import { SelectionSummary } from "../components/SelectionSummary";
import { useDocumentSelectorData } from "../hooks/useDocumentSelectorData";
import type { DocumentOption, DocumentSelectorState } from "../model/documentSelector.types";

const INITIAL_SELECTION: DocumentSelectorState = {
  dosageFormId: null,
  documentTypeId: null,
  pvpSourceKey: null,
};

export function NewDocumentSelectorPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { context, isLoading, error } = useDocumentSelectorData(user);
  const [selection, setSelection] = useState<DocumentSelectorState>(INITIAL_SELECTION);
  const [isCreating, setIsCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const createInFlightRef = useRef(false);

  const config = context?.config;
  const selectedDosageForm = config?.dosageForms.find(
    (option) => option.id === selection.dosageFormId,
  );
  const selectedDocumentType = config?.documentTypes.find(
    (option) => option.id === selection.documentTypeId,
  );
  const isPvp = selectedDocumentType?.backendValue === "pvp";
  const pvpSourceOptions = context?.pvpSourceOptions ?? [];
  const pvpSourceCardOptions: DocumentOption[] = pvpSourceOptions.map(
    ({ key, label, source_doc_type }) => ({
      id: key,
      backendValue: key,
      label,
      description: `Source document type: ${source_doc_type.toUpperCase()}`,
      available: true,
      icon: selectedDocumentType?.icon ?? FileText,
    }),
  );
  const hasValidPvpSource = pvpSourceOptions.some(
    (option) => option.key === selection.pvpSourceKey,
  );
  const canCreate = user?.role === USER_ROLES.PREPARED_BY;
  const isSelectionComplete = Boolean(
    selectedDosageForm?.available &&
      selectedDocumentType?.available &&
      context?.unit &&
      (!isPvp || hasValidPvpSource),
  );
  const hasAvailableDocumentTypes = Boolean(
    config?.documentTypes.some((option) => option.available),
  );

  const body = useMemo(() => {
    if (isLoading) {
      return <LoadingState />;
    }

    if (error) {
      return (
        <GuardPanel title="Document options unavailable">
          <p>{error}</p>
        </GuardPanel>
      );
    }

    if (!user || !context || !config) {
      return null;
    }

    if (!canCreate) {
      const roleLabel = getRestrictedRoleText(user.role);

      return (
        <GuardPanel
          title="Create permission required"
          action={
            <button
              type="button"
              className="rounded-control border border-danger/30 bg-white px-4 py-2 text-small font-semibold text-danger-ink transition hover:bg-danger-soft focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2"
              onClick={() => navigate("/")}
            >
              Go to your dashboard
            </button>
          }
        >
          <p>
            Creating documents is restricted to the Prepared By role. You're signed in as{" "}
            {roleLabel}.
          </p>
        </GuardPanel>
      );
    }

    if (!context.unit) {
      return (
        <GuardPanel title="No manufacturing Unit assigned">
          <p>
            No manufacturing Unit is assigned to your account. A document must belong to a Unit
            before it can be created. Contact your Admin.
          </p>
        </GuardPanel>
      );
    }

    if (!hasAvailableDocumentTypes) {
      return (
        <GuardPanel title="No document types configured">
          <p>No document types are configured for this deployment yet. Contact your Admin.</p>
        </GuardPanel>
      );
    }

    return (
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreate();
        }}
      >
        {creationError ? (
          <div
            className="rounded-control border border-danger/20 bg-danger-soft px-4 py-3 text-small font-medium text-danger-ink"
            role="alert"
          >
            {creationError}
          </div>
        ) : null}

        <section aria-busy={isCreating}>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-h3 font-semibold">Dosage form</h2>
          </div>
          <div
            className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
            role="radiogroup"
            aria-label="Dosage form"
            onKeyDown={(event) =>
              handleRadioGroupKeyDown(
                event,
                config.dosageForms,
                selection.dosageFormId,
                selectDosageForm,
              )
            }
          >
            {config.dosageForms.map((option) => (
              <DocumentOptionCard
                key={option.id}
                option={option}
                groupName="dosage-form"
                isSelected={selection.dosageFormId === option.id}
                isDisabled={isCreating}
                onSelect={selectDosageForm}
              />
            ))}
          </div>
        </section>

        <section aria-busy={isCreating}>
          <h2 className="text-h3 font-semibold">Document type</h2>
          <div
            className="mt-3 grid gap-3 md:grid-cols-2"
            role="radiogroup"
            aria-label="Document type"
            onKeyDown={(event) =>
              handleRadioGroupKeyDown(
                event,
                config.documentTypes,
                selection.documentTypeId,
                selectDocumentType,
              )
            }
          >
            {config.documentTypes.map((option) => (
              <DocumentOptionCard
                key={option.id}
                option={option}
                groupName="document-type"
                isSelected={selection.documentTypeId === option.id}
                isDisabled={isCreating}
                onSelect={selectDocumentType}
              />
            ))}
          </div>
        </section>

        {isPvp ? (
          <section aria-busy={isCreating}>
            <h2 className="text-h3 font-semibold">PVP Source</h2>
            <div
              className="mt-3 grid gap-3 md:grid-cols-2"
              role="radiogroup"
              aria-label="PVP Source"
              onKeyDown={(event) =>
                handleRadioGroupKeyDown(
                  event,
                  pvpSourceCardOptions,
                  selection.pvpSourceKey,
                  selectPvpSource,
                )
              }
            >
              {pvpSourceCardOptions.map((option) => (
                <DocumentOptionCard
                  key={option.id}
                  option={option}
                  groupName="pvp-source"
                  isSelected={selection.pvpSourceKey === option.id}
                  isDisabled={isCreating}
                  onSelect={selectPvpSource}
                />
              ))}
            </div>
          </section>
        ) : null}

        <SelectionSummary
          dosageForm={selectedDosageForm}
          documentType={selectedDocumentType}
          isCreating={isCreating}
        />

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center rounded-control border border-border bg-white px-5 py-2.5 text-small font-semibold text-subdued transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isCreating}
            onClick={() => navigate("/")}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex min-h-10 items-center justify-center rounded-control bg-primary px-5 py-2.5 text-small font-semibold text-white transition hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-muted disabled:text-subdued"
            disabled={!isSelectionComplete || isCreating}
          >
            {isCreating ? (
              <span className="inline-flex items-center gap-2" aria-live="polite">
                <LoadingSpinner />
                Creating document...
              </span>
            ) : creationError ? (
              "Retry"
            ) : (
              "Continue to inputs"
            )}
          </button>
        </div>
      </form>
    );
  }, [
    canCreate,
    config,
    context,
    creationError,
    error,
    hasAvailableDocumentTypes,
    isCreating,
    isLoading,
    isSelectionComplete,
    navigate,
    selectedDocumentType,
    selectedDosageForm,
    selection.pvpSourceKey,
    selection.documentTypeId,
    selection.dosageFormId,
    hasValidPvpSource,
    isPvp,
    pvpSourceCardOptions,
    user,
  ]);

  function selectDosageForm(optionId: string) {
    setCreationError(null);
    setSelection((current) => ({ ...current, dosageFormId: optionId }));
  }

  function selectDocumentType(optionId: string) {
    setCreationError(null);
    const option = config?.documentTypes.find((item) => item.id === optionId);
    setSelection((current) => ({
      ...current,
      documentTypeId: optionId,
      pvpSourceKey: option?.backendValue === "pvp" ? current.pvpSourceKey : null,
    }));
  }

  function selectPvpSource(sourceKey: string) {
    setCreationError(null);
    setSelection((current) => ({ ...current, pvpSourceKey: sourceKey }));
  }

  async function handleCreate() {
    if (
      !context?.unit ||
      !selectedDosageForm?.available ||
      !selectedDocumentType?.available ||
      (isPvp && !hasValidPvpSource) ||
      createInFlightRef.current
    ) {
      return;
    }

    createInFlightRef.current = true;
    setCreationError(null);
    setIsCreating(true);

    try {
      const document = await createBmrDocument({
        dosage_form: selectedDosageForm.backendValue,
        doc_type: selectedDocumentType.backendValue,
        user: user?.username ?? user?.id ?? "api",
        ...(isPvp ? { pvp_mode: selection.pvpSourceKey ?? "" } : {}),
      });

      navigate(getDocumentInputsRoute(document.document_id), {
        state: { document, pvpMode: selection.pvpSourceKey },
      });
    } catch (requestError) {
      setCreationError(
        getApiErrorMessage(requestError, "Unable to create the document. Please try again."),
      );
    } finally {
      createInFlightRef.current = false;
      setIsCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader user={user} unit={context?.unit ?? null} isLoadingUnit={isLoading} />
      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />
        <main className="min-w-0 px-4 py-6 sm:px-6 lg:h-full lg:overflow-y-auto lg:px-8">
          <section className="rounded-panel border border-border bg-surface p-5 shadow-sm sm:p-6 shadow-auth">
            {config ? (
              <DocumentStepper steps={config.steps} activeStepId="type" />
            ) : (
              <div className="h-10 animate-pulse rounded-control bg-muted" aria-hidden="true" />
            )}

            <div className="mt-6 border-t border-border pt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-h1 font-semibold">Start a new document</h2>
                  <p className="mt-2 max-w-2xl text-small leading-6 text-subdued">
                    Choose the dosage form and document type.
                  </p>
                </div>
              </div>

              <div className="mt-6">{body}</div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function getRestrictedRoleText(role: keyof typeof USER_ROLE_LABELS) {
  if (role === USER_ROLES.REVIEWER_QA) {
    return "QA reviewer";
  }

  return USER_ROLE_LABELS[role].toLowerCase();
}

function LoadingState() {
  return (
    <div className="space-y-6" aria-live="polite">
      <p className="text-small font-medium text-subdued">Loading document options…</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="min-h-[104px] animate-pulse rounded-card border border-border bg-muted"
          />
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="min-h-[104px] animate-pulse rounded-card border border-border bg-muted"
          />
        ))}
      </div>
    </div>
  );
}

function handleRadioGroupKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  options: DocumentOption[],
  selectedId: string | null,
  onSelect: (optionId: string) => void,
) {
  if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) {
    return;
  }

  const availableOptions = options.filter((option) => option.available);
  if (!availableOptions.length) {
    return;
  }

  event.preventDefault();

  const currentIndex = Math.max(
    0,
    availableOptions.findIndex((option) => option.id === selectedId),
  );
  const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
  const nextIndex = (currentIndex + direction + availableOptions.length) % availableOptions.length;
  onSelect(availableOptions[nextIndex].id);
}
