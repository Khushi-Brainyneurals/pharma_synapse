import { AlertCircle, Check, Clock, Loader2, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { useAuthStore } from "../../auth/state/auth.store";
import { AppHeader } from "../../new-document/components/AppHeader";
import { AppSidebar } from "../../new-document/components/AppSidebar";
import {
  addMasterRows,
  approveChangeRequest,
  listChangeRequests,
  listMasterRows,
  rejectChangeRequest,
  type ChangeRequestItem,
  type MasterKind,
  type MasterRowsList,
} from "../api/masterDataAdmin";

const TABS: { key: MasterKind; label: string }[] = [
  { key: "equipments", label: "Equipment" },
  { key: "instruments", label: "Instruments" },
];

export function MasterDataPage() {
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState<MasterKind>("equipments");
  const [data, setData] = useState<MasterRowsList | null>(null);
  const [crs, setCrs] = useState<ChangeRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await listMasterRows(tab);
      setData(list);
      setCrs(list.can_edit ? await listChangeRequests("pending").catch(() => []) : []);
      setError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not load master data."));
    } finally {
      setIsLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitRow = useCallback(
    async (row: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        const result = await addMasterRows(tab, [row]);
        setNotice(
          result.committed
            ? "Added to master data."
            : `Sent for approval — change request #${result.change_request_id}.`,
        );
        await load();
      } catch (caught) {
        setError(getApiErrorMessage(caught, "Could not save the row."));
      } finally {
        setBusy(false);
      }
    },
    [tab, load],
  );

  const decide = useCallback(
    async (id: number, approve: boolean, reason?: string) => {
      setBusy(true);
      try {
        if (approve) await approveChangeRequest(id);
        else await rejectChangeRequest(id, reason ?? "");
        await load();
      } catch (caught) {
        setError(getApiErrorMessage(caught, "Could not decide the change request."));
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader user={user} unit={user?.unitId ? { id: user.unitId } : null} />
      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />
        <main className="min-w-0 min-h-0 p-4 lg:p-6 lg:h-full lg:overflow-y-auto">
          <div className="mx-auto max-w-4xl space-y-5">
            <header className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-h1 font-semibold">Master data</h1>
                <p className="mt-1 max-w-xl text-small text-subdued">
                  Equipment and instruments the system offers on the Stage-input screen.
                  {data?.commits_directly
                    ? " Your edits commit directly and you approve others' proposals."
                    : data?.can_edit
                      ? " Your edits are proposed and take effect once Approved By approves them."
                      : " Read-only — only Reviewer (QA) and Approved By may edit."}
                </p>
              </div>
            </header>

            {error ? (
              <div className="flex items-start gap-2 rounded-panel border border-danger/30 bg-danger-soft p-4">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                <p className="text-small text-danger">{error}</p>
              </div>
            ) : null}
            {notice ? (
              <div className="rounded-panel border border-primary/30 bg-accent-soft p-3 text-small text-primary-dark">
                {notice}
              </div>
            ) : null}

            <div className="inline-flex rounded-pill border border-border bg-sunken p-0.5">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setTab(t.key);
                    setNotice(null);
                  }}
                  className={`rounded-pill px-5 py-1.5 text-small font-semibold transition ${
                    tab === t.key ? "bg-primary text-white shadow-sm" : "text-subdued"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {isLoading || !data ? (
              <div className="flex items-center justify-center gap-2 rounded-panel border border-border bg-surface p-16 text-subdued">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                <span className="text-small">Loading…</span>
              </div>
            ) : (
              <>
                {data.can_edit ? (
                  <AddRowForm kind={tab} busy={busy} onSubmit={submitRow} />
                ) : null}

                {crs.length > 0 ? (
                  <section className="overflow-hidden rounded-card border border-draft-fg/30 bg-draft-bg">
                    <div className="border-b border-draft-fg/20 px-5 py-3 text-small font-semibold text-draft-fg">
                      Pending change requests · {crs.length}
                    </div>
                    <ul className="divide-y divide-draft-fg/15">
                      {crs.map((cr) => (
                        <ChangeRequestRow
                          key={cr.id}
                          cr={cr}
                          canDecide={data.commits_directly}
                          busy={busy}
                          onApprove={() => void decide(cr.id, true)}
                          onReject={(reason) => void decide(cr.id, false, reason)}
                        />
                      ))}
                    </ul>
                  </section>
                ) : null}

                <section className="overflow-hidden rounded-card border border-border bg-surface">
                  <div className="border-b border-border px-5 py-3 text-small font-semibold">
                    {tab === "equipments" ? "Equipment" : "Instruments"} · {data.rows.length}
                  </div>
                  <ul className="divide-y divide-sunken">
                    {data.rows.map((r) => (
                      <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-small font-semibold">
                            {String(r.row.name ?? "—")}
                          </p>
                          <p className="truncate text-micro text-subdued">
                            {rowSummary(tab, r.row)}
                          </p>
                        </div>
                        {r.created_by === "seed" ? (
                          <span className="rounded-sm bg-sunken px-2 py-0.5 text-micro text-subdued">
                            master
                          </span>
                        ) : (
                          <span className="rounded-sm bg-accent-soft px-2 py-0.5 text-micro text-primary-dark">
                            added
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function rowSummary(kind: MasterKind, row: Record<string, unknown>): string {
  if (kind === "equipments") {
    const stages = Array.isArray(row.stages) ? row.stages.length : 0;
    return [row.machine_id, row.capacity, `${stages} stage${stages === 1 ? "" : "s"}`]
      .filter(Boolean)
      .join(" · ");
  }
  const units = Array.isArray(row.instruments) ? row.instruments.length : 0;
  return `${units} unit${units === 1 ? "" : "s"}`;
}

function AddRowForm({
  kind,
  busy,
  onSubmit,
}: {
  kind: MasterKind;
  busy: boolean;
  onSubmit: (row: Record<string, unknown>) => void;
}) {
  const [f, setF] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setF((cur) => ({ ...cur, [k]: v }));

  useEffect(() => setF({}), [kind]);

  const fields =
    kind === "equipments"
      ? [
          ["name", "Equipment name", true],
          ["machine_id", "Equipment ID", true],
          ["capacity", "Capacity", false],
          ["working_capacity", "Working capacity", false],
        ]
      : [
          ["name", "Instrument name", true],
          ["instrument_id", "Instrument ID", true],
          ["location", "Location", false],
          ["stage", "Processing stage", false],
        ];

  const valid = kind === "equipments" ? f.name && f.machine_id : f.name && f.instrument_id;

  const submit = () => {
    if (!valid) return;
    const row =
      kind === "equipments"
        ? {
            name: f.name.trim(),
            machine_id: f.machine_id.trim(),
            capacity: (f.capacity ?? "").trim() || "N/A",
            working_capacity: (f.working_capacity ?? "").trim() || "N/A",
            stages: [],
          }
        : {
            name: f.name.trim(),
            instruments: [
              {
                instrument_id: f.instrument_id.trim(),
                location: (f.location ?? "").trim(),
                stages: (f.stage ?? "").trim() ? [f.stage.trim()] : [],
              },
            ],
          };
    onSubmit(row);
    setF({});
  };

  return (
    <section className="rounded-card border border-border bg-surface p-5">
      <h2 className="mb-3 text-micro font-bold uppercase tracking-wide text-subdued">
        Add {kind === "equipments" ? "equipment" : "instrument"}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(([key, label, required]) => (
          <div key={key as string} className="flex flex-col gap-1.5">
            <label className="text-micro font-semibold text-subdued">
              {label as string}
              {required ? <span className="text-danger"> *</span> : null}
            </label>
            <input
              type="text"
              value={f[key as string] ?? ""}
              onChange={(e) => set(key as string, e.target.value)}
              className="h-[38px] rounded-control border border-border-strong bg-surface px-3 text-small focus:border-primary focus:outline-none focus:ring-2 focus:ring-accent-soft"
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={!valid || busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-control bg-primary px-4 text-small font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-border-strong"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          Add
        </button>
      </div>
    </section>
  );
}

function ChangeRequestRow({
  cr,
  canDecide,
  busy,
  onApprove,
  onReject,
}: {
  cr: ChangeRequestItem;
  canDecide: boolean;
  busy: boolean;
  onApprove: () => void;
  onReject: (reason: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const names = cr.payload.rows.map((r) => String(r.name ?? "?")).join(", ");

  return (
    <li className="px-5 py-3">
      <div className="flex items-center gap-3">
        <Clock className="size-4 shrink-0 text-draft-fg" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-small font-semibold text-draft-fg">
            Add {cr.target} · {names}
          </p>
          <p className="text-micro text-draft-fg/80">
            Proposed by {cr.requested_by} · #{cr.id}
          </p>
        </div>
        {canDecide && !rejecting ? (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onApprove}
              className="inline-flex h-8 items-center gap-1 rounded-control bg-primary px-3 text-small font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
            >
              <Check className="size-4" aria-hidden="true" />
              Approve
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setRejecting(true)}
              className="inline-flex h-8 items-center gap-1 rounded-control border border-border-strong bg-surface px-3 text-small font-semibold transition hover:bg-sunken"
            >
              <X className="size-4" aria-hidden="true" />
              Reject
            </button>
          </div>
        ) : null}
      </div>
      {rejecting ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={reason}
            placeholder="Reason (required)"
            onChange={(e) => setReason(e.target.value)}
            className="h-8 flex-1 rounded-control border border-border-strong bg-surface px-3 text-small focus:border-primary focus:outline-none focus:ring-2 focus:ring-accent-soft"
          />
          <button
            type="button"
            disabled={busy || !reason.trim()}
            onClick={() => onReject(reason.trim())}
            className="inline-flex h-8 items-center rounded-control bg-danger px-3 text-small font-semibold text-white transition disabled:opacity-60"
          >
            Confirm reject
          </button>
          <button
            type="button"
            onClick={() => setRejecting(false)}
            className="inline-flex h-8 items-center rounded-control px-3 text-small font-semibold text-subdued transition hover:bg-sunken"
          >
            Cancel
          </button>
        </div>
      ) : null}
    </li>
  );
}
