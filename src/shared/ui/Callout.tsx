import { AlertCircle, AlertTriangle, Info } from "lucide-react";

type CalloutTone =
  /** Validation / failure feedback. NOT a lifecycle state. */
  | "danger"
  /** Something the user should check before proceeding. Uses the draft (gold) hue —
   *  the design system has no separate warning register. */
  | "attention"
  /** Neutral explanation. Quiet by default: hairline border, flat surface. */
  | "info";

const TONE: Record<CalloutTone, { box: string; icon: string; Icon: typeof Info }> = {
  danger: {
    box: "border-danger/30 bg-danger-soft",
    icon: "text-danger",
    Icon: AlertCircle,
  },
  attention: {
    box: "border-draft-fg/30 bg-draft-bg",
    icon: "text-draft-fg",
    Icon: AlertTriangle,
  },
  info: {
    box: "border-border bg-sunken",
    icon: "text-subdued",
    Icon: Info,
  },
};

/**
 * A feedback panel.
 *
 * Exists so the design system's colour rules are decided ONCE, not re-invented on
 * every page — which is exactly how 47 hardcoded Tailwind colours crept in and the
 * status hues ended up wrong.
 */
export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: CalloutTone;
  title?: string;
  children: React.ReactNode;
}) {
  const { box, icon, Icon } = TONE[tone];

  return (
    <div className={`flex items-start gap-2 rounded-panel border p-4 ${box}`}>
      <Icon className={`mt-0.5 size-4 shrink-0 ${icon}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title ? <p className="text-small font-semibold">{title}</p> : null}
        <div className={`text-small ${title ? "mt-1" : ""}`}>{children}</div>
      </div>
    </div>
  );
}
