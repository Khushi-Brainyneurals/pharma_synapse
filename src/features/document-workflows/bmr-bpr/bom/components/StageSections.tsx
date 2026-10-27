import type { EquipmentEntry } from "../../stage-input/api/masterData";
import {
  paramDefs,
  type ParamState,
  type StageParams,
  type StageParamsMap,
} from "../../stages/model/stageParams";
import { DocHeading } from "./DocHeading";
import type { FlowContent, FlowUnit } from "./PaginatedBody";

/**
 * The manufacturing-stage sections of the printed BMR, emitted as paginatable flow
 * content so they flow after the BOM/calculation with the header/footer repeating.
 *
 * Each selected stage prints, in the reference's order (3.0, 4.0, …):
 *   N.1  Line clearance & environment control — limits taken from the stage's in-process
 *        parameters set on the Select-stages screen.
 *   N.2  Cleaning & calibration status — the equipment and instruments recorded on the
 *        Stage-input screen.
 *   N.3  In-process checks — the stage's parameters with their acceptance limits.
 *   Yield reconciliation.
 *
 * Values are blank (filled at execution) — this is the master template, not a completed
 * record.
 */

const STAGE_LABELS: Record<string, { label: string; area: string }> = {
  dispensing_rm: { label: "Dispensing of Raw Material", area: "Dispensing" },
  dispensing: { label: "Dispensing of Raw Material", area: "Dispensing" },
  granulation: { label: "Granulation", area: "Granulation" },
  compression: { label: "Compression", area: "Compression" },
  uncoated_inspection: { label: "Uncoated Tablet Inspection", area: "Inspection" },
  inspection: { label: "Tablet Inspection", area: "Inspection" },
  dispensing_coating: { label: "Dispensing of Coating Material", area: "Dispensing" },
  coating: { label: "Coating", area: "Coating" },
  coated_inspection: { label: "Coated Tablet Inspection", area: "Inspection" },
};

function stageInfo(key: string) {
  return STAGE_LABELS[key] ?? { label: titleCase(key), area: titleCase(key) };
}

