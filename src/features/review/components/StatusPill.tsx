import { STATUS_LABELS } from "../api/review.api";

/**
 * The document lifecycle badge — the design system calls this "the signature".
 *
 * TWO REGISTERS THAT NEVER CROSS (design-system rule):
 *   teal            = interaction ONLY (buttons, links, focus). Never a state.
 *   lifecycle hues  = status ONLY. Never interactive.
 *   danger          = validation feedback ONLY. Never a lifecycle state — `rejected`
 *                     has its own token and must use it.
 *
 * So: approved is GREEN (not teal), in-review is BLUE (not amber), draft is GOLD.
 * Colour is what tells an audit-anxious user, before they read a word, whether they
 * are looking at an editable draft or a controlled record. Getting the hue wrong
 * doesn't look bad — it misinforms.
 */
const TONE: Record<string, string> = {
  // Draft — editable, not a controlled record.
  draft: "bg-draft-bg text-draft-fg",
  core_inputs_set: "bg-draft-bg text-draft-fg",
  extracting: "bg-draft-bg text-draft-fg",
  extracted: "bg-draft-bg text-draft-fg",
  stages_set: "bg-draft-bg text-draft-fg",
  generating: "bg-draft-bg text-draft-fg",
  generated: "bg-draft-bg text-draft-fg",

  // In review — out of the author's hands, not yet approved.
  submitted: "bg-inreview-bg text-inreview-fg",
  in_review: "bg-inreview-bg text-inreview-fg",
  pending_approval: "bg-inreview-bg text-inreview-fg",

  // Terminal states.
  approved: "bg-approved-bg text-approved-fg",
  rejected: "bg-rejected-bg text-rejected-fg",

  // Failures are validation feedback, not a lifecycle state — hence danger, not rejected.
  extraction_failed: "bg-danger-soft text-danger-ink",
  generation_failed: "bg-danger-soft text-danger-ink",
};

const SUPERSEDED = "bg-superseded-bg text-superseded-fg";

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-pill px-2.5 py-1 text-micro font-semibold ${
        TONE[status] ?? SUPERSEDED
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
