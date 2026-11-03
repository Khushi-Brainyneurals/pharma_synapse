import { Link } from "react-router-dom";
import { useAuthStore } from "../../auth/state/auth.store";
import { getDocumentLocation } from "../../auth/storage/resumeLocation";
import type { DashboardItem } from "../api/dashboard.api";

const STEP_ALIASES: Record<string, string> = {
  type: "inputs",
  inputs: "inputs",
  core_inputs: "inputs",
  core_input: "inputs",
  preview: "cover-bom",
  format_preview: "cover-bom",
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
  finalize: "finalize",
  approved_for_print: "finalize",
};

const PVP_PVR_STEP_ROUTES: Record<string, string> = {
  "select-document": "pvp-pvr/select-document",
  "generate_cover": "pvp-pvr/cover-details",
  "cover-details": "pvp-pvr/cover-details",
  "process-bom": "pvp-pvr/process-bom",
  "cpp-cqa": "pvp-pvr/cpp-cqa",
  "procedure-sampling": "pvp-pvr/procedure-sampling",
  "generate-submit": "generate",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-amber-500/10 text-amber-700",
  in_review: "bg-blue-100 text-blue-800",
  in_approval: "bg-purple-100 text-purple-800",
  approved_for_print: "bg-emerald-100 text-emerald-800",
  returned_for_correction: "bg-orange-100 text-orange-800",
  rejected: "bg-rose-100 text-rose-800",
};

function statusBadgeClass(item: DashboardItem): string {
  const key = item.bucket || item.status;
  return STATUS_BADGE[key] ?? "bg-muted text-subdued";
}


export function resolveDocumentRoute(item: DashboardItem): string {
  const status = item.status.trim().toLowerCase();
  const stateLabel = item.state_label.trim().toLowerCase();
  if (["returned", "returned_for_correction"].includes(status)) return "stages";
  if (status === "approved_for_print" || stateLabel === "approved for print") return "finalize";
  if (["submitted", "in_review", "qa_review", "pr_review", "in_approval", "pending_approval", "rejected", "finalized"].includes(status)) return "review";
  // A generated document that is ready to be submitted should open the generated
  // document viewer, which loads the artifact from GET /api/documents/{id}/preview.
  if (item.state_label.trim().toLowerCase() === "submit for review" && !["submitted", "in_review", "qa_review", "pr_review", "in_approval", "pending_approval", "approved_for_print", "rejected"].includes(status)) {
    return "generate";
  }

  const candidate = (item.resume_step || item.state || "").trim().toLowerCase();
  if (isPvpPvrCoreInputs(item, candidate, stateLabel)) {
    return "pvp-pvr/select-document";
  }
  if (isPvpPvrDocument(item)) return PVP_PVR_STEP_ROUTES[candidate] ?? "pvp-pvr/cover-details";
  if (STEP_ALIASES[candidate]) {
    return STEP_ALIASES[candidate];
  }

  const label = stateLabel || (item.state || "").toLowerCase();
  if (label.includes("cover") || label.includes("bom")) return "cover-bom";
  if (label.includes("preview")) return "cover-bom";
  if (label.includes("stage")) return "stages";
  if (label.includes("generate") || label.includes("submit")) return "generate";
  if (label.includes("review") || label.includes("approval")) return "review";
  if (label.includes("input") || label.includes("draft")) return "inputs";
  return "inputs";
}

function isPvpPvrCoreInputs(item: DashboardItem, candidate: string, stateLabel: string) {
  const documentType = (item.doc_type ?? "").trim().toLowerCase();
  const isPvpPvr = documentType.includes("pvp") || documentType.includes("pvr");
  const isCoreInputs = ["inputs", "core_inputs", "core_input", "select-document"].includes(candidate) ||
    stateLabel === "core inputs continue" || stateLabel === "core inputs";
  return isPvpPvr && isCoreInputs;
}

function isPvpPvrDocument(item: DashboardItem) {
  const documentType = (item.doc_type ?? "").trim().toLowerCase();
  return documentType.includes("pvp") || documentType.includes("pvr");
}

