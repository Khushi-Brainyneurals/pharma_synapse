import { Image as ImageIcon } from "lucide-react";
import { FONT_STACKS } from "../api/company.api";

interface LetterheadPreviewProps {
  companyName: string;
  address: string;
  fontName: string;
  fontSize: number | null;
  lineSpacing: number | null;
  logoUrl: string | null;
}

/**
 * Live letterhead preview — screen #10.
 *
 * Shows exactly what will print at the top of every generated document, in the chosen
 * font. The point of the screen is that the QA reviewer sees the header before it becomes the
 * header on a controlled record, so this renders with the real font stack, not a
 * placeholder.
 */
export function LetterheadPreview({
  companyName,
  address,
  fontName,
  fontSize,
  lineSpacing,
  logoUrl,
}: LetterheadPreviewProps) {
  const empty = !companyName.trim() && !logoUrl;

  if (empty) {
    return (
      <div className="flex min-h-[140px] flex-col items-center justify-center rounded-card border border-dashed border-border-strong bg-sunken p-6 text-center">
        <ImageIcon className="size-6 text-subdued" aria-hidden="true" />
        <p className="mt-2 text-small text-subdued">Your letterhead preview appears here.</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-card border border-border bg-white p-6 text-black"
      style={{
        fontFamily: FONT_STACKS[fontName] ?? "serif",
        fontSize: fontSize ? `${fontSize}pt` : undefined,
        lineHeight: lineSpacing ?? undefined,
      }}
    >
      <div className="flex items-start gap-4 border-b-2 border-black pb-3">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-12 shrink-0 object-contain" />
        ) : (
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded border border-black/20 bg-black/5 text-micro font-bold">
            LOGO
          </span>
        )}

        <div className="min-w-0">
          <p className="truncate font-bold">
            {companyName.trim() || "Company name"}
          </p>
          {address.trim() ? (
            <p className="mt-0.5 whitespace-pre-line text-[0.8em] text-black/70">
              {address.trim()}
            </p>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-center text-[0.75em] uppercase tracking-wide text-black/60">
        Batch Manufacturing Record
      </p>
    </div>
  );
}
