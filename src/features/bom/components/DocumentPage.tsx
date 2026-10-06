import { Letterhead, type LetterheadField } from "../../../shared/document/Letterhead";
import type { DocumentHeader } from "../api/bom.types";

interface DocumentPageProps {
  header: DocumentHeader;
  /** 1-based page number and the total, for "Page X of Y". */
  pageNo: number;
  pageCount: number;
  /** Header band size in inches (from core inputs; default 0.5). */
  headerInches?: number;
  /** Let the sheet grow to fit its content instead of a fixed A4 aspect. Content-heavy
   *  pages (BOM table, calculation worksheet) span several printed pages and would be
   *  clipped by the fixed height — they set this so nothing is cut off. */
  grow?: boolean;
  /** Ref to the body area (the region between header and footer). The paginator attaches
   *  this to a fixed A4 sheet to measure how much vertical space one printed page has for
   *  content, so it can break the BOM/calc flow at real page boundaries. */
  bodyRef?: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
}

/**
 * One printed page of the BMR — an A4 sheet with the shared letterhead at the top and
 * the footer at the bottom, both repeating on every page (reference:
 * BMR_2026_022_ideal_bw.docx). The body is whatever is passed in.
 *
 * The header is the SAME shared Letterhead the page-1 preview uses, so the two screens
 * never diverge — only the field values differ (here they're filled from the AI
 * extraction; on the preview they're mostly "From MFC" placeholders).
 */
export function DocumentPage({
  header,
  pageNo,
  pageCount,
  headerInches = 0.5,
  grow = false,
  bodyRef,
  children,
}: DocumentPageProps) {
  const blank = <span className="text-black/40">&nbsp;</span>;

  const fields: LetterheadField[] = [
    { label: "Product Name", value: header.product_name ?? blank },
    { label: "Batch Size", value: header.batch_size ?? blank },
    { label: "BMR No.", value: header.bmr_number ?? blank },
    { label: "Revision No.", value: header.revision_number ?? "00" },
    { label: "Batch No.", value: blank },
    { label: "Page", value: `${pageNo} of ${pageCount}` },
  ];

  // A page is at LEAST A4 tall, but grows to fit its content instead of clipping it —
  // so a slightly-off measurement on another screen pushes overflow visible/onto the
  // next sheet rather than hiding a row. (A4 at 794px wide ≈ 1123px tall.)
  const shell = grow
    ? "mx-auto flex min-h-[1123px] w-full max-w-[794px] flex-col rounded-sm bg-white text-[9pt] text-black shadow-modal"
    : "mx-auto flex aspect-[210/297] w-full max-w-[794px] flex-col overflow-hidden rounded-sm bg-white text-[9pt] text-black shadow-modal";

  return (
    <div className={shell}>
      <div className={`flex flex-1 flex-col p-[5%] ${grow ? "" : "h-full"}`}>
        <div className="shrink-0">
          <Letterhead
            companyName={header.company_name}
            department={header.department}
            title={header.doc_title}
            logoApiUrl={header.logo_url}
            fields={fields}
            headerInches={headerInches}
          />
        </div>

        <div ref={bodyRef} className={`min-h-0 flex-1 pt-2 ${grow ? "" : "overflow-hidden"}`}>
          {children}
        </div>

        <div className="mt-2 shrink-0 border-t border-black/50 pt-1 text-center text-[7.5pt] text-black/60">
          {header.template_no ? `Template No. ${header.template_no}` : " "}
        </div>
      </div>
    </div>
  );
}
