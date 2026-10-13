import type { HTMLAttributes } from "react";
import { getInitials } from "./initials";
import { cn } from "./cn";

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  /** Nome completo; as iniciais são derivadas dele. */
  name: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "h-8 w-8 text-caption",
  md: "h-10 w-10 text-body-strong",
  lg: "h-16 w-16 text-subtitle",
};

export function Avatar({ name, size = "md", className, ...rest }: AvatarProps) {
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full bg-bg-brand-subtle font-semibold text-text-link",
        sizes[size],
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true">{getInitials(name)}</span>
    </span>
  );
}
