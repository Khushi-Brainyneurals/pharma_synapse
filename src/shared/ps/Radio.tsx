import { forwardRef, type InputHTMLAttributes } from "react";

interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

/** The design system .ps-radio: 18px ring, 8px dot that pops in when checked. */
export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio({ label, disabled, ...props }, ref) {
  return (
    <label
      className={`group relative inline-flex min-h-7 items-center gap-2.5 text-sm leading-5 ${disabled ? "cursor-not-allowed text-text-disabled" : "cursor-pointer text-text"}`}
    >
      <input ref={ref} type="radio" disabled={disabled} className="peer absolute m-0 size-px opacity-0" {...props} />
      <span className="inline-flex size-[18px] flex-none items-center justify-center rounded-full border-[1.5px] border-border-control bg-paper transition-[border-color,box-shadow] duration-1 after:size-2 after:scale-0 after:rounded-full after:bg-primary after:transition-transform after:duration-2 after:ease-[cubic-bezier(0.34,1.56,0.64,1)] after:content-[''] group-hover:border-accent group-hover:shadow-halo peer-checked:border-primary peer-checked:after:scale-100 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus-ring" />
      <span>{label}</span>
    </label>
  );
});
