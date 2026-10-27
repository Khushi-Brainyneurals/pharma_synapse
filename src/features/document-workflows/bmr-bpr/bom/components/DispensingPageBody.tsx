import type { BomIngredient } from "../api/bom.types";
import { DocHeading } from "./DocHeading";

interface DispensingPageBodyProps {
  ingredients: BomIngredient[];
}

/**
 * "3.0 Dispensing" — reference page 6. As you confirmed, this section is BOM-derived:
 * its Raw Material Dispensing Sheet (3.3) lists the same ingredients as the BOM, and the
 * operator fills the rest by hand. The line-clearance and cleaning tables (3.1, 3.2) are
 * blank templates completed during manufacturing, so they render as empty rules.
 *
 * Filled from the AI extraction where available (material code, ingredient, qty
 * required, UOM); blank where it's an at-execution entry.
 */
export function DispensingPageBody({ ingredients }: DispensingPageBodyProps) {
  const materials = ingredients.filter((row) => !row.is_avg_weight);

  return (
    <div className="flex h-full flex-col text-[7.5pt] leading-tight">
      <DocHeading level={1} number="3.0">
        Dispensing
      </DocHeading>

      <DocHeading level={2} number="3.1">
        Line Clearance &amp; Environment Control Checks in Dispensing Area
      </DocHeading>
      <BlankTable
        columns={["Date", "Area Name", "Time", "Temp (≤25°C)", "RH% (≤60%)", "DP (NLT 10 Pa)", "Checked By", "Verified By"]}
        rows={2}
      />

      <DocHeading level={2} number="3.2">
        Cleaning &amp; Calibration Status of Dispensing Area
      </DocHeading>
      <DocHeading level={3} number="3.2.1">
        Equipment &amp; Area Cleaning Details
      </DocHeading>
      <BlankTable columns={["Equipment / Area", "ID No.", "Cleaned On", "Status", "Verified By"]} rows={2} />

      {/* 3.3 — the BOM-derived table. Ingredients come from the AI extraction. */}
      <DocHeading level={2} number="3.3">
        Raw Material Dispensing Sheet
      </DocHeading>
      <p className="mb-1 text-[7pt] text-black/60">Date of Dispensing: __________</p>

      <div className="overflow-hidden border border-black">
        <RmsRow header>
          <RmsCell w="6%">Sr.</RmsCell>
          <RmsCell w="13%">Material Code</RmsCell>
          <RmsCell w="27%">Ingredients</RmsCell>
          <RmsCell w="12%" right>
            Qty. Required (kg)
          </RmsCell>
          <RmsCell w="12%">Weighed Qty.</RmsCell>
          <RmsCell w="8%">UOM</RmsCell>
          <RmsCell w="10%">Checked (Prod.)</RmsCell>
          <RmsCell w="12%" last>
            Verified (QA)
          </RmsCell>
        </RmsRow>

        {materials.map((row, index) => (
          <RmsRow key={index} className="border-t border-black/40">
            <RmsCell w="6%">{row.sr_no ?? index + 1}</RmsCell>
            <RmsCell w="13%" mono>
              {row.material_code ?? "—"}
            </RmsCell>
            <RmsCell w="27%">{row.name}</RmsCell>
            <RmsCell w="12%" right mono>
              {row.qty_required_production !== null && row.qty_required_production !== undefined
                ? row.qty_required_production.toLocaleString(undefined, {
                    minimumFractionDigits: 3,
                  })
                : "—"}
            </RmsCell>
            {/* Weighed at execution — blank. */}
            <RmsCell w="12%">
              <Rule />
            </RmsCell>
            <RmsCell w="8%">{row.uom ?? "kg"}</RmsCell>
            <RmsCell w="10%">
              <Rule />
            </RmsCell>
            <RmsCell w="12%" last>
              <Rule />
            </RmsCell>
          </RmsRow>
        ))}
      </div>

      <DocHeading level={2} number="3.5">
        In-Process Checks by QA
      </DocHeading>
      <BlankTable columns={["Check", "Observation", "Checked By", "Date"]} rows={2} />
    </div>
  );
}

/** A blank operator-fill template — headings with empty rows to complete by hand. */
function BlankTable({ columns, rows }: { columns: string[]; rows: number }) {
  return (
    <div className="overflow-hidden border border-black">
      <div className="flex bg-black/[0.04] font-semibold">
        {columns.map((c, i) => (
          <div
            key={c}
            className={`flex-1 px-1.5 py-0.5 ${i < columns.length - 1 ? "border-r border-black/40" : ""}`}
          >
            {c}
          </div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex border-t border-black/40">
          {columns.map((c, i) => (
            <div
              key={c}
              className={`h-4 flex-1 ${i < columns.length - 1 ? "border-r border-black/40" : ""}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Rule() {
  return <span className="block border-b border-dotted border-black/40">&nbsp;</span>;
}

function RmsRow({
  children,
  header,
  className = "",
}: {
  children: React.ReactNode;
  header?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex w-full ${header ? "bg-black/[0.06] font-semibold" : ""} ${className}`}>
      {children}
    </div>
  );
}

function RmsCell({
  children,
  w,
  right,
  last,
  mono,
}: {
  children: React.ReactNode;
  w: string;
  right?: boolean;
  last?: boolean;
  mono?: boolean;
}) {
  return (
    <div
      style={{ width: w }}
      className={`px-1.5 py-0.5 ${last ? "" : "border-r border-black/40"} ${
        right ? "text-right" : ""
      } ${mono ? "font-mono tabular-nums" : ""}`}
    >
      {children}
    </div>
  );
}
