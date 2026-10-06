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
    type: "inputs", inputs: "inputs", preview: "preview", "cover-bom": "cover-bom",
    stages: "stages", "stage-input": "stage-input", "generate-submit": "generate",
  };
  const step = item.permissions.can_correct ? "cover-bom" : item.permissions.can_edit ? (steps[item.resume_step] ?? "inputs") : "review";
  const remembered = item.permissions.can_edit && username
    ? getDocumentLocation(username, item.document_id, item.resume_step) : null;
  const target = remembered ?? `/documents/${encodeURIComponent(item.document_id)}/${step}`;
  const action = item.permissions.can_correct ? "Correct & resubmit" : item.permissions.can_edit ? "Continue" : item.permissions.can_review
    ? "Review" : item.permissions.can_approve ? "Review for approval" : "Open";
  return (
    <article className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="break-words text-small font-semibold">{item.display_id}</h2>
        <span className="font-mono text-micro text-subdued">{item.version}</span>
      </div>
      <p className="text-small">{item.product_name ?? "Untitled document"}</p>
      <p className="text-micro text-subdued">{[item.dosage_form, item.doc_type].filter(Boolean).join(" · ")}</p>
      <span className="text-small font-semibold text-primary-dark">{item.state_label}</span>
      {item.is_overdue ? <p className="text-small text-danger">Overdue · {item.days_in_step} days in this step</p> : null}
      {item.pending_with ? <p className="text-small text-subdued">Pending with {item.pending_with}</p> : null}
      {item.note ? <p className="text-small text-subdued">{item.note}</p> : null}
      <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-border pt-3">
        <Link className="text-small font-semibold text-primary-dark" to={target}>{action}</Link>
        {item.permissions.can_delete ? <button type="button" onClick={() => onDelete(item)} className="text-small text-danger">Delete draft</button> : null}
        {item.permissions.can_cancel ? <button type="button" onClick={() => onCancel(item)} className="text-small text-danger">Cancel record</button> : null}
      </div>
    </article>
  );
}
