import type { ReactNode } from "react";
import type { LoginFeedbackVariant } from "../api/auth.errors";
import { Info } from "lucide-react";

interface AuthNoticeProps {
  message?: ReactNode;
  variant?: LoginFeedbackVariant;
  className?: string;
}

const variantClasses: Record<LoginFeedbackVariant, string> = {
  danger: "border-danger/20 bg-danger-soft text-danger",
  info: "border-border bg-muted text-subdued",
  success: "border-success/20 bg-success/10 text-success",
};

export function AuthNotice({
  message,
  variant = "danger",
  className = "",
}: AuthNoticeProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={`flex items-center justify-center gap-2 rounded-control border px-4 py-3 text-center text-sm leading-6 ${variantClasses[variant]} ${className}`}
      role={variant === "danger" ? "alert" : "status"}
      aria-live="polite"
    >
      <Info aria-hidden="true" className="size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
