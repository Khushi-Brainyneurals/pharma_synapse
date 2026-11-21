import { useEffect, useState } from "react";
import { DocumentOptionCard } from "../../document-workflows/selection/components/DocumentOptionCard";
import { DOCUMENT_TYPE_OPTIONS, DOSAGE_FORM_OPTIONS } from "../../document-workflows/selection/model/documentSelector.config";
import type { DocumentOption } from "../../document-workflows/selection/model/documentSelector.types";
import { optionForBackendValue } from "../../document-workflows/selection/services/documentSelector.service";
import { getOptions } from "../../document-workflows/selection/api/document.api";
import type { PvpSourceOption } from "../../document-workflows/selection/api/document.types";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { SetupShell } from "../components/SetupShell";
import { StepFooter } from "../components/StepFooter";
import { STEPS } from "../model/setup.model";
import { useSetupStore } from "../state/setupStore";

/**
 * Step 1 — Type. The same dosage-form / document-type selector the prepared-by flow
 * uses (identical cards + options), so the two "pick a Type" screens read the same;
 * here it opens the master-data set for that Type instead of a new document.
 */
export function TypePage() {
  const dosageFormId = useSetupStore((s) => s.dosageFormId);
  const documentTypeId = useSetupStore((s) => s.documentTypeId);
  const pvpSourceKey = useSetupStore((s) => s.pvpSourceKey);
  const setDosageFormId = useSetupStore((s) => s.setDosageFormId);
  const setDocumentTypeId = useSetupStore((s) => s.setDocumentTypeId);
  const setPvpSourceKey = useSetupStore((s) => s.setPvpSourceKey);
  const stageSections = useSetupStore((s) => s.stageSections);
  const batchDocs = useSetupStore((s) => s.batchDocs);
  const [dosageOptions, setDosageOptions] = useState<DocumentOption[]>([]);
  const [documentOptions, setDocumentOptions] = useState<DocumentOption[]>([]);
  const [pvpSourceOptions, setPvpSourceOptions] = useState<PvpSourceOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    setIsLoadingOptions(true);
    setOptionsError(null);
    getOptions()
      .then((options) => {
        if (!isCurrent) return;
        setDosageOptions(options.supported_dosage_forms.map((value) => optionForBackendValue(DOSAGE_FORM_OPTIONS, value)));
        setDocumentOptions(options.supported_doc_types.map((value) => optionForBackendValue(DOCUMENT_TYPE_OPTIONS, value, true)));
        setPvpSourceOptions(options.pvp_source_options);
      })
      .catch((error) => {
        if (!isCurrent) return;
        setOptionsError(getApiErrorMessage(error, "Unable to load supported document types."));
        setDosageOptions([]);
        setDocumentOptions([]);
        setPvpSourceOptions([]);
      })
      .finally(() => {
        if (isCurrent) setIsLoadingOptions(false);
      });
    return () => { isCurrent = false; };
  }, [reloadToken]);

  const dosage = dosageOptions.find((o) => o.id === dosageFormId);
  const docType = documentOptions.find((o) => o.id === documentTypeId);
  const isPvp = docType?.backendValue.toLowerCase() === "pvp";
  const pvpSourceCards: DocumentOption[] = pvpSourceOptions.map(({ key, label, source_doc_type }) => ({
    id: key,
    backendValue: key,
    label,
    description: `Source document type: ${source_doc_type.toUpperCase()}`,
    available: true,
    icon: docType?.icon ?? DOSAGE_FORM_OPTIONS[0].icon,
  }));
  const hasValidPvpSource = pvpSourceOptions.some((option) => option.key === pvpSourceKey);
  const ready = Boolean(dosage?.available && docType?.available && (!isPvp || hasValidPvpSource));
  const stageDocCount = stageSections.reduce((n, s) => n + s.docs.length, 0);
  const batchDocCount = batchDocs.length;

  return (
    <SetupShell
      step="type"
      title="Type"
      description="Choose the dosage form and document type this master-data set configures."
    >
      <section className="space-y-6 rounded-panel border border-border bg-surface p-5 shadow-sm sm:p-6">
        {optionsError ? <div role="alert" className="rounded-control border border-danger/30 bg-danger/5 p-3 text-small text-danger">
          {optionsError} <button type="button" className="ml-2 font-semibold underline" onClick={() => setReloadToken((value) => value + 1)}>Retry</button>
        </div> : null}
        <div>
          <h2 className="text-h3 font-semibold">Dosage form</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-label="Dosage form">
            {dosageOptions.map((option) => (
              <DocumentOptionCard
                key={option.id}
                option={option}
                groupName="dosage-form"
                isSelected={dosageFormId === option.id}
                isDisabled={false}
                onSelect={setDosageFormId}
              />
            ))}
            {!isLoadingOptions && !optionsError && dosageOptions.length === 0 ? <p className="text-small text-subdued">No dosage forms are currently supported.</p> : null}
          </div>
        </div>

        <div>
          <h2 className="text-h3 font-semibold">Document type</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2" role="radiogroup" aria-label="Document type">
            {documentOptions.map((option) => (
              <DocumentOptionCard
                key={option.id}
                option={option}
                groupName="document-type"
                isSelected={documentTypeId === option.id}
                isDisabled={false}
                onSelect={(id) => {
                  setDocumentTypeId(id);
                  if (documentOptions.find((item) => item.id === id)?.backendValue.toLowerCase() !== "pvp") setPvpSourceKey(null);
                }}
              />
            ))}
            {!isLoadingOptions && !optionsError && documentOptions.length === 0 ? <p className="text-small text-subdued">No document types are currently supported.</p> : null}
          </div>
        </div>
        {isPvp ? <div>
          <h2 className="text-h3 font-semibold">PVP source</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2" role="radiogroup" aria-label="PVP source">
            {pvpSourceCards.map((option) => <DocumentOptionCard
              key={option.id}
              option={option}
              groupName="pvp-source"
              isSelected={pvpSourceKey === option.id}
              isDisabled={false}
              onSelect={setPvpSourceKey}
            />)}
            {!isLoadingOptions && !optionsError && pvpSourceCards.length === 0 ? <p className="text-small text-subdued">No PVP sources are currently supported.</p> : null}
          </div>
        </div> : null}
        {isLoadingOptions ? <p role="status" className="text-small text-subdued">Loading supported types…</p> : null}
      </section>

      <StepFooter
        note={
          ready
            ? `${dosage?.label} · ${docType?.label} selected — ${stageDocCount} stage documents and ${batchDocCount} other documents to configure.`
            : isPvp && !hasValidPvpSource
              ? "Choose a PVP source to continue."
              : "Choose an available dosage form and document type to continue."
        }
        continueTo={STEPS[1].route}
        continueLabel="Continue to stage documents"
        disabled={!ready || isLoadingOptions || Boolean(optionsError)}
        disabledReason={isPvp && !hasValidPvpSource ? "Choose a PVP source to continue" : "Choose an available dosage form and document type to continue"}
      />
    </SetupShell>
  );
}
