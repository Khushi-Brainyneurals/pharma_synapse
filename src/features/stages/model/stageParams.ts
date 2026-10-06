/**
 * In-process parameters for the Select-stages screen.
 *
 * Each stage records a small set of in-process parameters (Temperature, RH, Differential
 * pressure, Holding period, Yield) plus a couple of stage-specific ones (IPQC frequency,
 * compression station). Every parameter is either given a LIMIT from the MFC
 * (range / not-more-than / not-less-than) or marked RECORD-ONLY (captured at execution,
 * no acceptance limit). The chosen limits ride on the document and print into the stage
 * sections of the BMR.
 */

export type LimitType = "range" | "nmt" | "nlt";
export type ParamMode = "limit" | "record";

export interface ParamState {
  on: boolean;
  mode?: ParamMode;
  ltype?: LimitType;
  min?: string;
  max?: string;
  /** user-input params */
  val?: string; // IPQC base frequency
  tol?: string; // IPQC tolerance (± minutes)
  value?: string; // compression station count
}

/** paramKey → its state, for one stage. */
export type StageParams = Record<string, ParamState>;
/** stageKey → its parameter set. */
export type StageParamsMap = Record<string, StageParams>;

export interface ParamDef {
  key: string;
  label: string;
  unit?: string;
  /** user-input parameter with fixed units instead of a limit/record toggle. */
  vkind?: "freqtol" | "station";
}

export const SHARED_PARAMS: ParamDef[] = [
  { key: "temp", label: "Temperature", unit: "°C" },
  { key: "rh", label: "Relative humidity", unit: "%RH" },
  { key: "dp", label: "Differential pressure", unit: "Pa" },
  { key: "ht", label: "Holding period", unit: "Hrs" },
  { key: "yield", label: "Yield", unit: "%" },
];

const IPQC_FREQ: ParamDef = { key: "ipqc_freq", label: "IPQC frequency", vkind: "freqtol" };
const COMP_STATION: ParamDef = {
  key: "comp_station",
  label: "Compression machine station",
  vkind: "station",
};

const isDispensing = (k: string) => k.includes("dispensing") || k === "dispensing";
const isInspection = (k: string) => k.includes("inspection");
const isGranulation = (k: string) => k === "granulation";
const isCompression = (k: string) => k === "compression";
const isCoating = (k: string) => k === "coating";

/** Stage-specific extra parameters, appended after the shared five. */
export function stageExtras(stageKey: string): ParamDef[] {
  if (isCompression(stageKey)) return [IPQC_FREQ, COMP_STATION];
  if (isCoating(stageKey)) return [IPQC_FREQ];
  return [];
}

export function paramDefs(stageKey: string): ParamDef[] {
  return [...SHARED_PARAMS, ...stageExtras(stageKey)];
}

/** The default parameter set for a stage — which apply, and their starting mode. */
export function defaultParams(stageKey: string): StageParams {
  const lim = (): ParamState => ({ on: true, mode: "limit", ltype: "range", min: "", max: "" });
  const rec = (): ParamState => ({ on: true, mode: "record" });
  const off = (): ParamState => ({ on: false, mode: "limit", ltype: "range", min: "", max: "" });
  const nmt = (): ParamState => ({ on: true, mode: "limit", ltype: "nmt", min: "", max: "" });
  const nlt = (): ParamState => ({ on: true, mode: "limit", ltype: "nlt", min: "", max: "" });

  const base: StageParams = {
    temp: lim(),
    rh: lim(),
    dp: rec(),
    ht: off(),
    yield: off(),
  };

  if (isGranulation(stageKey) || isCoating(stageKey)) {
    base.ht = nmt();
    base.yield = nlt();
  }
  if (isCompression(stageKey)) {
    base.ht = nmt();
    base.yield = nlt();
    base.ipqc_freq = { on: true, val: "", tol: "" };
    base.comp_station = { on: true, value: "" };
  }
  if (isCoating(stageKey)) {
    base.ipqc_freq = { on: true, val: "", tol: "" };
  }
  if (isInspection(stageKey)) {
    base.yield = nlt();
  }
  if (isDispensing(stageKey)) {
    base.ht = off();
    base.yield = off();
  }

  return base;
}

const isNum = (v: string | undefined) => v != null && v.trim() !== "" && Number.isFinite(Number(v));

/** Returns the keys of parameters that are ON but incompletely filled. */
export function validateStage(stageKey: string, params: StageParams): string[] {
  const bad: string[] = [];
  for (const def of paramDefs(stageKey)) {
    const p = params[def.key];
    if (!p || !p.on) continue;

    if (def.vkind === "freqtol") {
      const okVal = isNum(p.val);
      const okTol = !p.tol || p.tol.trim() === "" || isNum(p.tol);
      if (!(okVal && okTol)) bad.push(def.key);
      continue;
    }
    if (def.vkind === "station") {
      if (!isNum(p.value)) bad.push(def.key);
      continue;
    }
    if ((p.mode ?? "limit") === "limit") {
      const lt = p.ltype ?? "range";
      if (lt === "range") {
        if (!(isNum(p.min) && isNum(p.max) && Number(p.min) < Number(p.max))) bad.push(def.key);
      } else if (lt === "nmt") {
        if (!isNum(p.max)) bad.push(def.key);
      } else if (lt === "nlt") {
        if (!isNum(p.min)) bad.push(def.key);
      }
    }
  }
  return bad;
}

/** Count of parameters that are currently active for a stage. */
export function activeParamCount(stageKey: string, params: StageParams): number {
  return paramDefs(stageKey).filter((d) => params[d.key]?.on).length;
}
