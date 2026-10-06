import { AlertCircle, Copy, FileWarning, KeyRound, Loader2, Plus, Search, Unlock, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { Identifier } from "../../../shared/ui/Identifier";
import { useAuthStore } from "../../auth/state/auth.store";
import { AppHeader } from "../../new-document/components/AppHeader";
import { AppSidebar } from "../../new-document/components/AppSidebar";
import {
  disableEmployee,
  enableEmployee,
  getInFlight,
  listEmployees,
  resetEmployeePassword,
  ROLE_LABELS,
  unlockEmployee,
  type Employee,
  type InFlightDocument,
  type TempPasswordResponse,
} from "../api/employees.api";
import { AccountStatusChip } from "../components/AccountStatusChip";
import { CreateEmployeeDrawer } from "../components/CreateEmployeeDrawer";
import { StepUpModal } from "../components/StepUpModal";

type PendingAction =
  | { kind: "disable"; employee: Employee }
  | { kind: "enable"; employee: Employee }
  | { kind: "reset"; employee: Employee }
  | { kind: "unlock"; employee: Employee };

export function EmployeesPage() {
  const user = useAuthStore((state) => state.user);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [exceptionsOnly, setExceptionsOnly] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [issued, setIssued] = useState<TempPasswordResponse | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [stepUpError, setStepUpError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{
    employee: Employee;
    message: string;
    documents: InFlightDocument[];
  } | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setEmployees(await listEmployees());
      setError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not load employees."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The list already arrives exceptions-first from the server — an admin opens this
  // screen to deal with problems, not to browse.
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return employees.filter((employee) => {
      if (exceptionsOnly && employee.account_status === "active") {
        return false;
      }
      if (!needle) {
        return true;
      }

      return [employee.username, employee.name, employee.department, employee.unit_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [employees, exceptionsOnly, query]);

  const exceptionCount = employees.filter((e) => e.account_status !== "active").length;

  const runStepUp = useCallback(
    async (password: string, reason: string) => {
      if (!pending) return;

      setStepUpError(null);

      try {
        const { kind, employee } = pending;

        if (kind === "disable") {
          await disableEmployee(employee.id, reason, password);
        } else if (kind === "enable") {
          await enableEmployee(employee.id, password);
        } else if (kind === "unlock") {
          await unlockEmployee(employee.id, password);
        } else {
          setIssued(await resetEmployeePassword(employee.id, password));
        }

        setPending(null);
        await load();
      } catch (caught) {
        setStepUpError(getApiErrorMessage(caught, "That didn't work."));
      }
    },
    [load, pending],
  );

  /** Disable is refused outright in three cases — check before opening the dialog. */
  const startDisable = useCallback(async (employee: Employee) => {
    setError(null);

    if (employee.id === Number(user?.id)) {
      setBlocked({
        employee,
        message: "You cannot disable your own account.",
        documents: [],
      });
      return;
    }

    if (employee.in_flight_count > 0) {
      setBlocked({
        employee,
        message: `${employee.username} owns ${employee.in_flight_count} in-flight document(s). Reassign them before disabling this account.`,
        documents: await getInFlight(employee.id).catch(() => []),
      });
      return;
    }

    setPending({ kind: "disable", employee });
  }, [user]);

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader user={user} unit={user?.unitId ? { id: user.unitId } : null} />

      <div className="flex">
        <AppSidebar user={user} />

        <main className="min-w-0 flex-1 p-4 lg:p-6">
          <div className="mx-auto max-w-5xl space-y-5">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-h1 font-semibold tracking-tight">Employee management</h1>
                <p className="mt-1 text-small text-subdued">
                  Accounts are disabled, never deleted — their User ID stays attached to
                  every document they signed.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="inline-flex h-[36px] items-center gap-2 rounded-control bg-primary px-4 text-small font-semibold text-white transition hover:bg-primary-dark"
              >
                <Plus className="size-4" aria-hidden="true" />
                Add employee
              </button>
            </header>

            {error ? (
              <div className="flex items-start gap-2 rounded-card border border-danger/30 bg-danger-soft p-4">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                <p className="text-small text-danger">{error}</p>
              </div>
            ) : null}

            {issued ? <TempPassword issued={issued} onDismiss={() => setIssued(null)} /> : null}

            {/* Search + filter to exceptions */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subdued"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search User ID, name, department, unit"
                  className="h-[36px] w-full rounded-control border border-border-strong bg-surface pl-9 pr-3 text-small focus:border-primary focus:outline-none"
                />
              </div>

              {exceptionCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setExceptionsOnly((on) => !on)}
                  aria-pressed={exceptionsOnly}
                  className={`inline-flex h-[36px] items-center gap-1.5 rounded-pill border px-3 text-small font-medium transition ${
                    exceptionsOnly
                      ? "border-primary bg-accent-soft text-primary-dark"
                      : "border-border text-subdued hover:border-primary hover:text-primary-dark"
                  }`}
                >
                  Exceptions only
                  <span className="rounded-pill bg-sunken px-1.5 text-micro">
                    {exceptionCount}
                  </span>
                </button>
              ) : null}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center gap-2 rounded-card border border-border bg-surface p-16 text-subdued">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                <span className="text-small">Loading…</span>
              </div>
            ) : visible.length === 0 ? (
              <div className="rounded-card border border-border bg-surface p-16 text-center">
                <p className="text-small font-semibold">
                  {employees.length === 0 ? "No employees yet" : "Nothing matches"}
                </p>
              </div>
            ) : (
              <section className="overflow-hidden rounded-card border border-border bg-surface">
                <div
                  className="grid items-center gap-x-3 border-b border-border-strong px-4 text-overline font-semibold uppercase tracking-overline text-subdued"
                  style={{ gridTemplateColumns: GRID, height: "40px" }}
                >
                  <span>User ID</span>
                  <span>Role</span>
                  <span>Department</span>
                  <span>Unit</span>
                  <span>Account status</span>
                  <span className="text-right">Password age</span>
                  <span />
                </div>

                {visible.map((employee) => (
                  <div
                    key={employee.id}
                    className="grid items-center gap-x-3 border-b border-sunken px-4 py-2 last:border-0 hover:bg-sunken/50"
                    style={{ gridTemplateColumns: GRID, minHeight: "48px" }}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-small font-semibold">
                        <Identifier>{employee.username}</Identifier>
                      </p>
                      {employee.name ? (
                        <p className="truncate text-micro text-subdued">{employee.name}</p>
                      ) : null}
                    </div>

                    <span className="truncate text-small">
                      {ROLE_LABELS[employee.role] ?? employee.role}
                    </span>
                    <span className="truncate text-small text-subdued">
                      {employee.department ?? "—"}
                    </span>
                    <span className="truncate text-small text-subdued">
                      {employee.unit_id ? <Identifier>{employee.unit_id}</Identifier> : "—"}
                    </span>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <AccountStatusChip status={employee.account_status} />
                      {employee.in_flight_count > 0 ? (
                        <span
                          title={`Owns ${employee.in_flight_count} in-flight document(s) — must be reassigned before this account can be disabled`}
                          className="inline-flex items-center gap-1 rounded-pill border border-border bg-sunken px-1.5 py-0.5 text-micro font-medium text-subdued"
                        >
                          <FileWarning className="size-3" aria-hidden="true" />
                          {employee.in_flight_count} in-flight
                        </span>
                      ) : null}
                    </div>

                    <span className="text-right text-small text-subdued">
                      <Identifier>{employee.password_age_days}</Identifier> d
                    </span>

                    <div className="flex justify-end gap-1">
                      {employee.account_status === "locked" ? (
                        <RowAction
                          label="Unlock"
                          icon={Unlock}
                          onClick={() => setPending({ kind: "unlock", employee })}
                        />
                      ) : null}

                      <RowAction
                        label="Reset password"
                        icon={KeyRound}
                        onClick={() => setPending({ kind: "reset", employee })}
                      />

                      {employee.is_active ? (
                        <button
                          type="button"
                          onClick={() => void startDisable(employee)}
                          className="h-[30px] rounded-control border border-border px-2.5 text-micro font-semibold text-subdued transition hover:bg-sunken"
                        >
                          Disable
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPending({ kind: "enable", employee })}
                          className="h-[30px] rounded-control border border-border px-2.5 text-micro font-semibold text-primary-dark transition hover:bg-accent-soft"
                        >
                          Re-enable
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </section>
            )}
          </div>
        </main>
      </div>

      {isCreating ? (
        <CreateEmployeeDrawer
          onCancel={() => setIsCreating(false)}
          onCreated={async (response) => {
            setIssued(response);
            setIsCreating(false);
            await load();
          }}
        />
      ) : null}

      {pending ? (
        <StepUpModal
          action={STEP_UP_LABEL[pending.kind]}
          subject={`${pending.employee.username} · ${
            ROLE_LABELS[pending.employee.role] ?? pending.employee.role
          }`}
          reasonLabel={pending.kind === "disable" ? "Reason for disabling" : undefined}
          error={stepUpError}
          onCancel={() => {
            setPending(null);
            setStepUpError(null);
          }}
          onConfirm={runStepUp}
        />
      ) : null}

      {blocked ? (
        <BlockedDialog blocked={blocked} onClose={() => setBlocked(null)} />
      ) : null}
    </div>
  );
}

const GRID = "minmax(120px,1.2fr) 110px 110px 90px minmax(170px,1fr) 90px 210px";

const STEP_UP_LABEL: Record<PendingAction["kind"], string> = {
  disable: "disable this account",
  enable: "re-enable this account",
  reset: "reset this password",
  unlock: "unlock this account",
};

function RowAction({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof KeyRound;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex size-[30px] items-center justify-center rounded-control border border-border text-subdued transition hover:bg-sunken"
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

/**
 * The system refuses outright — no confirm is offered, only Close.
 * Offering a confirm on an action that cannot succeed just teaches people to click past
 * warnings.
 */
function BlockedDialog({
  blocked,
  onClose,
}: {
  blocked: { employee: Employee; message: string; documents: InFlightDocument[] };
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--scrim)" }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-modal border border-border bg-surface shadow-modal">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-h3 font-semibold">Disable blocked</h2>
          <p className="mt-1 text-small text-subdued">
            <Identifier>{blocked.employee.username}</Identifier>
          </p>
        </header>

        <div className="px-5 py-4">
          <p className="text-small">{blocked.message}</p>

          {blocked.documents.length > 0 ? (
            <ul className="mt-3 space-y-1.5 rounded-control border border-border bg-sunken p-3">
              {blocked.documents.slice(0, 6).map((document) => (
                <li key={document.document_id} className="text-small">
                  <Identifier>
                    {document.bmr_number ?? document.document_id.slice(0, 8)}
                  </Identifier>
                  <span className="ml-2 text-subdued">{document.status}</span>
                </li>
              ))}
              {blocked.documents.length > 6 ? (
                <li className="text-micro text-subdued">
                  + {blocked.documents.length - 6} more
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>

        <footer className="flex justify-end border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-[34px] rounded-control border border-border px-3.5 text-small font-semibold transition hover:bg-sunken"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

/** Shown ONCE. Never stored in plaintext, never retrievable again. */
function TempPassword({
  issued,
  onDismiss,
}: {
  issued: TempPasswordResponse;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-card border border-primary/30 bg-accent-soft p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-small font-semibold text-primary-dark">
            Temporary password issued for{" "}
            <Identifier>{issued.user.username}</Identifier>
          </p>
          <p className="mt-1 text-small text-subdued">
            Give this to them now — it cannot be shown again. They must set their own
            password at first sign-in.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="rounded-control border border-border bg-surface px-3 py-1.5 font-mono text-small">
              {issued.temporary_password}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(issued.temporary_password);
                setCopied(true);
              }}
              className="inline-flex h-[34px] items-center gap-1.5 rounded-control border border-border bg-surface px-3 text-small font-semibold transition hover:bg-sunken"
            >
              <Copy className="size-4" aria-hidden="true" />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-sm p-1 text-subdued transition hover:bg-surface"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
