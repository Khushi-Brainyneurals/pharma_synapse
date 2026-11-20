import { Users } from "lucide-react";
import { useMemo, useState } from "react";
import { GlassSelect } from "../../../shared/ui/GlassSelect";
import {
  DEPARTMENT_DEMO,
  DEPARTMENT_PERIODS,
  DEPARTMENT_TARGET,
  type DepartmentPeriod,
} from "../model/demoData";
import { ChartSection, ColumnChart, FilterField, Legend, filterSelectClass } from "./charts";

const NEAR = DEPARTMENT_TARGET - 10;

/** On-time completion rate per department. Dummy figures until the API exists. */
export function DepartmentPerformance() {
  const [period, setPeriod] = useState<DepartmentPeriod>("month");
  const periodName = DEPARTMENT_PERIODS.find((p) => p.value === period)!.label.toLowerCase();

  const model = useMemo(() => {
    const rows = DEPARTMENT_DEMO[period];
    const finished = rows.reduce((sum, r) => sum + r.finished, 0);
    const onTime = rows.reduce((sum, r) => sum + r.onTime, 0);
    const pctOf = (r: { finished: number; onTime: number }) => Math.round((r.onTime / r.finished) * 100);
    const best = rows.reduce((a, r) => (pctOf(r) > pctOf(a) ? r : a));
    const meeting = rows.filter((r) => pctOf(r) >= DEPARTMENT_TARGET).length;
    const groups = rows.map((r) => {
      const pct = pctOf(r);
      return {
        key: r.department,
        x: r.department,
        bars: [
          {
            key: r.department,
            value: pct,
            label: `${pct}%`,
            className: pct >= DEPARTMENT_TARGET ? "bg-primary" : pct >= NEAR ? "bg-primary/40" : "bg-clay-500",
            aria: `${r.department}: ${pct}% on time`,
            tip: `${r.department}, ${periodName}: ${pct}% on time, ${r.onTime} of ${r.finished} tasks.`,
          },
        ],
      };
    });
    const summary =
      `Every department, ${periodName}: ${onTime.toLocaleString()} of ${finished.toLocaleString()} tasks finished on time ` +
      `(${Math.round((onTime / finished) * 100)}%). ${meeting} of ${rows.length} departments meet the ${DEPARTMENT_TARGET}% target. ` +
      `Highest: ${best.department}.`;
    return { groups, summary };
  }, [period, periodName]);

  return (
    <ChartSection
      icon={Users}
      title="Department performance"
      subtitle={`On-time completion rate by department, ${periodName}. Sample figures until the department API is ready.`}
      filters={
        <FilterField label="Period">
          <GlassSelect
            aria-label="Department performance period"
            value={period}
            onChange={(e) => setPeriod(e.target.value as DepartmentPeriod)}
            className={filterSelectClass}
          >
            {DEPARTMENT_PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </GlassSelect>
        </FilterField>
      }
    >
      <p className="m-0 text-[13.5px] leading-5 text-text">{model.summary}</p>
      <ColumnChart
        groups={model.groups}
        ticks={[0, 25, 50, 75, 100]}
        top={100}
        formatTick={(v) => `${v}%`}
        target={DEPARTMENT_TARGET}
        barMaxWidth={52}
        axisWidth={40}
        ariaLabel="On-time completion by department"
      />
      <Legend
        items={[
          { key: "on", label: "At or above target", swatch: "bg-primary" },
          { key: "near", label: `Close to target (${NEAR} to ${DEPARTMENT_TARGET - 1}%)`, swatch: "bg-primary/40" },
          { key: "below", label: `Needs attention (under ${NEAR}%)`, swatch: "bg-clay-500" },
          { key: "target", label: `Target ${DEPARTMENT_TARGET}%`, swatch: "", line: true },
        ]}
      />
    </ChartSection>
  );
}
