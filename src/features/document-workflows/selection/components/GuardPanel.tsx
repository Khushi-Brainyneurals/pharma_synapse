import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

interface GuardPanelProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}

export function GuardPanel({ title, children, action }: GuardPanelProps) {
  return (
    <section
      className="rounded-card border border-danger/20 bg-danger-soft p-5 text-danger-ink"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="text-h3 font-semibold">{title}</h2>
          <div className="mt-2 text-small leading-6">{children}</div>
          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </div>
    </section>
  );
}
