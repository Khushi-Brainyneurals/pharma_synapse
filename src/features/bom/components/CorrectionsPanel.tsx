import { Check, RotateCcw } from "lucide-react";
import { Identifier } from "../../../shared/ui/Identifier";
import type { Correction } from "../api/corrections.api";

interface CorrectionsPanelProps {
  corrections: Correction[];
  onResolve: (id: number) => void;
  onReopen: (id: number) => void;
  busyId?: number | null;
}

/**
 * Corrections filed against the cover page or BOM. Screen #20, state 04.
 *
 * Resolved corrections stay on the list. Resolving closes an observation; it does not
 * erase that it was made — which is the whole point of recording it.
 */
export function CorrectionsPanel({
  corrections,
  onResolve,
  onReopen,
  busyId,
}: CorrectionsPanelProps) {
  if (corrections.length === 0) {
    return null;
  }

  const openCount = corrections.filter((c) => c.status === "open").length;

  return (
    <section className="rounded-card border border-border bg-surface mx-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-4">
        <h2 className="text-h2 font-semibold">Corrections</h2>
        <p className="text-small text-subdued">
          {openCount > 0 ? (
            <>
              <span className="font-semibold text-draft-fg">{openCount} open</span>
              {corrections.length - openCount > 0
                ? ` · ${corrections.length - openCount} resolved`
                : null}
            </>
          ) : (
            `${corrections.length} resolved`
          )}
        </p>
      </header>

      <ul>
        {corrections.map((correction) => {
          const isOpen = correction.status === "open";

          return (
            <li
              key={correction.id}
              className="flex flex-wrap items-start gap-3 border-b border-sunken px-5 py-4 last:border-0"
            >
              <span
                className={`mt-0.5 shrink-0 rounded-pill px-2 py-0.5 text-micro font-semibold uppercase tracking-overline ${
                  isOpen
                    ? "bg-draft-bg text-draft-fg"
                    : "bg-approved-bg text-approved-fg"
                }`}
              >
                {isOpen ? "Open" : "Resolved"}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-small font-semibold">
                  <Identifier>{correction.target}</Identifier>
                </p>

                {correction.proposed_value ? (
                  <p className="mt-1 text-small">
                    {correction.current_value ? (
                      <>
                        <span className="text-subdued line-through">
                          <Identifier>{correction.current_value}</Identifier>
                        </span>
                        <span className="mx-1.5 text-subdued">→</span>
                      </>
                    ) : null}
                    <span className="font-semibold">
                      <Identifier>{correction.proposed_value}</Identifier>
                    </span>
                  </p>
                ) : null}

                <p className="mt-1 text-small text-subdued">{correction.reason}</p>

                <p className="mt-1 text-micro text-subdued">
                  Raised by <Identifier>{correction.raised_by}</Identifier>
                  {correction.resolved_by ? (
                    <>
                      {" · resolved by "}
                      <Identifier>{correction.resolved_by}</Identifier>
                    </>
                  ) : null}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  isOpen ? onResolve(correction.id) : onReopen(correction.id)
                }
                disabled={busyId === correction.id}
                className="inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-control border border-border px-3 text-small font-semibold transition hover:bg-sunken disabled:opacity-50"
              >
                {isOpen ? (
                  <>
                    <Check className="size-4" aria-hidden="true" />
                    Resolve
                  </>
                ) : (
                  <>
                    <RotateCcw className="size-4" aria-hidden="true" />
                    Reopen
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
