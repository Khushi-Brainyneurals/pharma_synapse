import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  Send,
  X,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { canDecideCompanyApproval, canEditCompanyInfo } from "../access";
import {
  decideCompanyApproval,
  submitCompanyApproval,
  type CompanyApprovalState,
} from "../api/company.api";

interface CompanyApprovalPanelProps {
  approval: CompanyApprovalState | null;
  isLoading: boolean;
  isComplete: boolean;
  userRole?: string | null;
  onReload: () => Promise<void> | void;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function CompanyApprovalPanel({
  approval,
  isLoading,
  isComplete,
  userRole,
  onReload,
}: CompanyApprovalPanelProps) {
  const [isBusy, setIsBusy] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const canEdit = canEditCompanyInfo(userRole);
  const canDecide = canDecideCompanyApproval(userRole);
  const status = approval?.status?.toLowerCase() ?? "draft";
  const isPending = status === "pending" || status === "submitted" || status === "in_review";
  const isApproved = status === "approved";
  const isRejected = status === "rejected";

  const canSubmit = canEdit && !isPending && !isApproved;

  const handleSubmit = async () => {
    if (!canSubmit || !isComplete || isBusy) return;
    setIsBusy(true);
    setActionError(null);
    setActionNotice(null);
    try {
      await submitCompanyApproval();
      setActionNotice("Company standard submitted for approval.");
      await onReload();
    } catch (caught) {
      setActionError(getApiErrorMessage(caught, "Could not submit for approval."));
    } finally {
      setIsBusy(false);
    }
  };

  const handleApprove = async () => {
    if (!canDecide || isBusy) return;
    setIsBusy(true);
    setActionError(null);
    setActionNotice(null);
    try {
      await decideCompanyApproval("approved");
      setActionNotice("Company standard approved successfully.");
      await onReload();
    } catch (caught) {
      setActionError(getApiErrorMessage(caught, "Could not approve submission."));
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      setRejectError("A reason is required when rejecting.");
      return;
    }
    setIsBusy(true);
    setRejectError(null);
    try {
      await decideCompanyApproval("rejected", rejectReason.trim());
      setIsRejectModalOpen(false);
      setRejectReason("");
      setActionNotice("Submission rejected with comments.");
      await onReload();
    } catch (caught) {
      setRejectError(getApiErrorMessage(caught, "Could not record rejection."));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-card border border-border bg-surface p-5 shadow-xs">
      {/* Header with Title and Status Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-h3 font-semibold text-text">Approval</h2>
          <p className="mt-0.5 text-small text-subdued">
            Company information is signed off by the Approver before it is used.
          </p>
        </div>

        {isLoading ? (
          <span className="h-6 w-24 animate-pulse rounded-pill bg-muted" />
        ) : (
          <ApprovalStatusBadge status={status} />
        )}
      </div>

      {/* Notifications and Alerts */}
      {actionError ? (
        <div className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger-soft p-3 text-small text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      ) : null}

      {actionNotice ? (
        <div className="flex items-start gap-2 rounded-control border border-approved-fg/20 bg-approved-bg p-3 text-small text-approved-fg">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{actionNotice}</span>
        </div>
      ) : null}

      {isRejected && approval?.reject_reason ? (
        <div className="rounded-control border border-danger/30 bg-danger-soft p-3 text-small text-danger">
          <p className="font-semibold">Rejected — Reason:</p>
          <p className="mt-0.5 text-danger/90">{approval.reject_reason}</p>
        </div>
      ) : null}

      {isPending ? (
        <div className="flex items-start gap-2 rounded-control border border-amber-500/30 bg-amber-500/10 p-3 text-small text-amber-700 dark:text-amber-300">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Locked while pending Approver review. Viewing stays available; modifications are frozen.
          </span>
        </div>
      ) : null}

      {/* Metadata Fact Grid */}
      <dl className="grid gap-3 sm:grid-cols-2">
        <FactCard label="Submitted by" value={approval?.submitted_by} />
        <FactCard label="Submitted at" value={formatDate(approval?.submitted_at)} />
        <FactCard label="Approved / Decided by" value={approval?.decided_by} />
        <FactCard label="Approved / Decided at" value={formatDate(approval?.decided_at)} />
      </dl>

      {/* Guidance Notes */}
      {!isComplete && canSubmit ? (
        <p className="text-micro text-draft-fg">
          Complete company name, address, and upload logo before submitting for approval.
        </p>
      ) : null}

      {!canEdit && !canDecide ? (
        <p className="text-micro text-subdued">
          Your role has view-only access to this approval record.
        </p>
      ) : null}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
        {canSubmit ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isComplete || isBusy}
            className="inline-flex h-[36px] items-center gap-2 rounded-control bg-primary px-4 text-small font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
          >
            {isBusy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="size-4" aria-hidden="true" />
            )}
            Submit for approval
          </button>
        ) : null}

