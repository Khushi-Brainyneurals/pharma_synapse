import { Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { GlassSelect } from "../../../shared/ui/GlassSelect";
import { EQUIPMENT_PERIODS, equipmentDemo, type EquipmentPeriod } from "../model/demoData";
import { monthShort, niceAxis } from "../model/period";
import { ChartSection, ColumnChart, FilterField, Legend, filterSelectClass } from "./charts";

const SERIES = [
  { key: "scheduled", label: "Scheduled", className: "bg-mist-300" },
  { key: "completed", label: "Completed", className: "bg-primary" },
  { key: "pending", label: "Pending", className: "bg-honey-400" },
] as const;

/** Scheduled, completed and pending equipment activities per month. Dummy figures until the API exists. */
export function EquipmentCompliance() {
  const [period, setPeriod] = useState<EquipmentPeriod>("6m");

  const model = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const months = equipmentDemo(period, today).map((m) => {
      const pending = m.scheduled - m.completed;
      // Pending activities in a month that has already ended are overdue.
      const overdue = m.month < today.getMonth() ? pending : 0;
      return { ...m, pending, overdue };
    });
    const { ticks, top } = niceAxis(Math.max(...months.map((m) => m.scheduled)));
    const groups = months.map((m) => {
      const name = `${monthShort(m.month)} ${year}`;
      const tips = {
        scheduled: `${name}: ${m.scheduled} activities scheduled. ${m.completed} completed, ${m.pending} pending.`,
        completed:
          `${name}: ${m.completed} of ${m.scheduled} completed` +
          (m.scheduled ? ` (${Math.round((m.completed / m.scheduled) * 100)}%)` : "") +
          (!m.completed ? "." : m.late ? `, ${m.late} after the due date.` : ", every one by its due date."),
        pending: `${name}: ${m.pending} pending` + (m.pending ? `: ${m.overdue} overdue, ${m.pending - m.overdue} not yet due.` : "."),
      };
      return {
        key: `m${m.month}`,
        x: monthShort(m.month),
        bars: SERIES.map((s) => {
          const value = m[s.key];
          return { key: s.key, value, label: value ? String(value) : undefined, className: s.className, aria: `${name}, ${s.label}: ${value}`, tip: tips[s.key] };
        }),
      };
    });
    const total = months.reduce(
      (t, m) => ({ scheduled: t.scheduled + m.scheduled, completed: t.completed + m.completed, pending: t.pending + m.pending, overdue: t.overdue + m.overdue }),
      { scheduled: 0, completed: 0, pending: 0, overdue: 0 },
    );
    const first = months[0];
    const last = months[months.length - 1];
    const summary =
      `Every activity, ${monthShort(first.month)} to ${monthShort(last.month)} ${year}: ${total.scheduled} scheduled, ` +
      `${total.completed} completed, ${total.pending} pending` +
      (total.pending ? ` (${total.overdue} overdue, ${total.pending - total.overdue} not yet due).` : ".");
    return { groups, ticks, top, summary };
  }, [period]);

  return (
    <ChartSection
      icon={Wrench}
      title="Equipment and maintenance compliance"
      subtitle="Qualification, calibration and preventive maintenance, counted in the month each one is due. Sample figures until the equipment API is ready."
      filters={
        <FilterField label="Period">
          <GlassSelect
            aria-label="Equipment period"
            value={period}
            onChange={(e) => setPeriod(e.target.value as EquipmentPeriod)}
            className={filterSelectClass}
          >
            {EQUIPMENT_PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </GlassSelect>
        </FilterField>
      }
    >
      <p className="m-0 text-[13.5px] leading-5 text-text">{model.summary}</p>
      <ColumnChart groups={model.groups} ticks={model.ticks} top={model.top} ariaLabel="Equipment and maintenance activities by month" />
      <Legend items={SERIES.map((s) => ({ key: s.key, label: s.label, swatch: s.className }))} />
    </ChartSection>
  );
}
