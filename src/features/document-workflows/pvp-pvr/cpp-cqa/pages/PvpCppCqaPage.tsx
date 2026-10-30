import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AppHeader } from "../../../../../app/layout/AppHeader";
import { AppSidebar } from "../../../../../app/layout/AppSidebar";
import { getApiErrorMessage } from "../../../../../shared/api/apiError";
import { Callout } from "../../../../../shared/ui/Callout";
import { useAuthStore } from "../../../../auth/state/auth.store";
import { DocumentStepper } from "../../../selection/components/DocumentStepper";
import { SelectionStrip } from "../../../selection/components/SelectionStrip";
import type { DocumentDetail } from "../../../selection/api/document.types";
import { useDocumentSelectorData } from "../../../selection/hooks/useDocumentSelectorData";
import { useStepNavigation } from "../../../selection/hooks/useStepNavigation";
import { PVP_PVR_DOCUMENT_STEPS } from "../../../selection/model/documentSelector.config";
import { getPvpCppCqa, type PvpCppCqaRow } from "../api/cppCqa.api";

interface StageGroup {
  name: string;
  rows: PvpCppCqaRow[];
}

interface StageTableGroup {
  heading: string | null;
  rows: PvpCppCqaRow[];
}

export function PvpCppCqaPage({ documentId, document }: { documentId: string; document: DocumentDetail }) {
  const user = useAuthStore((state) => state.user);
  const { context, isLoading: isLoadingContext } = useDocumentSelectorData(user);
  const { goToStep } = useStepNavigation(documentId);
  const [rows, setRows] = useState<PvpCppCqaRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [openStage, setOpenStage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    void getPvpCppCqa(documentId)
      .then((result) => { if (!cancelled) setRows(result.rows); })
      .catch((caught: unknown) => {
        if (!cancelled) setError(getApiErrorMessage(caught, "Unable to load critical process parameters and quality attributes."));
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [documentId, retry]);

  const groups = useMemo(() => groupByMainStage(rows), [rows]);

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader user={user} unit={context?.unit ?? null} isLoadingUnit={isLoadingContext} />
      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />
        <main className="min-w-0 lg:h-full lg:overflow-y-auto">
          <section className="mx-auto bg-surface shadow-sm">
            <div className="px-4 py-4 sm:px-6 lg:px-8">
              <DocumentStepper steps={PVP_PVR_DOCUMENT_STEPS} activeStepId="cpp-cqa" onStepClick={goToStep} />
            </div>
            <SelectionStrip dosageForm={document?.dosage_form} docType={document?.doc_type} identifier={document?.bmr_number ?? document?.draft_id} />
            <div>
              <div className="flex flex-col items-start justify-between border-b border-border p-5 pb-5">
                <p className="text-micro font-semibold uppercase tracking-overline text-primary">Step 5 of 7</p>
                <h1 className="mt-1 text-h1 font-semibold">Critical Process Parameters &amp; Critical Quality Attributes</h1>
                <p className="mt-1.5 text-small text-subdued">Review the process parameters and quality attributes by manufacturing stage.</p>
              </div>

              <div className="space-y-4 bg-muted/50 px-4 py-5 sm:px-6 lg:px-8">
                {isLoading ? <LoadingPanel /> : null}
                {!isLoading && error ? (
                  <Callout tone="danger" title="CPP and CQA unavailable">
                    <p>{error}</p>
                    <button className="mt-2 font-semibold underline" type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button>
                  </Callout>
                ) : null}
                {!isLoading && !error && rows.length === 0 ? <EmptyPanel /> : null}
                {!isLoading && !error && groups.map((group) => {
                  const isOpen = openStage === group.name;
                  const tableGroups = groupRowsBySubgroup(group.rows);
                  const stageKey = `${group.name}`;
                  return (
                    <section key={stageKey} className="overflow-hidden rounded-card border border-border bg-surface shadow-sm">
                      <h3>
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-controls={`cpp-cqa-panel-${groups.indexOf(group)}`}
                          onClick={() => setOpenStage(isOpen ? null : stageKey)}
                          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
                        >
                          <span className="text-h3 font-semibold">{group.name || "Other"}</span>
                          <ChevronDown className={`size-5 shrink-0 text-subdued transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                        </button>
                      </h3>
                      {isOpen ? (
                        <div id={`cpp-cqa-panel-${groups.indexOf(group)}`} className="space-y-5 border-t border-border p-4 sm:p-5">
                          {tableGroups.map((table, index) => (
                            <CppCqaTable key={`${group.name}-${index}`} group={table} />
                          ))}
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </div>

              <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-3 border-t border-border bg-surface p-3.5 shadow-auth sm:flex-row sm:justify-between">
                <button type="button" className="rounded-control border border-border px-4 py-2 text-small font-semibold text-subdued" onClick={() => goToStep("process-bom")}>Back</button>
                <button type="button" className="rounded-control bg-primary px-4 py-2 text-small font-semibold text-white" onClick={() => goToStep("procedure-sampling")}>Continue to Procedure &amp; Sampling Plan</button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function groupByMainStage(rows: PvpCppCqaRow[]): StageGroup[] {
  const groups = new Map<string, PvpCppCqaRow[]>();
  for (const row of rows) {
    const stage = row.main_stage;
    const group = groups.get(stage) ?? [];
    group.push(row);
    groups.set(stage, group);
  }
  return [...groups].map(([name, stageRows]) => ({ name, rows: stageRows }));
}

function groupRowsBySubgroup(rows: PvpCppCqaRow[]): StageTableGroup[] {
  const tables: StageTableGroup[] = [];
  let current: StageTableGroup = { heading: null, rows: [] };
  for (const row of rows) {
    if (row.kind.trim().toLowerCase() === "group") {
      if (current.rows.length || current.heading !== null) tables.push(current);
      current = { heading: row.processing_stage, rows: [] };
    } else {
      current.rows.push(row);
    }
  }
  if (current.rows.length || current.heading !== null) tables.push(current);
  return tables;
}

function CppCqaTable({ group }: { group: StageTableGroup }) {
  return (
    <section className="overflow-hidden rounded-card border border-border bg-surface">
      {group.heading ? <h3 className="border-b border-border bg-primary/10 px-4 py-2.5 text-center text-small font-semibold text-text">{group.heading}</h3> : null}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-small">
          <thead>
            <tr className="text-left text-micro uppercase tracking-overline text-subdued">
              <th scope="col" className="min-w-44 border border-border bg-muted px-3 py-2.5 font-semibold">Processing Stage</th>
              <th scope="col" className="min-w-56 border border-border bg-muted px-3 py-2.5 font-semibold">Critical Process Parameter</th>
              <th scope="col" className="min-w-56 border border-border bg-muted px-3 py-2.5 font-semibold">Critical Quality Attribute</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row, index) => (
              <tr key={`${row.processing_stage}-${index}`} className="hover:bg-muted/50">
                <td className="border border-border px-3 py-2.5 align-top">{row.processing_stage || "—"}</td>
                <td className="border border-border px-3 py-2.5 align-top">{row.critical_process_parameter || "—"}</td>
                <td className="border border-border px-3 py-2.5 align-top">{row.critical_quality_attribute || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LoadingPanel() {
  return <div className="flex min-h-36 items-center justify-center gap-3 rounded-panel border border-border bg-surface text-small text-subdued" role="status"><span className="size-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" aria-hidden="true" />Loading critical process parameters and quality attributes…</div>;
}

function EmptyPanel() {
  return <div className="rounded-panel border border-border bg-surface px-5 py-10 text-center text-small text-subdued">No critical process parameters or quality attributes were returned for this document.</div>;
}
