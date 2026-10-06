import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { FormError } from "./FormError";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  isRequired?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    {
      id,
      label,
      error,
      isRequired,
      required,
      className = "",
      ...props
    },
    ref,
  ) {
  const [isVisible, setIsVisible] = useState(false);
  const errorId = error ? `${id}-error` : undefined;
  const showRequiredMarker = isRequired ?? required;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-text">
        {label}
        {showRequiredMarker ? <span className="ml-1 text-danger">*</span> : null}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isVisible ? "text" : "password"}
          aria-invalid={Boolean(error)}
          aria-required={showRequiredMarker}
          aria-describedby={errorId}
          ref={ref}
          className={`min-h-10 w-full rounded-control border bg-surface px-3 py-2 pr-16 text-sm text-text shadow-sm transition placeholder:text-subdued/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:text-subdued ${
            error ? "border-danger focus:border-danger focus:ring-danger/20" : "border-border"
          } ${className}`}
          {...props}
        />
        <button
          type="button"
          aria-label={isVisible ? "Hide password" : "Show password"}
          className="absolute inset-y-1.5 right-1.5 rounded px-2 text-xs font-semibold text-subdued transition hover:bg-muted hover:text-primary focus:outline-none "
          onClick={() => setIsVisible((current) => !current)}
        >
          {isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <FormError id={errorId} message={error} />
    </div>
  );
  },
);
