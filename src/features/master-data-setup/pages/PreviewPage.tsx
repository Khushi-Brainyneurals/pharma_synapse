import { AlertCircle, Check, CheckCircle2, ChevronLeft, ChevronRight, Eye, Loader2, Maximize2, Minus, Plus, Search, Send, StretchHorizontal, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Identifier } from "../../../shared/ui/Identifier";
import { masterDataAccess } from "../access";
import { HowThisWorks } from "../components/HowThisWorks";
import { SetupShell } from "../components/SetupShell";
import { type UploadedFile } from "../model/setup.model";
import { getSelectedTypeMeta, useSetupStore } from "../state/setupStore";
import { useAuthStore } from "../../auth/state/auth.store";
import { DocxViewer } from "../../preview/components/DocxViewer";
import { DocumentViewer } from "../../../shared/document/DocumentViewer";
import {
  DOC_CODE_TO_STAGE_KEY,
  decideStageApproval,
  getOtherDocumentPreviewBlob,
  getOtherDocumentsChecklist,
  getOtherStageDocumentPreviewBlob,
  getStageApprovalStatus,
  getStageChecklist,
  getStageDocumentPreviewBlob,
  submitStageApproval,
  type MasterOtherDocStatus,
  type StageApprovalStatus,
} from "../api/masterDataDocuments.api";
import {
  backendEquipmentToEquipmentRow,
  backendInstrumentToInstrumentRow,
  getEquipments,
  getInstruments,
} from "../../master-data/api/equipmentInstrument.api";

interface PreviewDoc {
  code: string;
  name: string;
  group: string;
  stageKey?: string;
  isOther?: boolean;
  otherId?: number;
  file: UploadedFile;
}

