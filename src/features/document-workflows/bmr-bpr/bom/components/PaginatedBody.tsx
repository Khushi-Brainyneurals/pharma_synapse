import {
  cloneElement,
  isValidElement,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import type { DocumentHeader } from "../api/bom.types";
import { DocumentPage } from "./DocumentPage";

/**
 * Flow the BOM + Active-Material-Calculation content across REAL A4 pages, the way the
 * printed BMR breaks it (reference pages 5–10): the header/footer repeat on every sheet,
 * a long table carries its column header onto each continued page, and a page never
 * clips — content that doesn't fit moves to the next sheet.
 *
 * The browser is the only thing that knows how tall a rendered row or paragraph actually
 * is, so pagination is measured, not guessed:
 *   1. An empty fixed A4 sheet is rendered off-screen to learn how much body height one
 *      printed page has (this already accounts for the letterhead + footer + margins).
 *   2. The whole flow is rendered off-screen once, and every breakable unit (each table
 *      row, each paragraph/sub-table) is measured.
 *   3. Units are packed greedily into pages that fit that budget; a table's column header
 *      is re-reserved at the top of each page it continues onto.
 *
 * If measurement hasn't happened yet (first paint) the whole flow renders on one growing
 * sheet — visible and un-clipped — until the measured layout replaces it.
 */

/** A repeated table skeleton (column widths + header row) for a row group. */
export interface TableDef {
  colgroup: ReactNode;
  /** The header row(s) — rendered inside a <thead> and repeated on every continued page. */
  thead: ReactNode;
}

/**
 * One breakable unit of the document flow.
 *   atom — a self-contained block (heading, paragraph, small table) placed whole.
 *   row  — one <tr> of a large table identified by `table`; consecutive rows regroup into
 *          a single <table> per page, with the table's header repeated.
 */
export type FlowUnit =
  | { type: "atom"; key: string; keep?: boolean; breakBefore?: boolean; node: ReactNode }
  // `keep` on a row means "don't strand this at the foot of a page" — a Layer/Part
  // header is carried to the next sheet with the rows it introduces.
  | { type: "row"; key: string; table: string; keep?: boolean; node: ReactNode };

export interface FlowContent {
  units: FlowUnit[];
  tables: Record<string, TableDef>;
}

/** Concatenate flow sections (e.g. the BOM table followed by the calculation worksheet). */
export function mergeFlow(...parts: FlowContent[]): FlowContent {
  return {
    units: parts.flatMap((part) => part.units),
    tables: Object.assign({}, ...parts.map((part) => part.tables)),
  };
}

interface PaginatedBodyProps {
  header: DocumentHeader;
  headerInches: number;
  /** Rendered as fixed page 1 (the cover), ahead of the paginated flow. */
  cover?: ReactNode;
  content: FlowContent;
}

/** pt-2 on the body (0.5rem) plus a safety cushion for sub-pixel rounding and the header
 *  settling after the async logo loads — pagination should break early, never clip. */
const BODY_PADDING_TOP = 8;
const SAFETY = 18;

export function PaginatedBody({ header, headerInches, cover, content }: PaginatedBodyProps) {
  const { units, tables } = content;

  const budgetRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const signatureRef = useRef<string>("");

  const [layout, setLayout] = useState<{ pages: FlowUnit[][]; grows: boolean[] } | null>(null);

  // Re-measuring must start clean whenever the content changes, or a stale layout from a
  // previous document would show through until the observer fires.
  useLayoutEffect(() => {
    signatureRef.current = "";
    setLayout(null);
  }, [units]);

  const measure = useCallback(() => {
    const budgetEl = budgetRef.current;
    const flowEl = flowRef.current;
    if (!budgetEl || !flowEl) return;

    const budget = budgetEl.clientHeight - BODY_PADDING_TOP - SAFETY;
    if (budget < 120) return; // sheet not laid out yet

    const hostTop = flowEl.getBoundingClientRect().top;
    const flowBottom = flowEl.scrollHeight;

    // Atom heights come from the gap between successive anchors (a data-uk wrapper or a
    // grouped <table>), so inter-block margins are captured as they actually render.
    const anchors = Array.from(
      flowEl.querySelectorAll<HTMLElement>("[data-uk],[data-mtable]"),
    );
    const tops = anchors.map((el) => el.getBoundingClientRect().top - hostTop);
    const atomH: Record<string, number> = {};
    anchors.forEach((el, i) => {
      const key = el.getAttribute("data-uk");
      if (key === null) return; // a table anchor — its rows are measured below
      const next = i + 1 < tops.length ? tops[i + 1] : flowBottom;
      atomH[key] = next - tops[i];
    });

    // Table rows measure cleanly off their own <tr> boxes (no margin collapse in tables).
    const theadH: Record<string, number> = {};
    const rowH: Record<string, number[]> = {};
    flowEl.querySelectorAll<HTMLElement>("[data-mtable]").forEach((table) => {
      const id = table.getAttribute("data-mtable");
      if (id === null) return;
      const thead = table.querySelector("thead");
      theadH[id] = thead ? thead.getBoundingClientRect().height : 0;
      rowH[id] = Array.from(table.querySelectorAll<HTMLElement>("tbody > tr")).map(
        (tr) => tr.getBoundingClientRect().height,
      );
    });

    const next = paginate(units, { budget, atomH, theadH, rowH });
    const signature =
      next.pages.map((page) => page.map((u) => u.key).join(",")).join("|") +
      "::" +
      next.grows.join(",");
    if (signature === signatureRef.current) return; // nothing changed — avoid a render loop
    signatureRef.current = signature;
    setLayout(next);
  }, [units]);

  // Measure after layout, and again whenever the off-screen sheets change size (the logo
  // loading, a webfont settling). The signature guard makes repeated observer fires cheap.
  useLayoutEffect(() => {
    measure();
    const observer = new ResizeObserver(() => measure());
    if (budgetRef.current) observer.observe(budgetRef.current);
    if (flowRef.current) observer.observe(flowRef.current);
    return () => observer.disconnect();
  }, [measure]);

  const measurerFlow = useMemo(() => renderUnits(units, tables), [units, tables]);

  const coverOffset = cover ? 1 : 0;
  const pages = layout?.pages ?? [units]; // fallback: one growing sheet with everything
  const total = coverOffset + pages.length;

  return (
    <>
      {/* Off-screen measurers: a fixed A4 sheet for the height budget, and the full flow
          laid out once so every unit can be measured. */}
      <div
        aria-hidden
        style={{ position: "absolute", left: -99999, top: 0, width: 794, opacity: 0 }}
      >
        <DocumentPage
          header={header}
          headerInches={headerInches}
          pageNo={1}
          pageCount={1}
          bodyRef={budgetRef}
        >
          <div style={{ height: "100%" }} />
        </DocumentPage>
        <DocumentPage
          header={header}
          headerInches={headerInches}
          pageNo={1}
          pageCount={1}
          grow
          bodyRef={flowRef}
        >
          {measurerFlow}
        </DocumentPage>
      </div>

      {cover ? (
        <DocumentPage
          header={header}
          headerInches={headerInches}
          pageNo={1}
          pageCount={total}
        >
          {cover}
        </DocumentPage>
      ) : null}

      {pages.map((pageUnits, i) => (
        <DocumentPage
          key={i}
          header={header}
          headerInches={headerInches}
          pageNo={coverOffset + i + 1}
          pageCount={total}
          grow
        >
          {renderUnits(pageUnits, tables)}
        </DocumentPage>
      ))}
    </>
  );
}

interface Measured {
  budget: number;
  atomH: Record<string, number>;
  theadH: Record<string, number>;
  rowH: Record<string, number[]>;
}

/**
 * Greedily pack units into pages that fit `budget`. Row units re-reserve their table
 * header whenever a table starts (or continues) at the top of a page. An atom flagged
 * `keep` is not left orphaned at the foot of a page — it is carried to the next sheet
 * with the block it introduces. A single unit taller than a page marks that sheet to
 * grow, so nothing is ever clipped.
 */
function paginate(
  units: FlowUnit[],
  m: Measured,
): { pages: FlowUnit[][]; grows: boolean[] } {
  const pages: FlowUnit[][] = [];
  const grows: boolean[] = [];

  let page: FlowUnit[] = [];
  let heights: number[] = [];
  let used = 0;
  let overflowed = false;
  let openTable: string | null = null;
  const rowCursor: Record<string, number> = {}; // rows are measured in one global order

  const commit = () => {
    pages.push(page);
    grows.push(overflowed);
    page = [];
    heights = [];
    used = 0;
    overflowed = false;
    openTable = null;
  };

  const place = (u: FlowUnit) => {
    if (u.type === "row") {
      const idx = rowCursor[u.table] ?? 0;
      const needThead = openTable !== u.table;
      const contributed = (needThead ? m.theadH[u.table] ?? 0 : 0) + (m.rowH[u.table]?.[idx] ?? 0);
      rowCursor[u.table] = idx + 1;
      openTable = u.table;
      page.push(u);
      heights.push(contributed);
      used += contributed;
    } else {
      const h = m.atomH[u.key] ?? 0;
      openTable = null;
      page.push(u);
      heights.push(h);
      used += h;
    }
    if (used > m.budget) overflowed = true;
  };

  for (const u of units) {
    // A hard page break requested by the content (e.g. the 2.1.1 calculation body
    // starts on its own sheet, after the heading that introduces it on the BOM page).
    if (u.type === "atom" && u.breakBefore && page.length > 0) {
      commit();
    }

    const idx = u.type === "row" ? rowCursor[u.table] ?? 0 : 0;
    const needThead = u.type === "row" && openTable !== u.table;
    const add =
      u.type === "row"
        ? (needThead ? m.theadH[u.table] ?? 0 : 0) + (m.rowH[u.table]?.[idx] ?? 0)
        : m.atomH[u.key] ?? 0;

    if (used + add > m.budget && page.length > 0) {
      // Carry any trailing keep-with-next atoms onto the new page with `u`, so a heading
      // is never stranded at the foot of a page away from the block it introduces.
      const carry: FlowUnit[] = [];
      while (
        page.length > 1 &&
        (page[page.length - 1] as { keep?: boolean }).keep
      ) {
        carry.unshift(page[page.length - 1]);
        page.pop();
        used -= heights.pop() ?? 0;
      }
      commit();
      for (const c of carry) place(c);
      place(u);
      continue;
    }

    place(u);
  }

  if (page.length > 0) commit();
  return { pages, grows };
}

/**
 * Render an ordered slice of units. Consecutive row units of the same table regroup into
 * a single <table> carrying that table's colgroup + header, so column widths line up and
 * the header repeats on every page. Atoms are wrapped in a marked <div> so the measurer
 * can anchor them; the wrapper adds no layout of its own.
 */
function renderUnits(units: FlowUnit[], tables: Record<string, TableDef>): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;

  while (i < units.length) {
    const u = units[i];

    if (u.type === "atom") {
      out.push(
        <div key={u.key} data-uk={u.key}>
          {u.node}
        </div>,
      );
      i += 1;
      continue;
    }

    const tableId = u.table;
    const rows: FlowUnit[] = [];
    while (i < units.length && units[i].type === "row" && (units[i] as { table: string }).table === tableId) {
      rows.push(units[i]);
      i += 1;
    }

    const def = tables[tableId];
    out.push(
      <table
        key={`t-${tableId}-${rows[0].key}`}
        data-mtable={tableId}
        className="w-full table-fixed border-collapse"
      >
        {def?.colgroup}
        <thead>{def?.thead}</thead>
        <tbody>
          {rows.map((row) =>
            isValidElement(row.node)
              ? cloneElement(row.node as ReactElement, { key: row.key })
              : row.node,
          )}
        </tbody>
      </table>,
    );
  }

  return out;
}
