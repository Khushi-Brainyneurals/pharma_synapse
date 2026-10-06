import { CheckCircle2, Lock } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { DocumentOption } from "../model/documentSelector.types";

interface DocumentOptionCardProps {
  option: DocumentOption;
  isSelected: boolean;
  isDisabled: boolean;
  groupName: string;
  onSelect: (optionId: string) => void;
}

export function DocumentOptionCard({
  option,
  isSelected,
  isDisabled,
  groupName,
  onSelect,
}: DocumentOptionCardProps) {
  const isUnavailable = !option.available;
  const isLocked = isUnavailable || isDisabled;
  const OptionIcon = option.icon;

  function handleSelect() {
    if (isLocked) {
      return;
    }

    onSelect(option.id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    handleSelect();
  }

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      aria-disabled={isLocked}
      aria-describedby={
        isUnavailable ? `${groupName}-${option.id}-tooltip` : undefined
      }
      className={`group relative z-0 w-full overflow-visible rounded-card border p-4 text-left transition hover:z-20 focus-visible:z-20 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
        isSelected
          ? "border-primary bg-accent-soft"
          : "border-border bg-surface hover:border-primary/40 hover:bg-muted/40"
      } ${
        isUnavailable
          ? "cursor-not-allowed opacity-75"
          : "cursor-pointer"
      } ${
        isDisabled && option.available
          ? "cursor-not-allowed opacity-70"
          : ""
      }`}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
    >
      <span className="flex items-start gap-3">
        {/* Option icon */}
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-control border transition ${
            isSelected
              ? "border-primary/20 bg-primary/10 text-primary"
              : isUnavailable
                ? "border-border bg-muted text-subdued"
                : "border-border bg-muted/60 text-text"
          }`}
        >
          <OptionIcon className="size-5" aria-hidden="true" />
        </span>

        {/* Option content */}
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span
                className={`truncate text-small font-semibold ${
                  isUnavailable ? "text-subdued" : "text-text"
                }`}
              >
                {option.label}
              </span>

              {option.shortLabel ? (
                <span className="shrink-0 ml-1 text-micro font-semibold text-primary-dark">
                  ({option.shortLabel})
                </span>
              ) : null}
            </span>

            {isSelected ? (
              <CheckCircle2
                className="size-5 shrink-0 text-primary"
                aria-hidden="true"
              />
            // ) : isUnavailable ? (
            //   <Lock
            //     className="size-4 shrink-0 text-subdued"
            //     aria-hidden="true"
            //   />
            ) : null}
          </span>

          {option.description ? (
            <span className="mt-2 block text-small leading-5 text-subdued">
              {option.description}
            </span>
          ) : null}

          {isUnavailable ? (
            <span className="mt-3 inline-flex items-center gap-1 rounded-pill border border-border bg-muted px-2 py-1 text-micro font-medium text-subdued">
              <Lock className="size-3" aria-hidden="true" />
              Not in this release
            </span>
          ) : null}
        </span>
      </span>

      {isUnavailable && option.unavailableReason ? (
        <span
          id={`${groupName}-${option.id}-tooltip`}
          role="tooltip"
          className="pointer-events-none absolute left-3 right-3 top-full z-10 mt-2 hidden rounded-control border border-border bg-text px-3 py-2 text-micro font-medium text-white shadow-overlay group-hover:block group-focus-visible:block"
        >
          {option.unavailableReason}
        </span>
      ) : null}
    </button>
  );
}