import {
  Activity,
  AlertCircle,
  CircleCheck,
  CircleX,
  Database,
  Download,
  Eye,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  Printer,
  Search,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type FormEvent,
  type ReactNode,
} from "react";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { Callout } from "../../../shared/ui/Callout";
import { Dialog } from "../../../shared/ui/Dialog";
import { Identifier } from "../../../shared/ui/Identifier";
import { useAuthStore } from "../../auth/state/auth.store";
import { AppHeader } from "../../new-document/components/AppHeader";
import { AppSidebar } from "../../new-document/components/AppSidebar";
import {
  auditDateTime,
  buildAuditParams,
  getAuditLogs,
  type AuditFilters,
  type AuditRecord,
} from "../api/auditTrail.api";

type Tone = "neutral" | "danger" | "warn" | "success" | "info";

interface FilterForm {
  actorId: string;
  actorRole: string;
  action: string;
  result: string;
  entity: string;
  entityId: string;
  ipAddress: string;
  sessionId: string;
  startDate: string;
  endDate: string;
}

const EMPTY_FILTERS: FilterForm = {
  actorId: "",
  actorRole: "",
  action: "",
  result: "",
  entity: "",
  entityId: "",
  ipAddress: "",
  sessionId: "",
  startDate: "",
  endDate: "",
};

const TONE_CHIP: Record<Tone, string> = {
  neutral: "border border-border bg-surface text-subdued",
  danger: "bg-rejected-bg text-rejected-fg",
  warn: "bg-draft-bg text-draft-fg",
  success: "bg-approved-bg text-approved-fg",
  info: "bg-inreview-bg text-inreview-fg",
};

const BAD_RESULTS = new Set([
  "error",
  "failed",
  "failure",
  "rejected",
  "denied",
  "unauthorized",
  "locked",
]);
const WARNING_RESULTS = new Set(["warning", "warn", "partial", "pending"]);
const SUCCESS_RESULTS = new Set(["done", "success", "successful", "approved", "completed"]);

function actionPresentation(record: AuditRecord): {
  tone: Tone;
  Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
} {
  const result = normalized(record.result);
  if (BAD_RESULTS.has(result)) return { tone: "danger", Icon: CircleX };
  if (WARNING_RESULTS.has(result)) return { tone: "warn", Icon: AlertCircle };
  if (SUCCESS_RESULTS.has(result)) return { tone: "success", Icon: CircleCheck };
  return { tone: "neutral", Icon: Activity };
}

function isException(record: AuditRecord): boolean {
  const result = normalized(record.result);
  return BAD_RESULTS.has(result) || WARNING_RESULTS.has(result);
}

function normalized(value: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function formatTimestamp(value: string | null): { date: string; time: string } {
  if (!value) return { date: "—", time: "—" };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: value, time: "—" };

  return {
    date: parsed.toLocaleDateString("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    time: parsed.toLocaleTimeString("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }),
  };
}

function jsonText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function matchesSearch(record: AuditRecord, query: string): boolean {
  if (!query) return true;
  return [
    record.id,
    record.actor_id,
    record.actor_role,
    record.action,
    record.result,
    record.entity,
    record.entity_id,
    record.reason,
    record.ip_address,
    record.session_id,
  ].some((value) => String(value ?? "").toLowerCase().includes(query));
}

