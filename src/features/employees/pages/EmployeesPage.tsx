import { AlertCircle, Edit3, KeyRound, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { Identifier } from "../../../shared/ui/Identifier";
import { useAuthStore } from "../../auth/state/auth.store";
import { AppHeader } from "../../../app/layout/AppHeader";
import { AppSidebar } from "../../../app/layout/AppSidebar";
import { listEmployees, type Employee } from "../api/employees.api";
import { ChangePasswordDialog } from "../components/ChangePasswordDialog";
import { DeleteEmployeeDialog } from "../components/DeleteEmployeeDialog";
import { EmployeeFormDialog } from "../components/EmployeeFormDialog";

type DialogState =
  | { kind: "add" }
  | { kind: "edit"; employee: Employee }
  | { kind: "delete"; employee: Employee }
  | { kind: "password"; employee: Employee }
  | null;

export function EmployeesPage() {
  const user = useAuthStore((state) => state.user);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);

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

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const statuses = useMemo(
    () => [...new Set(employees.map((employee) => employee.status).filter(Boolean))].sort(),
    [employees],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return employees.filter((employee) => {
      if (statusFilter && employee.status !== statusFilter) return false;
      if (!needle) return true;
      return [
        employee.user_id,
        employee.roles.join(" "),
        employee.department,
        employee.unit,
        employee.address,
        employee.status,
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [employees, query, statusFilter]);

  async function mutationSucceeded(message: string) {
    setDialog(null);
    setNotice(message);
    await load();
  }

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader
        user={user}
        unit={user?.unitId ? { id: user.unitId } : null}
        title="Employee management"
      />

      <div className="lg:grid lg:h-[calc(100vh-var(--topbar-h))] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] lg:overflow-hidden">
        <AppSidebar user={user} />

        <main className="min-h-0 min-w-0 p-4 lg:h-full lg:overflow-y-auto lg:p-6">
          <div className="mx-auto max-w-7xl space-y-5">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-h1 font-semibold tracking-tight">Employee management</h1>
                <p className="mt-1 text-small text-subdued">
                  Add employees and manage their account details and passwords.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDialog({ kind: "add" })}
                className="inline-flex h-9 items-center gap-2 rounded-control bg-primary px-4 text-small font-semibold text-white transition hover:bg-primary-dark"
              >
                <Plus className="size-4" aria-hidden="true" />
                Add employee
              </button>
            </header>

            {error ? (
              <div className="flex items-start justify-between gap-3 rounded-card border border-danger/30 bg-danger-soft p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                  <p className="text-small text-danger">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="text-small font-semibold text-danger underline"
                >
                  Retry
                </button>
              </div>
            ) : null}

            {notice ? (
              <div className="rounded-card border border-primary/30 bg-accent-soft p-3 text-small font-medium text-primary-dark" role="status">
                {notice}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[230px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subdued" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search employees"
                  className="h-9 w-[260px] rounded-control border border-border-strong bg-surface pl-9 pr-3 text-small focus:border-primary focus:outline-none"
                />
              </div>
              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-9 rounded-control border border-border-strong bg-surface px-3 text-small focus:border-primary focus:outline-none"
              >
                <option value="">All statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center gap-2 rounded-card border border-border bg-surface p-16 text-subdued">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                <span className="text-small">Loading employees…</span>
              </div>
            ) : visible.length === 0 ? (
              <div className="rounded-card border border-border bg-surface p-16 text-center">
                <p className="text-small font-semibold">
                  {employees.length === 0 ? "No employees yet" : "No employees match these filters"}
                </p>
              </div>
            ) : (
              <section className="overflow-x-auto rounded-card border border-border bg-surface">
                <table className="w-full min-w-[1050px] border-collapse text-left">
                  <thead className="border-b border-border-strong bg-sunken/60 text-overline font-semibold uppercase tracking-overline text-subdued">
                    <tr>
                      <Header>User ID</Header>
                      <Header>Roles</Header>
                      <Header>Department</Header>
                      <Header>Unit</Header>
                      <Header>Address</Header>
                      <Header>Status</Header>
                      <Header>Created at</Header>
                      <Header><span className="sr-only">Actions</span></Header>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((employee) => (
                      <tr key={employee.user_id} className="border-b border-sunken last:border-0 hover:bg-sunken/50">
                        <Cell><Identifier>{employee.user_id}</Identifier></Cell>
                        <Cell>
                          <div className="flex flex-wrap gap-1">
                            {employee.roles.map((role) => (
                              <span key={role} className="rounded-pill border border-border bg-sunken px-2 py-0.5 text-micro font-medium">{role}</span>
                            ))}
                          </div>
                        </Cell>
                        <Cell>{employee.department || "—"}</Cell>
                        <Cell>{employee.unit || "—"}</Cell>
                        <Cell>
                          <span title={`Address ID: ${employee.address_id}`}>{employee.address || "—"}</span>
                        </Cell>
                        <Cell>
                          <span className="rounded-pill border border-border bg-sunken px-2 py-0.5 text-micro font-semibold">{employee.status || "—"}</span>
                        </Cell>
                        <Cell>{formatDate(employee.created_at)}</Cell>
                        <Cell>
                          <div className="flex justify-end gap-1">
                            <RowAction label="Edit employee" icon={Edit3} onClick={() => setDialog({ kind: "edit", employee })} />
                            <RowAction label="Change password" icon={KeyRound} onClick={() => setDialog({ kind: "password", employee })} />
                            <RowAction label="Delete employee" icon={Trash2} danger onClick={() => setDialog({ kind: "delete", employee })} />
                          </div>
                        </Cell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </div>
        </main>
      </div>

      {dialog?.kind === "add" ? (
        <EmployeeFormDialog onClose={() => setDialog(null)} onSaved={mutationSucceeded} />
      ) : null}
      {dialog?.kind === "edit" ? (
        <EmployeeFormDialog employee={dialog.employee} onClose={() => setDialog(null)} onSaved={mutationSucceeded} />
      ) : null}
      {dialog?.kind === "delete" ? (
        <DeleteEmployeeDialog
          employee={dialog.employee}
          onClose={() => setDialog(null)}
          onDeleted={() => mutationSucceeded(`Employee ${dialog.employee.user_id} deleted.`)}
        />
      ) : null}
      {dialog?.kind === "password" ? (
        <ChangePasswordDialog
          employeeId={dialog.employee.user_id}
          employeeLabel={dialog.employee.user_id}
          isAdminAction
          onClose={() => setDialog(null)}
          onChanged={() => {
            const id = dialog.employee.user_id;
            setDialog(null);
            setNotice(`Password changed for ${id}.`);
          }}
        />
      ) : null}
    </div>
  );
}

function Header({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-3">{children}</th>;
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="max-w-48 px-4 py-3 text-small text-subdued">{children}</td>;
}

function RowAction({
  label,
  icon: Icon,
  danger = false,
  onClick,
}: {
  label: string;
  icon: typeof Edit3;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex size-8 items-center justify-center rounded-control border border-border transition hover:bg-muted ${danger ? "text-danger" : "text-subdued"}`}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
