import { forwardRef, type SelectHTMLAttributes } from "react";
import { FormError } from "./FormError";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  isRequired?: boolean;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    id,
    label,
    error,
    isRequired,
    options,
    placeholder = "Select an option",
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
      <select
        id={id}
        aria-invalid={Boolean(error)}
        aria-required={showRequiredMarker}
        aria-describedby={errorId}
        ref={ref}
        className={`min-h-10 w-full rounded-control border bg-surface px-3 py-2 text-sm text-text shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:text-subdued ${
          error ? "border-danger focus:border-danger focus:ring-danger/20" : "border-border"
        } ${className}`}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FormError id={errorId} message={error} />
    </div>
  );
});
