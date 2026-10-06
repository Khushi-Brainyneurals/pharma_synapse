import { AlertTriangle } from "lucide-react";
import { Letterhead, type LetterheadField } from "../../../shared/document/Letterhead";
import type { PreviewField, PreviewResponse } from "../api/preview.types";

interface PageOneRenderProps {
  preview: PreviewResponse;
}

/**
 * Page 1 as it will print — a full A4 sheet using the SHARED letterhead (the same
 * component the Cover + BOM document pages use, so the header can never drift between
 * the two screens). Here the header fields are mostly "From MFC" placeholders; they get
 * filled once the MFC is read.
 *
 * Both formatting inputs are applied so their effect is visible before they become the
 * settings on a controlled document:
 *   - font size (company standard info) → the page's text size
 *   - header/footer size (core inputs)  → the header + footer band heights
 */
export function PageOneRender({ preview }: PageOneRenderProps) {
  const { company, formatting, header_fields } = preview;

  const clamp = (v: number) => Math.min(Math.max(v || 0.5, 0.4), 1.5);
  const headerInches = clamp(formatting.header_size);
  const footerInches = clamp(formatting.footer_size);

  const fields: LetterheadField[] = header_fields.map((field) => ({
    label: field.label,
    value: <FieldValue field={field} />,
  }));

  return (
    <div className="mx-auto flex aspect-[210/297] w-full max-w-[794px] flex-col overflow-hidden rounded-sm bg-white text-[9pt] text-black shadow-modal">
      <div
        className="relative flex h-full flex-col p-[5%]"
        style={{
          fontFamily: `"${formatting.font_name}", serif`,
          fontSize: `${formatting.font_size}pt`,
          lineHeight: formatting.line_spacing,
        }}
      >
        {/* DRAFT watermark across the whole sheet. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
        >
          <span className="-rotate-45 select-none text-[11rem] font-bold tracking-widest text-black/[0.05]">
            DRAFT
          </span>
        </div>

        <div className="relative z-10 shrink-0">
          <Letterhead
            companyName={company.name}
            department={company.department}
            title={preview.title}
            logoApiUrl={company.logo_url}
            fields={fields}
            headerInches={headerInches}
          />
        </div>

        {/* Body — deliberately blank; fills from the MFC at the next step. */}
        <div className="relative z-10 flex flex-1 items-center justify-center">
          <p className="select-none text-center text-[0.85em] italic text-black/30">
            Document content is generated from the MFC after this step.
          </p>
        </div>

        {/* Footer — only the Template No.; the page number is in the header. */}
        <div
          className="relative z-10 flex shrink-0 items-center justify-center border-t border-black/40 pt-2 text-[0.8em] text-black/60"
          style={{ minHeight: `${footerInches}in` }}
        >
          {formatting.template_no ? (
            `Template No. ${formatting.template_no}`
          ) : (
            <MissingInline label="No Template No." />
          )}
        </div>
      </div>
    </div>
  );
}

function FieldValue({ field }: { field: PreviewField }) {
  if (field.status === "blank") {
    return (
      <span className="inline-flex w-full items-baseline gap-1">
        <span className="min-w-16 flex-1 border-b border-dotted border-black/40">&nbsp;</span>
        {field.unit ? <span className="text-black/60">{field.unit}</span> : null}
      </span>
    );
  }

  if (field.status === "pending" || !field.value) {
    return (
      <span className="inline-flex items-center gap-1 font-normal text-amber-700">
        <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
        <span className="text-[0.85em]">From MFC</span>
      </span>
    );
  }

  return (
    <span>
      {field.value}
      {field.note ? <span className="ml-1 text-black/50">({field.note})</span> : null}
    </span>
  );
}

function MissingInline({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[0.8em] font-normal text-amber-700">
      <AlertTriangle className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
