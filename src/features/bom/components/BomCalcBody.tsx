import { Fragment, useMemo } from "react";
import type { BomIngredient } from "../api/bom.types";
import { DocHeading } from "./DocHeading";
import type { FlowContent, FlowUnit } from "./PaginatedBody";

/**
 * "2.1.1 Active Material Calculation" — the potency / A.R.-number worksheet, one block
 * per layer that carries an API, laid out exactly as the printed BMR (reference pages
 * 7–10). A faithful port of the ai-backend renderer
 * (app/document/sections/stages/bom/calculations.py) so the review screen and the
 * generated document stay identical. Strict black-and-white; every value cell is a blank
 * to be filled at execution.
 *
 * `calcContent` is the single source of truth: it emits the worksheet as a sequence of
 * cohesive flow units so the paginator can break it across real A4 pages without ever
 * splitting a table from its intro line or stranding a sign-off block. The `BomCalcBody`
 * component renders those same units on one continuous sheet.
 */

/** The calculation worksheet as paginatable flow content (atoms only — no split tables). */
export function calcContent(ingredients: BomIngredient[]): FlowContent {
  const layers = apiLayers(ingredients);
  const multilayer = layers.filter((l) => l.name).length > 1;

  const units: FlowUnit[] = [];
  if (layers.length === 0) return { units, tables: {} };

  // The 2.1.1 heading opens a fresh sheet and the calculation body follows it there,
  // rather than the heading closing the BOM page.
  units.push({
    type: "atom",
    key: "calc-h",
    keep: true,
    breakBefore: true,
    node: (
      <DocHeading level={2} number="2.1.1">
        Active Material Calculation
      </DocHeading>
    ),
  });

  layers.forEach((layer, li) => {
    const multipleApis = layer.apis.length > 1;

    if (layer.name) {
      units.push({
        type: "atom",
        key: `calc-l${li}-name`,
        keep: true,
        node: <p className="mb-1 mt-2 font-bold">{layer.name}</p>,
      });
    }
    if (multipleApis) {
      units.push({
        type: "atom",
        key: `calc-l${li}-multi`,
        keep: true,
        node: <p className="mb-1 font-bold">If Product Contains Multiple APIs</p>,
      });
    }

    layer.apis.forEach((api, ai) => {
      const heading = multipleApis
        ? `For API-${ai + 1} (${api.name}):`
        : `For Single API (${api.name}):`;

      units.push({
        type: "atom",
        key: `calc-l${li}-a${ai}-head`,
        keep: true,
        node: <p className="mt-2 font-bold">{heading}</p>,
      });

      units.push({
        type: "atom",
        key: `calc-l${li}-a${ai}-std`,
        node: (
          <div>
            <p>Calculation for Single A.R. No.:</p>
            <p>Standard Required Quantity (Std. API)</p>
            <Fraction
              label="StdAPI ="
              numerator="Batch size x Label claim x 100"
              denominator="1000000 x Potency"
            />
            <ExecSpace h="h-28" />
          </div>
        ),
      });

      units.push({
        type: "atom",
        key: `calc-l${li}-a${ai}-ar`,
        node: (
          <div>
            <p className="mt-1">Calculation for Multiple A.R. No.:</p>
            <ArTable />
          </div>
        ),
      });

      // Second A.R., then a gap, then Third A.R. — the reference spaces these two blocks
      // across most of a page (execution room for the operator to fill).
      units.push({
        type: "atom",
        key: `calc-l${li}-a${ai}-next1`,
        node: (
          <div>
            <p className="mt-1 font-bold">Required Quantity from Next A.R.</p>
            <p className="mt-1">Second AR:</p>
            <Fraction label="Req2 = (Req1 - Stock1) x" numerator="P1" denominator="P2" />
            <ExecSpace h="h-28" />
          </div>
        ),
      });

      units.push({
        type: "atom",
        key: `calc-l${li}-a${ai}-next2`,
        node: (
          <div>
            <p className="mt-1">Third AR:</p>
            <Fraction label="Req3 = (Req2 - Stock2) x" numerator="P2" denominator="P3" />
            <ExecSpace h="h-20" />
          </div>
        ),
      });

      if (!multipleApis) {
        units.push({
          type: "atom",
          key: `calc-l${li}-a${ai}-gen`,
          node: (
            <div>
              <p className="mt-1 font-bold">
                General Formula
                <br />
                For the nth A.R.
              </p>
              <Fraction
                label="Req_n = (Req_{n-1} - Stock_{n-1}) x"
                numerator="P_{n-1}"
                denominator="P_n"
              />
              <ExecSpace h="h-24" />
            </div>
          ),
        });
      }
    });

    if (multipleApis) {
      units.push({
        type: "atom",
        key: `calc-l${li}-summary`,
        node: <SummaryTable apis={layer.apis} />,
      });
    }

    if (layer.excipients.length > 0) {
      units.push({
        type: "atom",
        key: `calc-l${li}-exc`,
        node: (
          <ExcipientAdjustment
            layer={layer}
            showLayerName={multilayer}
            multipleApis={multipleApis}
          />
        ),
      });
    }
  });

  return { units, tables: {} };
}

/** Deliberate execution whitespace — the room the printed template leaves under a formula
 *  for the operator to enter values. `h` is a Tailwind height class (e.g. "h-24"). */
function ExecSpace({ h }: { h: string }) {
  return <div className={h} aria-hidden="true" />;
}

