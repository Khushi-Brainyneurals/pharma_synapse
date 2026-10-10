import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Diff,
  Loader2,
  Lock,
  Send,
  X,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "../../auth/state/auth.store";
import { masterDataAccess } from "../access";
import type { ApprovalState } from "../../master-data/api/equipmentInstrument.api";

interface ChangeDiffItem {
  key: string;
  field: string;
  existing: string;
  proposed: string;
}

interface MasterDataApprovalCardProps {
  entityName: "Equipment" | "Instrument";
  approval: ApprovalState | null;
  isLoading: boolean;
  isSaving: boolean;
  hasErrors?: boolean;
  changes?: ChangeDiffItem[];
  onSave: () => Promise<void> | void;
  onSubmit: () => Promise<void> | void;
  onDecide: (decision: "approved" | "rejected", reason?: string) => Promise<void> | void;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function MasterDataApprovalCard({
  entityName,
  approval,
  isLoading,
  isSaving,
  hasErrors = false,
  changes = [],
  onSave,
  onSubmit,
  onDecide,
}: MasterDataApprovalCardProps) {
  const user = useAuthStore((s) => s.user);
  const access = masterDataAccess(user?.role);
  const isApprover = access.canApprove;
  const canEdit = access.canEdit;

  const [isBusy, setIsBusy] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showDiff, setShowDiff] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const status = (approval?.status || "draft").toLowerCase();
  const isPending = status === "pending" || status === "submitted" || status === "in_review";
  const isApproved = status === "approved";
  const isRejected = status === "rejected";

  const handleSave = async () => {
    if (isBusy || isSaving) return;
    setErrorMessage(null);
    try {
      await onSave();
    } catch (err: any) {
      setErrorMessage(err.message || `Failed to save ${entityName.toLowerCase()} list.`);
    }
  };

