/** The teal "HOW THIS WORKS" strip that heads each wizard step, with numbered hints. */
export function HowThisWorks({ items }: { items: React.ReactNode[] }) {
  return (
    <div className="rounded-panel border-l-4 border-primary bg-accent-soft/50 p-4">
      <p className="mb-2 text-micro font-semibold uppercase tracking-overline text-primary-dark">How this works</p>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-small text-text/90">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              {i + 1}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