/** The worksheet on one continuous sheet (unpaginated) — same units as `calcContent`. */
export function BomCalcBody({ ingredients }: { ingredients: BomIngredient[] }) {
  const { units } = useMemo(() => calcContent(ingredients), [ingredients]);
  if (units.length === 0) return null;

  return (
    <div className="flex h-full flex-col text-[8pt] leading-tight text-black">
      {units.map((u) => (
        <Fragment key={u.key}>{u.node}</Fragment>
      ))}
    </div>
  );
}

interface Layer {
  name: string;
  apis: BomIngredient[];
  excipients: BomIngredient[];
}

function apiLayers(ingredients: BomIngredient[]): Layer[] {
  const order: string[] = [];
  for (const ing of ingredients) {
    const l = ing.layer ?? "";
    if (!order.includes(l)) order.push(l);
  }
  return order
    .map((name) => ({
      name,
      apis: ingredients.filter((i) => (i.layer ?? "") === name && i.is_api && !i.is_avg_weight),
      excipients: ingredients.filter(
        (i) => (i.layer ?? "") === name && i.is_compensated && !i.is_avg_weight,
      ),
    }))
    .filter((l) => l.apis.length > 0);
}

const AR_HEADERS = [
  "A.R. Number",
  "Potency (P) % as such",
  "Calculated required Qty. (Req) in kg",
  "Available Stock (Stock) in kg",
  "Dispensed Qty. (Disp) in kg",
];

function ArTable() {
  const cell = "border border-black px-1 py-0.5 align-top";
  return (
    <table className="w-full table-fixed border-collapse">
      <thead>
        <tr>
          {AR_HEADERS.map((h) => (
            <th key={h} className={`${cell} text-center font-bold`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {["AR-1", "AR-2", "AR-3"].map((ar) => (
          <tr key={ar}>
            <td className={cell}>{ar}</td>
            <td className={cell}>&nbsp;</td>
            <td className={cell}>&nbsp;</td>
            <td className={cell}>&nbsp;</td>
            <td className={cell}>&nbsp;</td>
          </tr>
        ))}
        <tr>
          <td colSpan={4} className={`${cell} font-bold`}>
            Total Dispensed Quantity (Disp_API)
          </td>
          <td className={cell}>&nbsp;</td>
        </tr>
      </tbody>
    </table>
  );
}

function SummaryTable({ apis }: { apis: BomIngredient[] }) {
  const cell = "border border-black px-1 py-0.5 align-top";
  return (
    <div className="mt-2">
      <p className="font-bold">Summary of All API Quantity:</p>
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            {["API", "StdAPI", "DispAPI"].map((h) => (
              <th key={h} className={`${cell} text-center font-bold`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {apis.map((_, i) => (
            <tr key={i}>
              <td className={cell}>{`API-${i + 1}`}</td>
              <td className={cell}>&nbsp;</td>
              <td className={cell}>&nbsp;</td>
            </tr>
          ))}
          <tr>
            <td className={cell}>Total</td>
            <td className={cell}>&nbsp;</td>
            <td className={cell}>&nbsp;</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ExcipientAdjustment({
  layer,
  showLayerName,
  multipleApis,
}: {
  layer: Layer;
  showLayerName: boolean;
  multipleApis: boolean;
}) {
  const cell = "border border-black px-1 py-0.5 align-top";
  const title =
    showLayerName && layer.name
      ? `EXCIPIENT ADJUSTMENT FOR API QUANTITY (${layer.name}):`
      : "EXCIPIENT ADJUSTMENT FOR API QUANTITY:";
  const adj = multipleApis
    ? "AdjExc = StdExc - (∑DispAPI - ∑StdAPI)"
    : "AdjExc = StdExc - (DispAPI - StdAPI)";

  return (
    <div className="mt-2">
      <p className="font-bold">{title}</p>
      <p className="mt-1">StdExc = Standard Excipient Quantity</p>
      <p>AdjExc = Adjusted Excipient Quantity</p>
      <p className="mt-1">{adj}</p>

      {layer.excipients.map((exc, i) => {
        const name = cleanName(exc.name);
        return (
          <p key={i} className="mt-1 pl-4">
            {`${name} quantity (AdjExc) = Std. quantity of ${name} - (DispAPI - StdAPI)`}
          </p>
        );
      })}

      <table className="mt-56 w-full table-fixed border-collapse">
        <tbody>
          <tr>
            {[
              "Done by (Production) Sign & Date",
              "Checked by (Production) Sign & Date",
              "Verified by (QA) Sign & Date",
            ].map((h) => (
              <td key={h} className={`${cell} text-center font-bold`}>
                {h}
              </td>
            ))}
          </tr>
          <tr>
            <td className={cell}>&nbsp;</td>
            <td className={cell}>&nbsp;</td>
            <td className={cell}>&nbsp;</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** A stacked fraction: label, then numerator over a rule over denominator. */
function Fraction({
  label,
  numerator,
  denominator,
}: {
  label: string;
  numerator: string;
  denominator: string;
}) {
  return (
    <div className="my-1.5 flex items-center gap-2 pl-2">
      <span className="whitespace-pre">{label}</span>
      <span className="inline-flex flex-col text-center leading-tight">
        <span className="px-2">{numerator}</span>
        <span className="border-t border-black px-2">{denominator}</span>
      </span>
    </div>
  );
}

/** Strip a trailing marker ($, #, …) but keep bracketed text — matches the ai-backend. */
function cleanName(name: string): string {
  return name.replace(/[^a-zA-Z0-9\s()[\],./-]+\s*$/, "").trim();
}
