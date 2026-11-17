import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: string;
  isLoading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "border-primary bg-primary text-on-primary shadow-[var(--lp-shadow-primary)] hover:border-primary-hover hover:bg-primary-hover dark:shadow-[var(--lp-raised-primary)]",
  secondary: "border-[var(--lp-btn-secondary-edge)] bg-surface text-text hover:bg-[var(--lp-row-hover)]",
  ghost: "bg-transparent text-primary-hover hover:bg-primary-soft",
};

/** The design system .ps-btn: 36px tall, 10px radius, 500 weight. */
export function Button({
  variant = "primary",
  icon,
  isLoading = false,
  loadingLabel = "Loading",
  disabled,
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={`inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-control border px-4 text-sm font-medium leading-5 transition-[background-color,color,border-color,box-shadow,transform] duration-1 hover:-translate-y-px hover:shadow-halo active:scale-[0.98] disabled:cursor-not-allowed disabled:border-border disabled:bg-fill-disabled disabled:text-text-disabled disabled:hover:translate-y-0 disabled:hover:shadow-none ${variant === "ghost" ? "border-transparent" : ""} ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {isLoading ? <Spinner label={loadingLabel} /> : icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}
