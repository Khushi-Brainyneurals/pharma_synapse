import { DocHeading } from "./DocHeading";
import type { FlowContent, FlowUnit, TableDef } from "./PaginatedBody";
import {
  RefBodyRow,
  RefTable,
  refColgroup,
  refHeadRows,
  type RefCell,
  type RefTableBlock,
} from "./RefTable";

/**
 * Turn the reference BMR's extracted body (paragraphs + span-aware tables, see
 * data/stageBlocks.json) into paginatable FlowContent, so the manufacturing-stage pages
 * (3.0 Dispensing … 7.0 Coating) flow after the BOM/calculation with the letterhead and
 * footer repeating and nothing ever clipped.
 *
 * Paragraphs become atoms styled by their number pattern (N.0 section, N.M subsection,
 * N.M.K sub-sub, layer bands, notes). Tables are placed whole; a long table with no
 * vertically-merged body cell is split into rows so it paginates and repeats its header.
 */

type PBlock = { t: "p"; text: string };
export type RefDocBlock = PBlock | RefTableBlock;
type Block = RefDocBlock;

const SECTION_RE = /^(\d+)\.0(\s|$)/;
const SUB_RE = /^(\d+)\.(\d+)\s/;
const SUBSUB_RE = /^(\d+)\.(\d+)\.(\d+)/;
const LAYER_RE = /^[A-Z][A-Z\s]+LAYER$/;
const NOTE_RE = /^(note|frequency|during|for description|for the|perform|collect|transfer|set and|estimated|operator|the operator|discard|calculate|send intimation|sampled by|record|evaluation|\*|#|@|\$|•)/i;

function splitNumber(text: string): { num?: string; rest: string } {
  const m = text.match(/^(\d+(?:\.\d+)+)\s+(.*)$/) || text.match(/^(\d+\.0)\s+(.*)$/);
  if (m) return { num: m[1], rest: m[2] };
  return { rest: text };
}

/** One paragraph → a styled atom node. */
function paragraphNode(text: string) {
  if (SECTION_RE.test(text)) {
    const { num, rest } = splitNumber(text);
    return (
      <DocHeading level={1} number={num}>
        {rest || text}
      </DocHeading>
    );
  }
  if (SUBSUB_RE.test(text)) {
    const { num, rest } = splitNumber(text);
    return (
      <DocHeading level={3} number={num}>
        {rest || text}
      </DocHeading>
    );
  }
  if (SUB_RE.test(text)) {
    const { num, rest } = splitNumber(text);
    return (
      <DocHeading level={2} number={num}>
        {rest || text}
      </DocHeading>
    );
  }
  if (LAYER_RE.test(text)) {
    return (
      <p className="mb-1 mt-3 border border-black bg-transparent py-1 text-center text-[8.5pt] font-bold uppercase tracking-wide text-black">
        {text}
      </p>
    );
  }
  // ALL-CAPS label line ending with a colon (e.g. "YIELD RECONCILIATION GRANULATION STAGE:")
  if (/^[A-Z0-9][A-Z0-9 ,/&().'-]+:?$/.test(text) && text.length > 3) {
    return <p className="mb-1 mt-2 text-[8pt] font-bold uppercase text-black">{text}</p>;
  }
  if (NOTE_RE.test(text)) {
    return <p className="mb-1 mt-0.5 text-[6.8pt] italic leading-snug text-black/70">{text}</p>;
  }
  return <p className="mb-1 mt-0.5 text-[7.2pt] leading-snug text-black">{text}</p>;
}

function hasBodyRowspan(block: RefTableBlock): boolean {
  const h = Math.max(block.headerRows, 1);
  return block.rows.slice(h).some((row) => row.some((c) => (c.rs ?? 1) > 1));
}

const SPLIT_MIN_ROWS = 16;

/** Build FlowContent from an ordered list of reference blocks. `keyPrefix` keeps unit
 *  keys unique when several block-runs are merged into one document. */
export function refBlocksToFlow(blocks: Block[], keyPrefix = "rf"): FlowContent {
  const units: FlowUnit[] = [];
  const tables: Record<string, TableDef> = {};
  let lastPText = "";

  blocks.forEach((block, i) => {
    const key = `${keyPrefix}-${i}`;
    if (block.t === "p") {
      // The reference writes some title-only sections twice (6.0 Inspection, 7.0 Coating —
      // once as the section title, once as the stage writer's own heading). Collapse an
      // immediately-repeated identical line.
      if (block.text === lastPText) return;
      lastPText = block.text;
      const isSection = SECTION_RE.test(block.text);
      units.push({
        type: "atom",
        key,
        keep: true, // headings/labels shouldn't strand at a page foot, away from their table
        breakBefore: isSection || undefined,
        node: paragraphNode(block.text),
      });
      return;
    }

    // table
    lastPText = "";
    const splittable = block.nrows >= SPLIT_MIN_ROWS && !hasBodyRowspan(block);
    if (!splittable) {
      units.push({ type: "atom", key, node: <RefTable block={block} /> });
      return;
    }

    const tableId = `${keyPrefix}t-${i}`;
    const headCount = Math.max(block.headerRows, 1);
    tables[tableId] = {
      colgroup: refColgroup(block.ncols),
      thead: refHeadRows({ ...block, headerRows: headCount }),
    };
    block.rows.slice(headCount).forEach((row, r) => {
      units.push({
        type: "row",
        key: `${key}-r${r}`,
        table: tableId,
        node: <RefBodyRow row={row as RefCell[]} />,
      });
    });
  });

  return { units, tables };
}
