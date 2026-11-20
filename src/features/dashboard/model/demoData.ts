/**
 * Placeholder figures for the Dashboard graphs that have no API yet.
 * Replace each block with its endpoint once the backend provides it.
 */

// ─── Department performance ────────────────────────────────────────────────────
// Figures from the design handoff (data/20-lead-dashboard.js, DP_DATA).

export const DEPARTMENT_TARGET = 85;

export type DepartmentPeriod = "month" | "quarter" | "year";

export const DEPARTMENT_PERIODS: { value: DepartmentPeriod; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
  { value: "year", label: "This year" },
];

export interface DepartmentRow {
  department: string;
  /** Tasks finished in the period. */
  finished: number;
  /** Of those, finished on time. */
  onTime: number;
}

const dept = (department: string, finished: number, onTime: number): DepartmentRow => ({ department, finished, onTime });

export const DEPARTMENT_DEMO: Record<DepartmentPeriod, DepartmentRow[]> = {
  month: [dept("QA", 52, 47), dept("QC", 38, 32), dept("Production", 64, 51), dept("Engineering", 27, 19), dept("Warehouse", 41, 37), dept("R&D", 15, 12)],
  quarter: [dept("QA", 168, 149), dept("QC", 121, 102), dept("Production", 205, 166), dept("Engineering", 84, 61), dept("Warehouse", 132, 117), dept("R&D", 47, 37)],
  year: [dept("QA", 590, 519), dept("QC", 433, 359), dept("Production", 742, 586), dept("Engineering", 301, 214), dept("Warehouse", 468, 412), dept("R&D", 168, 131)],
};

// ─── Equipment and maintenance compliance ──────────────────────────────────────
// Qualification, calibration and preventive maintenance, counted in the month each is due.

export type EquipmentPeriod = "6m" | "year";

export const EQUIPMENT_PERIODS: { value: EquipmentPeriod; label: string }[] = [
  { value: "6m", label: "Last 6 months" },
  { value: "year", label: "This year" },
];

export interface EquipmentMonth {
  /** 0 = January. */
  month: number;
  scheduled: number;
  completed: number;
  /** Completed after the due date. */
  late: number;
}

/** Scheduled and completed activities per calendar month, January to December. */
const EQUIPMENT_BY_MONTH: [scheduled: number, completed: number, late: number][] = [
  [34, 33, 2], [28, 27, 1], [41, 39, 3], [30, 29, 2], [37, 34, 4], [45, 42, 3],
  [32, 31, 1], [39, 36, 2], [36, 33, 3], [43, 38, 4], [38, 29, 2], [35, 0, 0],
];

/**
 * The demo months for a period. Months still to come are scheduled with nothing
 * completed yet, and the current month is only partly done.
 */
export function equipmentDemo(period: EquipmentPeriod, today = new Date()): EquipmentMonth[] {
  const current = today.getMonth();
  const from = period === "year" ? 0 : Math.max(0, current - 5);
  const to = period === "year" ? 11 : current;
  const months: EquipmentMonth[] = [];
  for (let m = from; m <= to; m++) {
    const [scheduled, completed, late] = EQUIPMENT_BY_MONTH[m];
    const done = m > current ? 0 : m === current ? Math.round(completed * Math.min(1, today.getDate() / 30)) : completed;
    months.push({ month: m, scheduled, completed: done, late: Math.min(late, done) });
  }
  return months;
}
