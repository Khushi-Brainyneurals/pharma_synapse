import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { masterDataAccess } from "../access";
import {
  getOtherDocumentsChecklist,
  getStageChecklist,
  removeOtherDocument,
  removeOtherStageDocument,
  replaceOtherStageDocument,
  uploadOtherDocument,
  uploadOtherStageDocument,
  type MasterOtherDocStatus,
} from "../api/masterDataDocuments.api";
import { HowThisWorks } from "../components/HowThisWorks";
import { SetupShell } from "../components/SetupShell";
import { StepFooter } from "../components/StepFooter";
import { UploadRow } from "../components/UploadRow";
import { STEPS } from "../model/setup.model";
import { getSelectedTypeMeta, useSetupStore } from "../state/setupStore";
import { useAuthStore } from "../../auth/state/auth.store";

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const STORAGE_KEY = "master_data_other_batch_docs";

export function BatchDocumentsPage() {
  const user = useAuthStore((s) => s.user);
  const canEdit = masterDataAccess(user?.role).canEdit;
  const dosageFormId = useSetupStore((s) => s.dosageFormId);
  const documentTypeId = useSetupStore((s) => s.documentTypeId);
  const typeMeta = getSelectedTypeMeta(dosageFormId, documentTypeId);
  const batchDocs = useSetupStore((s) => s.batchDocs);
  const setOtherChecklistData = useSetupStore((s) => s.setOtherChecklistData);
  const uploads = useSetupStore((s) => s.batchUploads);
  const setUpload = useSetupStore((s) => s.setBatchUpload);
  const removeUpload = useSetupStore((s) => s.removeBatchUpload);

  const otherBatchDocs = useSetupStore((s) => s.batchOthers);
  const setOtherBatchDocs = useSetupStore((s) => s.setBatchOthers);
  const [isUploadingOther, setIsUploadingOther] = useState(false);
  const otherFileInputRef = useRef<HTMLInputElement>(null);

  const refreshBatchOthers = useCallback(async () => {
    try {
      const res = await getStageChecklist(typeMeta.dosageBackend, typeMeta.docBackend);
      if (res && Array.isArray(res.stages)) {
        useSetupStore.getState().setStageChecklistData(res);
        const reconStage = res.stages.find(
          (s: any) => s.stage_key === "batch_yield_reconciliation" || s.stage_key === "reconciliation",
        );
        if (reconStage?.others && reconStage.others.length > 0) {
          setOtherBatchDocs(reconStage.others);
        }
      }
    } catch {
      // Offline fallback
    }
  }, [typeMeta.dosageBackend, typeMeta.docBackend, setOtherBatchDocs]);

  useEffect(() => {
    let cancelled = false;
    getOtherDocumentsChecklist(typeMeta.dosageBackend, typeMeta.docBackend)
      .then((res) => {
        if (cancelled || !res) return;
        setOtherChecklistData(res);
      })
      .catch(() => {
        /* fallback to store */
      });
    void refreshBatchOthers();
    return () => {
      cancelled = true;
    };
  }, [typeMeta.dosageBackend, typeMeta.docBackend, setOtherChecklistData, refreshBatchOthers]);

  const handleOtherFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setIsUploadingOther(true);

    const localId = Date.now();
    const newDoc: MasterOtherDocStatus = {
      id: localId,
      label: file.name.replace(/\.[^/.]+$/, ""),
      file_name: file.name,
      uploaded_by: user?.username || "Reviewer QA",
      uploaded_at: new Date().toISOString(),
    };

    setOtherBatchDocs((prev) => {
      const next = [...prev, newDoc];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    try {
      const res = await uploadOtherStageDocument(
        typeMeta.dosageBackend,
        typeMeta.docBackend,
        "batch_yield_reconciliation",
        file,
      );
      if (res?.id) {
        setOtherBatchDocs((prev) => {
          const next = prev.map((item) =>
            item.id === localId ? { ...item, id: res.id!, file_name: res.file_name || item.file_name } : item,
          );
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
      }
      await refreshBatchOthers();
    } catch (err) {
      console.warn("Backend other document upload fallback:", err);
    } finally {
      setIsUploadingOther(false);
    }
  };

  const handleReplaceOther = async (otherId: number, file: File) => {
    setOtherBatchDocs((prev) => {
      const next = prev.map((item) =>
        item.id === otherId
          ? {
              ...item,
              file_name: file.name,
              label: file.name.replace(/\.[^/.]+$/, ""),
              uploaded_at: new Date().toISOString(),
            }
          : item,
      );
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    try {
      await replaceOtherStageDocument(
        typeMeta.dosageBackend,
        typeMeta.docBackend,
        "batch_yield_reconciliation",
        otherId,
        file,
      );
      await refreshBatchOthers();
    } catch (err) {
      console.warn("Backend other document replace fallback:", err);
    }
  };

  const handleRemoveOther = async (otherId: number) => {
    setOtherBatchDocs((prev) => {
      const next = prev.filter((item) => item.id !== otherId);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    try {
      await removeOtherStageDocument(
        typeMeta.dosageBackend,
        typeMeta.docBackend,
        "batch_yield_reconciliation",
        otherId,
      );
      await refreshBatchOthers();
    } catch (err) {
      console.warn("Backend other document remove fallback:", err);
    }
  };

  const done = batchDocs.filter((d) => uploads[d.code]).length;
  const total = batchDocs.length;

  return (
    <SetupShell
      step="batch"
      title="Other documents"
      description={
        <>
          The closing sections of the {typeMeta.docShortLabel} — batch reconciliation, batch release, deviation, change history — they apply{" "}
          <strong>once per batch, not per stage</strong>, which is why they live here. Upload the blank approved master
          format for each.
        </>
      }
    >
      <input
        ref={otherFileInputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleOtherFileSelected}
      />

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
            <p className="text-base font-semibold">Batch-level documents — {typeMeta.label}</p>
            <p className="text-micro text-subdued">{total} documents · all mandatory · one file per document · PDF or DOCX</p>
          </div>
          <p className="text-right">
            <span className={`font-mono text-small font-semibold tabular-nums ${done === total && total > 0 ? "text-approved-fg" : "text-draft-fg"}`}>
              {done} / {total}
              {otherBatchDocs.length > 0 ? (
                <span className="ml-1 text-[11px] font-semibold text-primary">
                  (+{otherBatchDocs.length} extra)
                </span>
              ) : null}
            </span>
            <span className="block text-[10px] uppercase tracking-overline text-subdued">Uploaded</span>
          </p>
        </div>
        {batchDocs.map((d, i) => (
          <UploadRow
            key={d.code}
            doc={d}
            letter={LETTERS[i] ?? String(i + 1)}
            file={uploads[d.code] ?? null}
            canEdit={canEdit}
            onUpload={(f) => {
              setUpload(d.code, f);
              if (f.rawFile) {
                void uploadOtherDocument(typeMeta.dosageBackend, typeMeta.docBackend, d.code, f.rawFile).catch(() => {});
              }
            }}
            onRemove={() => {
              removeUpload(d.code);
              void removeOtherDocument(typeMeta.dosageBackend, typeMeta.docBackend, d.code).catch(() => {});
            }}
          />
        ))}
      </section>

      <section className="rounded-panel border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <p className="text-base font-semibold">Others — additional documents</p>
          <span className="rounded-pill border border-border px-2 py-0.5 text-[10px] font-semibold uppercase text-subdued">Optional</span>
          {otherBatchDocs.length > 0 ? (
            <span className="font-mono text-micro text-primary font-semibold">
              · {otherBatchDocs.length} extra document{otherBatchDocs.length > 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-micro text-subdued">
          Anything beyond the fixed sections — annexures, formats, SOP extracts. PDF or DOCX · never blocks Continue to preview.
        </p>

        {otherBatchDocs.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-control border border-border">
            {otherBatchDocs.map((item, idx) => (
              <UploadRow
                key={`other-batch-${item.id}`}
                doc={{
                  code: `OTHER-${item.id}`,
                  name: item.label || item.file_name,
                  required: false,
                }}
                letter={LETTERS[batchDocs.length + idx] ?? String(batchDocs.length + idx + 1)}
                file={{
                  filename: item.file_name,
                  sizeKB: 24,
                  by: item.uploaded_by || user?.username || "Reviewer QA",
                  at: item.uploaded_at ? new Date(item.uploaded_at).toLocaleDateString() : "Uploaded",
                  format: item.file_name.toLowerCase().endsWith(".pdf") ? "PDF" : "DOCX",
                  stageKey: "batch_yield_reconciliation",
                  otherId: item.id,
                }}
                canEdit={canEdit}
                onUpload={(f) => {
                  if (f.rawFile) {
                    void handleReplaceOther(item.id, f.rawFile);
                  }
                }}
                onRemove={() => void handleRemoveOther(item.id)}
              />
            ))}
          </div>
        ) : null}

        {canEdit ? (
          <button
            type="button"
            onClick={() => otherFileInputRef.current?.click()}
            disabled={isUploadingOther}
            className="mt-3 inline-flex items-center gap-2 rounded-control border border-dashed border-border px-3 py-1.5 text-small font-semibold text-subdued hover:border-primary hover:text-primary transition disabled:opacity-50"
          >
            {isUploadingOther ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {isUploadingOther ? "Uploading document…" : "+ Add another document"}
          </button>
        ) : null}
      </section>

      <StepFooter
        note={
          <>
            Autosaved · <span className="font-mono tabular-nums">{done}</span> / {total} mandatory uploaded
            {otherBatchDocs.length > 0 ? (
              <span className="ml-2 font-medium text-primary">
                (+{otherBatchDocs.length} extra)
              </span>
            ) : null}
          </>
        }
        backTo={STEPS[1].route}
        backLabel="Stage documents"
        continueTo={STEPS[5].route}
        continueLabel="Continue to preview"
      />
    </SetupShell>
  );
}
