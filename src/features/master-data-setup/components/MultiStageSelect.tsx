import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * The "Processing stage(s)" cell for the instrument master — one instrument can serve
 * several stages, so this is a multi-select from the configured stage list. Read-only
 * (a preparer) shows the chosen stages as text.
 */
export function MultiStageSelect({
  value,
  options,
  onChange,
  readOnly,
}: {
  value: string[];
  options: string[];
  onChange: (next: string[]) => void;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const label = value.length ? value.join(" · ") : "";

  if (readOnly) {
    return <span className="block text-small text-text">{label || <span className="text-subdued/60">—</span>}</span>;
  }

  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 text-left text-small text-text outline-none"
      >
        <span className={`min-w-0 flex-1 truncate ${label ? "" : "text-subdued/60"}`}>{label || "Select stage(s)"}</span>
        <ChevronDown className="size-3.5 shrink-0 text-subdued" aria-hidden="true" />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-56 w-56 overflow-y-auto rounded-control border border-border bg-surface py-1 shadow-modal">
          {options.map((opt) => {
            const checked = value.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-small hover:bg-sunken"
              >
                <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${checked ? "border-primary bg-primary text-white" : "border-border"}`}>
                  {checked ? <Check className="size-3" aria-hidden="true" /> : null}
                </span>
                <span className="text-text">{opt}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
