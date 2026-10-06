import { MessageSquarePlus } from "lucide-react";
import { useMemo, useState } from "react";
import { Identifier } from "../../../shared/ui/Identifier";
import type { BomIngredient } from "../api/bom.types";

/**
 * Bill of materials — master formulation sheet. Screen #20.
 *
 * Column grid is taken verbatim from the designed screen:
 *   34px 80px minmax(118px,1.4fr) 50px 64px 66px 52px 64px minmax(94px,1.2fr)
 *   Sr · Material code · Ingredient · Spec · Qty mg/unit · Qty kg/batch ·
 *   Overage % · Net qty req. · Functional cat.
 * Rows are 40px (--row-h), hairline-separated, grouped Part → Layer, with the
 * add-correction affordance revealed on row hover.
 *
 * "Overage %" is NOT in the MFC extraction. It renders as an explicit em-dash, never
 * an empty cell — a blank in an overage column reads as "no overage", which is a
 * different and dangerous claim on a formulation sheet.
 */
const GRID =
  "34px 80px minmax(118px,1.4fr) 50px 64px 66px 52px 64px minmax(94px,1.2fr)";

interface BomTableProps {
  ingredients: BomIngredient[];
  batchSize: number | null;
  /** Rows the user has raised a correction against. */
  correctedRows?: Set<number>;
  onAddCorrection?: (row: BomIngredient, index: number) => void;
}