        {canDecide && isPending ? (
          <>
            <button
              type="button"
              onClick={() => setIsRejectModalOpen(true)}
              disabled={isBusy}
              className="inline-flex h-[36px] items-center gap-1.5 rounded-control border border-danger/30 bg-danger-soft px-3.5 text-small font-semibold text-danger transition hover:bg-danger hover:text-white disabled:opacity-50"
            >
              <XCircle className="size-4" aria-hidden="true" />
              Reject
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={isBusy}
              className="inline-flex h-[36px] items-center gap-1.5 rounded-control bg-primary px-4 text-small font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
            >
              {isBusy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              )}
              Approve
            </button>
          </>
        ) : null}
      </div>

      {/* Rejection Modal Dialog */}
      {isRejectModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "var(--scrim, rgba(0, 0, 0, 0.5))" }}
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-modal border border-border bg-surface shadow-modal">
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-h3 font-semibold text-text">Reject submission</h3>
              <button
                type="button"
                onClick={() => {
                  setIsRejectModalOpen(false);
                  setRejectError(null);
                }}
                disabled={isBusy}
                className="text-subdued hover:text-text"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </header>

            <div className="space-y-4 px-5 py-4">
              <div>
                <label
                  htmlFor="reject-reason"
                  className="text-overline font-semibold uppercase tracking-overline text-subdued"
                >
                  Reason for rejection <span className="text-danger">*</span>
                </label>
                <textarea
                  id="reject-reason"
                  rows={4}
                  value={rejectReason}
                  onChange={(e) => {
                    setRejectReason(e.target.value);
                    setRejectError(null);
                  }}
                  disabled={isBusy}
                  placeholder="Explain what must be corrected before resubmission..."
                  className={`mt-1.5 w-full rounded-control border bg-surface px-3 py-2 text-small text-text placeholder:text-subdued/70 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                    rejectError ? "border-danger focus:border-danger" : "border-border-strong focus:border-primary"
                  }`}
                />
                {rejectError ? (
                  <p className="mt-1 text-micro font-medium text-danger">{rejectError}</p>
                ) : null}
              </div>
            </div>

            <footer className="flex justify-end gap-2.5 border-t border-border px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setIsRejectModalOpen(false);
                  setRejectError(null);
                }}
                disabled={isBusy}
                className="h-[34px] rounded-control px-3.5 text-small font-semibold text-subdued transition hover:bg-sunken"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isBusy || !rejectReason.trim()}
                className="inline-flex h-[34px] items-center gap-1.5 rounded-control bg-danger px-4 text-small font-semibold text-white transition hover:bg-danger/90 disabled:opacity-50"
              >
                {isBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                Confirm rejection
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function FactCard({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-control bg-muted/60 px-3 py-2.5 border border-border/40">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-subdued">{label}</dt>
      <dd className="mt-0.5 text-small font-medium text-text">{value || "—"}</dd>
    </div>
  );
}

function ApprovalStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "pending":
    case "submitted":
    case "in_review":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-amber-500/10 px-2.5 py-1 text-micro font-semibold text-amber-700 dark:text-amber-300 border border-amber-500/20">
          <Clock className="size-3" aria-hidden="true" />
          Pending review
        </span>
      );
    case "approved":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-approved-bg px-2.5 py-1 text-micro font-semibold text-approved-fg border border-approved-fg/20">
          <CheckCircle2 className="size-3" aria-hidden="true" />
          Approved
        </span>
      );
    case "rejected":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-danger-soft px-2.5 py-1 text-micro font-semibold text-danger border border-danger/20">
          <XCircle className="size-3" aria-hidden="true" />
          Rejected
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-draft-bg px-2.5 py-1 text-micro font-semibold text-draft-fg border border-draft-fg/20">
          <span className="size-1.5 rounded-full bg-draft-fg" aria-hidden="true" />
          Draft
        </span>
      );
  }
}

