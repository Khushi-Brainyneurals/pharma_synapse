import {
  ArrowLeftRight,
  CircleCheck,
  CircleX,
  Database,
  Download,
  Eye,
  FilePlus2,
  GitBranch,
  Globe,
  KeyRound,
  Lock,
  LogIn,
  Printer,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  User as UserIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Identifier } from "../../../shared/ui/Identifier";
import { StatusPill } from "../../review/components/StatusPill";
import { useAuthStore } from "../../auth/state/auth.store";
import { AppHeader } from "../../new-document/components/AppHeader";
import { AppSidebar } from "../../new-document/components/AppSidebar";

/**
 * Audit trail (reference screen #8) — the append-only, tamper-evident record of every
 * consequential action: who did what, to which entity, the before→after, and why.
 *
 * Design rule the screen encodes: review by exception. Every event chip carries colour +
 * icon + text; a sensitive row also carries a coloured left rule; "Exceptions only"
 * filters to them in one click. Records are never edited or deleted.
 *
 * There is no audit-event store in the backend yet, so the log is representative — the
 * columns, event taxonomy and exception rules match the design and bind to a real,
 * signed event feed when one lands.
 */

type Tone = "neutral" | "danger" | "warn" | "success" | "info";

const ACTIONS: Record<string, { label: string; tone: Tone; icon: React.ComponentType<{ className?: string }> }> = {
  created: { label: "Document created", tone: "neutral", icon: FilePlus2 },
  submitted: { label: "Submitted for review", tone: "info", icon: Send },
  approved: { label: "Approved", tone: "success", icon: CircleCheck },
  rejected: { label: "Review rejected", tone: "danger", icon: CircleX },
  reassigned: { label: "Document reassigned", tone: "warn", icon: ArrowLeftRight },
  version: { label: "Version created", tone: "neutral", icon: GitBranch },
  masterdata: { label: "Master data changed", tone: "warn", icon: Database },
  signin: { label: "Signed in", tone: "neutral", icon: LogIn },
  failed: { label: "Failed sign-in · locked", tone: "warn", icon: Lock },
  pwreveal: { label: "Password revealed", tone: "warn", icon: Eye },
  exported: { label: "Audit exported", tone: "neutral", icon: Download },
};

const TONE_CHIP: Record<Tone, string> = {
  neutral: "border border-border bg-surface text-subdued",
  danger: "bg-rejected-bg text-rejected-fg",
  warn: "bg-draft-bg text-draft-fg",
  success: "bg-approved-bg text-approved-fg",
  info: "bg-inreview-bg text-inreview-fg",
};

type Entity =
  | { type: "doc"; ref: string; version: string; state: string }
  | { type: "masterdata"; label: string }
  | { type: "session" }
  | { type: "employee"; name: string };

interface AuditEvent {
  id: string;
  date: string;
  time: string;
  user: string;
  userId: string;
  role: string;
  roleUnverified?: boolean;
  action: keyof typeof ACTIONS;
  entity: Entity;
  change?: string;
  reason: string;
  exception?: "danger" | "warn";
}

