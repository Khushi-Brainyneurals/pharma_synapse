import { useEffect, useState } from "react";
import { fetchLogoObjectUrl } from "../../features/company/api/company.api";

export interface LetterheadField {
  label: string;
  value: React.ReactNode;
}

interface LetterheadProps {
  companyName: string | null;
  department: string | null;
  title: string;
  /** The logo API path (e.g. "/api/company-info/logo"), or null. Fetched here so the
   *  header renders identically everywhere it's used. */
  logoApiUrl: string | null;
  /** Six fields, paired into three rows of two, exactly as the reference letterhead. */
  fields: LetterheadField[];
  /** Header band size in inches (from core inputs). */
  headerInches: number;
}

/**
 * The one, canonical BMR letterhead — used by BOTH the page-1 preview (step 3) and the
 * Cover + BOM document pages (step 4), so they can never drift apart.
 *
 *   ┌ [logo]  Company name ───────────── BATCH MANUFACTURING RECORD ┐
 *   │                                     Department Name: …          │
 *   ├──────────────────────────┬──────────────────────────────────┤
 *   │ Product Name: …          │ Batch Size: …                     │  ← wraps, never truncates
 *   │ BMR No.: …               │ Revision No.: 00                  │
 *   │ Batch No.: …             │ Page: X of Y                      │
 *   └──────────────────────────┴──────────────────────────────────┘
 */
export function Letterhead({
  companyName,
  department,
  title,
  logoApiUrl,
  fields,
  headerInches,
}: LetterheadProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // The header band is inches tall on an ~11.7in page. Clamp to a sane range so a bad
  // stored value (e.g. 16) can't make the header taller than the page — which would
  // collapse the body to zero height and break the measured pagination.
  const bandInches = Math.min(2, Math.max(0.25, Number.isFinite(headerInches) ? headerInches : 0.5));

  useEffect(() => {
    if (!logoApiUrl) {
      setLogoUrl(null);
      return;
    }

    let objectUrl: string | null = null;
    void (async () => {
      objectUrl = await fetchLogoObjectUrl();
      setLogoUrl(objectUrl);
    })();

    return () => {
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [logoApiUrl]);

  return (
    <div className="border border-black">
      {/* Title row: small logo top-left, company + title + department centered. */}
      <div
        className="flex items-center gap-3 border-b border-black px-3 py-1.5"
        style={{ minHeight: `${bandInches}in` }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="w-auto max-w-[110px] shrink-0 object-contain"
            style={{ height: `${bandInches}in` }}
          />
        ) : null}

        <div className="min-w-0 flex-1 text-center leading-tight">
          <p className="font-bold">{companyName ?? <span className="text-black/40">—</span>}</p>
          <p className="text-[0.85em] font-semibold uppercase tracking-wide">{title}</p>
          <p className="text-[0.8em]">
            <span className="font-semibold">Department Name: </span>
            {department ? (
              department
            ) : (
              <span className="text-black/50">[Add Department name]</span>
            )}
          </p>
        </div>
      </div>

      {/* Field grid — two columns. Values WRAP (break-words), so a long product name
          is shown in full instead of being cut off. */}
      <div className="grid grid-cols-2">
        {fields.map((field, index) => (
          <div
            key={field.label}
            className={`flex gap-2 px-3 py-1 ${index % 2 === 0 ? "border-r" : ""} ${
              index >= 2 ? "border-t" : ""
            } border-black/40`}
          >
            <span className="shrink-0 font-semibold">{field.label}:</span>
            <span className="min-w-0 flex-1 break-words">{field.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
