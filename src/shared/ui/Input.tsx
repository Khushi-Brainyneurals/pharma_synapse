import { forwardRef, type InputHTMLAttributes } from "react";
import { FormError } from "./FormError";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  isRequired?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
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
  const errorId = error ? `${id}-error` : undefined;
  const showRequiredMarker = isRequired ?? required;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-text">
        {label}
        {showRequiredMarker ? <span className="ml-1 text-danger">*</span> : null}
      </label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-required={showRequiredMarker}
        aria-describedby={errorId}
        ref={ref}
        className={`min-h-10 w-full rounded-control border bg-surface px-3 py-2 text-sm text-text shadow-sm transition placeholder:text-subdued/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:text-subdued ${
          error ? "border-danger focus:border-danger focus:ring-danger/20" : "border-border"
        } ${className}`}
        {...props}
      />
      <FormError id={errorId} message={error} />
    </div>
  );
});
