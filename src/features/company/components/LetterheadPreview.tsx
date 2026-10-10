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
 * Live letterhead preview — aligned with Document Preview format (Page 15 of UI spec).
 *
 * Shows exactly what prints at the top of every generated document:
 * Logo on the left, centered Company name, divider rule, and BMR title.
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
      className="rounded-card border border-black/80 bg-white p-5 text-black shadow-sm"
      style={{
        fontFamily: FONT_STACKS[fontName] ?? "serif",
        fontSize: fontSize ? `${fontSize}pt` : undefined,
        lineHeight: lineSpacing ?? undefined,
      }}
    >
      {/* Top row: Logo on left, Centered Company Name & details in center */}
      <div className="relative flex min-h-[56px] items-center justify-center pb-3">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="absolute left-0 top-1/2 h-11 max-w-[100px] -translate-y-1/2 object-contain"
          />
        ) : (
          <span className="absolute left-0 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded border border-black/20 bg-black/5 text-micro font-bold">
            LOGO
          </span>
        )}

        <div className="text-center">
          <p className="text-base font-bold tracking-tight">
            {companyName.trim() || "Company name"}
          </p>
          {address.trim() ? (
            <p className="mt-0.5 whitespace-pre-line text-[0.8em] text-black/70">
              {address.trim()}
            </p>
          ) : null}
        </div>
      </div>

      {/* Horizontal divider rule */}
      <div className="border-b-2 border-black" />

      {/* Document title subtitle below rule */}
      <div className="pt-2 text-center">
        <p className="text-[0.82em] font-bold uppercase tracking-wider text-black">
          BATCH MANUFACTURING RECORD
        </p>
        <p className="mt-0.5 text-[0.75em] text-black/75">
          <span className="font-semibold">Department:</span> Production
        </p>
      </div>
    </div>
  );
}
