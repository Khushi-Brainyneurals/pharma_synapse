import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

interface DialogProps {
  title: string;
  busy?: boolean;
  size?: "md" | "lg" | "xl";
  onClose: () => void;
  children: ReactNode;
}

const sizes = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-5xl",
} as const;

export function Dialog({ title, busy = false, size = "lg", onClose, children }: DialogProps) {
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    }

    document.addEventListener("keydown", keyDown);
    return () => document.removeEventListener("keydown", keyDown);
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: "var(--scrim, rgba(0, 0, 0, 0.45))" }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`max-h-[90vh] w-full ${sizes[size]} overflow-y-auto rounded-modal border border-border bg-surface p-5 shadow-modal sm:p-6`}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-h2 font-semibold text-text">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close dialog"
            disabled={busy}
            className="inline-flex size-8 items-center justify-center rounded-control text-subdued transition hover:bg-muted hover:text-text disabled:opacity-50"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