export function formatLastModified(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Where a document opens, and what the button says.
 * Shared by the card view and the list view so both always behave the same.
 */
export function getDocumentAction(
  item: DashboardItem,
  username?: string,
  userRole?: string,
): { target: string; action: string } {
  const perms = item.permissions ?? {
    can_edit: false,
    can_delete: false,
    can_cancel: false,
    can_review: false,
    can_approve: false,
    can_correct: false,
  };
  const resumeStep = item.resume_step ?? item.state ?? "inputs";
  const isSubmitForReview = item.state_label.trim().toLowerCase() === "submit for review" && !["submitted", "in_review", "qa_review", "pr_review", "in_approval", "pending_approval", "approved_for_print", "rejected"].includes(item.status);
  const isPendingReview = ["submitted", "in_review", "in_approval", "qa_review", "pr_review"].includes(item.status);
  const isReturned = userRole === "preparer" && ["returned", "returned_for_correction"].includes(item.status);
  const isRejected = item.status === "rejected";
  const isFinalizable = userRole === "preparer" && (
    item.permissions?.can_finalize || item.status === "approved_for_print" || item.state_label.trim().toLowerCase() === "approved for print"
  );
  const resolvedStep = resolveDocumentRoute(item);
  const forcePvpSelectDocument = isPvpPvrCoreInputs(
    item,
    (item.resume_step || item.state || "").trim().toLowerCase(),
    item.state_label.trim().toLowerCase(),
  );
  const forcePvpWorkflowStep = isPvpPvrDocument(item);
  const step = isSubmitForReview
    ? "generate"
    : isReturned
    ? "stages"
    : isFinalizable
    ? "finalize"
    : perms.can_correct
    ? "cover-bom"
    : isPendingReview
    ? "review"
    : forcePvpWorkflowStep
    ? resolvedStep
    : perms.can_edit
    ? resolvedStep
    : "review";

  const remembered = perms.can_edit && username && item.document_id
    ? getDocumentLocation(username, item.document_id, resumeStep) : null;
  const defaultTarget = !isSubmitForReview && !isReturned && item.resume_step === "stage-input" && item.resume_stage_key
    ? `/documents/${encodeURIComponent(item.document_id || "new")}/stage-input?stage=${encodeURIComponent(item.resume_stage_key)}`
    : `/documents/${encodeURIComponent(item.document_id || "new")}/${step}${isSubmitForReview ? "?readyForReview=1" : ""}`;
  const target = forcePvpSelectDocument || forcePvpWorkflowStep || isSubmitForReview || isReturned || isFinalizable || isPendingReview || isRejected
    ? defaultTarget
    : remembered ?? defaultTarget;

  const action = isRejected
    ? "View"
    : isFinalizable
    ? "Finalize"
    : isReturned
    ? "Continue correction"
    : perms.can_correct
    ? "Continue"
    : perms.can_review
    ? "Review"
    : perms.can_approve
    ? "Review for approval"
    : isPendingReview
    ? "View review"
    : perms.can_edit
    ? "Continue"
    : "Open";

  return { target, action };
}

export function DocumentCard({ item, onDelete, onCancel }: {
  item: DashboardItem;
  onDelete: (item: DashboardItem) => void;
  onCancel: (item: DashboardItem) => void;
}) {
  const username = useAuthStore((state) => state.user?.username);
  const userRole = useAuthStore((state) => state.user?.role);
  const { target, action } = getDocumentAction(item, username, userRole);

  return (
    <article className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5 transition hover:border-primary/40 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h2 className="break-words text-small font-semibold">
          <Link to={target} state={{ dashboardPermissions: item.permissions }} className="hover:text-primary-dark hover:underline transition">
            {`${item.doc_type}_${item.document_id?.slice(0, 8) || ""}`}
          </Link>
        </h2>
        {/* <span className={`inline-block rounded-full px-2.5 py-0.5 text-micro font-semibold ${statusBadgeClass(item)}`}>
          {item.status || "Draft"}
        </span> */}
      </div>
      <p className="text-small">{item.product_name ?? "Untitled document"}</p>
      <p className="text-micro text-subdued">{[item.dosage_form, item.doc_type].filter(Boolean).join(" · ")}</p>
      <span className="text-small font-semibold text-primary-dark">{item.state_label || item.status || "Draft"}</span>
      {item.is_overdue ? <p className="text-small text-danger">Overdue · {item.days_in_step} days in this step</p> : null}
      {item.pending_with ? <p className="text-small text-subdued">Pending with {item.pending_with}</p> : null}
      {item.note ? <p className="text-small text-subdued">{item.note}</p> : null}
      <div className="mt-auto flex flex-wrap justify-between gap-3 border-t border-border pt-3">
        {item.last_modified_at ? (
          <span className="text-micro text-subdued self-end pb-0.5" title="Last modified">
            {formatLastModified(item.last_modified_at)}
          </span>
        ) : <span />}
        <Link className="inline-flex items-center text-small font-semibold h-8 px-3 border border-primary text-primary-dark rounded-control hover:bg-primary-dark hover:text-white transition" to={target} state={{ dashboardPermissions: item.permissions }}>
          {action}
        </Link>
        {/* {perms.can_delete ? <button type="button" onClick={() => onDelete(item)} className="text-small text-danger hover:underline">Delete draft</button> : null}
        {perms.can_cancel ? <button type="button" onClick={() => onCancel(item)} className="text-small text-danger hover:underline">Cancel record</button> : null} */}
      </div>
    </article>
  );
}