  const handleSubmit = async () => {
    if (isBusy || hasErrors) return;
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await onSubmit();
    } catch (err: any) {
      setErrorMessage(err.message || `Failed to submit ${entityName.toLowerCase()} for approval.`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleApprove = async () => {
    if (isBusy) return;
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await onDecide("approved");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to approve.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim() || isBusy) return;
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await onDecide("rejected", rejectReason.trim());
      setShowRejectModal(false);
      setRejectReason("");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to reject.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="mt-6 rounded-panel border border-border bg-surface p-5 shadow-sm">
      {/* Top Header with Status Pill and Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-semibold text-text">
              Approval — {entityName.toLowerCase()}
            </h3>
            <span
              className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-micro font-semibold uppercase tracking-wider ${
                isApproved
                  ? "bg-approved-bg text-approved-fg"
                  : isPending
                  ? "bg-inreview-bg text-inreview-fg"
                  : isRejected
                  ? "bg-danger-soft text-danger-ink"
                  : "bg-muted text-subdued"
              }`}
            >
              {isApproved && <CheckCircle2 className="size-3.5" />}
              {isPending && <Clock className="size-3.5" />}
              {isRejected && <XCircle className="size-3.5" />}
              {!isApproved && !isPending && !isRejected && <span className="size-1.5 rounded-full bg-subdued" />}
              {isPending ? "Pending review" : isApproved ? "Approved" : isRejected ? "Rejected" : "Draft"}
            </span>
          </div>
          <p className="mt-1 text-small text-subdued">
            The {entityName.toLowerCase()} list has its own review cycle, independent of other static masters.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && !isPending && (
            <>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || isBusy}
                className="inline-flex h-8 items-center gap-1.5 rounded-control border border-border bg-surface px-3 text-small font-semibold text-text transition hover:bg-muted disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Save {entityName.toLowerCase()} list
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isBusy || hasErrors}
                title={hasErrors ? "Resolve table errors before submitting" : undefined}
                className="inline-flex h-8 items-center gap-1.5 rounded-control bg-primary px-3 text-small font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
              >
                {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                Submit for approval
              </button>
            </>
          )}

          {isApprover && isPending && (
            <>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isBusy}
                className="inline-flex h-8 items-center gap-1.5 rounded-control bg-approved-fg px-3 text-small font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                Approve
              </button>

              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                disabled={isBusy}
                className="inline-flex h-8 items-center gap-1.5 rounded-control border border-danger bg-danger-soft px-3 text-small font-semibold text-danger-ink transition hover:bg-danger-soft/80 disabled:opacity-50"
              >
                <XCircle className="size-3.5" />
                Reject
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error alert if any */}
      {errorMessage && (
        <div className="mt-3 flex items-center gap-2 rounded-control border border-danger/30 bg-danger-soft/40 p-2.5 text-small text-danger-ink">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Pending review notice banner */}
      {isPending && (
        <div className="mt-3 flex items-start gap-2.5 rounded-control border border-inreview-fg/30 bg-inreview-bg/40 p-3 text-small text-inreview-fg">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong>Locked while pending Approver review.</strong> Saving additional edits, uploads, and deletions are disabled until decided.
          </p>
        </div>
      )}

      {/* Rejection notice if rejected */}
      {isRejected && approval?.reject_reason && (
        <div className="mt-3 rounded-control border border-danger/30 bg-danger-soft/40 p-3 text-small text-danger-ink">
          <strong>Rejection reason:</strong> {approval.reject_reason}
        </div>
      )}

      {/* Submitted and Decided metadata grid */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 text-small">
        <div className="rounded-card border border-border bg-sunken/40 p-3">
          <p className="text-micro font-medium uppercase tracking-overline text-subdued">Submitted by</p>
          <p className="mt-1 font-semibold text-text">{approval?.submitted_by || "—"}</p>
        </div>
        <div className="rounded-card border border-border bg-sunken/40 p-3">
          <p className="text-micro font-medium uppercase tracking-overline text-subdued">Submitted at</p>
          <p className="mt-1 font-semibold text-text">{formatDate(approval?.submitted_at)}</p>
        </div>
        <div className="rounded-card border border-border bg-sunken/40 p-3">
          <p className="text-micro font-medium uppercase tracking-overline text-subdued">Decided by</p>
          <p className="mt-1 font-semibold text-text">{approval?.decided_by || "—"}</p>
        </div>
        <div className="rounded-card border border-border bg-sunken/40 p-3">
          <p className="text-micro font-medium uppercase tracking-overline text-subdued">Decided at</p>
          <p className="mt-1 font-semibold text-text">{formatDate(approval?.decided_at)}</p>
        </div>
      </div>

      {/* Changes Details (Existing & Proposed) - Page 21 requirement */}
      {changes.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowDiff(!showDiff)}
            className="flex items-center gap-1.5 text-small font-semibold text-primary hover:underline"
          >
            <Diff className="size-4" />
            {showDiff ? "Hide changes details" : `View changes before approval (${changes.length} modified field${changes.length === 1 ? "" : "s"})`}
          </button>

          {showDiff && (
            <div className="mt-2.5 overflow-hidden rounded-control border border-border">
              <table className="w-full text-left text-small">
                <thead className="border-b border-border bg-muted text-micro uppercase tracking-wider text-subdued">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Field</th>
                    <th className="px-3 py-2">Existing Value</th>
                    <th className="px-3 py-2">Proposed Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {changes.map((c, i) => (
                    <tr key={i} className="hover:bg-sunken/20">
                      <td className="px-3 py-2 font-mono text-mono-sm text-subdued">{c.key}</td>
                      <td className="px-3 py-2 font-medium">{c.field}</td>
                      <td className="px-3 py-2 text-danger-ink line-through">{c.existing || "—"}</td>
                      <td className="px-3 py-2 text-approved-fg font-semibold">{c.proposed || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Rejection Reason Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-panel border border-border bg-surface p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h4 className="text-base font-semibold text-text">Reason for Rejection</h4>
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="rounded-control p-1 text-subdued hover:bg-muted hover:text-text"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-2 text-small text-subdued">
              Please specify why this {entityName.toLowerCase()} list is being returned for correction.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason..."
              rows={3}
              className="mt-3 w-full rounded-control border border-border bg-surface p-2 text-small focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="h-8 rounded-control border border-border px-3 text-small font-semibold text-text hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={!rejectReason.trim() || isBusy}
                className="h-8 rounded-control bg-danger px-3 text-small font-semibold text-white hover:bg-danger-ink disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
