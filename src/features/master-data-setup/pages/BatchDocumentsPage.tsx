import { masterDataAccess } from "../access";
import { HowThisWorks } from "../components/HowThisWorks";
import { SetupShell } from "../components/SetupShell";
import { StepFooter } from "../components/StepFooter";
import { UploadRow } from "../components/UploadRow";
import { BATCH_DOCS, STEPS } from "../model/setup.model";
import { useSetupStore } from "../state/setupStore";
import { useAuthStore } from "../../auth/state/auth.store";

const LETTERS = "abcd";

export function BatchDocumentsPage() {
  const user = useAuthStore((s) => s.user);
  const canEdit = masterDataAccess(user?.role).canEdit;
  const uploads = useSetupStore((s) => s.batchUploads);
  const setUpload = useSetupStore((s) => s.setBatchUpload);
  const removeUpload = useSetupStore((s) => s.removeBatchUpload);

  const done = BATCH_DOCS.filter((d) => uploads[d.code]).length;
  const total = BATCH_DOCS.length;

  return (
    <SetupShell
      step="batch"
      title="Other documents"
      description={
        <>
          The closing sections of the BMR — batch reconciliation, batch release, deviation, change history — they apply{" "}
          <strong>once per batch, not per stage</strong>, which is why they live here. Upload the blank approved master
          format for each.
        </>
      }
    >
      <HowThisWorks
        items={[
          <>Each box tells you <span className="font-semibold">which document to upload</span> — one PDF or DOCX per box.</>,
          <><span className="font-semibold">Green tick = done</span> · Replace or Remove anytime.</>,
          <>All {total} uploaded → <span className="font-semibold">Preview unlocks</span> · extra docs go in Others (optional).</>,
        ]}
      />

      <section className="overflow-hidden rounded-panel border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-base font-semibold">Batch-level documents</p>
            <p className="text-micro text-subdued">{total} documents · all mandatory · one file per document · PDF or DOCX</p>
          </div>
          <p className="text-right">
            <span className={`font-mono text-small font-semibold tabular-nums ${done === total ? "text-approved-fg" : "text-draft-fg"}`}>{done} / {total}</span>
            <span className="block text-[10px] uppercase tracking-overline text-subdued">Uploaded</span>
          </p>
        </div>
        {BATCH_DOCS.map((d, i) => (
          <UploadRow
            key={d.code}
            doc={d}
            letter={LETTERS[i]}
            file={uploads[d.code] ?? null}
            canEdit={canEdit}
            onUpload={(f) => setUpload(d.code, f)}
            onRemove={() => removeUpload(d.code)}
          />
        ))}
      </section>

      <section className="rounded-panel border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <p className="text-base font-semibold">Others — additional documents</p>
          <span className="rounded-pill border border-border px-2 py-0.5 text-[10px] font-semibold uppercase text-subdued">Optional</span>
        </div>
        <p className="mt-1 text-micro text-subdued">
          Anything beyond the four fixed sections — annexures, formats, SOP extracts. PDF or DOCX · never blocks Continue to preview.
        </p>
        {canEdit ? (
          <button type="button" className="mt-3 rounded-control border border-dashed border-border px-3 py-1.5 text-small font-semibold text-subdued hover:border-primary hover:text-primary">
            + Add another document
          </button>
        ) : null}
      </section>

      <StepFooter
        note={<>Autosaved · <span className="font-mono tabular-nums">{done}</span> / {total} mandatory uploaded</>}
        backTo={STEPS[3].route}
        backLabel="Instrument list"
        continueTo={STEPS[5].route}
        continueLabel="Continue to preview"
      />
    </SetupShell>
  );
}
