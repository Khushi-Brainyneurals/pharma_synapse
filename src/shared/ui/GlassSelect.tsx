import { Check, ChevronDown } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";

interface Option {
  value: string;
  label: string;
  disabled: boolean;
  group?: string;
}

interface Placement {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

const FOOTER_H = 41;

function readOptions(select: HTMLSelectElement): Option[] {
  return Array.from(select.options).map((option) => {
    const parent = option.parentElement;
    const group = parent instanceof HTMLOptGroupElement ? parent : null;
    return {
      value: option.value,
      label: option.text,
      disabled: option.disabled || Boolean(group?.disabled),
      group: group?.label,
    };
  });
}

/** Set the hidden native select and fire a real change event, so React onChange and
 *  react-hook-form see exactly what a native pick would produce. */
function commitValue(select: HTMLSelectElement, value: string) {
  if (select.value === value) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Drop-in replacement for <select>: same props, same <option> children, same onChange.
 *
 * The native select stays in the page (hidden) and remains the source of truth, so
 * controlled values, react-hook-form `register` and form submission behave as before.
 * What the user sees is the design system Select: the field with a chevron that turns
 * while open, and a glass dropdown list rendered at page level, with a highlighted row,
 * a check on the selected row and the keyboard hints footer.
 */
export const GlassSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function GlassSelect(props, forwardedRef) {
    const {
      className = "",
      style,
      id,
      title,
      disabled,
      children,
      onChange,
      onBlur,
      onFocus,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledby,
      "aria-describedby": ariaDescribedby,
      "aria-invalid": ariaInvalid,
      "aria-required": ariaRequired,
      ...selectProps
    } = props;

    const selectRef = useRef<HTMLSelectElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const typeahead = useRef({ text: "", at: 0 });
    const listId = useId();

    const [label, setLabel] = useState("");
    const [current, setCurrent] = useState("");
    const [widest, setWidest] = useState(0);
    const [open, setOpen] = useState(false);
    const [options, setOptions] = useState<Option[]>([]);
    const [active, setActive] = useState(-1);
    const [place, setPlace] = useState<Placement | null>(null);

    const setRefs = useCallback(
      (node: HTMLSelectElement | null) => {
        selectRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );

    // Mirror the native select's selected text after every render.
    const sync = useCallback(() => {
      const select = selectRef.current;
      if (!select) return;
      const selected = select.options[select.selectedIndex];
      setLabel(selected ? selected.text : "");
      setCurrent(select.value);
      setWidest(Array.from(select.options).reduce((max, o) => Math.max(max, o.text.length), 0));
    }, []);

    useLayoutEffect(sync);

    const position = useCallback(() => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      // Menus are at least 264px (design system: 240 to 320px, plus room for the
      // keyboard hints footer), or the field's width.
      const width = Math.max(rect.width, 264);
      const below = window.innerHeight - rect.bottom - 16;
      const above = rect.top - 16;
      const up = below < 220 && above > below;
      const room = up ? above : below;
      setPlace({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        width,
        top: up ? undefined : rect.bottom + 8,
        bottom: up ? window.innerHeight - rect.top + 8 : undefined,
        maxHeight: Math.max(140, Math.min(360, room)),
      });
    }, []);

    const openList = useCallback(() => {
      const select = selectRef.current;
      if (!select || disabled) return;
      const next = readOptions(select);
      setOptions(next);
      const selectedIndex = next.findIndex((o) => o.value === select.value);
      setActive(selectedIndex >= 0 ? selectedIndex : next.findIndex((o) => !o.disabled));
      position();
      setOpen(true);
    }, [disabled, position]);

    const close = useCallback((refocus = false) => {
      setOpen(false);
      if (refocus) triggerRef.current?.focus();
    }, []);

    const choose = useCallback(
      (index: number) => {
        const option = options[index];
        const select = selectRef.current;
        if (!option || option.disabled || !select) return;
        commitValue(select, option.value);
        sync();
        close(true);
      },
      [options, sync, close],
    );

    // Close on an outside press, a scroll outside the list, or a resize.
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

    useEffect(() => {
      if (!open || active < 0) return;
      listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
    }, [open, active]);

    function step(from: number, delta: number) {
      for (let i = from + delta; i >= 0 && i < options.length; i += delta) {
        if (!options[i].disabled) return i;
      }
      return from;
    }

    function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
      if (!open) {
        if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
          event.preventDefault();
          openList();
        }
        return;
      }
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setActive((i) => step(i, 1));
          return;
        case "ArrowUp":
          event.preventDefault();
          setActive((i) => step(i, -1));
          return;
        case "Home":
          event.preventDefault();
          setActive(step(-1, 1));
          return;
        case "End":
          event.preventDefault();
          setActive(step(options.length, -1));
          return;
        case "Enter":
        case " ":
          event.preventDefault();
          choose(active);
          return;
        case "Escape":
          event.preventDefault();
          close(true);
          return;
        case "Tab":
          close();
          return;
      }
      // Type to jump to the next option starting with those letters.
      if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const now = Date.now();
        const ta = typeahead.current;
        ta.text = now - ta.at > 600 ? event.key.toLowerCase() : ta.text + event.key.toLowerCase();
        ta.at = now;
        const start = ta.text.length === 1 ? active + 1 : active;
        for (let k = 0; k < options.length; k += 1) {
          const i = (start + k) % options.length;
          if (!options[i].disabled && options[i].label.toLowerCase().startsWith(ta.text)) {
            setActive(i);
            break;
          }
        }
      }
    }

    const asSelectEvent = <E,>(type: string) =>
      ({ target: selectRef.current, currentTarget: selectRef.current, type }) as unknown as E;

    // Without a width class, keep the field as wide as its longest option, like a native select.
    const hasWidth = /(^|\s)(w-|min-w-|flex-1|grow)/.test(className);
    const autoWidth = hasWidth ? undefined : `min(100%, calc(${Math.min(widest, 48) * 0.58}em + 2.75rem))`;

    let lastGroup: string | undefined;

    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          id={id}
          title={title}
          disabled={disabled}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          aria-describedby={ariaDescribedby}
          aria-invalid={ariaInvalid}
          aria-required={ariaRequired}
          data-open={open || undefined}
          className={`ps-select-trigger ${className}`}
          style={{ minWidth: autoWidth, ...style }}
          onClick={() => (open ? close() : openList())}
          onKeyDown={onKeyDown}
          onBlur={() => onBlur?.(asSelectEvent<FocusEvent<HTMLSelectElement>>("blur"))}
          onFocus={() => onFocus?.(asSelectEvent<FocusEvent<HTMLSelectElement>>("focus"))}
        >
          <span className="ps-select-trigger__value">{label || " "}</span>
          <ChevronDown className="ps-select-trigger__chevron" aria-hidden="true" />
        </button>

        <select
          {...selectProps}
          ref={setRefs}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          className="ps-select-native"
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            onChange?.(event);
            sync();
          }}
          onFocus={() => triggerRef.current?.focus()}
        >
          {children}
        </select>

        {open && place
          ? createPortal(
              <div
                ref={panelRef}
                className={`ps-dropdown ${place.bottom !== undefined ? "ps-dropdown--up" : ""}`}
                style={{ left: place.left, width: place.width, top: place.top, bottom: place.bottom }}
              >
                <div
                  ref={listRef}
                  id={listId}
                  role="listbox"
                  aria-label={ariaLabel}
                  className="ps-dropdown__list"
                  style={{ maxHeight: place.maxHeight - FOOTER_H }}
                >
                  {options.map((option, index) => {
                    const header = option.group && option.group !== lastGroup ? option.group : null;
                    lastGroup = option.group;
                    const isSelected = option.value === current;
                    return (
                      <div key={`${option.value}-${index}`} role="presentation">
                        {header ? <div className="ps-dropdown__group">{header}</div> : null}
                        <div
                          id={`${listId}-${index}`}
                          data-index={index}
                          role="option"
                          aria-selected={isSelected}
                          aria-disabled={option.disabled || undefined}
                          className={`ps-dropdown__row ${index === active ? "is-active" : ""}`}
                          onMouseDown={(event) => event.preventDefault()}
                          onMouseEnter={() => !option.disabled && setActive(index)}
                          onClick={() => choose(index)}
                        >
                          <span className="ps-dropdown__label">{option.label || " "}</span>
                          {isSelected ? <Check className="ps-dropdown__check" aria-hidden="true" /> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="ps-dropdown__foot" aria-hidden="true">
                  <span><kbd className="ps-kbd">↑↓</kbd> Move</span>
                  <span><kbd className="ps-kbd">Enter</kbd> Pick</span>
                  <span><kbd className="ps-kbd">Esc</kbd> Close</span>
                </div>
              </div>,
              document.body,
            )
          : null}
      </>
    );
  },
);
