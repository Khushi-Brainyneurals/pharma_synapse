import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const PANEL_W = 296;
const PANEL_H = 372;

/** "2026-11-12" → local Date, or null. */
function parseIso(value: string | undefined | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The design system date format: 12 Nov 2026. */
export function formatDisplayDate(value: string | null | undefined) {
  const d = parseIso(value);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : "";
}

const sameDay = (a: Date | null, b: Date | null) =>
  Boolean(a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate());

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last));
};

/** Monday-first 6 week grid for the month containing `d`. */
function monthGrid(d: Date) {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export interface DateFieldProps {
  /** ISO date, YYYY-MM-DD, or "" for no date. */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Earliest and latest selectable dates, YYYY-MM-DD. */
  min?: string;
  max?: string;
  "aria-label"?: string;
}

/**
 * The design system date picker: a field reading "12 Nov 2026" with a calendar icon,
 * opening a glass popover with the month, previous and next buttons and a Monday-first
 * grid of 36px days. Today has an accent ring, the selected day the accent fill, and
 * days outside the month are text-3. Keyboard: arrows move a day or a week, Page Up and
 * Page Down move a month, Home and End jump within the week, Enter picks, Esc closes.
 */
export function DateField({
  value,
  onChange,
  id,
  className = "",
  placeholder = "Select a date",
  disabled,
  min,
  max,
  "aria-label": ariaLabel,
}: DateFieldProps) {
  const selected = parseIso(value);
  const minDate = parseIso(min);
  const maxDate = parseIso(max);
  const today = new Date();
  const titleId = useId();

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [focusDay, setFocusDay] = useState<Date>(selected ?? today);
  const [place, setPlace] = useState<{ left: number; top?: number; bottom?: number } | null>(null);

  const isDisabledDay = (d: Date) =>
    Boolean((minDate && d < minDate && !sameDay(d, minDate)) || (maxDate && d > maxDate && !sameDay(d, maxDate)));

  const position = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom - 16;
    const up = below < PANEL_H && rect.top - 16 > below;
    setPlace({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - PANEL_W - 8)),
      top: up ? undefined : rect.bottom + 8,
      bottom: up ? window.innerHeight - rect.top + 8 : undefined,
    });
  }, []);

  function openPicker() {
    if (disabled) return;
    setFocusDay(selected ?? today);
    position();
    setOpen(true);
  }

  const close = useCallback((refocus = false) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  function pick(d: Date) {
    if (isDisabledDay(d)) return;
    onChange(toIso(d));
    close(true);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) close();
    };
    const onScroll = (event: Event) => {
      if (!panelRef.current?.contains(event.target as Node)) close();
    };
    const onResize = () => close();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close]);

  // Keep keyboard focus on the focused day while the picker is open.
  useEffect(() => {
    if (!open) return;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${toIso(focusDay)}"]`)?.focus();
  }, [open, focusDay]);

  function onGridKey(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focusDay, -1),
      ArrowRight: () => addDays(focusDay, 1),
      ArrowUp: () => addDays(focusDay, -7),
      ArrowDown: () => addDays(focusDay, 7),
      PageUp: () => addMonths(focusDay, event.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focusDay, event.shiftKey ? 12 : 1),
      Home: () => addDays(focusDay, -((focusDay.getDay() + 6) % 7)),
      End: () => addDays(focusDay, 6 - ((focusDay.getDay() + 6) % 7)),
    };
    if (moves[event.key]) {
      event.preventDefault();
      setFocusDay(moves[event.key]());
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pick(focusDay);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    }
  }

  const days = monthGrid(focusDay);
  const display = formatDisplayDate(value);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel ? `${ariaLabel}${display ? `, ${display}` : ""}` : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-open={open || undefined}
        className={`ps-date-trigger ${className}`}
        onClick={() => (open ? close() : openPicker())}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            openPicker();
          }
        }}
      >
        <span className={`ps-date-trigger__value ${display ? "" : "is-empty"}`}>{display || placeholder}</span>
        <CalendarDays className="ps-date-trigger__icon" aria-hidden="true" />
      </button>

      {open && place
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="false"
              aria-labelledby={titleId}
              className={`ps-dropdown ps-datepick ${place.bottom !== undefined ? "ps-dropdown--up" : ""}`}
              style={{ left: place.left, top: place.top, bottom: place.bottom, width: PANEL_W }}
            >
              <div className="ps-datepick__head">
                <button
                  type="button"
                  className="ps-datepick__nav"
                  aria-label="Previous month"
                  onClick={() => setFocusDay(addMonths(focusDay, -1))}
                >
                  <ChevronLeft aria-hidden="true" />
                </button>
                <span id={titleId} aria-live="polite">
                  {MONTHS[focusDay.getMonth()]} {focusDay.getFullYear()}
                </span>
                <button
                  type="button"
                  className="ps-datepick__nav"
                  aria-label="Next month"
                  onClick={() => setFocusDay(addMonths(focusDay, 1))}
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>

              <div ref={gridRef} role="grid" aria-labelledby={titleId} className="ps-datepick__grid" onKeyDown={onGridKey}>
                {DOW.map((d) => (
                  <span key={d} role="columnheader" className="ps-datepick__dow">
                    {d}
                  </span>
                ))}
                {days.map((d) => {
                  const iso = toIso(d);
                  const out = d.getMonth() !== focusDay.getMonth();
                  const isSel = sameDay(d, selected);
                  const isToday = sameDay(d, today);
                  const off = isDisabledDay(d);
                  return (
                    <button
                      key={iso}
                      type="button"
                      role="gridcell"
                      data-iso={iso}
                      tabIndex={sameDay(d, focusDay) ? 0 : -1}
                      aria-selected={isSel}
                      aria-disabled={off || undefined}
                      aria-label={`${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}${isToday ? ", today" : ""}`}
                      className={`ps-datepick__day ${out ? "ps-datepick__day--out" : ""} ${isToday ? "ps-datepick__day--today" : ""}`}
                      onClick={() => pick(d)}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>

              <div className="ps-datepick__foot">
                <button type="button" className="ps-datepick__link" disabled={isDisabledDay(today)} onClick={() => pick(today)}>
                  Today
                </button>
                {value ? (
                  <button
                    type="button"
                    className="ps-datepick__link"
                    onClick={() => {
                      onChange("");
                      close(true);
                    }}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
