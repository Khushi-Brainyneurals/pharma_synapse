import { Link } from "react-router-dom";
import { useAuthStore } from "../../auth/state/auth.store";
import { getDocumentLocation } from "../../auth/storage/resumeLocation";
import type { DashboardItem } from "../api/dashboard.api";

export function DocumentCard({ item, onDelete, onCancel }: {
  item: DashboardItem;
  onDelete: (item: DashboardItem) => void;
  onCancel: (item: DashboardItem) => void;
}) {
  const username = useAuthStore((state) => state.user?.username);
  const steps: Record<string, string> = {
    type: "inputs",
    inputs: "inputs",
    core_inputs: "inputs",
    preview: "preview",
    format_preview: "preview",
    "cover-bom": "cover-bom",
    cover_bom: "cover-bom",
    stages: "stages",
    "stage-input": "stages",
    stage_params: "stages",
    "generate-submit": "generate",
    generate: "generate",
    submit: "generate",
  };
  const perms = item.permissions ?? {
    can_edit: false,
    can_delete: false,
    can_cancel: false,
    can_review: false,
    can_approve: false,
    can_correct: false,
  };
  const resumeStep = item.resume_step ?? "inputs";
  const isPendingReview = ["submitted", "in_review", "in_approval", "qa_review", "pr_review"].includes(item.status);
  const step = perms.can_correct
    ? "cover-bom"
    : isPendingReview
    ? "review"
    : perms.can_edit
    ? (steps[resumeStep] ?? "inputs")
    : "review";
  const remembered = perms.can_edit && username && item.document_id
    ? getDocumentLocation(username, item.document_id, resumeStep) : null;
  const target = remembered ?? `/documents/${encodeURIComponent(item.document_id || "new")}/${step}`;
  const action = perms.can_correct
    ? "Correct & resubmit"
    : perms.can_review
    ? "Review"
    : perms.can_approve
    ? "Review for approval"
    : isPendingReview
    ? "View review"
    : perms.can_edit
    ? "Continue"
    : "Open";
  return (
    <article className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="break-words text-small font-semibold">{item.display_id || item.document_id || "Document"}</h2>
        <span className="font-mono text-micro text-subdued">{item.version || "v00"}</span>
      </div>
      <p className="text-small">{item.product_name ?? "Untitled document"}</p>
      <p className="text-micro text-subdued">{[item.dosage_form, item.doc_type].filter(Boolean).join(" · ")}</p>
      <span className="text-small font-semibold text-primary-dark">{item.state_label || item.status || "Draft"}</span>
      {item.is_overdue ? <p className="text-small text-danger">Overdue · {item.days_in_step} days in this step</p> : null}
      {item.pending_with ? <p className="text-small text-subdued">Pending with {item.pending_with}</p> : null}
      {item.note ? <p className="text-small text-subdued">{item.note}</p> : null}
      <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-border pt-3">
        <Link className="text-small font-semibold text-primary-dark" to={target}>{action}</Link>
        {perms.can_delete ? <button type="button" onClick={() => onDelete(item)} className="text-small text-danger">Delete draft</button> : null}
        {perms.can_cancel ? <button type="button" onClick={() => onCancel(item)} className="text-small text-danger">Cancel record</button> : null}
      </div>
    </article>
  );
}