function titleCase(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function limitText(p?: ParamState): string {
  if (!p || !p.on) return "—";
  if ((p.mode ?? "limit") === "record") return "To be recorded";
  const lt = p.ltype ?? "range";
  const unit = "";
  if (lt === "nmt") return p.max ? `NMT ${p.max}${unit}` : "NMT ___";
  if (lt === "nlt") return p.min ? `NLT ${p.min}${unit}` : "NLT ___";
  if (p.min || p.max) return `${p.min || "___"} – ${p.max || "___"}`;
  return "___";
}

/** Build the flow content for every selected manufacturing stage. */
export function stageContent(
  stages: string[],
  stageParams: StageParamsMap,
  equipment: EquipmentEntry[],
): FlowContent {
  const units: FlowUnit[] = [];
  const equips = equipment.filter((e) => e.mode === "equipment");
  const instrs = equipment.filter((e) => e.mode === "instrument");

  stages.forEach((key, i) => {
    const num = i + 3; // 1.0 Signature Log, 2.0 BOM, stages start at 3.0
    const info = stageInfo(key);
    const params = stageParams[key] ?? {};

    units.push({
      type: "atom",
      key: `st-${key}-h`,
      keep: true,
      breakBefore: true,
      node: (
        <DocHeading level={1} number={`${num}.0`}>
          {info.label}
        </DocHeading>
      ),
    });

    units.push({
      type: "atom",
      key: `st-${key}-lc`,
      node: <LineClearance num={num} area={info.area} params={params} />,
    });

    units.push({
      type: "atom",
      key: `st-${key}-cc`,
      node: <CleaningCalibration num={num} equips={equips} instrs={instrs} />,
    });

    units.push({
      type: "atom",
      key: `st-${key}-ip`,
      node: <InProcess num={num} stageKey={key} params={params} />,
    });

    units.push({
      type: "atom",
      key: `st-${key}-yl`,
      node: <YieldReconciliation num={num} />,
    });
  });

  return { units, tables: {} };
}

const CELL = "border border-black px-1.5 py-1 align-top";
const HDR = `${CELL} text-center font-bold`;

function LineClearance({ num, area, params }: { num: number; area: string; params: StageParams }) {
  return (
    <section className="mb-3 text-[7.5pt] leading-tight text-black">
      <DocHeading level={2} number={`${num}.1`}>
        Line Clearance &amp; Environment Control Checks in {area} Area
      </DocHeading>
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            <th className={HDR}>Date</th>
            <th className={HDR}>Time</th>
            <th className={HDR}>
              Temperature °C<br />
              <span className="font-normal">{limitText(params.temp)}</span>
            </th>
            <th className={HDR}>
              RH %<br />
              <span className="font-normal">{limitText(params.rh)}</span>
            </th>
            <th className={HDR}>
              Diff. Pressure Pa<br />
              <span className="font-normal">{limitText(params.dp)}</span>
            </th>
            <th className={HDR}>Checked By</th>
            <th className={HDR}>Verified By</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            {Array.from({ length: 7 }).map((_, i) => (
              <td key={i} className={`${CELL} h-6`}>
                &nbsp;
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function CleaningCalibration({
  num,
  equips,
  instrs,
}: {
  num: number;
  equips: EquipmentEntry[];
  instrs: EquipmentEntry[];
}) {
  return (
    <section className="mb-3 text-[7.5pt] leading-tight text-black">
      <DocHeading level={2} number={`${num}.2`}>
        Cleaning &amp; Calibration Status
      </DocHeading>

      <p className="mb-1 mt-1 text-[7.5pt] font-semibold">
        {num}.2.1 Equipment &amp; Area Cleaning Details:
      </p>
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col style={{ width: "6%" }} />
          <col style={{ width: "34%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "14%" }} />
        </colgroup>
        <thead>
          <tr>
            <th className={HDR}>Sr.</th>
            <th className={HDR}>Equipment Name</th>
            <th className={HDR}>ID No.</th>
            <th className={HDR}>Cleaned</th>
            <th className={HDR}>Done By</th>
            <th className={HDR}>Verified By</th>
          </tr>
        </thead>
        <tbody>
          {(equips.length ? equips : [null]).map((e, i) => (
            <tr key={i}>
              <td className={`${CELL} text-center`}>{i + 1}</td>
              <td className={CELL}>{e?.name ?? <span className="text-black/40">—</span>}</td>
              <td className={`${CELL} tabular-nums`}>{e?.id ?? ""}</td>
              <td className={`${CELL} h-6`}>&nbsp;</td>
              <td className={CELL}>&nbsp;</td>
              <td className={CELL}>&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mb-1 mt-2 text-[7.5pt] font-semibold">
        {num}.2.2 Instrument Used and Its Calibration Status:
      </p>
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col style={{ width: "6%" }} />
          <col style={{ width: "30%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "24%" }} />
          <col style={{ width: "24%" }} />
        </colgroup>
        <thead>
          <tr>
            <th className={HDR}>Sr.</th>
            <th className={HDR}>Instrument</th>
            <th className={HDR}>ID No.</th>
            <th className={HDR}>Calibration due on</th>
            <th className={HDR}>Verified By</th>
          </tr>
        </thead>
        <tbody>
          {(instrs.length ? instrs : [null]).map((e, i) => (
            <tr key={i}>
              <td className={`${CELL} text-center`}>{i + 1}</td>
              <td className={CELL}>{e?.name ?? <span className="text-black/40">—</span>}</td>
              <td className={`${CELL} tabular-nums`}>{e?.id ?? ""}</td>
              <td className={`${CELL} h-6`}>&nbsp;</td>
              <td className={CELL}>&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function InProcess({
  num,
  stageKey,
  params,
}: {
  num: number;
  stageKey: string;
  params: StageParams;
}) {
  const active = paramDefs(stageKey).filter((d) => params[d.key]?.on);
  return (
    <section className="mb-3 text-[7.5pt] leading-tight text-black">
      <DocHeading level={2} number={`${num}.3`}>
        In-Process Checks
      </DocHeading>
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col style={{ width: "6%" }} />
          <col style={{ width: "40%" }} />
          <col style={{ width: "24%" }} />
          <col style={{ width: "30%" }} />
        </colgroup>
        <thead>
          <tr>
            <th className={HDR}>Sr.</th>
            <th className={HDR}>Parameter</th>
            <th className={HDR}>Limit</th>
            <th className={HDR}>Observed value</th>
          </tr>
        </thead>
        <tbody>
          {(active.length ? active : [{ key: "—", label: "—" }]).map((d, i) => (
            <tr key={d.key}>
              <td className={`${CELL} text-center`}>{i + 1}</td>
              <td className={CELL}>{d.label}</td>
              <td className={`${CELL} text-center`}>{limitText(params[d.key])}</td>
              <td className={`${CELL} h-6`}>&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function YieldReconciliation({ num }: { num: number }) {
  return (
    <section className="mb-3 text-[7.5pt] leading-tight text-black">
      <p className="mb-1 mt-1 text-[8pt] font-bold uppercase">Yield Reconciliation</p>
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            <th className={HDR}>Theoretical Qty.</th>
            <th className={HDR}>Actual Qty.</th>
            <th className={HDR}>% Yield</th>
            <th className={HDR}>Limit</th>
            <th className={HDR}>Done By</th>
            <th className={HDR}>Verified By</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            {Array.from({ length: 6 }).map((_, i) => (
              <td key={i} className={`${CELL} h-6`}>
                &nbsp;
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="mt-0.5 text-[6.5pt] text-black/60">Section {num} · filled during execution</p>
    </section>
  );
}