export function BomTable({
  ingredients,
  batchSize,
  correctedRows,
  onAddCorrection,
}: BomTableProps) {
  const [exceptionsOnly, setExceptionsOnly] = useState(false);

  const groups = useMemo(() => groupRows(ingredients), [ingredients]);
  const exceptionCount = ingredients.filter(isException).length;

  return (
    <section className="overflow-hidden rounded-card border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-h2 font-semibold">Bill of materials — master formulation sheet</h2>
          <p className="mt-0.5 text-small text-subdued">
            {batchSize ? (
              <>
                scaled · <Identifier>{batchSize.toLocaleString()}</Identifier> units
              </>
            ) : (
              "not yet scaled"
            )}
          </p>
        </div>

        {exceptionCount > 0 ? (
          <button
            type="button"
            onClick={() => setExceptionsOnly((on) => !on)}
            aria-pressed={exceptionsOnly}
            className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-small font-medium transition ${
              exceptionsOnly
                ? "border-primary bg-accent-soft text-primary-dark"
                : "border-border text-subdued hover:border-primary hover:text-primary-dark"
            }`}
          >
            Show exceptions only
            <span className="rounded-pill bg-sunken px-1.5 text-micro">{exceptionCount}</span>
          </button>
        ) : null}
      </header>

      <div className="overflow-x-auto">
        <div className="min-w-[46rem]" role="table">
          {/* Header rule — the design uses --line-strong under the head. */}
          <div
            role="row"
            className="grid items-center gap-x-1.5 border-b border-border-strong bg-surface px-[10px] pr-[34px] text-micro font-semibold uppercase tracking-overline text-subdued"
            style={{ gridTemplateColumns: GRID, height: "40px" }}
          >
            <span>Sr</span>
            <span>Material code</span>
            <span>Ingredient</span>
            <span>Spec</span>
            <span className="text-right">Qty mg/unit</span>
            <span className="text-right">Qty kg/batch</span>
            <span className="text-right">Overage %</span>
            <span className="text-right">Net qty req.</span>
            <span>Functional cat.</span>
          </div>

          {groups.map((group) => {
            const groupExceptions = group.rows.filter(({ row }) => isException(row)).length;
            if (exceptionsOnly && groupExceptions === 0) {
              return null;
            }

            return (
              <div key={group.key}>
                {/* Part → Layer divider */}
                <div
                  className="flex items-center gap-2 border-b border-border bg-sunken px-[10px] py-1.5"
                  role="row"
                >
                  <span className="text-micro font-semibold uppercase tracking-overline text-text">
                    {group.part}
                  </span>
                  {group.layer ? (
                    <span className="text-micro text-subdued">{group.layer}</span>
                  ) : null}
                </div>

                {group.rows.map(({ row, index }) => {
                  const exception = isException(row);
                  if (exceptionsOnly && !exception) {
                    return null;
                  }

                  // Subtotal rows ("Avg. wt. of X Tablet") are not ingredients.
                  if (row.is_avg_weight) {
                    return (
                      <div
                        key={index}
                        role="row"
                        className="grid items-center gap-x-1.5 border-b border-sunken bg-sunken/50 px-[10px] pr-[34px] text-small font-semibold"
                        style={{ gridTemplateColumns: GRID, height: "40px" }}
                      >
                        <span />
                        <span />
                        <span className="truncate">{row.name}</span>
                        <span />
                        <span className="text-right">
                          <Num value={row.label_claim_mg_per_unit} />
                        </span>
                        <span className="text-right">
                          <Num value={row.qty_per_mfc_batch} />
                        </span>
                        <span />
                        <span className="text-right">
                          <Num value={row.qty_required_production} />
                        </span>
                        <span />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={index}
                      role="row"
                      className="group relative grid items-center gap-x-1.5 border-b border-sunken px-[10px] pr-[34px] text-small transition hover:bg-sunken/60"
                      style={{ gridTemplateColumns: GRID, height: "40px" }}
                    >
                      <span className="text-subdued">
                        <Identifier>{String(row.sr_no ?? "").padStart(2, "0")}</Identifier>
                      </span>

                      <span className="truncate">
                        {row.material_code ? (
                          <Identifier>{row.material_code}</Identifier>
                        ) : (
                          <NotCaptured />
                        )}
                      </span>

                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate">{row.name}</span>
                        {row.is_api ? (
                          <span className="shrink-0 rounded-pill bg-accent-soft px-1.5 text-micro font-semibold text-primary-dark">
                            API
                          </span>
                        ) : null}
                      </span>

                      <span className="truncate text-subdued">
                        {row.specification ?? <NotCaptured />}
                      </span>

                      <span className="text-right">
                        <Num value={row.label_claim_mg_per_unit} />
                      </span>
                      <span className="text-right">
                        <Num value={row.qty_per_mfc_batch} />
                      </span>

                      {/* Never blank — see the component docstring. */}
                      <span className="text-right text-subdued">
                        {row.overage_pct !== null && row.overage_pct !== undefined ? (
                          <Identifier>{row.overage_pct}</Identifier>
                        ) : (
                          <span title="Not carried by the MFC">—</span>
                        )}
                      </span>

                      <span className="text-right font-semibold">
                        <Num value={row.qty_required_production} />
                      </span>

                      <span className="truncate text-subdued">
                        {row.functional_category ?? <NotCaptured />}
                      </span>

                      {/* Add correction — revealed on hover, as in the design. */}
                      {onAddCorrection ? (
                        <button
                          type="button"
                          onClick={() => onAddCorrection(row, index)}
                          title="Add a correction to this row"
                          aria-label={`Add a correction to ${row.name}`}
                          className={`absolute right-1 inline-flex size-7 items-center justify-center rounded-sm text-subdued transition hover:bg-sunken hover:text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary ${
                            correctedRows?.has(index)
                              ? "opacity-100 text-primary-dark"
                              : "opacity-0 group-hover:opacity-100 focus:opacity-100"
                          }`}
                        >
                          <MessageSquarePlus className="size-4" aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** A row is an exception when the MFC didn't give us something the sheet needs. */
function isException(row: BomIngredient): boolean {
  if (row.is_avg_weight) {
    return false;
  }

  return (
    !row.material_code ||
    !row.specification ||
    !row.functional_category ||
    !row.qty_required_production
  );
}

interface Grouped {
  key: string;
  part: string;
  layer: string | null;
  rows: { row: BomIngredient; index: number }[];
}

/**
 * Grouped Part → Layer, as the sheet prints.
 *
 * The layer is part of the key: on a bi-layer tablet the same part name repeats per
 * layer, and merging them would collapse two different formulations into one block.
 */
function groupRows(ingredients: BomIngredient[]): Grouped[] {
  const groups = new Map<string, Grouped>();

  ingredients.forEach((row, index) => {
    const part = row.part || "Formulation";
    const layer = row.layer || null;
    const key = `${part}::${layer ?? ""}`;

    const existing = groups.get(key);
    if (existing) {
      existing.rows.push({ row, index });
    } else {
      groups.set(key, { key, part, layer, rows: [{ row, index }] });
    }
  });

  return [...groups.values()];
}

function Num({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) {
    return <span className="text-subdued">—</span>;
  }

  return (
    <Identifier>
      {value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
    </Identifier>
  );
}

/** Explicit, not blank: "we didn't capture this" ≠ "there isn't one". */
function NotCaptured() {
  return (
    <span className="text-subdued" title="Not found in the MFC">
      —
    </span>
  );
}