const EVENTS: AuditEvent[] = [
  { id: "#04923", date: "30 Jun 2026", time: "14:38:22", user: "System", userId: "U-SYS", role: "System", action: "created", entity: { type: "doc", ref: "BMR-TAB-0157", version: "v1.3", state: "draft" }, reason: "Auto-created from re-issue after rejection" },
  { id: "#04922", date: "30 Jun 2026", time: "14:38:21", user: "Aarti Sharma", userId: "U-0427", role: "QA Reviewer", action: "rejected", entity: { type: "doc", ref: "BMR-TAB-0157", version: "v1.2", state: "rejected" }, change: "In review → Rejected", reason: "Compression force limit outside master formula", exception: "danger" },
  { id: "#04921", date: "30 Jun 2026", time: "14:31:55", user: "Aarti Sharma", userId: "U-0427", role: "QA Reviewer", action: "signin", entity: { type: "session" }, reason: "Password verified" },
  { id: "#04920", date: "30 Jun 2026", time: "13:12:08", user: "Meera Iyer", userId: "U-0611", role: "Approver", action: "masterdata", entity: { type: "masterdata", label: "Tablet hardness spec" }, change: "6.0 kp → 6.5 kp", reason: "Minimum hardness raised per periodic review", exception: "warn" },
  { id: "#04919", date: "30 Jun 2026", time: "12:47:33", user: "Rajesh Kumar", userId: "U-0208", role: "Author", action: "pwreveal", entity: { type: "session" }, reason: "Credential field unmasked during config", exception: "warn" },
  { id: "#04918", date: "30 Jun 2026", time: "11:59:41", user: "Rajesh Kumar", userId: "U-0208", role: "Author", action: "masterdata", entity: { type: "masterdata", label: "Dissolution apparatus DA-04" }, change: "Paddle 50 rpm → 75 rpm", reason: "Method update per revised STP", exception: "warn" },
  { id: "#04917", date: "30 Jun 2026", time: "11:58:02", user: "Rajesh Kumar", userId: "U-0208", role: "Author", action: "signin", entity: { type: "session" }, reason: "Password verified" },
  { id: "#04916", date: "30 Jun 2026", time: "10:22:17", user: "jdoe", userId: "unverified", role: "No session", roleUnverified: true, action: "failed", entity: { type: "employee", name: "jdoe" }, reason: "3 failed attempts — account locked", exception: "danger" },
  { id: "#04915", date: "30 Jun 2026", time: "09:47:50", user: "Meera Iyer", userId: "U-0611", role: "Approver", action: "reassigned", entity: { type: "doc", ref: "BMR-TAB-0161", version: "v2", state: "in_review" }, change: "U-0427 → U-0356", reason: "Reviewer on leave — reassigned", exception: "warn" },
  { id: "#04914", date: "30 Jun 2026", time: "09:31:04", user: "Aarti Sharma", userId: "U-0427", role: "QA Reviewer", action: "approved", entity: { type: "doc", ref: "BMR-TAB-0149", version: "v3", state: "approved" }, change: "In review → Approved", reason: "Meets validated ranges" },
  { id: "#04913", date: "30 Jun 2026", time: "08:15:22", user: "Rajesh Kumar", userId: "U-0208", role: "Author", action: "created", entity: { type: "doc", ref: "BMR-TAB-0161", version: "v1", state: "draft" }, reason: "New BMR — Metformin HCl 500 mg" },
  { id: "#04912", date: "29 Jun 2026", time: "17:40:11", user: "Sanjay Gupta", userId: "U-0356", role: "PR Reviewer", action: "submitted", entity: { type: "doc", ref: "BMR-TAB-0149", version: "v3", state: "in_review" }, change: "Generated → In review", reason: "Sent for QA + PR sign-off" },
  { id: "#04911", date: "29 Jun 2026", time: "16:03:48", user: "S. Nair", userId: "U-0731", role: "Author", action: "version", entity: { type: "doc", ref: "BMR-TAB-0149", version: "v3", state: "draft" }, reason: "Re-issued after periodic review" },
  { id: "#04910", date: "29 Jun 2026", time: "09:05:12", user: "K. Rao", userId: "U-0088", role: "Approver", action: "exported", entity: { type: "session" }, reason: "Quarterly audit export — 01 Apr–30 Jun" },
];

/** Plain-text description of an event's entity, for the printable report. */
function entityText(e: AuditEvent): string {
  if (e.entity.type === "doc") return `${e.entity.ref} · ${e.entity.version} · ${e.entity.state}`;
  if (e.entity.type === "masterdata") return `Master data · ${e.entity.label}`;
  if (e.entity.type === "employee") return `Employee · ${e.entity.name}`;
  return "Session";
}

/**
 * Build a self-contained, printable HTML report of the given events and open it for
 * print / Save-as-PDF. The header records WHO generated it and WHEN (the audit-export
 * requirement), and every row keeps its own who/when. No external PDF dependency — the
 * browser's print dialog produces the PDF.
 */
