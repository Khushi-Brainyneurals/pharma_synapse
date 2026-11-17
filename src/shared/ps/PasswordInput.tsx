import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Icon } from "./Icon";
import { inputClass } from "./Field";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** Password input with the show and hide eye button in its tail. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { className = "", ...props },
  ref,
) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative flex w-full items-center">
      <input ref={ref} type={show ? "text" : "password"} className={`${inputClass} pr-11 ${className}`} {...props} />
      <span className="absolute right-1 top-1/2 flex -translate-y-1/2">
        <button
          type="button"
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          onClick={() => setShow((v) => !v)}
          className="inline-flex size-8 items-center justify-center rounded-[10px] text-text-2 transition-[background-color,box-shadow] duration-1 hover:bg-primary-soft hover:shadow-halo"
        >
          <Icon name={show ? "visibility_off" : "visibility"} size={18} />
        </button>
      </span>
    </span>
  );
});
