import { Link } from "react-router-dom";
import { useAuthStore } from "../../auth/state/auth.store";
import { getDocumentLocation } from "../../auth/storage/resumeLocation";
import type { DashboardItem } from "../api/dashboard.api";

const STEP_ALIASES: Record<string, string> = {
  type: "inputs",
  inputs: "inputs",
  core_inputs: "inputs",
  core_input: "inputs",
  preview: "preview",
  format_preview: "preview",
  "cover-bom": "cover-bom",
  cover_bom: "cover-bom",
  cover_review: "cover-bom",
  review_cover: "cover-bom",
  cover: "cover-bom",
  bom: "cover-bom",
  stages: "stages",
  select_stages: "stages",
  "stage-input": "stages",
  stage_params: "stages",
  "generate-submit": "generate",
  generate: "generate",
  submit: "generate",
  review: "review",
};

export function resolveDocumentRoute(item: DashboardItem): string {
  const candidate = (item.resume_step || item.state || "").trim().toLowerCase();
  if (STEP_ALIASES[candidate]) {
    return STEP_ALIASES[candidate];
  }

  const label = (item.state_label || item.state || "").toLowerCase();
  if (label.includes("cover") || label.includes("bom")) return "cover-bom";
  if (label.includes("preview")) return "preview";
  if (label.includes("stage")) return "stages";
  if (label.includes("generate") || label.includes("submit")) return "generate";
  if (label.includes("review") || label.includes("approval")) return "review";
  if (label.includes("input") || label.includes("draft")) return "inputs";

  return "inputs";
}

export function DocumentCard({ item, onDelete, onCancel }: {
  item: DashboardItem;
  onDelete: (item: DashboardItem) => void;
  onCancel: (item: DashboardItem) => void;
}) {
  const username = useAuthStore((state) => state.user?.username);
  const perms = item.permissions ?? {
    can_edit: false,
    can_delete: false,
    can_cancel: false,
    can_review: false,
    can_approve: false,
    can_correct: false,
  };
  const resumeStep = item.resume_step ?? item.state ?? "inputs";
  const isPendingReview = ["submitted", "in_review", "in_approval", "qa_review", "pr_review"].includes(item.status);
  const resolvedStep = resolveDocumentRoute(item);
  const step = perms.can_correct
    ? "cover-bom"
    : isPendingReview
    ? "review"
    : perms.can_edit
    ? resolvedStep
    : "review";

  const remembered = perms.can_edit && username && item.document_id
    ? getDocumentLocation(username, item.document_id, resumeStep) : null;
  const defaultTarget = item.resume_step === "stage-input" && item.resume_stage_key
    ? `/documents/${encodeURIComponent(item.document_id || "new")}/stage-input?stage=${encodeURIComponent(item.resume_stage_key)}`
    : `/documents/${encodeURIComponent(item.document_id || "new")}/${step}`;
  const target = remembered ?? defaultTarget;

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
    <article className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5 transition hover:border-primary/40 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h2 className="break-words text-small font-semibold">
          <Link to={target} className="hover:text-primary-dark hover:underline transition">
            {item.display_id || item.document_id || "Document"}
          </Link>
        </h2>
        <span className="font-mono text-micro text-subdued">{item.version || "v00"}</span>
      </div>
      <p className="text-small">{item.product_name ?? "Untitled document"}</p>
      <p className="text-micro text-subdued">{[item.dosage_form, item.doc_type].filter(Boolean).join(" · ")}</p>
      <span className="text-small font-semibold text-primary-dark">{item.state_label || item.status || "Draft"}</span>
      {item.is_overdue ? <p className="text-small text-danger">Overdue · {item.days_in_step} days in this step</p> : null}
      {item.pending_with ? <p className="text-small text-subdued">Pending with {item.pending_with}</p> : null}
      {item.note ? <p className="text-small text-subdued">{item.note}</p> : null}
      <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-border pt-3">
        <Link className="text-small font-semibold text-primary-dark hover:underline" to={target}>{action}</Link>
        {perms.can_delete ? <button type="button" onClick={() => onDelete(item)} className="text-small text-danger hover:underline">Delete draft</button> : null}
        {perms.can_cancel ? <button type="button" onClick={() => onCancel(item)} className="text-small text-danger hover:underline">Cancel record</button> : null}
      </div>
    </article>
  );
}
