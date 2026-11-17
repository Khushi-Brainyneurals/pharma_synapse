import type { ReactNode } from "react";
import { Icon } from "./Icon";

export const inputClass =
  "min-h-9 w-full rounded-control border border-border-control bg-surface px-3 text-sm leading-5 text-text outline-none transition-[border-color,box-shadow] duration-1 placeholder:text-text-3 hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:bg-fill-disabled disabled:text-text-disabled";

export const labelClass = "m-0 text-[13px] font-medium leading-5 text-text-2";

interface FieldProps {
  label: ReactNode;
  error?: string;
  children: ReactNode;
}

/** The .ps-field stack: label, control, error line. */
export function Field({ label, error, children }: FieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {label}
      {children}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}

export function FieldError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="m-0 flex items-start gap-1.5 text-[12.5px] leading-[18px] text-danger-text">
      <Icon name="error" size={14} className="mt-0.5" />
      <span>{children}</span>
    </p>
  );
}
