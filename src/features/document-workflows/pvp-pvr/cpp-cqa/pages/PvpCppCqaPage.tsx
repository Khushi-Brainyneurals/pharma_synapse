import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { ChevronDown, Lock } from "lucide-react";
import { useParams } from "react-router-dom";
import { AppHeader } from "../../../../../app/layout/AppHeader";
import { AppSidebar } from "../../../../../app/layout/AppSidebar";
import { getApiErrorMessage } from "../../../../../shared/api/apiError";
import { Callout } from "../../../../../shared/ui/Callout";
import { useAuthStore } from "../../../../auth/state/auth.store";
import { DocumentStepper } from "../../../selection/components/DocumentStepper";
import { SelectionStrip } from "../../../selection/components/SelectionStrip";
import { useDocumentSelectorData } from "../../../selection/hooks/useDocumentSelectorData";
import { useDocument } from "../../../selection/hooks/useDocument";
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

export function PvpCppCqaPage() {
  const { documentId = "" } = useParams();
  const user = useAuthStore((state) => state.user);
  const { context, isLoading: isLoadingContext } = useDocumentSelectorData(user);
  const { document } = useDocument(documentId);
  const { goToStep } = useStepNavigation(documentId);
  const [rows, setRows] = useState<PvpCppCqaRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  // undefined = nothing chosen yet (first stage opens by default), null = user collapsed everything
  const [openStage, setOpenStage] = useState<string | null | undefined>(undefined);

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
  const activeStage = openStage === undefined ? groups[0]?.name ?? null : openStage;

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader user={user} unit={context?.unit ?? null} isLoadingUnit={isLoadingContext} />
      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />
        <main className="min-w-0 lg:h-full lg:overflow-y-auto">
          <section className="mx-auto flex min-h-[calc(100vh-var(--topbar-h))] flex-col bg-surface shadow-sm lg:min-h-full">
            <div className="px-4 py-4 sm:px-6 lg:px-8">
              <DocumentStepper steps={PVP_PVR_DOCUMENT_STEPS} activeStepId="cpp-cqa" onStepClick={goToStep} />
            </div>
            <SelectionStrip dosageForm={document?.dosage_form} docType={document?.doc_type} identifier={document?.bmr_number ?? document?.draft_id} />

            <div className="flex flex-1 flex-col">
              <div className="flex flex-col items-start justify-between border-b border-border p-5 pb-5">
                <p className="text-micro font-semibold uppercase tracking-overline text-primary">Step 5 of 7</p>
                <h1 className="mt-1 text-h1 font-semibold">Critical Process Parameters &amp; Critical Quality Attributes</h1>
                <p className="mt-1.5 text-small text-subdued">Review the process parameters and quality attributes by manufacturing stage.</p>
              </div>

              <div className="flex-1 bg-muted/50 px-4 py-5 sm:px-6 lg:px-8">
                {isLoading ? <LoadingPanel /> : null}

                {!isLoading && error ? (
                  <Callout tone="danger" title="CPP and CQA unavailable">
                    <p>{error}</p>
                    <button className="mt-2 font-semibold underline" type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button>
                  </Callout>
                ) : null}

                {!isLoading && !error && rows.length === 0 ? <EmptyPanel /> : null}

                {!isLoading && !error && groups.length > 0 ? (
                  <section className="overflow-hidden rounded-card border border-border bg-surface shadow-sm">
                    {/* Card header */}
                    <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border px-5 py-4">
                      <h2 className="text-h3 font-semibold">Stages</h2>
                      <p className="min-w-0 flex-1 truncate text-small text-subdued">
                        CPP &amp; CQA on {groups.map((group) => group.name || "Other").join(", ")}
                      </p>
                      <ReadOnlyBadge label="Read-only" />
                    </header>

                    {/* Accordion */}
                    <ul className="divide-y divide-border">
                      {groups.map((group, index) => {
                        const stageKey = group.name;
                        const isOpen = activeStage === stageKey;
                        const panelId = `cpp-cqa-panel-${index}`;
                        const buttonId = `cpp-cqa-trigger-${index}`;
                        const tableGroups = groupRowsBySubgroup(group.rows);
                        const parameterCount = group.rows.filter((row) => row.kind.trim().toLowerCase() !== "group").length;

                        return (
                          <li key={stageKey} className="relative">
                            <span
                              aria-hidden="true"
                              className="absolute left-0 top-2 h-[44px] w-0.5 bg-primary"
                            />
                            <h3>
                              <button
                                id={buttonId}
                                type="button"
                                aria-expanded={isOpen}
                                aria-controls={panelId}
                                onClick={() => setOpenStage(isOpen ? null : stageKey)}
                                className="flex h-[60px] w-full items-center gap-4 pl-6 pr-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                              >
                                <span className="min-w-0 flex-1 truncate text-[13px] text-text font-semibold">{group.name || "Other"}</span>
                                <span className="hidden px-2 text-small text-primary-dark sm:inline">
                                  {parameterCount} {parameterCount === 1 ? "step" : "steps"}
                                </span>
                                <span className="grid size-8 shrink-0 place-items-center rounded-control border border-border bg-surface text-subdued">
                                  <ChevronDown className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                                </span>
                              </button>
                            </h3>

                            {isOpen ? (
                              <div
                                id={panelId}
                                role="region"
                                aria-labelledby={buttonId}
                                className="border-t border-dashed border-border bg-muted/50 py-2 pl-6 pr-5"
                              >
                                <StageTabs idPrefix={panelId} tables={tableGroups} />
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ) : null}
              </div>

              <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-3 border-t border-border bg-surface p-3.5 shadow-auth sm:flex-row sm:justify-between">
                <button type="button" className="rounded-control border border-border px-4 py-2 text-small font-semibold text-subdued hover:bg-muted" onClick={() => goToStep("process-bom")}>Back</button>
                <button type="button" className="rounded-control bg-primary px-4 py-2 text-small font-semibold text-white hover:opacity-90" onClick={() => goToStep("procedure-sampling")}>Continue to Procedure &amp; Sampling Plan</button>
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

function splitItems(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/;|\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function ReadOnlyBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-micro font-medium text-subdued">
      <Lock className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}

function ItemList({ value, variant }: { value: string | null | undefined; variant: "cpp" | "cqa" }) {
  const items = splitItems(value);
  if (items.length === 0) return <span className="text-subdued/70">Not applicable</span>;

  const chipClass = "border-border bg-muted text-text";

  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item, index) => (
        <li
          key={`${item}-${index}`}
          className={`rounded-full border px-2 py-1 text-[12px] font-small leading-snug ${chipClass}`}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function StageTabs({ idPrefix, tables }: { idPrefix: string; tables: StageTableGroup[] }) {
  const [active, setActive] = useState(0);

  if (tables.length === 0) return null;
  if (tables.length === 1) return <CppCqaTable group={tables[0]} showHeading />;

  const current = Math.min(active, tables.length - 1);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next =
      event.key === "ArrowRight" ? (current + 1) % tables.length : (current - 1 + tables.length) % tables.length;
    setActive(next);
    window.document.getElementById(`${idPrefix}-tab-${next}`)?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label="Process groups" className="flex gap-1 border-b border-border">
        {tables.map((table, index) => {
          const selected = index === current;
          return (
            <button
              key={index}
              id={`${idPrefix}-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${idPrefix}-tabpanel-${index}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(index)}
              onKeyDown={onKeyDown}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-small font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                selected
                  ? "border-primary text-primary"
                  : "border-transparent text-subdued hover:text-text"
              }`}
            >
              {table.heading || "General"}
              <span
                className={`rounded-full px-1.5 py-0.5 text-micro font-medium ${
                  selected ? "bg-primary/10 text-primary-dark" : "bg-muted text-subdued"
                }`}
              >
                {table.rows.length}
              </span>
            </button>
          );
        })}
      </div>

      <div
        id={`${idPrefix}-tabpanel-${current}`}
        role="tabpanel"
        aria-labelledby={`${idPrefix}-tab-${current}`}
      >
        <CppCqaTable group={tables[current]} showHeading={false} />
      </div>
    </div>
  );
}

function CppCqaTable({ group, showHeading = true }: { group: StageTableGroup; showHeading?: boolean }) {
  return (
    <div className="first:pt-1">
      {showHeading && group.heading ? (
        <p className="pb-1 pt-2 text-small font-semibold text-primary">{group.heading}</p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-small">
          <thead>
            <tr className="border-b border-border text-left text-subdued">
              <th scope="col" className="w-1/5 py-3 px-4 font-medium">Critical stage</th>
              <th scope="col" className="w-2/5 py-3 px-4 font-medium">Critical process parameter</th>
              <th scope="col" className="w-2/5 py-3 px-4 font-medium">Critical quality attributes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {group.rows.map((row, index) => (
              <tr key={`${row.processing_stage}-${index}`}>
                <th scope="row" className="py-3.5 px-4 text-left align-top font-semibold">{row.processing_stage || "—"}</th>
                <td className="py-3.5 px-4 align-top"><ItemList value={row.critical_process_parameter} variant="cpp" /></td>
                <td className="py-3.5 px-4 align-top"><ItemList value={row.critical_quality_attribute} variant="cqa" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LoadingPanel() {
  return <div className="flex min-h-36 items-center justify-center gap-3 rounded-panel border border-border bg-surface text-small text-subdued" role="status"><span className="size-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" aria-hidden="true" />Loading critical process parameters and quality attributes…</div>;
}

function EmptyPanel() {
  return <div className="rounded-panel border border-border bg-surface px-5 py-10 text-center text-small text-subdued">No critical process parameters or quality attributes were returned for this document.</div>;
}