function openAuditReport(events: AuditEvent[], generatedBy: { name: string; id: string; role: string }) {
  const now = new Date();
  const when = now.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const esc = (s: unknown) =>
    String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] ?? c));

  const rows = events
    .map(
      (e) => `<tr>
        <td>${esc(e.date)} ${esc(e.time)}<div class="dim">${esc(e.id)}</div></td>
        <td>${esc(e.user)}<div class="dim">${esc(e.userId)} · ${esc(e.role)}</div></td>
        <td>${esc(ACTIONS[e.action]?.label ?? e.action)}</td>
        <td>${esc(entityText(e))}</td>
        <td>${esc(e.change ?? "—")}</td>
        <td>${esc(e.reason)}</td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8" />
    <title>Audit Trail — ${esc(when)}</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;font-size:11px}
      h1{font-size:18px;margin:0 0 6px}
      .meta{color:#555;margin:0 0 3px}
      .meta b{color:#111}
      table{width:100%;border-collapse:collapse;margin-top:14px}
      th,td{border:1px solid #999;padding:5px 7px;text-align:left;vertical-align:top}
      th{background:#eee;font-size:9.5px;text-transform:uppercase;letter-spacing:.04em}
      .dim{color:#777;font-size:9.5px;margin-top:1px}
      .foot{margin-top:16px;color:#777;font-size:9.5px}
      @media print{body{margin:10mm}}
    </style></head><body>
    <h1>Audit Trail</h1>
    <p class="meta">Generated by <b>${esc(generatedBy.name)}</b> (${esc(generatedBy.id)}${generatedBy.role ? ` · ${esc(generatedBy.role)}` : ""}) on <b>${esc(when)}</b></p>
    <p class="meta">${events.length} record(s) · Append-only — records are never edited or deleted.</p>
    <table><thead><tr>
      <th>Timestamp</th><th>User</th><th>Action</th><th>Entity</th><th>Change (old &rarr; new)</th><th>Reason</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <div class="foot">PharmaDoc AI · Audit trail export · ${esc(when)}</div>
    <script>window.onload=function(){window.focus();window.print();};<\/script>
    </body></html>`;

  const w = window.open("", "_blank", "width=1024,height=800");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export function AuditTrailPage() {
  const user = useAuthStore((state) => state.user);
  // Who is generating the export — printed in the report header (the audit-export requirement).
  const reportBy = {
    name: user?.displayName ?? user?.username ?? user?.id ?? "—",
    id: user?.id ?? "",
    role: user?.role ?? "",
  };
  const [exceptionsOnly, setExceptionsOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  const users = useMemo(() => Array.from(new Set(EVENTS.map((e) => e.user))), []);
  const roles = useMemo(() => Array.from(new Set(EVENTS.map((e) => e.role))), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EVENTS.filter((e) => (exceptionsOnly ? Boolean(e.exception) : true))
      .filter((e) => (actionFilter === "all" ? true : e.action === actionFilter))
      .filter((e) => (userFilter === "all" ? true : e.user === userFilter))
      .filter((e) => (roleFilter === "all" ? true : e.role === roleFilter))
      .filter((e) => {
        if (!q) return true;
        const entityText =
          e.entity.type === "doc"
            ? `${e.entity.ref} ${e.entity.version}`
            : e.entity.type === "masterdata"
              ? e.entity.label
              : e.entity.type === "employee"
                ? e.entity.name
                : "session";
        return (
          e.reason.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q) ||
          e.user.toLowerCase().includes(q) ||
          entityText.toLowerCase().includes(q)
        );
      });
  }, [exceptionsOnly, actionFilter, userFilter, roleFilter, query]);

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader user={user} unit={user?.unitId ? { id: user.unitId } : null} title="Audit trail" />

      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />

        <main className="min-w-0 min-h-0 p-4 lg:p-6 lg:h-full lg:overflow-y-auto">
          <div className="mx-auto max-w-6xl space-y-4">
            {/* Header */}
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-h1 font-semibold">Audit trail</h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-subdued">
                  <span className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-2.5 py-0.5">
                    <Lock className="size-3.5" aria-hidden="true" />
                    Append-only · records are never edited or deleted
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Globe className="size-3.5" aria-hidden="true" />
                    Times shown in instance timezone · Asia/Kolkata (IST, UTC+05:30)
                  </span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-pill border border-approved-fg/30 bg-approved-bg px-3 py-1 text-small font-semibold text-approved-fg">
                <ShieldCheck className="size-4" aria-hidden="true" />
                Integrity: verified
              </span>
            </header>

            {/* Filters */}
            <div className="space-y-3 rounded-panel border border-border bg-surface p-4">
              <div className="flex flex-wrap items-end gap-3">
                <button
                  type="button"
                  onClick={() => setExceptionsOnly((v) => !v)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-control border px-3 text-small font-semibold transition ${
                    exceptionsOnly
                      ? "border-primary bg-accent-soft text-primary-dark"
                      : "border-border text-subdued hover:bg-muted"
                  }`}
                >
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                  Exceptions only
                </button>
                <Field label="Date range">
                  <div className="flex h-9 items-center rounded-control border border-border bg-background px-3 font-mono text-small text-text">
                    01 Jun — 30 Jun 2026
                  </div>
                </Field>
                <Field label="User">
                  <Select value={userFilter} onChange={setUserFilter} options={[{ value: "all", label: "All users" }, ...users.map((u) => ({ value: u, label: u }))]} />
                </Field>
                <Field label="Role">
                  <Select value={roleFilter} onChange={setRoleFilter} options={[{ value: "all", label: "All roles" }, ...roles.map((r) => ({ value: r, label: r }))]} />
                </Field>
                <Field label="Action type">
                  <Select
                    value={actionFilter}
                    onChange={setActionFilter}
                    options={[{ value: "all", label: "All actions" }, ...Object.entries(ACTIONS).map(([k, v]) => ({ value: k, label: v.label }))]}
                  />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[240px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subdued" aria-hidden="true" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search reason, entry ID, entity or user…"
                    className="h-9 w-full rounded-control border border-border bg-background pl-9 pr-3 text-small outline-none placeholder:text-subdued focus:border-primary focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => openAuditReport(filtered, reportBy)}
                  title="Generate a PDF of these records and save it"
                  className="inline-flex h-9 items-center gap-1.5 rounded-control border border-border px-3 text-small font-semibold text-subdued transition hover:bg-muted"
                >
                  <Download className="size-4" aria-hidden="true" />
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => openAuditReport(filtered, reportBy)}
                  title="Print these records"
                  className="inline-flex h-9 items-center gap-1.5 rounded-control border border-border px-3 text-small font-semibold text-subdued transition hover:bg-muted"
                >
                  <Printer className="size-4" aria-hidden="true" />
                  Print
                </button>
              </div>
            </div>

            {/* Log */}
            <div className="overflow-hidden rounded-panel border border-border bg-surface">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <p className="text-small font-semibold">
                  Log <span className="font-normal text-subdued">{filtered.length} entries</span>
                </p>
                <p className="hidden font-mono text-micro text-subdued sm:block">newest first</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-small">
                  <thead>
                    <tr className="border-b border-border text-left text-micro uppercase tracking-overline text-subdued">
                      <th className="px-4 py-2 font-medium">Timestamp</th>
                      <th className="px-4 py-2 font-medium">User</th>
                      <th className="px-4 py-2 font-medium">Action</th>
                      <th className="px-4 py-2 font-medium">Entity</th>
                      <th className="px-4 py-2 font-medium">Change (old → new)</th>
                      <th className="px-4 py-2 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-10 text-center text-subdued">
                          No entries match this view.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((e) => <AuditRow key={e.id} e={e} />)
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function AuditRow({ e }: { e: AuditEvent }) {
  const action = ACTIONS[e.action];
  const Icon = action.icon;
  const rule =
    e.exception === "danger"
      ? "border-l-2 border-l-rejected-fg"
      : e.exception === "warn"
        ? "border-l-2 border-l-draft-fg"
        : "border-l-2 border-l-transparent";
  return (
    <tr className={`border-b border-border/70 align-top last:border-0 hover:bg-sunken/40 ${rule}`}>
      <td className="whitespace-nowrap px-4 py-3">
        <p className="font-mono text-small tabular-nums text-text">{e.date}</p>
        <p className="font-mono text-micro tabular-nums text-subdued">{e.time}</p>
        <p className="font-mono text-micro text-subdued/70">{e.id}</p>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-text">{e.user}</p>
        <p className="mt-0.5 flex items-center gap-1.5">
          <Identifier className="text-micro text-subdued">{e.userId}</Identifier>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${e.roleUnverified ? "bg-danger-soft text-danger-ink" : "bg-muted text-subdued"}`}>
            {e.role}
          </span>
        </p>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-micro font-semibold ${TONE_CHIP[action.tone]}`}>
          <Icon className="size-3.5" aria-hidden="true" />
          {action.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <EntityCell entity={e.entity} />
      </td>
      <td className="px-4 py-3 font-mono text-micro tabular-nums text-text">{e.change ?? <span className="text-subdued">—</span>}</td>
      <td className="max-w-[240px] px-4 py-3 text-subdued">{e.reason}</td>
    </tr>
  );
}

function EntityCell({ entity }: { entity: Entity }) {
  if (entity.type === "doc") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <Identifier className="text-text">{entity.ref}</Identifier>
        <span className="font-mono text-micro text-subdued">· {entity.version}</span>
        <StatusPill status={entity.state} />
      </span>
    );
  }
  if (entity.type === "masterdata") {
    return (
      <span className="inline-flex items-center gap-1.5 text-subdued">
        <Database className="size-3.5" aria-hidden="true" />
        Master data · <span className="text-text">{entity.label}</span>
      </span>
    );
  }
  if (entity.type === "employee") {
    return (
      <span className="inline-flex items-center gap-1.5 text-subdued">
        <UserIcon className="size-3.5" aria-hidden="true" />
        Employee · <Identifier className="text-text">{entity.name}</Identifier>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-subdued">
      <KeyRound className="size-3.5" aria-hidden="true" />
      Session
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-micro font-medium uppercase tracking-overline text-subdued">{label}</p>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-control border border-border bg-background px-3 text-small outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