function filterRequest(form: FilterForm): { filters?: AuditFilters; error?: string } {
  if (form.startDate && form.endDate && form.startDate > form.endDate) {
    return { error: "Start date must be on or before the end date." };
  }

  const startDate = form.startDate ? auditDateTime(form.startDate, "start") : undefined;
  const endDate = form.endDate ? auditDateTime(form.endDate, "end") : undefined;
  if ((form.startDate && !startDate) || (form.endDate && !endDate)) {
    return { error: "Enter valid start and end dates." };
  }

  const sessionIdText = form.sessionId.trim();
  if (sessionIdText && !/^\d+$/.test(sessionIdText)) {
    return { error: "Session ID must be a whole number." };
  }

  const sessionId = sessionIdText ? Number(sessionIdText) : undefined;
  if (sessionId !== undefined && !Number.isSafeInteger(sessionId)) {
    return { error: "Session ID is outside the supported integer range." };
  }

  return {
    filters: buildAuditParams({
      actor_id: form.actorId,
      actor_role: form.actorRole,
      action: form.action,
      result: form.result,
      entity: form.entity,
      entity_id: form.entityId,
      ip_address: form.ipAddress,
      session_id: sessionId,
      start_date: startDate,
      end_date: endDate,
    }),
  };
}

/** Open the currently visible records as a printable, escaped audit report. */
function openAuditReport(
  records: AuditRecord[],
  generatedBy: { name: string; id: string; role: string },
) {
  const now = new Date();
  const when = now.toLocaleString("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const esc = (value: unknown) =>
    String(value ?? "").replace(/[&<>]/g, (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character] ?? character,
    );
  const rows = records
    .map((record) => {
      const timestamp = formatTimestamp(record.timestamp);
      const exactTimestamp = record.timestamp
        ? `<div class="dim">${esc(record.timestamp)}</div>`
        : "";
      return `<tr>
        <td>${esc(display(record.id))}</td>
        <td>${esc(timestamp.date)} ${esc(timestamp.time)}${exactTimestamp}</td>
        <td>${esc(display(record.actor_id))}</td>
        <td>${esc(display(record.actor_role))}</td>
        <td class="action-col">${esc(display(record.action))}</td>
        <td>${esc(display(record.result))}</td>
        <td>${esc(display(record.entity))}</td>
        <td>${esc(display(record.entity_id))}</td>
        <td class="reason-col">${esc(display(record.reason))}</td>
        <td>${esc(display(record.ip_address))}</td>
        <td>${esc(display(record.session_id))}</td>
        <td><pre>${esc(jsonText(record.before))}</pre></td>
        <td><pre>${esc(jsonText(record.after))}</pre></td>
      </tr>`;
    })
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8" />
    <title>Audit Trail — ${esc(when)}</title><style>
    @page{size:landscape;margin:8mm}body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:20px;font-size:8px}h1{font-size:17px;margin:0 0 6px}
    .meta{color:#555;margin:0 0 3px}table{width:1016px;border-collapse:collapse;margin-top:12px;table-layout:fixed}th,td{border:1px solid #999;padding:4px;text-align:left;vertical-align:top;overflow-wrap:anywhere;word-break:break-word}
    th{background:#eee;font-size:7px;text-transform:uppercase}tr{break-inside:avoid-page}.id-col{width:40px}.timestamp-col{width:90px}.actor-col{width:70px}.role-col{width:55px}.action-col{width:120px}.result-col{width:50px}.entity-col{width:70px}.entity-id-col{width:85px}.reason-col{width:100px}.ip-col{width:65px}.session-col{width:45px}.before-col,.after-col{width:113px}.dim{color:#777;font-size:7px;margin-top:2px}pre{font-family:Consolas,monospace;font-size:7px;margin:0;max-width:100%;overflow-wrap:anywhere;white-space:pre-wrap;word-break:break-word}.foot{margin-top:12px;color:#777;font-size:8px}
    @media print{body{margin:0}}
    </style></head><body><h1>Audit Trail</h1>
    <p class="meta">Generated by <b>${esc(generatedBy.name)}</b> (${esc(generatedBy.id)}${generatedBy.role ? ` · ${esc(generatedBy.role)}` : ""}) on <b>${esc(when)}</b></p>
    <p class="meta">${records.length} record(s) · Append-only — records are never edited or deleted.</p>
    <table><colgroup><col class="id-col" /><col class="timestamp-col" /><col class="actor-col" /><col class="role-col" /><col class="action-col" /><col class="result-col" /><col class="entity-col" /><col class="entity-id-col" /><col class="reason-col" /><col class="ip-col" /><col class="session-col" /><col class="before-col" /><col class="after-col" /></colgroup><thead><tr><th>ID</th><th>Timestamp</th><th>Actor ID</th><th>Role</th><th>Action</th><th>Result</th><th>Entity</th><th>Entity ID</th><th>Reason</th><th>IP address</th><th>Session ID</th><th>Previous data</th><th>Updated data</th></tr></thead><tbody>${rows || '<tr><td colspan="13">No records in this view.</td></tr>'}</tbody></table>
    <div class="foot">PharmaDoc AI · Audit trail export · ${esc(when)}</div><script>window.onload=function(){window.focus();window.print();};<\/script></body></html>`;
  const reportWindow = window.open("", "_blank", "width=1024,height=800");
  if (!reportWindow) return;
  reportWindow.document.open();
  reportWindow.document.write(html);
  reportWindow.document.close();
}

export function AuditTrailPage() {
  const user = useAuthStore((state) => state.user);
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [filters, setFilters] = useState<FilterForm>({ ...EMPTY_FILTERS });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<AuditFilters>({});
  const [selected, setSelected] = useState<AuditRecord | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const loadRecords = useCallback(async (requestFilters: AuditFilters) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const nextRecords = await getAuditLogs(requestFilters, controller.signal);
      if (!controller.signal.aborted) setRecords(nextRecords);
    } catch (caught) {
      if (!controller.signal.aborted) {
        setRecords([]);
        setError(getApiErrorMessage(caught, "Could not load the audit trail."));
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords({});
    return () => requestRef.current?.abort();
  }, [loadRecords]);

  const visibleRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return records.filter((record) => matchesSearch(record, normalizedQuery));
  }, [records, query]);

  const reportBy = {
    name: user?.displayName ?? user?.username ?? user?.id ?? "—",
    id: user?.id ?? "",
    role: user?.role ?? "",
  };

  function updateFilter(key: keyof FilterForm, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const request = filterRequest(filters);
    if (!request.filters) {
      setFilterError(request.error ?? "Check the selected filters.");
      return;
    }
    setFilterError(null);
    setAppliedFilters(request.filters);
    void loadRecords(request.filters);
  }

  function clearFilters() {
    setFilters({ ...EMPTY_FILTERS });
    setFilterError(null);
    setAppliedFilters({});
    setQuery("");
    void loadRecords({});
  }

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader user={user} unit={user?.unitId ? { id: user.unitId } : null} title="Audit trail" />
      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />
        <main className="min-h-0 min-w-0 p-4 lg:h-full lg:overflow-y-auto lg:p-6">
          <div className="mx-auto space-y-4">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-h1 font-semibold">Audit trail</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ReportButton icon={Download} label="Download PDF" title="Generate a PDF of these records and save it" onClick={() => openAuditReport(visibleRecords, reportBy)} />
                <ReportButton icon={Printer} label="Print" title="Print these records" onClick={() => openAuditReport(visibleRecords, reportBy)} />
              </div>
            </header>

            <form onSubmit={applyFilters} className="space-y-3 rounded-panel border border-border bg-surface p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <FilterInput label="Start date" type="date" value={filters.startDate} onChange={(value) => updateFilter("startDate", value)} />
                <FilterInput label="End date" type="date" value={filters.endDate} onChange={(value) => updateFilter("endDate", value)} />
                <FilterInput label="Username" value={filters.actorId} onChange={(value) => updateFilter("actorId", value)} placeholder="e.g. demo_preparer" />
                <FilterInput label="Role" value={filters.actorRole} onChange={(value) => updateFilter("actorRole", value)} placeholder="e.g. preparer" />
                <FilterInput label="Action" value={filters.action} onChange={(value) => updateFilter("action", value)} placeholder="Action" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <FilterInput label="Result" value={filters.result} onChange={(value) => updateFilter("result", value)} placeholder="e.g. done" />
                <FilterInput label="Entity" value={filters.entity} onChange={(value) => updateFilter("entity", value)} placeholder="Entity type" />
                <FilterInput label="Entity ID" value={filters.entityId} onChange={(value) => updateFilter("entityId", value)} placeholder="Entity identifier" />
                <FilterInput label="IP address" value={filters.ipAddress} onChange={(value) => updateFilter("ipAddress", value)} placeholder="IP address" />
                <FilterInput label="Session ID" inputMode="numeric" value={filters.sessionId} onChange={(value) => updateFilter("sessionId", value)} placeholder="Session ID" />
              </div>
              {filterError ? <p className="text-small text-danger" role="alert">{filterError}</p> : null}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                <div className="relative min-w-[240px] max-w-[360px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subdued" aria-hidden="true" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search loaded reason, entry ID, entity or actor…" className="h-9 w-full rounded-control border border-border bg-background pl-9 pr-3 text-small outline-none placeholder:text-subdued focus:border-primary focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="submit" disabled={loading} className="inline-flex h-9 items-center rounded-control bg-primary px-4 text-small font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60">
                    {loading ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" /> : null} Apply filters
                  </button>
                  <button type="button" onClick={clearFilters} disabled={loading} className="inline-flex h-9 items-center rounded-control border border-border px-3 text-small font-semibold text-subdued transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60">
                    Clear filters
                  </button>
                </div>
              </div>
            </form>

            {error ? <Callout tone="danger" title="Audit trail unavailable"><p>{error}</p><button type="button" onClick={() => void loadRecords(appliedFilters)} className="mt-2 text-small font-semibold underline">Try again</button></Callout> : null}

            <div className="overflow-hidden rounded-panel border border-border bg-surface">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <p className="text-small font-semibold">Log <span className="font-normal text-subdued">{loading ? "loading…" : `${visibleRecords.length} entries`}</span></p>
                <p className="hidden font-mono text-micro text-subdued sm:block">newest first</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-small px-8">
                  <thead><tr className="border-b border-border text-left text-micro uppercase tracking-overline text-subdued">
                    <th className="py-2 pl-6 pr-8 font-medium">Timestamp</th><th className="px-5 py-2 font-medium">Actor</th><th className="px-4 py-2 font-medium">Action</th><th className="px-4 py-2 font-medium">Result</th><th className="px-4 py-2 font-medium">Entity</th><th className="py-2 pl-4 pr-6 font-medium">Details</th>
                  </tr></thead>
                  <tbody>
                    {loading ? <tr><td colSpan={6} className="p-10 text-center text-subdued"><span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading audit records…</span></td></tr>
                      : visibleRecords.length === 0 ? <tr><td colSpan={6} className="p-10 text-center text-subdued">{Object.keys(appliedFilters).length > 0 || query ? "No records match the selected filters." : "No audit records are available."}</td></tr>
                        : visibleRecords.map((record, index) => <AuditRow key={`${String(record.id)}-${index}`} record={record} onView={() => setSelected(record)} />)}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
      {selected ? <AuditDetails record={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function AuditRow({ record, onView }: { record: AuditRecord; onView: () => void }) {
  const presentation = actionPresentation(record);
  const Icon = presentation.Icon;
  const timestamp = formatTimestamp(record.timestamp);
  const exception = isException(record);
  return (
    <tr className={`border-b border-border/70 align-top last:border-0 hover:bg-sunken/40 ${exception ? "border-l-2 border-l-rejected-fg" : "border-l-2 border-l-transparent"}`}>
      <td className="whitespace-nowrap py-3 pl-6 pr-8"><p className="font-mono text-small tabular-nums text-text">{timestamp.date}</p><p className="font-mono text-micro tabular-nums text-subdued">{timestamp.time}</p><p className="font-mono text-micro text-subdued/70">#{display(record.id)}</p></td>
      <td className="px-5 py-3"><p className="font-medium text-text">{display(record.actor_id)}</p><p className="mt-0.5 flex items-center gap-1.5"><span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-subdued">{display(record.actor_role)}</span></p></td>
      <td className="max-w-[300px] break-words px-4 py-3 text-text">{display(record.action)}</td>
      <td className="max-w-[140px] px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-micro font-semibold ${TONE_CHIP[presentation.tone]}`}><Icon className="size-3.5 shrink-0" aria-hidden="true" />{display(record.result)}</span></td>
      <td className="px-4 py-3"><span className="inline-flex items-start gap-1.5 text-subdued"><Database className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><span><span className="text-text">{display(record.entity)}</span><br /><Identifier className="text-micro text-subdued">{display(record.entity_id)}</Identifier></span></span></td>
      <td className="py-3 pl-4 pr-6"><button type="button" onClick={onView} className="inline-flex items-center gap-1.5 font-semibold text-primary hover:text-primary-dark"><Eye className="size-3.5" aria-hidden="true" /> View</button></td>
    </tr>
  );
}

