import { LoaderCircle } from "lucide-react";
import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  /** Tamanho em px do ícone. */
  size?: number;
  /** Texto lido por leitores de tela. */
  label?: string;
}

export function Spinner({ size = 16, label = "Carregando", className, ...rest }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={cn("inline-flex", className)} {...rest}>
      <LoaderCircle width={size} height={size} className="animate-spin" aria-hidden="true" />
    </span>
  );
}

export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-sm bg-bg-hover", className)}
      {...rest}
    />
  );
}