export function PreviewPage() {
  const user = useAuthStore((s) => s.user);
  const access = masterDataAccess(user?.role);
  const dosageFormId = useSetupStore((s) => s.dosageFormId);
  const documentTypeId = useSetupStore((s) => s.documentTypeId);
  const typeMeta = getSelectedTypeMeta(dosageFormId, documentTypeId);
  const stageSections = useSetupStore((s) => s.stageSections);
  const stageOthers = useSetupStore((s) => s.stageOthers);
  const batchOthers = useSetupStore((s) => s.batchOthers);
  const batchDocs = useSetupStore((s) => s.batchDocs);
  const setStageChecklistData = useSetupStore((s) => s.setStageChecklistData);
  const setOtherChecklistData = useSetupStore((s) => s.setOtherChecklistData);
  const uploads = useSetupStore((s) => s.uploads);
  const batch = useSetupStore((s) => s.batchUploads);
  const equipment = useSetupStore((s) => s.equipment);
  const instrument = useSetupStore((s) => s.instrument);
  const setEquipmentRows = useSetupStore((s) => s.setEquipmentRows);
  const setInstrumentRows = useSetupStore((s) => s.setInstrumentRows);
  const previewed = useSetupStore((s) => s.previewed);
  const markPreviewed = useSetupStore((s) => s.markPreviewed);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [documentApproval, setDocumentApproval] = useState<StageApprovalStatus | null>(null);
  const [isApprovalLoading, setIsApprovalLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeciding, setIsDeciding] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [page, setPage] = useState(1);
  const [fullScreen, setFullScreen] = useState(false);
  const TOTAL_PAGES = 2;

  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<"PDF" | "DOCX" | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const refreshDocumentApproval = useCallback(async (): Promise<StageApprovalStatus> => {
    setIsApprovalLoading(true);
    try {
      const approval = await getStageApprovalStatus(typeMeta.dosageBackend, typeMeta.docBackend);
      setDocumentApproval(approval);
      return approval;
    } finally {
      setIsApprovalLoading(false);
    }
  }, [typeMeta.dosageBackend, typeMeta.docBackend]);

  // Sync live uploaded files, equipments, instruments, and approval state from backend on mount
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      getStageChecklist(typeMeta.dosageBackend, typeMeta.docBackend).catch(() => null),
      getOtherDocumentsChecklist(typeMeta.dosageBackend, typeMeta.docBackend).catch(() => null),
      getEquipments().catch(() => null),
      getInstruments().catch(() => null),
    ]).then(([stageRes, otherRes, equipsRes, instrsRes]) => {
      if (!isMounted) return;
      if (equipsRes && equipsRes.length > 0) {
        setEquipmentRows(equipsRes.map(backendEquipmentToEquipmentRow));
      }
      if (instrsRes && instrsRes.length > 0) {
        setInstrumentRows(instrsRes.map(backendInstrumentToInstrumentRow));
      }
      if (stageRes) {
        setStageChecklistData(stageRes);
      }
      if (otherRes) {
        setOtherChecklistData(otherRes);
      }
    });
    void refreshDocumentApproval().catch(() => {
      if (isMounted) setSubmitError("Could not load the current approval status.");
    });
    return () => {
      isMounted = false;
    };
  }, [typeMeta.dosageBackend, typeMeta.docBackend, setStageChecklistData, setOtherChecklistData, setEquipmentRows, setInstrumentRows, refreshDocumentApproval]);

  // Flatten every uploaded master into a grouped, searchable list, including extra documents from database.
  const groups = useMemo(() => {
    const out: { group: string; docs: PreviewDoc[] }[] = [];

    const STAGE_KEY_MAP: Record<string, string> = {
      dispensing: "dispensing_rm",
      dispensing_rm: "dispensing_rm",
      granulation: "granulation",
      compression: "compression",
      inspection_uncoated: "uncoated_inspection",
      uncoated_inspection: "uncoated_inspection",
      dispensing_coating: "dispensing_coating",
      coating: "coating",
      inspection_coated: "coated_inspection",
      coated_inspection: "coated_inspection",
      batch_yield_reconciliation: "batch_yield_reconciliation",
      reconciliation: "batch_yield_reconciliation",
      packing: "packing",
      primary_packing: "primary_packing",
      secondary_packing: "secondary_packing",
    };

    const seenOtherIds = new Set<number>();

    for (const sec of stageSections) {
      const stageKey = STAGE_KEY_MAP[sec.key] || sec.key;
      const mandatoryDocs: PreviewDoc[] = sec.docs
        .filter((d) => uploads[d.code])
        .map((d) => ({
          code: d.code,
          name: d.name,
          group: sec.note ? `${sec.title} (${sec.note})` : sec.title,
          stageKey: uploads[d.code]?.stageKey || stageKey,
          isOther: false,
          file: uploads[d.code]!,
        }));

      const othersList: MasterOtherDocStatus[] = stageOthers[stageKey] || stageOthers[sec.key] || [];
      const extraDocs: PreviewDoc[] = othersList.map((item) => {
        seenOtherIds.add(item.id);
        const isPdf = item.file_name.toLowerCase().endsWith(".pdf");
        return {
          code: `OTHER-${item.id}`,
          name: item.label || item.file_name,
          group: sec.note ? `${sec.title} (${sec.note})` : sec.title,
          stageKey,
          isOther: true,
          otherId: item.id,
          file: {
            filename: item.file_name,
            sizeKB: 24,
            by: item.uploaded_by || "Reviewer QA",
            at: item.uploaded_at ? new Date(item.uploaded_at).toLocaleDateString() : "Uploaded",
            format: isPdf ? "PDF" : "DOCX",
            stageKey,
            otherId: item.id,
          },
        };
      });

      const allSecDocs = [...mandatoryDocs, ...extraDocs];
      if (allSecDocs.length > 0) {
        out.push({
          group: sec.note ? `${sec.title} (${sec.note})` : sec.title,
          docs: allSecDocs,
        });
      }
    }

    const otherUploadedDocs: PreviewDoc[] = batchDocs
      .filter((d) => batch[d.code])
      .map((d) => ({
        code: d.code,
        name: d.name,
        group: "Other documents",
        isOther: false,
        file: batch[d.code]!,
      }));

    const remainingBatchOthers = (batchOthers || []).filter((item) => !seenOtherIds.has(item.id));
    const batchExtraDocs: PreviewDoc[] = remainingBatchOthers.map((item) => {
      const isPdf = item.file_name.toLowerCase().endsWith(".pdf");
      return {
        code: `OTHER-${item.id}`,
        name: item.label || item.file_name,
        group: "Other documents",
        stageKey: "batch_yield_reconciliation",
        isOther: true,
        otherId: item.id,
        file: {
          filename: item.file_name,
          sizeKB: 24,
          by: item.uploaded_by || "Reviewer QA",
          at: item.uploaded_at ? new Date(item.uploaded_at).toLocaleDateString() : "Uploaded",
          format: isPdf ? "PDF" : "DOCX",
          stageKey: "batch_yield_reconciliation",
          otherId: item.id,
        },
      };
    });

    const allBatchDocs = [...otherUploadedDocs, ...batchExtraDocs];
    if (allBatchDocs.length > 0) {
      out.push({
        group: "Other documents",
        docs: allBatchDocs,
      });
    }

    return out;
  }, [stageSections, stageOthers, batchDocs, batch, batchOthers, uploads]);

  const allDocs = groups.flatMap((g) => g.docs);
  const q = query.trim().toLowerCase();
  const filteredGroups = groups
    .map((g) => ({
      ...g,
      docs: g.docs.filter(
        (d) =>
          !q ||
          d.name.toLowerCase().includes(q) ||
          d.code.toLowerCase().includes(q) ||
          d.file.filename.toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.docs.length > 0);

  const stageTotal = stageSections.reduce((n, sec) => n + sec.docs.length, 0);
  const stageDone = stageSections.reduce((n, sec) => n + sec.docs.filter((d) => uploads[d.code]).length, 0);
  const batchTotal = batchDocs.length;
  const batchDone = batchDocs.filter((d) => batch[d.code]).length;
  const totalUploaded = allDocs.length;
  const previewedCount = allDocs.filter((d) => previewed[d.code]).length;
  const ready = stageDone === stageTotal && batchDone === batchTotal;
  const documentsSubmitted = isSubmittedOrApproved(documentApproval?.status);
  const documentsApproved = normalizeApprovalStatus(documentApproval?.status) === "approved";
  const documentsRejected = normalizeApprovalStatus(documentApproval?.status) === "rejected";
  const canDecideDocuments = isPendingApproval(documentApproval?.status);

  const current = selected ?? allDocs[0]?.code ?? null;
  const currentDoc = allDocs.find((d) => d.code === current) ?? null;

  // A new document opens at its first page.
  useEffect(() => setPage(1), [current]);

  // Load preview blob whenever current document changes
  useEffect(() => {
    const doc = currentDoc;
    if (!doc) {
      setPreviewBlob(null);
      setDetectedFormat(null);
      setIsLoadingPreview(false);
      return;
    }

    let isMounted = true;
    setIsLoadingPreview(true);
    setPreviewError(null);

    async function loadPreview(targetDoc: PreviewDoc) {
      try {
        if (targetDoc.file.rawFile) {
          if (isMounted) {
            setPreviewBlob(targetDoc.file.rawFile);
            const isDoc = targetDoc.file.rawFile.name.toLowerCase().endsWith(".docx");
            setDetectedFormat(isDoc ? "DOCX" : "PDF");
            setIsLoadingPreview(false);
          }
          return;
        }

        let blob: Blob | null = null;
        if (targetDoc.isOther || targetDoc.otherId) {
          const otherId = targetDoc.otherId || Number(targetDoc.code.replace(/^(OTHER-|OTHER-BATCH-)/, ""));
          const stageKey = targetDoc.stageKey || targetDoc.file.stageKey || "batch_yield_reconciliation";
          blob = await getOtherStageDocumentPreviewBlob(
            typeMeta.dosageBackend,
            typeMeta.docBackend,
            stageKey,
            otherId,
          );
        } else {
          const stageKey = targetDoc.stageKey || targetDoc.file.stageKey || DOC_CODE_TO_STAGE_KEY[targetDoc.code];
          if (stageKey && targetDoc.group !== "Other documents") {
            blob = await getStageDocumentPreviewBlob(typeMeta.dosageBackend, typeMeta.docBackend, stageKey, targetDoc.code);
          } else {
            blob = await getOtherDocumentPreviewBlob(typeMeta.dosageBackend, typeMeta.docBackend, targetDoc.code);
          }
        }

        if (isMounted) {
          if (blob) {
            setPreviewBlob(blob);
            let fmt: "PDF" | "DOCX" =
              targetDoc.file.format === "DOCX" || targetDoc.file.filename.toLowerCase().endsWith(".docx")
                ? "DOCX"
                : "PDF";
            try {
              const header = await blob.slice(0, 5).text();
              if (header.startsWith("%PDF")) {
                fmt = "PDF";
              } else {
                const buf = await blob.slice(0, 4).arrayBuffer();
                const bytes = new Uint8Array(buf);
                if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
                  fmt = "DOCX";
                }
              }
            } catch {
              // keep fallback fmt
            }
            setDetectedFormat(fmt);
          } else {
            setPreviewBlob(null);
            setDetectedFormat(null);
          }
          setIsLoadingPreview(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setPreviewBlob(null);
          setDetectedFormat(null);
          setPreviewError(err?.message || "Failed to load live preview from server.");
          setIsLoadingPreview(false);
        }
      }
    }

    void loadPreview(doc);

    return () => {
      isMounted = false;
    };
  }, [currentDoc, typeMeta.dosageBackend, typeMeta.docBackend]);

  // Close the full-screen preview on Escape.
  useEffect(() => {
    if (!fullScreen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFullScreen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullScreen]);

  const open = (code: string) => {
    setSelected(code);
    markPreviewed(code);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // Equipment and instruments have independent approval flows on their own pages.
      // Preview submits only this Type's stage and other-document package.
      if (!isSubmittedOrApproved(documentApproval?.status)) {
        await submitStageApproval(typeMeta.dosageBackend, typeMeta.docBackend);
      }
      await refreshDocumentApproval();
    } catch (err: any) {
      setSubmitError(err?.response?.data?.detail || err?.message || "Submission failed");
      await refreshDocumentApproval().catch(() => undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecision = async (decision: "approved" | "rejected") => {
    const reason = decision === "rejected" ? rejectReason.trim() : "";
    if (decision === "rejected" && !reason) {
      setSubmitError("Enter a rejection reason before sending the set back to QA.");
      return;
    }

    setIsDeciding(true);
    setSubmitError(null);
    try {
      if (!canDecideDocuments) {
        throw new Error("There is no pending document submission to decide.");
      }
      await decideStageApproval(typeMeta.dosageBackend, typeMeta.docBackend, decision, reason);
      await refreshDocumentApproval();
      setShowRejectReason(false);
      setRejectReason("");
    } catch (err: any) {
      setSubmitError(err?.response?.data?.detail || err?.message || `Could not ${decision} the document set.`);
      await refreshDocumentApproval().catch(() => undefined);
    } finally {
      setIsDeciding(false);
    }
  };

  return (
    <SetupShell
      step="preview"
      title="Document preview"
      description={
        documentsApproved ? (
          "The stage and other-document set is approved."
        ) : documentsSubmitted ? (
          "The stage and other-document set is submitted for approval."
        ) : documentsRejected ? (
          "The document set was returned to QA for changes."
        ) : (
          <>
            One last look before it goes for approval. <strong>Click a document to open and check it</strong> — fix
            anything wrong right here, no need to walk back through the steps.
          </>
        )
      }
    >
      {documentsSubmitted && (
        <div className="flex items-center gap-3 rounded-panel border border-approved-fg/30 bg-approved-bg/50 px-4 py-3 text-text">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-approved-bg text-approved-fg">
            <CheckCircle2 className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-small font-semibold text-text">
              {documentsApproved ? "Document set approved" : "Documents submitted for approval"}
            </p>
            <p className="text-micro text-subdued">
              These {totalUploaded} stage and other documents {documentsApproved ? "have been signed off." : "are routed to the Approver for sign-off."} Equipment and instrument lists keep their separate approval flows.
            </p>
          </div>
        </div>
      )}

      {/* The how-it-works guidance is for the QA editor; a preparer just views, so it's hidden for them. */}
      {access.canEdit && !documentsSubmitted ? (
        <HowThisWorks
          items={[
            <>Click a document on the left to open it — the eye marks it as checked.</>,
            <>Wrong file? <span className="font-semibold">Replace or Remove</span> right here.</>,
            <>Happy with everything? Press <span className="font-semibold">Submit for approval</span>.</>,
          ]}
        />
      ) : null}

      {/* summary strip */}
      {/* <div className="flex flex-wrap items-center gap-2 rounded-panel border border-border bg-surface px-4 py-3 text-small">
        <Chip label="Stage documents" value={`${stageDone} / ${stageTotal}`} ok={stageDone === stageTotal} />
        <Chip label="Equipment list" value={`${equipment.length} rows`} ok to="/master-data-setup/equipment" />
        <Chip label="Instrument list" value={`${instrument.length} rows`} ok to="/master-data-setup/instruments" />
        <Chip label="Other documents" value={`${batchDone} / ${batchTotal}`} ok={batchDone === batchTotal} />
        <span className={`ml-auto inline-flex items-center gap-1.5 font-semibold ${ready ? "text-approved-fg" : "text-draft-fg"}`}>
          {ready ? <Check className="size-4" aria-hidden="true" /> : null}
          {ready ? "All steps complete — ready to submit" : `${stageTotal - stageDone + (batchTotal - batchDone)} mandatory pending`}
        </span>
      </div> */}

      {submitError ? (
        <div className="flex items-start gap-2 rounded-panel border border-danger/30 bg-danger-soft p-3 text-small text-danger-ink">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{submitError}</span>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* left: doc list */}
        <div className="h-fit overflow-hidden rounded-panel border border-border bg-surface">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subdued" aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by name or code — e.g. GRN-03"
                className="h-8 w-full rounded-control border border-border bg-background pl-8 pr-2 text-small outline-none placeholder:text-subdued focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <p className="mt-2.5 text-micro text-subdued">
              <span className="font-mono tabular-nums">{totalUploaded}</span> documents · <span className="font-mono tabular-nums">{previewedCount}</span> previewed
            </p>
          </div>
          <div className="max-h-[780px] overflow-y-auto">
            {filteredGroups.map((g) => {
              const gd = g.docs.filter((d) => previewed[d.code]).length;
              return (
                <section key={g.group}>
                  <div className="flex items-center justify-between bg-sunken/50 px-3 py-2 pt-4">
                    <span className="text-micro font-semibold uppercase tracking-overline text-subdued">{g.group}</span>
                    <span className="font-mono text-[10px] tabular-nums text-subdued">{gd}/{g.docs.length}</span>
                  </div>
                  <ul>
                    {g.docs.map((d) => {
                      const active = d.code === current;
                      const isDocPreviewed = Boolean(previewed[d.code]);
                      return (
                        <li key={d.code}>
                          <button
                            type="button"
                            onClick={() => open(d.code)}
                            className={`flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left transition ${
                              active ? "border-l-primary bg-accent-soft/50" : "border-l-transparent hover:bg-sunken/50"
                            }`}
                          >
                            <Check className={`size-3.5 shrink-0 ${isDocPreviewed ? "text-approved-fg" : "text-subdued/40"}`} aria-hidden="true" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-small font-medium text-text">{d.name}</span>
                              <span className="block text-micro text-subdued">
                                <Identifier>{d.code}</Identifier> · {formatSize(d.file.sizeKB)}
                                {d.isOther ? (
                                  <span className="ml-1.5 rounded bg-primary/10 px-1 py-0.5 text-[9px] font-semibold text-primary">
                                    Extra
                                  </span>
                                ) : null}
                              </span>
                            </span>
                            <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold text-subdued">{d.file.format}</span>
                            {isDocPreviewed ? <Eye className="size-3.5 shrink-0 text-primary" aria-hidden="true" /> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>

        {/* right: preview pane */}
        <div className="overflow-hidden rounded-panel border border-border bg-surface">
          {currentDoc ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border p-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-base font-semibold">
                    {currentDoc.name}
                    <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold text-subdued">
                      <Identifier>{currentDoc.code}</Identifier>
                    </span>
                    {currentDoc.isOther ? (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        Extra Document
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-micro text-subdued">
                    <Identifier>{currentDoc.file.filename}</Identifier> · {formatSize(currentDoc.file.sizeKB)} — {currentDoc.file.by} · {currentDoc.file.at}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-small font-semibold">
                  <button
                    type="button"
                    onClick={() => setFullScreen(true)}
                    className="inline-flex items-center gap-1 rounded-control border border-border px-2.5 py-1 text-subdued hover:bg-muted"
                  >
                    <Maximize2 className="size-3.5" aria-hidden="true" /> Full screen
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-micro text-subdued">
                <PageControls page={page} total={TOTAL_PAGES} onChange={setPage} />
              </div>
              <div className="bg-sunken/40 p-4">
                {isLoadingPreview ? (
                  <div className="flex h-96 flex-col items-center justify-center gap-2 text-subdued">
                    <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
                    <span className="text-small">Loading document preview from server…</span>
                  </div>
                ) : previewBlob && detectedFormat === "DOCX" ? (
                  <div className="h-[720px] w-full rounded border border-border bg-muted overflow-auto flex justify-center py-4">
                    <DocxViewer
                      file={{ blob: previewBlob, filename: currentDoc.file.filename, format: "docx" }}
                      hideHeader
                      borderless
                      containerHeightClass="h-auto min-h-full"
                    />
                  </div>
                ) : previewBlob && detectedFormat === "PDF" ? (
                  <div className="h-[760px] w-full rounded border border-border bg-white overflow-hidden">
                    <DocumentViewer
                      docKey={`preview-${currentDoc.code}`}
                      load={async () => previewBlob}
                      fileName={currentDoc.file.filename}
                    />
                  </div>
                ) : (
                  <div className="h-[760px] w-full overflow-auto py-4 flex justify-center">
                    <MockPage doc={currentDoc} page={page} total={TOTAL_PAGES} />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-16 text-center text-small text-subdued">No documents uploaded yet.</div>
          )}
        </div>
      </div>

      {access.canEdit ? (
        <div className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-micro text-subdued">
            Submit routes only the stage and other documents to the Approver. Equipment and instruments are submitted separately from their own pages.
          </p>
          <div className="flex items-center gap-3">
            <StepFooterBack />
            {documentsSubmitted ? (
              <div className="inline-flex h-9 items-center gap-2 rounded-control border border-approved-fg/30 bg-approved-bg px-4 text-small font-semibold text-approved-fg">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {documentsApproved ? "Approved" : "Submitted for approval"}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!ready || isSubmitting || isApprovalLoading}
                className="inline-flex h-9 items-center gap-1.5 rounded-control bg-primary px-4 text-small font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-primary/40"
                title={!ready ? "Upload every mandatory document to submit" : isApprovalLoading ? "Loading approval status" : undefined}
              >
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="size-4" aria-hidden="true" />
                )}
                {isSubmitting ? "Submitting…" : "Submit for approval"}
              </button>
            )}
          </div>
        </div>
      ) : access.canApprove ? (
        <div className="space-y-3 rounded-panel border border-border bg-surface p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-small font-semibold text-text">Stage and other-document approval</p>
              <p className="mt-0.5 text-micro text-subdued">
                {documentsApproved
                  ? "The document set has been approved."
                  : canDecideDocuments
                    ? "The stage and other documents are waiting for your decision."
                    : documentsRejected
                      ? "The document set has been returned to QA for changes."
                      : "Waiting for QA to submit the document set."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StepFooterBack />
              {canDecideDocuments ? (
                <>
                  <button
                    type="button"
                    onClick={() => void handleDecision("approved")}
                    disabled={isDeciding || isApprovalLoading}
                    className="inline-flex h-9 items-center gap-1.5 rounded-control bg-approved-fg px-4 text-small font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {isDeciding ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
                    Approve documents
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRejectReason((current) => !current)}
                    disabled={isDeciding || isApprovalLoading}
                    className="inline-flex h-9 items-center gap-1.5 rounded-control border border-danger bg-danger-soft px-4 text-small font-semibold text-danger-ink transition hover:bg-danger-soft/80 disabled:opacity-50"
                  >
                    <XCircle className="size-4" aria-hidden="true" />
                    Reject documents
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {showRejectReason && canDecideDocuments ? (
            <div className="rounded-control border border-danger/30 bg-danger-soft/30 p-3">
              <label className="text-small font-semibold text-danger-ink" htmlFor="master-data-reject-reason">
                Rejection reason
              </label>
              <textarea
                id="master-data-reject-reason"
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                rows={3}
                placeholder="Explain what QA must correct before resubmitting."
                className="mt-2 w-full rounded-control border border-border bg-surface px-3 py-2 text-small text-text outline-none focus:border-danger focus:ring-2 focus:ring-danger/20"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectReason(false);
                    setRejectReason("");
                  }}
                  className="h-8 rounded-control px-3 text-small font-semibold text-subdued hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleDecision("rejected")}
                  disabled={!rejectReason.trim() || isDeciding}
                  className="inline-flex h-8 items-center gap-1.5 rounded-control bg-danger px-3 text-small font-semibold text-white disabled:opacity-50"
                >
                  {isDeciding ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
                  Confirm rejection
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-panel border border-border bg-sunken/40 p-3 text-micro text-subdued">
          You can open and check every uploaded master. Submitting the set for approval is done by the QA reviewer; the Approver signs it off.
        </div>
      )}

      {fullScreen && currentDoc ? (
        <FullScreenPreview
          doc={currentDoc}
          page={page}
          total={TOTAL_PAGES}
          onChange={setPage}
          onClose={() => setFullScreen(false)}
          previewBlob={previewBlob}
          detectedFormat={detectedFormat}
          isLoadingPreview={isLoadingPreview}
        />
      ) : null}
    </SetupShell>
  );
}

/** Prev / page x-of-n / next controls for the preview pane. */
function PageControls({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        aria-label="Previous page"
        className="flex size-6 items-center justify-center rounded-control border border-border text-subdued transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="size-3.5" aria-hidden="true" />
      </button>
      <span className="font-mono tabular-nums">Page {page} / {total}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(total, page + 1))}
        disabled={page >= total}
        aria-label="Next page"
        className="flex size-6 items-center justify-center rounded-control border border-border text-subdued transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight className="size-3.5" aria-hidden="true" />
      </button>
      <span className="ml-1">· 100%</span>
    </div>
  );
}

/** Full-screen document preview overlay — the same rendered page, larger, with page
 *  navigation and zoom/fit controls. Closes on the X, a backdrop click or Escape. */
function FullScreenPreview({
  doc,
  page,
  total,
  onChange,
  onClose,
  previewBlob,
  detectedFormat,
  isLoadingPreview,
}: {
  doc: PreviewDoc;
  page: number;
  total: number;
  onChange: (p: number) => void;
  onClose: () => void;
  previewBlob: Blob | null;
  detectedFormat: "PDF" | "DOCX" | null;
  isLoadingPreview: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const [fitWidth, setFitWidth] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (fitWidth && scrollRef.current) {
      const w = scrollRef.current.clientWidth - 48;
      const s = Math.min(1.3, Math.max(0.4, w / 794));
      setZoom(Number(s.toFixed(2)));
    }
  }, [fitWidth]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-neutral-900/95 backdrop-blur-md text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`${doc.name} — full screen`}
      onClick={onClose}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-neutral-900/90 px-4 py-2.5 backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-small font-semibold">
            {doc.name}
            <span className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px]">
              <Identifier>{doc.code}</Identifier>
            </span>
            <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-light">
              {detectedFormat || doc.file.format}
            </span>
          </p>
          <p className="truncate text-micro text-white/60">
            <Identifier>{doc.file.filename}</Identifier> · {formatSize(doc.file.sizeKB)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {detectedFormat === "DOCX" ? (
            <>
              <div className="flex items-center gap-1 rounded-control border border-white/20 bg-white/5 p-0.5 text-micro">
                <button
                  type="button"
                  onClick={() => {
                    setFitWidth(false);
                    setZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))));
                  }}
                  title="Zoom out"
                  aria-label="Zoom out"
                  className="flex size-7 items-center justify-center rounded-control transition hover:bg-white/10 disabled:opacity-40"
                  disabled={zoom <= 0.4}
                >
                  <Minus className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFitWidth(false);
                    setZoom(1);
                  }}
                  title="Reset zoom (100%)"
                  className="w-12 text-center font-mono tabular-nums text-white/80 hover:text-white"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFitWidth(false);
                    setZoom((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))));
                  }}
                  title="Zoom in"
                  aria-label="Zoom in"
                  className="flex size-7 items-center justify-center rounded-control transition hover:bg-white/10 disabled:opacity-40"
                  disabled={zoom >= 2.0}
                >
                  <Plus className="size-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setFitWidth((prev) => !prev)}
                title={fitWidth ? "Disable fit to width" : "Fit to width"}
                className={`flex h-8 items-center gap-1.5 rounded-control border px-2.5 text-micro font-medium transition ${
                  fitWidth
                    ? "border-primary bg-primary/20 text-white"
                    : "border-white/20 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <StretchHorizontal className="size-3.5" />
                <span className="hidden sm:inline">Fit width</span>
              </button>
            </>
          ) : null}

          <div className="flex items-center gap-1 text-micro text-white/80">
            <button
              type="button"
              onClick={() => onChange(Math.max(1, page - 1))}
              disabled={page <= 1}
              aria-label="Previous page"
              className="flex size-8 items-center justify-center rounded-control border border-white/20 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="font-mono tabular-nums px-1.5">Page {page} / {total}</span>
            <button
              type="button"
              onClick={() => onChange(Math.min(total, page + 1))}
              disabled={page >= total}
              aria-label="Next page"
              className="flex size-8 items-center justify-center rounded-control border border-white/20 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close full screen"
            className="flex size-8 items-center justify-center rounded-control border border-white/20 text-white transition hover:bg-white/10"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto bg-neutral-950/90 py-8 px-4 flex justify-center items-start"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoadingPreview ? (
          <div className="flex h-96 flex-col items-center justify-center gap-2 text-white/70">
            <Loader2 className="size-6 animate-spin text-white" />
            <span className="text-small">Loading document preview from server…</span>
          </div>
        ) : previewBlob && detectedFormat === "DOCX" ? (
          <div className="w-full flex justify-center">
            <DocxViewer
              file={{ blob: previewBlob, filename: doc.file.filename, format: "docx" }}
              hideHeader
              borderless
              containerHeightClass="h-auto min-h-full"
              zoom={zoom}
            />
          </div>
        ) : previewBlob && detectedFormat === "PDF" ? (
          <div className="h-[85vh] w-full max-w-5xl rounded border border-white/20 bg-white overflow-hidden">
            <DocumentViewer
              docKey={`fullscreen-${doc.code}`}
              load={async () => previewBlob}
              fileName={doc.file.filename}
            />
          </div>
        ) : (
          <div className="w-[210mm] max-w-full">
            <MockPage doc={doc} page={page} total={total} />
          </div>
        )}
      </div>
    </div>
  );
}

function StepFooterBack() {
  return (
    <Link
      to="/master-data-setup/batch-docs"
      className="inline-flex h-9 items-center gap-1.5 rounded-control border border-border px-3 text-small font-semibold text-subdued transition hover:bg-muted"
    >
      ← Other documents
    </Link>
  );
}

function normalizeApprovalStatus(status?: string | null): string {
  return (status || "draft").toLowerCase();
}

function isPendingApproval(status?: string | null): boolean {
  const normalized = normalizeApprovalStatus(status);
  return normalized === "pending" || normalized === "submitted" || normalized === "in_review";
}

function isSubmittedOrApproved(status?: string | null): boolean {
  return isPendingApproval(status) || normalizeApprovalStatus(status) === "approved";
}

function ApprovalStatusChip({
  label,
  status,
  loading,
}: {
  label: string;
  status?: string | null;
  loading: boolean;
}) {
  const normalized = normalizeApprovalStatus(status);
  const pending = isPendingApproval(normalized);
  const approved = normalized === "approved";
  const rejected = normalized === "rejected";
  const display = !status
    ? loading ? "Loading" : "Unavailable"
    : pending
      ? "Pending"
      : approved
        ? "Approved"
        : rejected
          ? "Rejected"
          : "Draft";

  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-background px-2.5 py-1">
      {loading && !status ? (
        <Loader2 className="size-3 animate-spin text-subdued" aria-hidden="true" />
      ) : (
        <span
          className={`size-1.5 rounded-full ${
            approved
              ? "bg-approved-fg"
              : pending
                ? "bg-inreview-fg"
                : rejected
                  ? "bg-danger"
                  : "bg-draft-fg"
          }`}
          aria-hidden="true"
        />
      )}
      <span className="text-subdued">{label}</span>
      <span className="font-semibold text-text">{display}</span>
    </span>
  );
}

function Chip({ label, value, ok, to }: { label: string; value: string; ok: boolean; to?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-background px-2.5 py-1">
      <span className={`size-1.5 rounded-full ${ok ? "bg-approved-fg" : "bg-draft-fg"}`} aria-hidden="true" />
      <span className="text-subdued">{label}</span>
      <span className="font-mono font-semibold tabular-nums text-text">{value}</span>
      {to ? (
        <Link to={to} className="ml-1 font-semibold text-primary hover:underline">
          · View table
        </Link>
      ) : null}
    </span>
  );
}

function MockPage({ doc, page = 1, total = 2 }: { doc: PreviewDoc; page?: number; total?: number }) {
  const dosageFormId = useSetupStore((s) => s.dosageFormId);
  const documentTypeId = useSetupStore((s) => s.documentTypeId);
  const typeMeta = getSelectedTypeMeta(dosageFormId, documentTypeId);
  return (
    <div className="mx-auto w-[210mm] max-w-full min-h-[297mm] rounded-sm border border-border/80 bg-white p-10 text-black shadow-lg">
      <div className="flex items-center justify-between text-[9px] uppercase tracking-wide text-black/50">
        <span>UNIT-01 · Master Template</span>
        <span>{typeMeta.label}</span>
      </div>
      <h3 className="mt-6 text-center text-sm font-bold uppercase tracking-wide">{doc.name}</h3>
      <p className="mt-1 text-center text-[10px] text-black/50">
        {doc.group} · {doc.code} · uploaded source document
      </p>

      {page === 1 ? (
        <>
          <div className="mt-6 space-y-2">
            <div className="h-2 w-full rounded bg-black/10" />
            <div className="h-2 w-11/12 rounded bg-black/10" />
            <div className="h-2 w-4/5 rounded bg-black/10" />
          </div>
          <div className="mt-6 grid grid-cols-4 gap-px overflow-hidden rounded border border-black/10 bg-black/10">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className={`h-6 ${i < 4 ? "bg-black/[0.06]" : "bg-white"}`} />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded border border-black/10 bg-black/10">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className={`h-6 ${i < 3 ? "bg-black/[0.06]" : "bg-white"}`} />
            ))}
          </div>
          <div className="mt-8 grid grid-cols-3 gap-3 text-[9px] text-black/50">
            {["Done by", "Checked by", "Verified by (QA)"].map((s) => (
              <div key={s} className="rounded border border-black/10 p-2">
                <p className="font-semibold uppercase">{s}</p>
                <p className="mt-4 border-t border-black/10 pt-1">Sign / Date</p>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-8 flex items-center justify-between text-[9px] text-black/40">
        <span>{doc.file.filename}</span>
        <span>uploaded master copy · page {page} of {total}</span>
      </div>
    </div>
  );
}

function formatSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}
