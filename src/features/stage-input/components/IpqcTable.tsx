import { AlertCircle } from "lucide-react";
import { Identifier } from "../../../shared/ui/Identifier";

export interface IpqcRow {
  test: string;
  specification: string;
  frequency: string;
}

interface IpqcTableProps {
  rows: IpqcRow[];
  frequencies: string[];
  onChange: (rows: IpqcRow[]) => void;
}

/**
 * In-process quality control — screen #22, the Compression stage.
 *
 * Every test must carry a sampling frequency. A test with no frequency is an
 * unperformed check: it prints on the BMR as something the operator is supposed to do,
 * with no instruction on when to do it. Hence the row-level error, not just a form-level
 * one — the user has to see WHICH test is missing it.
 */
export function IpqcTable({ rows, frequencies, onChange }: IpqcTableProps) {
  function set(index: number, patch: Partial<IpqcRow>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="overflow-hidden rounded-card border border-border">
      <div
        className="grid items-center gap-x-3 border-b border-border-strong bg-surface px-4 text-overline font-semibold uppercase tracking-overline text-subdued"
        style={{ gridTemplateColumns: "minmax(120px,1fr) minmax(140px,1.4fr) 180px", height: "40px" }}
      >
        <span>Test</span>
        <span>Specification</span>
        <span>Sampling frequency</span>
      </div>

      {rows.map((row, index) => {
        const missing = !row.frequency.trim();

        return (
          <div
            key={row.test || index}
            className="grid items-center gap-x-3 border-b border-sunken px-4 py-2 last:border-0"
            style={{ gridTemplateColumns: "minmax(120px,1fr) minmax(140px,1.4fr) 180px" }}
          >
            <span className="text-small font-medium">{row.test}</span>

            <input
              type="text"
              value={row.specification}
              onChange={(event) => set(index, { specification: event.target.value })}
              placeholder="e.g. 540 – 560 mg"
              className="h-[34px] w-full rounded-control border border-border-strong bg-surface px-2.5 font-mono text-small tabular-nums focus:border-primary focus:outline-none"
            />

            <div>
              <select
                value={row.frequency}
                onChange={(event) => set(index, { frequency: event.target.value })}
                aria-invalid={missing}
                className={`h-[34px] w-full rounded-control border bg-surface px-2 text-small focus:outline-none ${
                  missing
                    ? "border-danger focus:border-danger"
                    : "border-border-strong focus:border-primary"
                }`}
              >
                <option value="">— Assign frequency —</option>
                {frequencies.map((frequency) => (
                  <option key={frequency} value={frequency}>
                    {frequency}
                  </option>
                ))}
              </select>

              {missing ? (
                <p className="mt-1 flex items-center gap-1 text-micro text-danger">
                  <AlertCircle className="size-3" aria-hidden="true" />
                  Assign a frequency
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface CoatingParamRow {
  label: string;
  unit: string;
  value: string;
  /** "MFC" when the value came from the document; "" when typed by hand. */
  source: string;
}

interface CoatingParamsTableProps {
  rows: CoatingParamRow[];
  placeholders: { label: string; unit: string; placeholder: string }[];
  onChange: (rows: CoatingParamRow[]) => void;
}

/**
 * Coating process parameters — screen #22.
 *
 * The design shows two sub-states: values fetched from the MFC, and a manual fallback.
 * Provenance is shown per row, because "the MFC said 55 °C" and "someone typed 55 °C"
 * are different claims on a regulated record.
 */
export function CoatingParamsTable({ rows, placeholders, onChange }: CoatingParamsTableProps) {
  function set(index: number, value: string) {
    onChange(
      rows.map((row, i) =>
        i === index
          ? // Typing over an MFC value makes it a manual entry — the provenance changes
            // with it, or the record would claim the MFC said something it didn't.
            { ...row, value, source: value === row.value ? row.source : "" }
          : row,
      ),
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((row, index) => {
        const hint = placeholders.find((p) => p.label === row.label);

        return (
          <div key={row.label}>
            <label className="flex items-baseline justify-between gap-2 text-small font-medium">
              <span>{row.label}</span>
              {row.source ? (
                <span className="shrink-0 rounded-pill bg-accent-soft px-1.5 text-micro font-semibold text-primary-dark">
                  from {row.source}
                </span>
              ) : null}
            </label>

            <div className="mt-1 flex items-center gap-2">
              <input
                type="text"
                value={row.value}
                onChange={(event) => set(index, event.target.value)}
                placeholder={hint?.placeholder}
                className="h-[34px] min-w-0 flex-1 rounded-control border border-border-strong bg-surface px-2.5 font-mono text-small tabular-nums focus:border-primary focus:outline-none"
              />
              <span className="w-14 shrink-0 text-small text-subdued">
                <Identifier>{row.unit}</Identifier>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
