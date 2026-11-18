import type { ReactNode } from "react";
import { Icon } from "./Icon";

interface TooltipProps {
  text: string;
  children: ReactNode;
  placement?: "above" | "below";
  wrap?: boolean;
}

/** Hover and focus tooltip, the design system's .ps-has-tip pattern. */
export function Tooltip({ text, children, placement = "above", wrap = true }: TooltipProps) {
  const pos =
    placement === "above"
      ? "bottom-[calc(100%+8px)] after:top-full after:border-t-toast"
      : "top-[calc(100%+8px)] after:bottom-full after:border-b-toast";
  return (
    <span className="group relative inline-flex flex-none align-middle">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-30 w-max max-w-[260px] -translate-x-1/2 rounded-sm bg-toast px-2.5 py-1.5 text-left text-[12.5px] font-normal normal-case leading-[18px] tracking-normal text-white opacity-0 shadow-overlay transition-opacity delay-300 duration-1 after:absolute after:left-1/2 after:-translate-x-1/2 after:border-[5px] after:border-transparent after:content-[''] group-focus-within:opacity-100 group-focus-within:delay-0 group-hover:opacity-100 ${pos} ${wrap ? "whitespace-normal" : "whitespace-nowrap"}`}
      >
        {text}
      </span>
    </span>
  );
}

interface InfoTipProps {
  label: string;
  text: string;
  icon?: string;
  placement?: "above" | "below";
}

/** The 20px round "info" button that carries a tooltip. */
export function InfoTip({ label, text, icon = "info", placement }: InfoTipProps) {
  return (
    <Tooltip text={text} placement={placement}>
      <button
        type="button"
        aria-label={label}
        className="inline-flex size-5 flex-none cursor-help items-center justify-center rounded-full border-none bg-transparent p-0 text-text-2 transition-[box-shadow,color] duration-100 hover:text-accent hover:shadow-halo"
      >
        <Icon name={icon} size={16} />
      </button>
    </Tooltip>
  );
}
