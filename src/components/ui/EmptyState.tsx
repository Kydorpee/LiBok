import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: ReactNode;
  title: ReactNode;
  message?: ReactNode;
  /** Botão/ação opcional (ex.: "Limpar filtros"). */
  action?: ReactNode;
}

export function EmptyState({ icon, title, message, action, className, ...rest }: EmptyStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}
      {...rest}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-bg-subtle text-text-muted [&>svg]:h-6 [&>svg]:w-6"
        >
          {icon}
        </span>
      ) : null}
      <h3 className="text-subtitle text-text-primary">{title}</h3>
      {message ? <p className="max-w-md text-body text-text-muted">{message}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
