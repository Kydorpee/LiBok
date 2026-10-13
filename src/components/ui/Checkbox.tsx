import { Check } from "lucide-react";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  /** Texto secundário sob o rótulo. */
  description?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, id, className, disabled, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <span className="relative mt-0.5 inline-flex h-5 w-5 shrink-0">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          disabled={disabled}
          aria-describedby={description ? `${inputId}-desc` : undefined}
          className="peer absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none rounded-[6px] border border-border-strong bg-bg-surface checked:border-action-primary checked:bg-action-primary disabled:cursor-not-allowed disabled:opacity-50"
          {...rest}
        />
        <Check
          className="pointer-events-none absolute inset-0 m-auto h-3.5 w-3.5 text-text-on-action opacity-0 peer-checked:opacity-100"
          strokeWidth={3}
          aria-hidden="true"
        />
      </span>
      <span className="flex flex-col">
        <label
          htmlFor={inputId}
          className={cn("text-body text-text-primary", disabled && "opacity-60")}
        >
          {label}
        </label>
        {description ? (
          <span id={`${inputId}-desc`} className="text-caption text-text-muted">
            {description}
          </span>
        ) : null}
      </span>
    </div>
  );
});
