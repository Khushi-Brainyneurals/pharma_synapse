/**
 * Renders one table extracted verbatim from the reference BMR
 * (BMR_2026_022_ideal_bw.docx), preserving its merged cells. The extractor
 * (scratchpad/dump_stage.py) reconstructs Word's gridSpan/vMerge into colSpan/rowSpan
 * and marks header cells by run-bold, so the printed structure is reproduced exactly:
 * black-and-white, bordered, blanks left blank for execution-time entry.
 */

export interface RefCell {
  text: string;
  /** colSpan (omitted when 1). */
  cs?: number;
  /** rowSpan (omitted when 1). */
  rs?: number;
  /** 1 when the source cell's first run is bold (a header/label). */
  b?: 1;
}

export interface RefTableBlock {
  t: "tbl";
  ncols: number;
  nrows: number;
  headerRows: number;
  rows: RefCell[][];
}

const CELL = "border border-black px-1 py-[2px] align-top text-[7pt] leading-[1.15] break-words";

/** A single cell — bold+centred when it is a header/label, otherwise plain; blanks keep
 *  a minimum height so fill-in rows have room. `\n` in the source becomes a line break. */
function Cell({ cell, header }: { cell: RefCell; header: boolean }) {
  const bold = header || cell.b === 1;
  const empty = cell.text.trim() === "";
  return (
    <td
      colSpan={cell.cs}
      rowSpan={cell.rs}
      className={`${CELL} ${bold ? "text-center font-bold" : ""} ${empty ? "min-h-[16px]" : ""} whitespace-pre-line`}
    >
      {empty ? " " : cell.text}
    </td>
  );
}

/** The header rows of a table (used both inline and as a repeated <thead> when the table
 *  is split across pages). */
export function refHeadRows(block: RefTableBlock) {
  const n = block.headerRows;
  if (n <= 0) return null;
  return block.rows.slice(0, n).map((row, r) => (
    <tr key={`h${r}`}>
      {row.map((cell, c) => (
        <Cell key={c} cell={cell} header />
      ))}
    </tr>
  ));
}

/** Even column widths keep wide tables (e.g. the 24-column uniformity grids) from
 *  collapsing; table-fixed + this colgroup gives every grid column an equal share. */
export function refColgroup(ncols: number) {
  const w = `${(100 / ncols).toFixed(4)}%`;
  return (
    <colgroup>
      {Array.from({ length: ncols }).map((_, i) => (
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>
  );
}

/** A body <tr> for a split table (header handled separately by the paginator). */
export function RefBodyRow({ row }: { row: RefCell[] }) {
  return (
    <tr>
      {row.map((cell, c) => (
        <Cell key={c} cell={cell} header={false} />
      ))}
    </tr>
  );
}

/** The whole table rendered as one block (for tables placed whole, not split). */
export function RefTable({ block }: { block: RefTableBlock }) {
  const head = block.headerRows;
  return (
    <table className="mb-2 w-full table-fixed border-collapse">
      {refColgroup(block.ncols)}
      <tbody>
        {block.rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, c) => (
              <Cell key={c} cell={cell} header={r < head} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