function AuditDetails({ record, onClose }: { record: AuditRecord; onClose: () => void }) {
  const timestamp = formatTimestamp(record.timestamp);
  return (
    <Dialog title={`Audit record #${display(record.id)}`} size="xl" onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="User"><span className="inline-flex items-center gap-1.5"><UserIcon className="size-4 text-subdued" aria-hidden="true" />{display(record.actor_id)}</span></Detail>
        <Detail label="Role">{display(record.actor_role)}</Detail><Detail label="Date & time">{timestamp.date} · {timestamp.time}</Detail>
        <Detail label="Action">{display(record.action)}</Detail><Detail label="Result">{display(record.result)}</Detail><Detail label="Entity">{display(record.entity)}</Detail>
        <Detail label="Entity ID">{display(record.entity_id)}</Detail><Detail label="IP address">{display(record.ip_address)}</Detail><Detail label="Session ID"><span className="inline-flex items-center gap-1.5"><KeyRound className="size-4 text-subdued" aria-hidden="true" />{display(record.session_id)}</span></Detail>
      </div>
      <div className="mt-5"><Detail label="Reason">{display(record.reason)}</Detail></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <JsonDetail label="Previous data" value={record.before} /><JsonDetail label="Updated data" value={record.after} />
      </div>
    </Dialog>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><p className="text-micro font-medium uppercase tracking-overline text-subdued">{label}</p><div className="mt-1 break-words text-small text-text">{children}</div></div>;
}

function JsonDetail({ label, value }: { label: string; value: unknown }) {
  return <div className="min-w-0"><p className="mb-1 text-micro font-medium uppercase tracking-overline text-subdued">{label}</p><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-control border border-border bg-background p-3 font-mono text-micro text-text">{jsonText(value)}</pre></div>;
}

function FilterInput({ label, onChange, ...props }: { label: string; onChange: (value: string) => void; value: string; type?: string; inputMode?: "numeric"; placeholder?: string }) {
  return <label className="block min-w-0"><span className="mb-1 block text-micro font-medium uppercase tracking-overline text-subdued">{label}</span><input {...props} onChange={(event) => onChange(event.target.value)} className="h-9 w-full min-w-0 rounded-control border border-border bg-background px-3 text-small outline-none placeholder:text-subdued focus:border-primary focus:ring-2 focus:ring-primary/30" /></label>;
}

function ReportButton({ icon: Icon, label, title, onClick }: { icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>; label: string; title: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} title={title} className="inline-flex h-9 items-center gap-1.5 rounded-control bg-accent-soft border border-primary/25 px-3 text-small font-semibold text-primary-dark transition hover:bg-primary hover:text-white"><Icon className="size-4" aria-hidden="true" />{label}</button>;
}
