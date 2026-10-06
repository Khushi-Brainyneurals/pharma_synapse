import { Info } from "lucide-react";

interface FormErrorProps {
  id?: string;
  message?: string;
  className?: string;
}

export function FormError({ id, message, className = "" }: FormErrorProps) {
  if (!message) {
    return null;
  }

  return (
    <p
      id={id}
      className={`flex items-start gap-1.5 text-xs font-medium leading-5 text-danger ${className}`}
      role="alert"
    >
      <span aria-hidden="true">
        <Info className="mt-1 size-3" />
      </span>
      {message}
    </p>
  );
}
