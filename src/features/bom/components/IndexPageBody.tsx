interface IndexPageBodyProps {
  /** Numbered manufacturing stages for the index. Defaults to the standard tablet BMR
   *  set; the real list follows the stages chosen in step 5. */
  stages?: string[];
}

const DEFAULT_STAGES = ["Dispensing", "Granulation", "Compression", "Inspection", "Coating"];

/**
 * "INDEX" — page 2 of the document (reference BMR_2026_022_ideal_bw, page 2). Three
 * black-and-white tables: the numbered stage index (with a Total-pages-issued and a
 * Reconciliation-of-Pages row), the list of attachments, and the pages-reconciliation
 * sign-off. Port of the ai-backend renderer (doc_builder._add_index_table).
 */
export function IndexPageBody({ stages = DEFAULT_STAGES }: IndexPageBodyProps) {
  const PRE = ["Signature Log", "Master Formulation Sheet (Bill of Materials)"];
  const POST = [
    "Deviation / Any other observation",
    "Release of Batch for Packing",
    "Other attachments",
  ];

  const entries: [string, string][] = [];
  let n = 1;
  for (const title of PRE) entries.push([`${n++}.0`, title]);
  for (const stage of stages) entries.push([`${n++}.0`, stage]);
  for (const title of POST) entries.push([`${n++}.0`, title]);

  const cell = "border border-black px-1.5 py-0.5 align-top";
  const hdr = `${cell} text-center font-bold`;

  return (
    <div className="flex h-full flex-col text-[8pt] leading-tight text-black">
      <p className="mb-1 font-bold">INDEX</p>

      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col style={{ width: "9%" }} />
          <col style={{ width: "46%" }} />
          <col style={{ width: "20%" }} />
          <col style={{ width: "25%" }} />
        </colgroup>
        <thead>
          <tr>
            <th className={hdr}>Sr. No.</th>
            <th className={hdr}>Title of Stage</th>
            <th className={hdr}>Page No.</th>
            <th className={hdr}>No of Additional pages (if issued)</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([sr, title]) => (
            <tr key={sr}>
              <td className={`${cell} text-center tabular-nums`}>{sr}</td>
              <td className={cell}>{title}</td>
              <td className={cell}>&nbsp;</td>
              <td className={cell}>&nbsp;</td>
            </tr>
          ))}
          <tr>
            <td colSpan={2} className={`${cell} font-bold`}>
              Total pages issued
            </td>
            <td className={cell}>&nbsp;</td>
            <td className={cell}>&nbsp;</td>
          </tr>
          <tr>
            <td colSpan={4} className={cell}>
              Reconciliation of Pages
            </td>
          </tr>
        </tbody>
      </table>

      <table className="mt-3 w-full table-fixed border-collapse">
        <colgroup>
          <col style={{ width: "9%" }} />
          <col style={{ width: "55%" }} />
          <col style={{ width: "36%" }} />
        </colgroup>
        <thead>
          <tr>
            <th className={hdr}>Sr. No.</th>
            <th className={hdr}>List of Attachments</th>
            <th className={hdr}>No. of Pages</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}>
              <td className={cell}>&nbsp;</td>
              <td className={cell}>&nbsp;</td>
              <td className={cell}>&nbsp;</td>
            </tr>
          ))}
          <tr>
            <td colSpan={2} className={`${cell} font-bold`}>
              Total Pages of list of attachments
            </td>
            <td className={cell}>&nbsp;</td>
          </tr>
        </tbody>
      </table>

      <table className="mt-3 w-full table-fixed border-collapse">
        <tbody>
          <tr>
            <td className={hdr}>Pages Reconciliation done by (Production) Sign &amp; Date</td>
            <td className={hdr}>Pages Reconciliation Verified by (QA) Sign &amp; Date</td>
          </tr>
          <tr>
            <td className={`${cell} h-8`}>&nbsp;</td>
            <td className={`${cell} h-8`}>&nbsp;</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
