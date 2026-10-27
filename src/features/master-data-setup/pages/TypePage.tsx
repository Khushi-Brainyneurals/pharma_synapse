import { DocumentOptionCard } from "../../document-workflows/selection/components/DocumentOptionCard";
import { DOCUMENT_TYPE_OPTIONS, DOSAGE_FORM_OPTIONS } from "../../document-workflows/selection/model/documentSelector.config";
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
  const setDosageFormId = useSetupStore((s) => s.setDosageFormId);
  const setDocumentTypeId = useSetupStore((s) => s.setDocumentTypeId);
  const stageSections = useSetupStore((s) => s.stageSections);
  const batchDocs = useSetupStore((s) => s.batchDocs);

  const dosage = DOSAGE_FORM_OPTIONS.find((o) => o.id === dosageFormId);
  const docType = DOCUMENT_TYPE_OPTIONS.find((o) => o.id === documentTypeId);
  const ready = Boolean(dosage?.available && docType?.available);
  const stageDocCount = stageSections.reduce((n, s) => n + s.docs.length, 0);
  const batchDocCount = batchDocs.length;

  return (
    <SetupShell
      step="type"
      title="Type"
      description="Choose the dosage form and document type this master-data set configures."
    >
      <section className="space-y-6 rounded-panel border border-border bg-surface p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="text-h3 font-semibold">Dosage form</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-label="Dosage form">
            {DOSAGE_FORM_OPTIONS.map((option) => (
              <DocumentOptionCard
                key={option.id}
                option={option}
                groupName="dosage-form"
                isSelected={dosageFormId === option.id}
                isDisabled={false}
                onSelect={setDosageFormId}
              />
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-h3 font-semibold">Document type</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2" role="radiogroup" aria-label="Document type">
            {DOCUMENT_TYPE_OPTIONS.map((option) => (
              <DocumentOptionCard
                key={option.id}
                option={option}
                groupName="document-type"
                isSelected={documentTypeId === option.id}
                isDisabled={false}
                onSelect={setDocumentTypeId}
              />
            ))}
          </div>
        </div>
      </section>

      <StepFooter
        note={
          ready
            ? `${dosage?.label} · ${docType?.label} selected — ${stageDocCount} stage documents and ${batchDocCount} other documents to configure.`
            : "Choose an available dosage form and document type to continue."
        }
        continueTo={STEPS[1].route}
        continueLabel="Continue to stage documents"
        disabled={!ready}
        disabledReason="Choose an available dosage form and document type to continue"
      />
    </SetupShell>
  );
}
