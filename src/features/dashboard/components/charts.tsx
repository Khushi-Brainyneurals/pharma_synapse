import type { ReactNode } from "react";

/**
 * Small, dependency-free chart pieces for the Dashboard, drawn the way the design
 * handoff draws them: a 220px plot with four dashed grid steps, rounded columns and
 * hover / focus tooltips.
 */

type IconComponent = React.ComponentType<{ className?: string }>;

const PLOT_H = 220;
/** Height the top tick sits at; the extra room above it carries value labels. */
const SCALE_H = 196;

/** Card section with the design's header: icon tile, title, subtitle, and filters on the right. */
export function ChartSection({
  icon: Icon,
  title,
  subtitle,
  filters,
  children,
}: {
  icon: IconComponent;
  title: string;
  subtitle?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="relative flex flex-col gap-3.5 rounded-card border border-border bg-surface px-[18px] py-4">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2.5">
        <div className="flex min-w-0 flex-[1_1_280px] items-start gap-3">
          <span className="inline-flex size-[30px] flex-none items-center justify-center rounded-card bg-harbor-100 text-harbor-700" aria-hidden="true">
            <Icon className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <h2 className="m-0 text-[16px] font-medium leading-[22px] tracking-[-0.01em] text-text">{title}</h2>
            {subtitle ? <p className="m-0 mt-0.5 text-micro text-subdued">{subtitle}</p> : null}
          </div>
        </div>
        {filters ? <div className="min-w-0 max-w-full">{filters}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** A labelled filter control in a chart header. */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="inline-flex min-w-0 flex-col gap-0.5">
      <span className="text-[12.5px] font-medium leading-[18px] text-subdued">{label}</span>
      {children}
    </div>
  );
}

export const filterSelectClass =
  "h-9 rounded-control border border-border bg-surface px-3 pr-8 text-small text-text focus:outline-none focus:ring-2 focus:ring-primary";

/** Segmented control, styled like the Personal / Company switch. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex overflow-hidden rounded-control border border-border-strong bg-surface">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`inline-flex h-9 items-center px-3 text-micro font-semibold transition ${
            value === option.value ? "bg-primary text-white" : "text-subdued hover:bg-accent-soft hover:text-primary-dark"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyChart({ icon: Icon, text }: { icon: IconComponent; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="inline-flex size-[30px] items-center justify-center rounded-card bg-harbor-100 text-harbor-700" aria-hidden="true">
        <Icon className="size-[18px]" />
      </span>
      <p className="m-0 text-small font-medium text-subdued">{text}</p>
    </div>
  );
}

export function Legend({ items }: { items: { key: string; label: string; swatch: string; line?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
      {items.map((item) => (
        <span key={item.key} className="inline-flex items-center gap-1.5">
          {item.line ? (
            <span aria-hidden="true" className="w-[18px] border-t-[1.5px] border-dashed border-subdued" />
          ) : (
            <span aria-hidden="true" className={`size-2.5 rounded-[3px] ${item.swatch}`} />
          )}
          <span className="text-[12.5px] leading-[18px] text-subdued">{item.label}</span>
        </span>
      ))}
    </div>
  );
}

// ─── Column chart ──────────────────────────────────────────────────────────────

export interface ColumnBar {
  key: string;
  value: number;
  /** Background class for the column, e.g. "bg-primary". */
  className: string;
  /** Text above the column; omit to hide. */
  label?: string;
  tip: string;
  aria: string;
}

export interface ColumnGroup {
  key: string;
  x: string;
  bars: ColumnBar[];
}

/**
 * Columns on a 0…`top` scale. A group holds one column (simple bars) or several
 * side by side (grouped bars). `target` draws a dashed reference line at that value.
 */
