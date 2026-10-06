import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { masterDataAccess } from "../access";
import { HowThisWorks } from "../components/HowThisWorks";
import { SetupShell } from "../components/SetupShell";
import { StepFooter } from "../components/StepFooter";
import { UploadRow } from "../components/UploadRow";
import { STAGE_DOC_COUNT, STAGE_SECTIONS, STEPS, type StageSection } from "../model/setup.model";
import { useSetupStore } from "../state/setupStore";
import { useAuthStore } from "../../auth/state/auth.store";

const LETTERS = "abcdefghij";

export function StageDocumentsPage() {
  const user = useAuthStore((s) => s.user);
  const access = masterDataAccess(user?.role);
  const uploads = useSetupStore((s) => s.uploads);
  const setUpload = useSetupStore((s) => s.setUpload);
  const removeUpload = useSetupStore((s) => s.removeUpload);

  const sectionCount = (sec: StageSection) => sec.docs.filter((d) => uploads[d.code]).length;
  const totalDone = STAGE_SECTIONS.reduce((n, sec) => n + sectionCount(sec), 0);

  const firstIncomplete = STAGE_SECTIONS.find((sec) => sectionCount(sec) < sec.docs.length)?.key;
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    firstIncomplete ? { [firstIncomplete]: true } : {},
  );

  const setAll = (open: boolean) =>
    setExpanded(Object.fromEntries(STAGE_SECTIONS.map((s) => [s.key, open])));

  return (
    <SetupShell
      step="stages"
      title="Stage documents"
      description={
        <>
          Upload one file for each document listed in the stages below — the <strong>blank approved master format</strong>{" "}
          (not a filled batch record). Everything saves automatically, and you can replace any file later.
        </>
      }
    >
      <HowThisWorks
        items={[
          <>Open a stage with the <span className="font-semibold">arrow</span>.</>,
          <>Each box tells you <span className="font-semibold">which document to upload</span> — one PDF or DOCX per box.</>,
          <><span className="font-semibold">Green tick = done.</span> Finish all {STAGE_DOC_COUNT} and press Continue.</>,
        ]}
      />

      <div className="flex items-center justify-between">
        <p className="text-micro font-semibold uppercase tracking-overline text-subdued">
          Stages — Tablet · BMR · {STAGE_SECTIONS.length} sections · {STAGE_DOC_COUNT} mandatory documents
        </p>
        <div className="flex items-center gap-3 text-small font-semibold text-primary">
          <button type="button" onClick={() => setAll(true)} className="hover:underline">Expand all</button>
          <button type="button" onClick={() => setAll(false)} className="hover:underline">Collapse all</button>
        </div>
      </div>

      <div className="space-y-3">
        {STAGE_SECTIONS.map((sec) => {
          const done = sectionCount(sec);
          const total = sec.docs.length;
          const state = done === total ? "done" : done > 0 ? "partial" : "empty";
          const isOpen = expanded[sec.key] ?? false;
          const led = state === "done" ? "bg-approved-fg" : state === "partial" ? "bg-draft-fg" : "bg-border";
          return (
            <section key={sec.key} className="overflow-hidden rounded-panel border border-border bg-surface">
              <button
                type="button"
                onClick={() => setExpanded((e) => ({ ...e, [sec.key]: !isOpen }))}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span className={`size-2.5 shrink-0 rounded-full ${led}`} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="text-base font-semibold text-text">
                    {sec.title} {sec.note ? <span className="text-small font-normal text-subdued">({sec.note})</span> : null}
                  </span>
                  <span className="block text-micro text-subdued">
                    {total} documents · all mandatory · one file per document · PDF or DOCX
                  </span>
                </span>
                <span className="ml-auto flex items-center gap-3 whitespace-nowrap text-right">
                  <span className="flex flex-col">
                    <span className={`font-mono text-small font-semibold tabular-nums ${state === "done" ? "text-approved-fg" : state === "partial" ? "text-draft-fg" : "text-subdued"}`}>
                      {done} / {total}
                    </span>
                    <span className="text-[10px] uppercase tracking-overline text-subdued">Uploaded</span>
                  </span>
                  <ChevronDown className={`size-4 text-subdued transition ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                </span>
              </button>

              {isOpen ? (
                <div className="border-t border-border">
                  {sec.docs.map((d, i) => (
                    <UploadRow
                      key={d.code}
                      doc={d}
                      letter={LETTERS[i]}
                      file={uploads[d.code] ?? null}
                      canEdit={access.canEdit}
                      onUpload={(f) => setUpload(d.code, f)}
                      onRemove={() => removeUpload(d.code)}
                    />
                  ))}
                  {access.canEdit ? (
                    <div className="border-t border-border px-4 py-3">
                      <button type="button" className="rounded-control border border-dashed border-border px-3 py-1.5 text-small font-semibold text-subdued hover:border-primary hover:text-primary">
                        + Add other document
                      </button>
                      <span className="ml-2 text-micro text-subdued">Optional — stage-specific extra document</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <StepFooter
        note={<>Autosaved · <span className="font-mono tabular-nums">{totalDone}</span> / {STAGE_DOC_COUNT} mandatory uploaded</>}
        backTo={STEPS[0].route}
        backLabel="Type"
        continueTo={STEPS[2].route}
        continueLabel="Continue to equipment list"
      />
    </SetupShell>
  );
}
