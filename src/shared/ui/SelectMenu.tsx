import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export function SelectMenu({
  value,
  options,
  placeholder,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
  disabled: boolean;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState({ left: 0, top: 0, width: 0, maxH: 240, up: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const items = [{ value: "", label: placeholder }, ...options.map((o) => ({ value: o, label: o }))];

  function openMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom;
    const up = below < 220 && rect.top > below;
    setPos({
      left: rect.left,
      top: up ? rect.top : rect.bottom,
      width: rect.width,
      maxH: Math.max(120, Math.min(240, (up ? rect.top : below) - 12)),
      up,
    });
    setActive(Math.max(0, items.findIndex((item) => item.value === value)));
    setOpen(true);
  }

  function choose(next: string) {
    onChange(next);
    setOpen(false);
    buttonRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!buttonRef.current?.contains(t) && !listRef.current?.contains(t)) close();
    };
    const onScroll = (e: Event) => {
      if (!listRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (items[active]) choose(items[active].value);
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
    }
  }

  const selected = value !== "";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        data-open={open || undefined}
        className={`ps-select-trigger flex w-full min-w-0 items-center justify-between gap-2 rounded-control border bg-surface px-3 py-2 text-left text-small outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:bg-muted disabled:text-subdued ${
          open ? "border-primary" : "border-border"
        }`}
      >
        <span className={`ps-select-trigger__value ${selected ? "text-text" : "text-subdued/70"}`}>
          {selected ? value : placeholder}
        </span>
        <ChevronDown className="ps-select-trigger__chevron" aria-hidden="true" />
      </button>

      {open
        ? createPortal(
            <ul
              ref={listRef}
              role="listbox"
              aria-label={ariaLabel}
              style={{
                position: "fixed",
                left: pos.left,
                width: pos.width,
                maxHeight: pos.maxH,
                ...(pos.up
                  ? { bottom: window.innerHeight - pos.top + 8 }
                  : { top: pos.top + 8 }),
              }}
              className={`ps-dropdown ps-dropdown__list ${pos.up ? "ps-dropdown--up" : ""}`}
            >
              {items.map((item, i) => {
                const isSelected = item.value === value;
                return (
                  <li
                    key={item.value || "__empty"}
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(item.value)}
                    onMouseEnter={() => setActive(i)}
                    className={`ps-dropdown__row ${i === active ? "is-active" : ""} ${
                      item.value === "" && !isSelected ? "text-subdued" : ""
                    }`}
                  >
                    <span className="ps-dropdown__label">{item.label}</span>
                    {isSelected ? (
                      <Check className="ps-dropdown__check" aria-hidden="true" />
                    ) : null}
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </>
  );
}