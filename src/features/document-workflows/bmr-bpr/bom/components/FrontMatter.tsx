import { DocHeading } from "./DocHeading";
import { IndexPageBody } from "./IndexPageBody";
import type { FlowContent, FlowUnit } from "./PaginatedBody";

/**
 * The document's front matter — the pages that sit between the cover and the Bill of
 * Materials in the reference BMR: INDEX (page 2), GENERAL INSTRUCTIONS / PRECAUTIONS
 * (page 3) and 1.0 SIGNATURE LOG (page 4). Each is one page, so each is a single atom
 * that starts on a fresh sheet; a page still grows rather than clip if content overflows.
 */

/** The 15 general precautions from the reference BMR, used when the extraction hasn't
 *  supplied its own. */
const DEFAULT_PRECAUTIONS = [
  "Check and ensure that all manufacturing equipment and other required accessories are clean",
  "and ready for use. Wear nose mask, hand gloves while manufacturing the batch.",
  "Counter check the weights of all ingredients before using in the batch.",
  "Get line clearance from Quality assurance for manufacturing.",
  "AHU system should be kept ON throughout the manufacturing process.",
  "Temperature should be kept at NMT 30°C and Relative humidity should be kept at NMT 60% RH during granulation and coating stage.",
  "During the preparation of this product, no other product processing should be done in the same area.",
  "Sifting or filtration through stainless steel mesh is involved; check the mesh integrity before and after use.",
  "All critical aspects during manufacturing like temperature, duration of mixing, weight etc. must be checked and recorded.",
  "Supervisor to ensure completion of all in-process records during various stages of manufacturing operations till completion.",
  "All the details whatever is necessary should be recorded in batch manufacturing record.",
  "Send a test Request form to quality control after manufacturing is completed.",
  "Check calibration of respective equipment / machine before use.",
];

const CELL = "border border-black px-1.5 py-[3px] align-top";
const HDR = `${CELL} text-center font-bold`;

function PrecautionsSection({ items }: { items: string[] }) {
  return (
    <section className="text-[8pt] leading-tight text-black">
      <p className="mb-1.5 font-bold uppercase">General Instructions / Precautions</p>
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col style={{ width: "8%" }} />
          <col style={{ width: "92%" }} />
        </colgroup>
        <thead>
          <tr>
            <th className={HDR}>Sr. No.</th>
            <th className={HDR}>GENERAL INSTRUCTION / PRECAUTIONS</th>
          </tr>
        </thead>
        <tbody>
          {items.map((text, i) => (
            <tr key={i}>
              <td className={`${CELL} text-center tabular-nums`}>{i + 1}</td>
              <td className={CELL}>{text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SignatureLogSection() {
  return (
    <section className="text-[8pt] leading-tight text-black">
      <DocHeading level={1} number="1.0">
        Signature Log
      </DocHeading>
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col style={{ width: "8%" }} />
          <col style={{ width: "34%" }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "20%" }} />
        </colgroup>
        <thead>
          <tr>
            <th className={HDR}>Sr. No.</th>
            <th className={HDR}>Name of Employee</th>
            <th className={HDR}>Department</th>
            <th className={HDR}>Employee Code</th>
            <th className={HDR}>Signature</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 27 }).map((_, i) => (
            <tr key={i}>
              <td className={`${CELL} text-center tabular-nums`}>{i + 1}</td>
              <td className={`${CELL} h-6`}>&nbsp;</td>
              <td className={CELL}>&nbsp;</td>
              <td className={CELL}>&nbsp;</td>
              <td className={CELL}>&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

interface FrontMatterOptions {
  stages?: string[];
  precautions?: string[];
}

export function frontMatterContent({ stages, precautions }: FrontMatterOptions = {}): FlowContent {
  const units: FlowUnit[] = [
    {
      type: "atom",
      key: "fm-index",
      breakBefore: true,
      node: <IndexPageBody stages={stages} />,
    },
    {
      type: "atom",
      key: "fm-precautions",
      breakBefore: true,
      node: <PrecautionsSection items={precautions?.length ? precautions : DEFAULT_PRECAUTIONS} />,
    },
    {
      type: "atom",
      key: "fm-signature",
      breakBefore: true,
      node: <SignatureLogSection />,
    },
  ];
  return { units, tables: {} };
}