export function ColumnChart({
  groups,
  ticks,
  top,
  formatTick = (v) => v.toLocaleString(),
  target,
  ariaLabel,
  barMaxWidth = 30,
  dense = false,
  axisWidth = 34,
}: {
  groups: ColumnGroup[];
  ticks: number[];
  top: number;
  formatTick?: (value: number) => string;
  target?: number;
  ariaLabel: string;
  barMaxWidth?: number;
  dense?: boolean;
  axisWidth?: number;
}) {
  const px = (value: number) => Math.round((Math.max(0, value) / top) * SCALE_H);
  const tickPos = (value: number) => (value / top) * SCALE_H;
  const gap = dense ? "gap-[3px]" : groups.length > 8 ? "gap-2" : "gap-4";
  // Thin the axis labels so they never collide.
  const every = Math.ceil(groups.length / 16);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2 pt-1">
        <div aria-hidden="true" className="relative flex-none" style={{ width: axisWidth, height: PLOT_H }}>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 translate-y-1/2 text-[11px] leading-[14px] tabular-nums text-subdued"
              style={{ bottom: tickPos(t) }}
            >
              {formatTick(t)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-auto border-b border-border-strong" style={{ height: PLOT_H }}>
          {ticks.map((t) => (
            <span
              key={t}
              aria-hidden="true"
              className="absolute inset-x-0 border-t border-dashed border-border"
              style={{ bottom: tickPos(t) }}
            />
          ))}
          {target !== undefined ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 border-t-[1.5px] border-dashed border-subdued opacity-60"
              style={{ bottom: tickPos(target) }}
            />
          ) : null}
          <div role="group" aria-label={ariaLabel} className={`absolute inset-0 flex px-2 ${gap}`}>
            {groups.map((group, groupIndex) => (
              <div key={group.key} className="flex min-w-0 flex-1 items-stretch justify-center gap-1">
                {group.bars.map((bar) => (
                  <span key={bar.key} className="group relative flex min-w-0 flex-1" style={{ maxWidth: group.bars.length > 1 ? 24 : barMaxWidth }}>
                    <button
                      type="button"
                      aria-label={bar.aria}
                      className="flex min-w-0 flex-1 cursor-default flex-col items-center justify-end border-none bg-transparent p-0 focus:outline-none"
                    >
                      {bar.label ? (
                        <span aria-hidden="true" className="mb-[3px] whitespace-nowrap text-[11px] font-medium leading-[14px] tabular-nums text-subdued">
                          {bar.label}
                        </span>
                      ) : null}
                      <span
                        className={`block w-full rounded-t-[4px] transition-opacity group-hover:opacity-85 ${bar.className}`}
                        style={{ height: px(bar.value), minHeight: bar.value ? 2 : 0 }}
                      />
                    </button>
                    {/* Rendered only on hover / focus so a hidden tooltip never widens the page,
                        and anchored inwards at the chart's edges so it stays inside the card. */}
                    <span
                      role="tooltip"
                      className={`pointer-events-none absolute z-30 hidden w-max max-w-[240px] rounded-sm bg-toast px-2.5 py-1.5 text-left text-[12.5px] leading-[18px] text-white shadow-overlay group-focus-within:block group-hover:block ${tooltipAnchor(groupIndex, groups.length)}`}
                      style={{ bottom: px(bar.value) + 22 }}
                    >
                      {bar.tip}
                    </span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div aria-hidden="true" className={`flex px-2 ${gap}`} style={{ marginLeft: axisWidth + 8 }}>
        {groups.map((group, i) => (
          <div key={group.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[11px] leading-4 text-subdued">
            {i % every === 0 ? group.x : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Left-anchor tooltips on the first columns, right-anchor on the last, centre the rest. */
function tooltipAnchor(index: number, count: number) {
  const edge = Math.max(1, Math.ceil(count * 0.2));
  if (index < edge) return "left-0";
  if (index >= count - edge) return "right-0";
  return "left-1/2 -translate-x-1/2";
}

// ─── Donut ─────────────────────────────────────────────────────────────────────

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  /** SVG stroke class, e.g. "stroke-sage-500". */
  stroke: string;
  /** Background class for the legend dot, e.g. "bg-sage-500". */
  dot: string;
}

export function DonutChart({
  segments,
  total,
  totalLabel,
  ariaLabel,
}: {
  segments: DonutSegment[];
  total: number;
  totalLabel: string;
  ariaLabel: string;
}) {
  const R = 44;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const arcs = segments.map((segment) => {
    const len = total ? (segment.value / total) * C : 0;
    // A hairline gap between neighbouring segments, none on a full ring.
    const gap = segment.value && segment.value < total ? Math.min(1.2, len / 3) : 0;
    const visible = Math.max(0, len - gap);
    const arc = { ...segment, dash: `${visible.toFixed(2)} ${(C - visible).toFixed(2)}`, offset: (-acc).toFixed(2) };
    acc += len;
    return arc;
  });

  return (
    <div className="flex flex-1 flex-wrap items-center gap-6">
      <div className="relative mx-auto size-[200px] flex-none">
        <svg viewBox="0 0 120 120" role="img" aria-label={ariaLabel} className="block size-full">
          <circle cx="60" cy="60" r={R} fill="none" strokeWidth="11" className="stroke-muted" />
          {arcs.map((arc) =>
            arc.value ? (
              <circle
                key={arc.key}
                cx="60"
                cy="60"
                r={R}
                fill="none"
                strokeWidth="11"
                strokeDasharray={arc.dash}
                strokeDashoffset={arc.offset}
                transform="rotate(-90 60 60)"
                className={arc.stroke}
              />
            ) : null,
          )}
        </svg>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[28px] font-medium leading-8 tracking-[-0.02em] text-text tabular-nums">{total.toLocaleString()}</span>
          <span className="max-w-[100px] text-micro text-subdued">{totalLabel}</span>
        </div>
      </div>
      <ul className="m-0 flex min-w-0 flex-[1_1_200px] list-none flex-col gap-0.5 p-0">
        {segments.map((segment) => (
          <li
            key={segment.key}
            className="flex items-center gap-2.5 rounded-control px-2 py-[7px] hover:bg-muted"
            title={`${segment.value.toLocaleString()} of ${total.toLocaleString()} documents`}
          >
            <span aria-hidden="true" className={`size-2.5 flex-none rounded-full ${segment.dot}`} />
            <span className="min-w-0 flex-auto text-[13.5px] leading-5 text-text">{segment.label}</span>
            <span className="text-[13.5px] font-medium leading-5 tabular-nums text-text">{segment.value.toLocaleString()}</span>
            <span className="w-10 text-right text-[12.5px] leading-5 tabular-nums text-subdued">
              {total ? `${Math.round((segment.value / total) * 100)}%` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
