import { AlertCircle, CheckCircle2, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { masterDataAccess } from "../access";
import {
  getStageChecklist,
  removeOtherStageDocument,
  removeStageDocument,
  replaceOtherStageDocument,
  uploadOtherStageDocument,
  uploadStageDocument,
  type MasterOtherDocStatus,
} from "../api/masterDataDocuments.api";
import { HowThisWorks } from "../components/HowThisWorks";
import { SetupShell } from "../components/SetupShell";
import { StepFooter } from "../components/StepFooter";
import { UploadRow } from "../components/UploadRow";
import { STEPS, type StageSection } from "../model/setup.model";
import { getSelectedTypeMeta, useSetupStore } from "../state/setupStore";
import { useAuthStore } from "../../auth/state/auth.store";

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

const STAGE_KEY_MAP: Record<string, string> = {
  dispensing: "dispensing_rm",
  granulation: "granulation",
  compression: "compression",
  inspection_uncoated: "uncoated_inspection",
  dispensing_coating: "dispensing_coating",
  coating: "coating",
  inspection_coated: "coated_inspection",
  reconciliation: "batch_yield_reconciliation",
};

export function StageDocumentsPage() {
  const user = useAuthStore((s) => s.user);
  const access = masterDataAccess(user?.role);
  const dosageFormId = useSetupStore((s) => s.dosageFormId);
  const documentTypeId = useSetupStore((s) => s.documentTypeId);
  const typeMeta = getSelectedTypeMeta(dosageFormId, documentTypeId);
  const stageSections = useSetupStore((s) => s.stageSections);
  const setStageChecklistData = useSetupStore((s) => s.setStageChecklistData);
  const uploads = useSetupStore((s) => s.uploads);
  const setUpload = useSetupStore((s) => s.setUpload);
  const removeUpload = useSetupStore((s) => s.removeUpload);

  const stageOthers = useSetupStore((s) => s.stageOthers);
  const setStageOthers = useSetupStore((s) => s.setStageOthers);
  const [activeStageKeyForOther, setActiveStageKeyForOther] = useState<string | null>(null);
  const [isUploadingOther, setIsUploadingOther] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  const otherFileInputRef = useRef<HTMLInputElement>(null);

  const sectionCount = (sec: StageSection) => sec.docs.filter((d) => uploads[d.code]).length;
  const totalDone = stageSections.reduce((n, sec) => n + sectionCount(sec), 0);
  const stageDocCount = stageSections.reduce((n, sec) => n + sec.docs.length, 0);

  const firstIncomplete = stageSections.find((sec) => sectionCount(sec) < sec.docs.length)?.key;
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    firstIncomplete ? { [firstIncomplete]: true } : {},
  );

  const refreshChecklist = useCallback(async () => {
    try {
      const res = await getStageChecklist(typeMeta.dosageBackend, typeMeta.docBackend);
      if (res) {
        setStageChecklistData(res);
        const othersMap: Record<string, MasterOtherDocStatus[]> = {};
        for (const stage of res.stages || []) {
          othersMap[stage.stage_key] = stage.others || [];
        }
        setStageOthers(othersMap);
      }
    } catch {
      /* fallback */
    }
  }, [typeMeta.dosageBackend, typeMeta.docBackend, setStageChecklistData, setStageOthers]);

  useEffect(() => {
    let cancelled = false;
    getStageChecklist(typeMeta.dosageBackend, typeMeta.docBackend)
      .then((res) => {
        if (cancelled || !res) return;
        setStageChecklistData(res);
        const othersMap: Record<string, MasterOtherDocStatus[]> = {};
        for (const stage of res.stages || []) {
          othersMap[stage.stage_key] = stage.others || [];
        }
        setStageOthers(othersMap);
        const firstKey = res.stages?.[0]?.stage_key;
        if (firstKey) {
          setExpanded((prev) => (Object.keys(prev).length > 0 ? prev : { [firstKey]: true }));
        }
      })
      .catch(() => {
        /* fallback to existing store */
      });

    return () => {
      cancelled = true;
    };
  }, [typeMeta.dosageBackend, typeMeta.docBackend, setStageChecklistData, setStageOthers]);

  const setAll = (open: boolean) =>
    setExpanded(Object.fromEntries(stageSections.map((s) => [s.key, open])));

  const handleAddOtherClick = (stageKey: string) => {
    setActiveStageKeyForOther(stageKey);
    otherFileInputRef.current?.click();
  };

  const handleOtherFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeStageKeyForOther) return;
    const stageKey = activeStageKeyForOther;
    e.target.value = "";
    setIsUploadingOther(true);
    setActionSuccessMessage(null);
    setActionErrorMessage(null);
    try {
      await uploadOtherStageDocument(
        typeMeta.dosageBackend,
        typeMeta.docBackend,
        stageKey,
        file,
      );
      await refreshChecklist();
      setActionSuccessMessage(`"${file.name}" uploaded successfully to backend.`);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error("Failed to upload other stage document:", err);
      setActionErrorMessage(err.message || "Failed to upload other document to backend.");
    } finally {
      setIsUploadingOther(false);
    }
  };

  const handleReplaceOther = async (stageKey: string, otherId: number, file: File) => {
    setActionSuccessMessage(null);
    setActionErrorMessage(null);
    try {
      await replaceOtherStageDocument(
        typeMeta.dosageBackend,
        typeMeta.docBackend,
        stageKey,
        otherId,
        file,
      );
      await refreshChecklist();
      setActionSuccessMessage(`"${file.name}" replaced successfully in backend.`);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error("Failed to replace other stage document:", err);
      setActionErrorMessage(err.message || "Failed to replace other document in backend.");
    }
  };

  const handleRemoveOther = async (stageKey: string, otherId: number) => {
    setActionSuccessMessage(null);
    setActionErrorMessage(null);
    try {
      await removeOtherStageDocument(
        typeMeta.dosageBackend,
        typeMeta.docBackend,
        stageKey,
        otherId,
      );
      await refreshChecklist();
      setActionSuccessMessage("Extra document removed from backend.");
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error("Failed to remove other stage document:", err);
      setActionErrorMessage(err.message || "Failed to remove other document from backend.");
    }
  };

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
      {/* Hidden input for adding optional other documents */}
      <input
        ref={otherFileInputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleOtherFileSelected}
      />

      <HowThisWorks
        items={[
          <>Open a stage with the <span className="font-semibold">arrow</span>.</>,
          <>Each box tells you <span className="font-semibold">which document to upload</span> — one PDF or DOCX per box.</>,
          <><span className="font-semibold">Green tick = done.</span> Finish all {stageDocCount} and press Continue.</>,
        ]}
      />

      <div className="flex items-center justify-between">
        <p className="text-micro font-semibold uppercase tracking-overline text-subdued">
          Stages — {typeMeta.label} · {stageSections.length} sections · {stageDocCount} mandatory documents
        </p>
        <div className="flex items-center gap-3 text-small font-semibold text-primary">
          <button type="button" onClick={() => setAll(true)} className="hover:underline">Expand all</button>
          <button type="button" onClick={() => setAll(false)} className="hover:underline">Collapse all</button>
        </div>
      </div>

      <div className="space-y-3">
        {stageSections.map((sec) => {
          const stageKey = STAGE_KEY_MAP[sec.key] || sec.key;
          const done = sectionCount(sec);
          const total = sec.docs.length;
          const othersList = stageOthers[stageKey] || [];
          const state = done === total && total > 0 ? "done" : done > 0 ? "partial" : "empty";
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
                    <span className="text-[10px] uppercase tracking-overline text-subdued">
                      Uploaded
                    </span>
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
                      letter={LETTERS[i] ?? String(i + 1)}
                      file={uploads[d.code] ?? null}
                      canEdit={access.canEdit}
                      onUpload={(f) => {
                        setUpload(d.code, { ...f, stageKey });
                        if (f.rawFile) {
                          void uploadStageDocument(typeMeta.dosageBackend, typeMeta.docBackend, stageKey, d.code, f.rawFile).catch(() => {});
                        }
                      }}
                      onRemove={() => {
                        removeUpload(d.code);
                        void removeStageDocument(typeMeta.dosageBackend, typeMeta.docBackend, stageKey, d.code).catch(() => {});
                      }}
                    />
                  ))}

                  {/* Other stage documents uploaded for this stage */}
                  {othersList.map((item, idx) => (
                    <UploadRow
                      key={`other-${item.id}`}
                      doc={{
                        code: `OTHER-${item.id}`,
                        name: item.label || item.file_name,
                        required: false,
                      }}
                      letter={LETTERS[sec.docs.length + idx] ?? String(sec.docs.length + idx + 1)}
                      file={{
                        filename: item.file_name,
                        sizeKB: 24,
                        by: item.uploaded_by || "Reviewer QA",
                        at: item.uploaded_at ? new Date(item.uploaded_at).toLocaleDateString() : "Uploaded",
                        format: item.file_name.toLowerCase().endsWith(".pdf") ? "PDF" : "DOCX",
                        stageKey,
                        otherId: item.id,
                      }}
                      canEdit={access.canEdit}
                      onUpload={(f) => {
                        if (f.rawFile) {
                          void handleReplaceOther(stageKey, item.id, f.rawFile);
                        }
                      }}
                      onRemove={() => void handleRemoveOther(stageKey, item.id)}
                    />
                  ))}

                  {access.canEdit ? (
                    <div className="border-t border-border px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleAddOtherClick(stageKey)}
                        className="rounded-control border border-dashed border-border px-3 py-1.5 text-small font-semibold text-subdued hover:border-primary hover:text-primary transition"
                      >
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
        note={<>Autosaved · <span className="font-mono tabular-nums">{totalDone}</span> / {stageDocCount} mandatory uploaded</>}
        backTo={STEPS[0].route}
        backLabel="Type"
        continueTo={STEPS[4].route}
        continueLabel="Continue to other documents"
      />
    </SetupShell>
  );
}
