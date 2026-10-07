import {
  AlertCircle,
  ArrowLeft,
  Check,
  Download,
  Loader2,
  Lock,
  MessageSquarePlus,
  Pencil,
  RotateCcw,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getApiErrorMessage } from "../../../shared/api/apiError";
import { useAuthStore } from "../../auth/state/auth.store";
import { getBom } from "../../bom/api/bom.api";
import type { BomResponse } from "../../bom/api/bom.types";
import { FullDocumentBody } from "../../bom/components/FullDocumentBody";
import { downloadDocument } from "../../generate/api/generate.api";
import { AppHeader } from "../../new-document/components/AppHeader";
import { AppSidebar } from "../../new-document/components/AppSidebar";
import { useDocument } from "../../new-document/hooks/useDocument";
import {
  approveDocument,
  getReviewState,
  resubmitDocument,
  ROLE_LABELS,
  submitReview,
  type ReviewState,
} from "../api/review.api";
import { Identifier } from "../../../shared/ui/Identifier";
import { StatusPill } from "../components/StatusPill";

interface Comment {
  text: string;
  by: string;
  at: string;
}

export function DocumentReviewPage() {
  const { documentId = "" } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { document: documentState } = useDocument(documentId);

  const [state, setState] = useState<ReviewState | null>(null);
  const [bom, setBom] = useState<BomResponse | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirming, setConfirming] = useState<"approved" | "rejected" | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [reviewState, bomData] = await Promise.all([
        getReviewState(documentId),
        getBom(documentId).catch(() => null),
      ]);
      setState(reviewState);
      setBom(bomData);
      setError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not load this document."));
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isApprover = user?.role === "approver";

  const addComment = () => {
    const text = commentDraft.trim();
    if (!text) return;
    setComments((c) => [...c, { text, by: user?.username ?? "you", at: nowLabel() }]);
    setCommentDraft("");
  };

  const decide = useCallback(
    async (decision: "approved" | "rejected") => {
      setIsBusy(true);
      setError(null);
      // The reviewer's added comments travel with the decision (a rejection must carry one).
      const joined = comments.map((c) => c.text).join(" · ");
      try {
        const next = isApprover
          ? await approveDocument(documentId, decision, joined)
          : await submitReview(documentId, decision, joined);
        setState(next);
        setComments([]);
        setConfirming(null);
      } catch (caught) {
        setError(getApiErrorMessage(caught, "Could not record your decision."));
      } finally {
        setIsBusy(false);
      }
    },
    [comments, documentId, isApprover],
  );

  const resubmit = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    try {
      setState(await resubmitDocument(documentId));
    } catch (caught) {
      setError(getApiErrorMessage(caught, "Could not re-submit."));
    } finally {
      setIsBusy(false);
    }
  }, [documentId]);

  // A rejection must say why — mirror the server rule so the UI doesn't let the user hit a wall.
  const rejectNeedsReason = confirming === "rejected" && comments.length === 0;
  const canResubmit =
    state?.status === "rejected" &&
    (user?.role === "preparer" || user?.role === "admin" || user?.role === "superadmin");
  const hasDoc = Boolean(bom && bom.ingredients.length > 0);

  return (
    <div className="min-h-screen bg-background text-text">
      <AppHeader user={user} unit={user?.unitId ? { id: user.unitId } : null} title="Review document" />

      <div className="flex">
        <AppSidebar user={user} />

        <main className="min-w-0 flex-1 p-4 lg:p-6">
          <div className="mx-auto max-w-[1240px] space-y-4">
            <button
              type="button"
              onClick={() => navigate("/queue")}
              className="inline-flex items-center gap-2 text-small font-semibold text-subdued transition hover:text-text"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to queue
            </button>

            {error ? (
              <div className="flex items-start gap-2 rounded-panel border border-danger/30 bg-danger-soft p-4">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                <p className="text-small text-danger">{error}</p>
              </div>
            ) : null}

            {isLoading || !state ? (
              <div className="flex items-center justify-center gap-2 rounded-panel border border-border bg-surface p-16 text-subdued">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                <span className="text-small">Loading…</span>
              </div>
            ) : (
              <>
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h1 className="text-h1 font-semibold">{bom?.cover.product_name ?? "Document review"}</h1>
                    <p className="mt-1 text-small text-subdued">
                      <Identifier>{documentState?.bmr_number ?? documentId.slice(0, 8)}</Identifier>
                      {" · prepared by "}
                      {state.reviews[0]?.reviewer ?? "the author"}
                      {state.review_round > 1 ? (
                        <>
                          {" · review round "}
                          <Identifier>{state.review_round}</Identifier>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <StatusPill status={state.status} />
                </header>

                {state.status === "rejected" && state.reject_reason ? (
                  <div className="rounded-panel border border-danger/30 bg-danger-soft p-4">
                    <p className="text-small font-semibold text-danger">Rejected</p>
                    <p className="mt-1 text-small text-subdued">{state.reject_reason}</p>
                    {canResubmit ? (
                      <button
                        type="button"
                        onClick={() => void resubmit()}
                        disabled={isBusy}
                        className="mt-3 inline-flex items-center gap-2 rounded-control border border-border bg-surface px-3 py-1.5 text-small font-semibold transition hover:bg-muted disabled:opacity-60"
                      >
                        <RotateCcw className="size-4" aria-hidden="true" />
                        Fix and re-submit
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {/* Document (left) + review side panel (right). */}
                <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
                  {/* The same page-7 document the preparer built. */}
                  <section className="min-w-0">
                    {hasDoc ? (
                      <div
                        contentEditable={editMode}
                        suppressContentEditableWarning
                        spellCheck={false}
                        className={`space-y-4 outline-none ${
                          editMode ? "rounded-card ring-2 ring-primary/40" : ""
                        }`}
                      >
                        <FullDocumentBody bom={bom as BomResponse} headerInches={documentState?.header_footer_size ?? 0.5} />
                      </div>
                    ) : (
                      <div className="rounded-panel border border-border bg-surface p-16 text-center text-small text-subdued">
                        The document isn't available to preview yet.
                      </div>
                    )}
                  </section>

                  {/* Side panel */}
                  <aside className="mt-4 space-y-4 lg:mt-0 lg:sticky lg:top-6 lg:self-start">
                    {/* Review tools */}
                    <section className="rounded-panel border border-border bg-surface p-4">
                      <h2 className="text-small font-semibold uppercase tracking-overline text-subdued">Review tools</h2>
                      <div className="mt-3 flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => setEditMode((v) => !v)}
                          className={`inline-flex items-center justify-center gap-2 rounded-control border px-3 py-2 text-small font-semibold transition ${
                            editMode
                              ? "border-primary bg-accent-soft text-primary-dark"
                              : "border-border text-subdued hover:bg-muted"
                          }`}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                          {editMode ? "Editing — click to finish" : "Edit document"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void downloadDocument(documentId, `BMR_${documentState?.bmr_number ?? documentId.slice(0, 8)}.docx`)
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-control border border-border px-3 py-2 text-small font-semibold text-subdued transition hover:bg-muted"
                        >
                          <Download className="size-4" aria-hidden="true" />
                          Download .docx
                        </button>
                      </div>
                      {editMode ? (
                        <p className="mt-2 text-micro text-subdued">
                          Inline edits are a visual draft for markup — send them to the preparer as a rejection comment.
                        </p>
                      ) : null}
                    </section>

                    {/* Add comment */}
                    <section className="rounded-panel border border-border bg-surface p-4">
                      <h2 className="text-small font-semibold uppercase tracking-overline text-subdued">Comments</h2>
                      {comments.length > 0 ? (
                        <ul className="mt-3 space-y-2">
                          {comments.map((c, i) => (
                            <li key={i} className="rounded-card border border-border bg-sunken/40 p-2.5">
                              <p className="text-small text-text">{c.text}</p>
                              <p className="mt-1 text-micro text-subdued">
                                <Identifier>{c.by}</Identifier> · {c.at}
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-micro text-subdued">No comments yet. Add notes for the preparer.</p>
                      )}
                      <div className="mt-3">
                        <textarea
                          rows={3}
                          value={commentDraft}
                          onChange={(e) => setCommentDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") addComment();
                          }}
                          placeholder="Add a comment or correction for the preparer…"
                          className="w-full rounded-control border border-border bg-surface px-3 py-2 text-small focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                          type="button"
                          onClick={addComment}
                          disabled={!commentDraft.trim()}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-control border border-border px-3 py-1.5 text-small font-semibold text-primary transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <MessageSquarePlus className="size-4" aria-hidden="true" />
                          Add comment
                        </button>
                      </div>
                    </section>

                    {/* Decision */}
                    {state.can_act ? (
                      <section className="rounded-panel border border-border bg-surface p-4">
                        <h2 className="text-small font-semibold uppercase tracking-overline text-subdued">
                          {isApprover ? "Sign off" : "Your decision"}
                        </h2>
                        {rejectNeedsReason ? (
                          <p className="mt-2 text-micro text-danger">
                            A rejection needs at least one comment — the preparer has to know what to fix.
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => (confirming === "approved" ? void decide("approved") : setConfirming("approved"))}
                            disabled={isBusy}
                            className="inline-flex items-center justify-center gap-2 rounded-control bg-primary px-4 py-2 text-small font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                          >
                            {isBusy && confirming === "approved" ? (
                              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <Check className="size-4" aria-hidden="true" />
                            )}
                            {confirming === "approved" ? "Confirm approve" : isApprover ? "Approve & sign" : "Approve"}
                          </button>
                          <button
                            type="button"
                            onClick={() => (confirming === "rejected" ? void decide("rejected") : setConfirming("rejected"))}
                            disabled={isBusy || rejectNeedsReason}
                            className="inline-flex items-center justify-center gap-2 rounded-control border border-danger/40 px-4 py-2 text-small font-semibold text-danger transition hover:bg-danger-soft disabled:opacity-50"
                          >
                            <X className="size-4" aria-hidden="true" />
                            {confirming === "rejected" ? "Confirm reject" : "Reject"}
                          </button>
                          {confirming ? (
                            <button
                              type="button"
                              onClick={() => setConfirming(null)}
                              disabled={isBusy}
                              className="rounded-control px-4 py-1.5 text-small font-semibold text-subdued transition hover:bg-muted"
                            >
                              Cancel
                            </button>
                          ) : null}
                        </div>
                      </section>
                    ) : (
                      <div className="flex items-start gap-2 rounded-panel border border-border bg-muted p-4">
                        <Lock className="mt-0.5 size-4 shrink-0 text-subdued" aria-hidden="true" />
                        <p className="text-small text-subdued">
                          {state.pending_roles.length > 0
                            ? `Waiting on ${state.pending_roles.map((role) => ROLE_LABELS[role] ?? role).join(" and ")}.`
                            : "There is no action for you on this document."}
                        </p>
                      </div>
                    )}

                    <ReviewHistory state={state} />
                  </aside>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function nowLabel(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function ReviewHistory({ state }: { state: ReviewState }) {
  if (state.reviews.length === 0) return null;

  return (
    <section className="rounded-panel border border-border bg-surface p-4">
      <h2 className="text-small font-semibold uppercase tracking-overline text-subdued">Review history</h2>
      <ol className="mt-3 space-y-3">
        {state.reviews.map((review, index) => (
          <li key={index} className="flex gap-3">
            <span
              className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full ${
                review.decision === "approved" ? "bg-primary/10 text-primary" : "bg-danger-soft text-danger"
              }`}
            >
              {review.decision === "approved" ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                <X className="size-3.5" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-small">
                <span className="font-semibold">{ROLE_LABELS[review.role] ?? review.role}</span>{" "}
                <span className="text-subdued">
                  {review.decision === "approved" ? "approved" : "rejected"} · {review.reviewer}
                </span>
              </p>
              {review.comment ? <p className="mt-1 text-small text-subdued">{review.comment}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
