import type { BomCover } from "../api/bom.types";

interface CoverPageBodyProps {
  cover: BomCover;
  onAddCorrection?: (label: string, currentValue: string | null) => void;
}

/**
 * Page 1 of the document — the cover, laid out exactly as the reference (BMR page 1):
 * a bordered grid where three wide rows span the full width, the middle block is a
 * four-column label/value/label/value grid, and the Approval & Authorization block
 * closes it. Black-and-white only — cells are distinguished by bold labels and black
 * rules, never by fill (matching the printed BMR).
 *
 * Field registers:
 *   value  — read from the MFC / filled by the AI extraction
 *   blank  — filled by hand at issuance (dates, batch no., protocol nos.) → a ruled line
 *   —      — captured by neither
 */
type Field =
  | { label: string; value: string | null; kind: "value" }
  | { label: string; kind: "blank" };

export function CoverPageBody({ cover, onAddCorrection }: CoverPageBodyProps) {
  const fmt = (n: number | null | undefined, suffix = "") =>
    n === null || n === undefined ? null : `${n.toLocaleString()}${suffix}`;

  const wideTop: Field[] = [
    { label: "Name of Product", value: cover.product_name, kind: "value" },
    { label: "Generic Name of Product", value: cover.generic_name, kind: "value" },
    { label: "Label claim", value: cover.label_claim, kind: "value" },
  ];

  // The paired middle block — left label/value, right label/value — row for row as the
  // reference cover. Hand-filled fields (dates, batch no., protocol nos.) are ruled blanks.
  const pairs: [Field, Field][] = [
    [
      { label: "Semi finish code No. / Product code", value: cover.product_code, kind: "value" },
      { label: "Master Formula card number", value: cover.mfc_number, kind: "value" },
    ],
    [
      // BMR No. is known but deliberately left blank at this stage — filled later.
      { label: "Batch Manufacturing Record No.", kind: "blank" },
      { label: "Theoretical Batch size", value: fmt(cover.theoretical_batch_size), kind: "value" },
    ],
    [
      { label: "Revision No.", value: cover.revision_number ?? "00", kind: "value" },
      {
        label: "Theoretical Batch Wt.",
        value:
          cover.theoretical_batch_wt != null ? `${cover.theoretical_batch_wt.toFixed(3)} kg` : null,
        kind: "value",
      },
    ],
    [
      { label: "Supersedes", value: cover.supersedes, kind: "value" },
      { label: "Shelf Life", value: cover.shelf_life, kind: "value" },
    ],
    [
      { label: "Effective Date", kind: "blank" },
      { label: "Mfg. Lic. No.", value: cover.licence_no, kind: "value" },
    ],
    [
      { label: "Batch No.", kind: "blank" },
      { label: "Market", value: cover.market, kind: "value" },
    ],
    [
      { label: "Mfg. date", kind: "blank" },
      { label: "Date of Started", kind: "blank" },
    ],
    [
      { label: "Exp. date", kind: "blank" },
      { label: "Date of Completed", kind: "blank" },
    ],
    [
      { label: "Process validation protocol No.", kind: "blank" },
      { label: "Hold time study protocol No.", kind: "blank" },
    ],
  ];

  const productDescription: Field = {
    label: "Product description",
    value: cover.product_description,
    kind: "value",
  };

  return (
    <div className="flex h-full flex-col text-[8pt] leading-tight">
      <h2 className="mb-1.5 text-[11pt] font-bold uppercase leading-tight">
        Batch Manufacturing Record
      </h2>
      <div className="border border-b-0 border-black">
        {wideTop.map((field) => (
          <div key={field.label} className="grid grid-cols-[27%_73%] border-b border-black">
            <LabelCell>{field.label}</LabelCell>
            <ValueCell field={field} onAddCorrection={onAddCorrection} last />
          </div>
        ))}

        {pairs.map(([left, right]) => (
          <div
            key={left.label}
            className="grid grid-cols-[27%_23%_27%_23%] border-b border-black"
          >
            <LabelCell>{left.label}</LabelCell>
            <ValueCell field={left} onAddCorrection={onAddCorrection} />
            <LabelCell>{right.label}</LabelCell>
            <ValueCell field={right} onAddCorrection={onAddCorrection} last />
          </div>
        ))}

        <div className="grid grid-cols-[27%_73%] border-b border-black">
          <LabelCell>{productDescription.label}</LabelCell>
          <ValueCell field={productDescription} onAddCorrection={onAddCorrection} last />
        </div>
      </div>

      {/* Approval & Authorization — the signature block at the foot of the cover. */}
      <div className="mt-4">
        <h2 className="mb-1.5 text-[11pt] font-bold uppercase leading-tight">
          Approval &amp; Authorization
        </h2>
        <div className="grid grid-cols-[22%_20%_20%_20%_18%] border border-black text-[7.5pt]">
          {["", "Name", "Department", "Designation", "Signature & date"].map((h, i) => (
            <div
              key={i}
              className="min-h-[1.4em] border-r border-black px-1.5 py-1 font-semibold last:border-r-0"
            >
              {h}
            </div>
          ))}
          {["Prepared By", "Reviewed By", "Reviewed By", "Approved By", "Authorized By"].map(
            (role, i) => (
              <div key={`${role}-${i}`} className="contents">
                <div className="border-r border-t border-black px-1.5 py-2 font-semibold">
                  {role}
                </div>
                <div className="border-r border-t border-black" />
                <div className="border-r border-t border-black" />
                <div className="border-r border-t border-black" />
                <div className="border-t border-black" />
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function LabelCell({ children }: { children: React.ReactNode }) {
  return <div className="border-r border-black px-2 py-1 font-semibold">{children}</div>;
}

function ValueCell({
  field,
  onAddCorrection,
  last,
}: {
  field: Field;
  onAddCorrection?: (label: string, currentValue: string | null) => void;
  last?: boolean;
}) {
  const border = last ? "" : "border-r border-black";
  const value = field.kind === "value" ? field.value : null;

  // A field the extraction didn't carry, or one filled in later (dates, batch/BMR
  // no.), renders as a plain blank cell — no ruled line, no dash.
  if (!value) {
    return <div className={`px-2 py-1 ${border}`}>&nbsp;</div>;
  }

  return (
    <button
      type="button"
      disabled={!onAddCorrection}
      onClick={() => onAddCorrection?.(field.label, value)}
      className={`px-2 py-1 text-left ${border} enabled:hover:bg-black/[0.06] disabled:cursor-default`}
    >
      <span className="whitespace-pre-line break-words">{value}</span>
    </button>
  );
}
