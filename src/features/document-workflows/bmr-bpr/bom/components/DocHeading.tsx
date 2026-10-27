/**
 * Standard section-heading hierarchy for the printed document.
 *
 * The BMR numbers its sections N.0 / N.M / N.M.K, and each level must read as a clear
 * step down — a section title, its subsection, its sub-subsection. Before this they were
 * all the same weight, stacked with no breathing room, so "2.0" and "2.1" looked like
 * one run-on line. This fixes the spacing and weight as a single standard, used
 * everywhere a heading appears.
 *
 *   level 1  N.0    section      — boldest, uppercase, shaded band, most space above
 *   level 2  N.M    subsection   — bold, a step down, moderate space above
 *   level 3  N.M.K  sub-sub      — semibold, smallest, least space above
 */
interface DocHeadingProps {
  level: 1 | 2 | 3;
  /** The section number, e.g. "2.0", "2.1", "3.2.1". Rendered in mono, tabular. */
  number?: string;
  children: React.ReactNode;
}

export function DocHeading({ level, number, children }: DocHeadingProps) {
  if (level === 1) {
    return (
      <h3 className="mb-1.5 mt-4 flex items-baseline gap-2 border border-black px-2 py-1 text-[9pt] font-bold uppercase leading-tight first:mt-0">
        {number ? <span className="font-mono tabular-nums">{number}</span> : null}
        <span>{children}</span>
      </h3>
    );
  }

  if (level === 2) {
    return (
      <h4 className="mb-1 mt-3 flex items-baseline gap-2 text-[8.5pt] font-bold uppercase leading-tight">
        {number ? <span className="font-mono tabular-nums">{number}</span> : null}
        <span>{children}</span>
      </h4>
    );
  }

  return (
    <h5 className="mb-1 mt-2 flex items-baseline gap-1.5 text-[8pt] font-semibold leading-tight">
      {number ? <span className="font-mono tabular-nums">{number}</span> : null}
      <span>{children}</span>
    </h5>
  );
}
