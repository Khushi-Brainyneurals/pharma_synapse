import { Loader2 } from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { Dialog } from "../../../shared/ui/Dialog";
import { deleteEmployee, type Employee } from "../api/employees.api";

export function DeleteEmployeeDialog({
  employee,
  onClose,
  onDeleted,
}: {
  employee: Employee;
  onClose: () => void;
  onDeleted: () => Promise<void> | void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (isDeleting) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteEmployee(employee.user_id);
      await onDeleted();
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not delete this employee."));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog title="Delete employee" busy={isDeleting} onClose={onClose}>
      <p className="text-small text-subdued">
        Delete <span className="font-semibold text-text">{employee.user_id}</span>? This removes
        the employee from the client database and cannot be undone from this screen.
      </p>
      {error ? (
        <p className="mt-4 rounded-panel border border-danger/30 bg-danger-soft p-3 text-small text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
        <button
          type="button"
          disabled={isDeleting}
          onClick={onClose}
          className="h-9 rounded-control px-4 text-small font-semibold text-subdued hover:bg-muted disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isDeleting}
          onClick={() => void confirm()}
          className="inline-flex h-9 items-center gap-2 rounded-control bg-danger px-4 text-small font-semibold text-white disabled:opacity-50"
        >
          {isDeleting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Delete employee
        </button>
      </div>
    </Dialog>
  );
}
