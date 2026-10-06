import { Layers } from "lucide-react";
import { Identifier } from "../../../shared/ui/Identifier";
import type { BomCover } from "../api/bom.types";

/**
 * Batch manufacturing record — Cover page. Screen #20.
 *
 * Three field registers, and conflating them is the mistake to avoid:
 *   value           — read from the MFC
 *   not captured    — the MFC has no such field. Said out loud, because an omitted
 *                     field on a cover page reads as "this product has none".
 *   at issuance     — deliberately blank, hand-filled when the batch is issued.
 */
interface CoverField {
  label: string;
  value?: string | null;
  mono?: boolean;
  atIssuance?: boolean;
  wide?: boolean;
}

interface CoverPanelProps {
  cover: BomCover;
  onConfirmLayers?: () => void;
  layersConfirmed?: boolean;
  /** Click any field to raise a correction against it — screen #20, state 03. */
  onAddCorrection?: (label: string, currentValue: string | null) => void;
}

export function CoverPanel({
  cover,
  onConfirmLayers,
  layersConfirmed,
  onAddCorrection,
}: CoverPanelProps) {
  const fields: CoverField[] = [
    { label: "Product code", value: cover.product_code, mono: true },
    { label: "Finished-goods code", value: cover.finished_goods_code, mono: true },
    { label: "MFR no.", value: cover.mfc_number, mono: true },

    { label: "BMR no.", value: cover.bmr_number, mono: true },
    {
      label: "Theoretical batch size",
      value: cover.theoretical_batch_size
        ? `${cover.theoretical_batch_size.toLocaleString()} ${cover.mfc_batch_size_uom ?? "units"}`
        : null,
      mono: true,
    },
    {
      label: "Theoretical batch weight",
      value: cover.theoretical_batch_wt ? `${cover.theoretical_batch_wt} kg` : null,
      mono: true,
    },

    { label: "Licence no.", value: cover.licence_no, mono: true },
    { label: "Storage condition", value: cover.storage_condition, wide: true },
    { label: "Pack style", value: cover.pack_style },

    { label: "Market", value: cover.market },
    { label: "Pharmacological action", value: cover.pharmacological_action, wide: true },
    { label: "Shelf life", value: cover.shelf_life },

    // Hand-filled on the shop floor when the batch is issued.
    { label: "Batch no.", atIssuance: true },
    { label: "Mfg date", atIssuance: true },
    { label: "Exp date", atIssuance: true },
  ];

  const isBiLayer = cover.layers.length > 1;

  return (
    <section className="rounded-card border border-border bg-surface">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-h2 font-semibold tracking-tight">
          Batch manufacturing record — Cover page
        </h2>
        <p className="mt-2 text-body font-semibold">
          {cover.product_name ?? <NotCaptured />}
        </p>
        {cover.label_claim ? (
          <p className="mt-0.5 text-small text-subdued">{cover.label_claim}</p>
        ) : null}
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => (
          <div key={field.label} className={field.wide ? "lg:col-span-2" : undefined}>
            <dt className="text-overline font-semibold uppercase tracking-overline text-subdued">
              {field.label}
            </dt>
            <dd className="mt-1 text-small">
              {onAddCorrection && !field.atIssuance ? (
                <button
                  type="button"
                  onClick={() => onAddCorrection(field.label, field.value ?? null)}
                  title={`Raise a correction against ${field.label}`}
                  className="rounded-sm text-left transition hover:bg-sunken focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <FieldValue field={field} />
                </button>
              ) : (
                <FieldValue field={field} />
              )}
            </dd>
          </div>
        ))}
      </dl>

      {/* Layer structure — if the parts map to the wrong layer, every downstream
          quantity does too, so the user confirms it before the BOM is trusted. */}
      {cover.layers.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-border bg-sunken px-5 py-4">
          <Layers className="size-4 shrink-0 text-subdued" aria-hidden="true" />

          <p className="text-small">
            <span className="text-subdued">Layers:</span>{" "}
            <span className="font-semibold">{cover.layers.join(" / ")}</span>
          </p>

          <span className="rounded-pill bg-draft-bg px-2 py-0.5 text-micro font-semibold uppercase tracking-overline text-draft-fg">
            {isBiLayer ? `${cover.layers.length}-layer` : "Single layer"}
          </span>
          <span className="text-micro text-subdued">detected from MFC</span>

          <p className="w-full text-small text-subdued sm:w-auto sm:flex-1">
            Confirm the structure so the BOM parts map to the correct layer.
          </p>

          {onConfirmLayers ? (
            <button
              type="button"
              onClick={onConfirmLayers}
              disabled={layersConfirmed}
              className="inline-flex items-center gap-1.5 rounded-control border border-primary bg-accent-soft px-3 py-1.5 text-small font-semibold text-primary-dark transition hover:bg-accent-soft/70 disabled:opacity-60"
            >
              {layersConfirmed ? "Layer structure confirmed" : "Confirm layer structure"}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function FieldValue({ field }: { field: CoverField }) {
  if (field.atIssuance) {
    return <span className="italic text-subdued">Filled at issuance</span>;
  }

  if (!field.value) {
    return <NotCaptured />;
  }

  return field.mono ? (
    <Identifier className="font-semibold">{field.value}</Identifier>
  ) : (
    <span className="font-medium">{field.value}</span>
  );
}

function NotCaptured() {
  return (
    <span className="text-draft-fg" title="The MFC does not carry this field">
      Not captured
    </span>
  );
}
