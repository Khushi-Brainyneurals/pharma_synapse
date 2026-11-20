/**
 * Date ranges and chart buckets for the Dashboard graphs.
 *
 * Every period is a whole calendar unit (Monday-first week, month, quarter, year)
 * that can be stepped back with an offset; the current one ends today. "Custom" is
 * any From / To pair, including ranges longer than a year.
 */

export type PeriodKind = "week" | "month" | "quarter" | "year" | "custom";

export const PERIOD_OPTIONS: { kind: PeriodKind; label: string }[] = [
  { kind: "week", label: "Week" },
  { kind: "month", label: "Month" },
  { kind: "quarter", label: "Quarter" },
  { kind: "year", label: "Year" },
  { kind: "custom", label: "Custom" },
];

export interface DayRange {
  start: Date;
  end: Date;
}

const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseIsoDate(value: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 864e5);

/** "12 Nov 2026" */
export function formatDay(d: Date) {
  return `${d.getDate()} ${MON3[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * The range for a period kind, `offset` units back from the current one (0 = current).
 * The current period ends today rather than in the future.
 */
export function periodRange(kind: Exclude<PeriodKind, "custom">, offset: number, today = startOfToday()): DayRange {
  let start: Date;
  let end: Date;
  if (kind === "week") {
    const monday = addDays(today, -((today.getDay() + 6) % 7));
    start = addDays(monday, offset * 7);
    end = addDays(start, 6);
  } else if (kind === "month") {
    start = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  } else if (kind === "quarter") {
    const q = Math.floor(today.getMonth() / 3) + offset;
    start = new Date(today.getFullYear(), q * 3, 1);
    end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
  } else {
    start = new Date(today.getFullYear() + offset, 0, 1);
    end = new Date(start.getFullYear(), 11, 31);
  }
  return { start, end: end > today ? today : end };
}

/** A short name for the chosen period: "November 2026", "Q4 2026", "2026", "17 Nov to 23 Nov 2026". */
export function periodLabel(kind: PeriodKind, range: DayRange) {
  const { start, end } = range;
  if (kind === "month") return `${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
  if (kind === "quarter") return `Q${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}`;
  if (kind === "year") return String(start.getFullYear());
  return rangeLabel(range);
}

export function rangeLabel({ start, end }: DayRange) {
  if (daysBetween(start, end) === 0) return formatDay(start);
  const sameYear = start.getFullYear() === end.getFullYear();
  return `${sameYear ? `${start.getDate()} ${MON3[start.getMonth()]}` : formatDay(start)} to ${formatDay(end)}`;
}

export type BucketUnit = "day" | "week" | "month" | "year";

export interface Bucket {
  key: string;
  /** First and last day the bucket covers (inclusive). */
  start: Date;
  end: Date;
  /** Axis label. */
  x: string;
  /** Full name for tooltips. */
  full: string;
}

/** Day bars up to a month, weeks up to ~4 months, months up to 2 years, then years. */
export function bucketUnitFor(range: DayRange): BucketUnit {
  const span = daysBetween(range.start, range.end) + 1;
  if (span <= 31) return "day";
  if (span <= 120) return "week";
  if (span <= 731) return "month";
  return "year";
}

export function buildBuckets(range: DayRange, unit: BucketUnit): Bucket[] {
  const buckets: Bucket[] = [];
  const { start, end } = range;
  const clip = (a: Date, b: Date) => ({ a: a < start ? start : a, b: b > end ? end : b });
  const multiYear = start.getFullYear() !== end.getFullYear();

  if (unit === "day") {
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const first = d.getTime() === start.getTime() || d.getDate() === 1;
      buckets.push({ key: toIsoDate(d), start: d, end: d, x: first ? `${d.getDate()} ${MON3[d.getMonth()]}` : String(d.getDate()), full: formatDay(d) });
    }
  } else if (unit === "week") {
    for (let w = addDays(start, -((start.getDay() + 6) % 7)); w <= end; w = addDays(w, 7)) {
      const { a, b } = clip(w, addDays(w, 6));
      buckets.push({ key: toIsoDate(a), start: a, end: b, x: `${a.getDate()} ${MON3[a.getMonth()]}`, full: rangeLabel({ start: a, end: b }) });
    }
  } else if (unit === "month") {
    for (let m = new Date(start.getFullYear(), start.getMonth(), 1); m <= end; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      const { a, b } = clip(m, new Date(m.getFullYear(), m.getMonth() + 1, 0));
      const x = multiYear && (m.getMonth() === 0 || buckets.length === 0) ? `${MON3[m.getMonth()]} ${String(m.getFullYear()).slice(2)}` : MON3[m.getMonth()];
      buckets.push({ key: toIsoDate(a), start: a, end: b, x, full: `${MONTHS[m.getMonth()]} ${m.getFullYear()}` });
    }
  } else {
    for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
      const { a, b } = clip(new Date(y, 0, 1), new Date(y, 11, 31));
      buckets.push({ key: String(y), start: a, end: b, x: String(y), full: String(y) });
    }
  }
  return buckets;
}

/** A round axis step so that four steps cover `max` (1, 2, 2.5, 5 × 10ⁿ). */
export function niceAxis(max: number) {
  const raw = Math.max(1, max) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = Math.max(1, Math.ceil([1, 2, 2.5, 5, 10].map((m) => m * mag).find((m) => m >= raw) ?? raw));
  return { step, top: step * 4, ticks: [0, 1, 2, 3, 4].map((i) => step * i) };
}

export function monthShort(index: number) {
  return MON3[((index % 12) + 12) % 12];
}
