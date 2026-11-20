import { AlertCircle, BarChart3, ChevronLeft, ChevronRight, Clock, FileText, FileStack, Loader2, PieChart, Timer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { DateField } from "../../../shared/ui/DateField";
import { GlassSelect } from "../../../shared/ui/GlassSelect";
import { getRememberedModule } from "../../modules/model/selectedModule";
import { getDocumentActivity, type DocumentActivity as Activity } from "../api/activity.api";
import {
  PERIOD_OPTIONS,
  buildBuckets,
  bucketUnitFor,
  niceAxis,
  parseIsoDate,
  periodLabel,
  periodRange,
  rangeLabel,
  startOfToday,
  toIsoDate,
  type DayRange,
  type PeriodKind,
} from "../model/period";
import { ChartSection, ColumnChart, DonutChart, EmptyChart, FilterField, Segmented, filterSelectClass, type DonutSegment } from "./charts";

/** The module filter. Empty means every module; any other pick filters the response on our side. */
const MODULE_OPTIONS = [
  { value: "", label: "All modules" },
  { value: "BATCH_DOC_101", label: "Batch documents" },
  { value: "PROC_VALID_201", label: "Process validation" },
  { value: "CPV_202", label: "CPV (Continued process verification)" },
  { value: "APQR_203", label: "APQR (Annual product quality review)" },
];

/**
 * The module the user signed in from preselects the filter. Administration
 * (ADMIN_ACCESS_901) and any module not in the list start on "All modules".
 */
function defaultModuleKey() {
  const signedInFrom = getRememberedModule();
  return MODULE_OPTIONS.some((m) => m.value && m.value === signedInFrom) ? signedInFrom! : "";
}

/** Donut order, label and colour for each `status_counts` key; unknown keys follow in mist. */
const STATUS_META: { keys: string[]; label: string; stroke: string; dot: string }[] = [
  { keys: ["finalized", "approved", "approved_for_print"], label: "Approved", stroke: "stroke-sage-500", dot: "bg-sage-500" },
  { keys: ["under_review", "in_review", "submitted"], label: "Under review", stroke: "stroke-iris-500", dot: "bg-iris-500" },
  { keys: ["in_approval", "pending_approval"], label: "In approval", stroke: "stroke-harbor-500", dot: "bg-harbor-500" },
  { keys: ["draft"], label: "Draft", stroke: "stroke-honey-400", dot: "bg-honey-400" },
  { keys: ["returned_for_correction", "returned"], label: "Returned for correction", stroke: "stroke-clay-500", dot: "bg-clay-500" },
  { keys: ["rejected"], label: "Rejected", stroke: "stroke-rose-600", dot: "bg-rose-600" },
  { keys: ["overdue"], label: "Overdue", stroke: "stroke-rose-400", dot: "bg-rose-400" },
];

const UNIT_WORD = { day: "per day", week: "per week (weeks start on Monday)", month: "per month", year: "per year" } as const;

/** 93600 → "26 h 00 min", 540 → "9 min", 12 → "12 s". */
export function formatDuration(seconds: number) {
  if (!seconds || seconds < 0) return "–";
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours.toLocaleString()} h ${String(minutes % 60).padStart(2, "0")} min`;
}

const titleCase = (key: string) => key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function statusSegments(counts: Record<string, number>): DonutSegment[] {
  const used = new Set<string>();
  const segments: DonutSegment[] = [];
  for (const meta of STATUS_META) {
    const present = meta.keys.filter((k) => k in counts);
    if (!present.length) continue;
    present.forEach((k) => used.add(k));
    segments.push({
      key: meta.keys[0],
      label: meta.label,
      value: present.reduce((sum, k) => sum + counts[k], 0),
      stroke: meta.stroke,
      dot: meta.dot,
    });
  }
  for (const [key, value] of Object.entries(counts)) {
    if (!used.has(key)) segments.push({ key, label: titleCase(key), value, stroke: "stroke-mist-400", dot: "bg-mist-400" });
  }
  return segments;
}

/**
 * Document activity: documents created by status (donut) and documents generated over
 * time (columns), for one module and period. Data: GET /api/documents/dashboard/activity.
 */
export function DocumentActivity() {
  const today = useMemo(() => startOfToday(), []);
  const [moduleKey, setModuleKey] = useState(defaultModuleKey);
  const [kind, setKind] = useState<PeriodKind>("month");
  const [offset, setOffset] = useState(0);
  const [from, setFrom] = useState(() => toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(() => toIsoDate(today));

  const range: DayRange = useMemo(() => {
    if (kind !== "custom") return periodRange(kind, offset, today);
    let start = parseIsoDate(from) ?? today;
    let end = parseIsoDate(to) ?? today;
    if (start > end) [start, end] = [end, start];
    return { start, end: end > today ? today : end };
  }, [kind, offset, from, to, today]);

  const startIso = toIsoDate(range.start);
  const endIso = toIsoDate(range.end);

  const [data, setData] = useState<Activity | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDocumentActivity(startIso, endIso)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((caught) => {
        if (!cancelled) {
          setData(null);
          setError(getApiErrorMessage(caught, "Could not load document activity."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [startIso, endIso]);

  function changeKind(next: PeriodKind) {
    setKind(next);
    setOffset(0);
  }

  const moduleName = MODULE_OPTIONS.find((m) => m.value === moduleKey)?.label ?? "All modules";

  const model = useMemo(() => {
    // Module filter, on our side: a response for another module contributes nothing.
    const matches = data && (!moduleKey || data.module === moduleKey);
    const counts = matches ? data.status_counts : {};
    const daily = matches ? data.daily : [];
    const segments = statusSegments(counts);
    const created = matches ? data.documents_created || segments.reduce((s, g) => s + g.value, 0) : 0;
    const segTotal = segments.reduce((s, g) => s + g.value, 0);

    const unit = bucketUnitFor(range);
    const buckets = buildBuckets(range, unit).map((b) => {
      const lo = toIsoDate(b.start);
      const hi = toIsoDate(b.end);
      const days = daily.filter((d) => d.date >= lo && d.date <= hi);
      return {
        ...b,
        count: days.reduce((s, d) => s + d.documents_generated, 0),
        seconds: days.reduce((s, d) => s + d.total_seconds, 0),
        measured: days.reduce((s, d) => s + d.measured_documents, 0),
      };
    });
    const { ticks, top } = niceAxis(Math.max(0, ...buckets.map((b) => b.count)));
    const groups = buckets.map((b) => ({
      key: b.key,
      x: b.x,
      bars: [
        {
          key: b.key,
          value: b.count,
          label: b.count && buckets.length <= 31 ? String(b.count) : undefined,
          className: "bg-primary",
          aria: `${b.full}: ${b.count} generated`,
          tip:
            `${b.full}: ${b.count} ${b.count === 1 ? "document" : "documents"} generated` +
            (b.measured ? `, ${formatDuration(b.seconds)} generation time in total, ${formatDuration(b.seconds / b.measured)} on average.` : "."),
        },
      ],
    }));

    return {
      segments,
      segTotal,
      created,
      generated: matches ? data.documents_generated : 0,
      totalSeconds: matches ? data.total_generation_seconds : 0,
      averageSeconds: matches ? data.average_generation_seconds : 0,
      missing: matches ? data.missing_duration_count : 0,
      groups,
      ticks,
      top,
      unit,
      hasGenerated: buckets.some((b) => b.count > 0),
    };
  }, [data, moduleKey, range]);

  const label = periodLabel(kind, range);
  const scopeLine = `${moduleName}, ${rangeLabel(range)}.`;

  return (
    <ChartSection
      icon={FileText}
      title="Document activity"
      subtitle={scopeLine}
      filters={
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2.5">
          <FilterField label="Module">
            <GlassSelect
              aria-label="Module"
              value={moduleKey}
              onChange={(e) => setModuleKey(e.target.value)}
              className={`${filterSelectClass} min-w-[220px]`}
            >
              {MODULE_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </GlassSelect>
          </FilterField>
          <FilterField label="Period">
            <Segmented
              label="Period"
              value={kind}
              onChange={changeKind}
              options={PERIOD_OPTIONS.map((p) => ({ value: p.kind, label: p.label }))}
            />
          </FilterField>
          {kind === "custom" ? (
            <>
              <FilterField label="From">
                <DateField
                  aria-label="From date"
                  value={from}
                  onChange={setFrom}
                  max={to || toIsoDate(today)}
                  className="h-9 w-[150px] rounded-control border border-border bg-surface px-3 text-small font-normal text-text"
                />
              </FilterField>
              <FilterField label="To">
                <DateField
                  aria-label="To date"
                  value={to}
                  onChange={setTo}
                  min={from}
                  max={toIsoDate(today)}
                  className="h-9 w-[150px] rounded-control border border-border bg-surface px-3 text-small font-normal text-text"
                />
              </FilterField>
            </>
          ) : (
            <div className="inline-flex h-9 items-center overflow-hidden rounded-control border border-border-strong bg-surface">
              <button
                type="button"
                aria-label={`Previous ${kind}`}
                onClick={() => setOffset((o) => o - 1)}
                className="inline-flex h-full w-8 items-center justify-center text-subdued transition hover:bg-accent-soft hover:text-primary-dark"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <span className="min-w-[120px] px-2 text-center text-micro font-semibold text-text" aria-live="polite">
                {label}
              </span>
              <button
                type="button"
                aria-label={`Next ${kind}`}
                disabled={offset >= 0}
                onClick={() => setOffset((o) => Math.min(0, o + 1))}
                className="inline-flex h-full w-8 items-center justify-center text-subdued transition hover:bg-accent-soft hover:text-primary-dark disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      }
    >
      {error ? (
        <div className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger-soft p-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
          <p className="m-0 text-small text-danger">{error}</p>
        </div>
      ) : null}

      <div className={`flex flex-wrap items-stretch gap-4 transition-opacity ${isLoading && data ? "opacity-60" : ""}`} aria-busy={isLoading}>
        {/* Documents by status */}
        <section aria-label="Documents by status" className="flex min-w-0 flex-[1_1_360px] flex-col gap-3.5 rounded-card border border-border px-4 py-3.5">
          <div>
            <h3 className="m-0 text-[14px] font-medium leading-5 text-text">Documents by status</h3>
            <p className="m-0 mt-0.5 text-micro text-subdued">Every document created in the period, by where it stands now.</p>
          </div>
          {isLoading && !data ? (
            <Loading />
          ) : model.segTotal > 0 ? (
            <DonutChart
              segments={model.segments}
              total={model.segTotal}
              totalLabel={model.segTotal === 1 ? "document created" : "documents created"}
              ariaLabel={`${moduleName} documents created ${rangeLabel(range)} by status: ${model.segments.map((s) => `${s.label} ${s.value}`).join(", ")}.`}
            />
          ) : (
            <EmptyChart icon={PieChart} text="No documents were created in this period." />
          )}
        </section>

        {/* Documents generated */}
        <section aria-label="Documents generated" className="flex min-w-0 flex-[2_1_560px] flex-col gap-3.5 rounded-card border border-border px-4 py-3.5">
          <div>
            <h3 className="m-0 text-[14px] font-medium leading-5 text-text">Documents generated</h3>
            <p className="m-0 mt-0.5 text-micro text-subdued">
              Documents whose first full draft was generated in the period. Generation time runs from creating the document to its first full draft.
            </p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
            <Stat icon={FileStack} label="Documents generated" value={model.generated.toLocaleString()} />
            <Stat icon={Clock} label="Total generation time" value={model.generated ? formatDuration(model.totalSeconds) : "–"} />
            <Stat icon={Timer} label="Average per document" value={model.generated ? formatDuration(model.averageSeconds) : "–"} />
          </div>
          {model.missing > 0 ? (
            <p className="m-0 text-micro text-subdued">
              {model.missing} generated {model.missing === 1 ? "document has" : "documents have"} no recorded duration and {model.missing === 1 ? "is" : "are"} left out of the times.
            </p>
          ) : null}
          {isLoading && !data ? (
            <Loading />
          ) : model.hasGenerated ? (
            <>
              <ColumnChart
                groups={model.groups}
                ticks={model.ticks}
                top={model.top}
                dense={model.groups.length > 20}
                ariaLabel={`${moduleName} documents generated ${UNIT_WORD[model.unit]}, ${rangeLabel(range)}`}
              />
              <p className="m-0 text-center text-micro text-subdued">
                Documents generated {UNIT_WORD[model.unit]}. Point at a bar for its total and average generation time.
              </p>
            </>
          ) : (
            <EmptyChart icon={BarChart3} text="No documents were generated in this period." />
          )}
        </section>
      </div>
    </ChartSection>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-control border border-border bg-accent-soft px-3.5 py-3">
      <Icon className="size-[22px] flex-none text-primary" aria-hidden="true" />
      <div className="flex min-w-0 flex-col">
        <span className="text-micro text-subdued">{label}</span>
        <span className="text-[20px] font-semibold leading-[26px] tracking-[-0.01em] tabular-nums text-text">{value}</span>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <p className="m-0 flex flex-1 items-center justify-center gap-2 py-12 text-small text-subdued">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      Loading…
    </p>
  );
}
