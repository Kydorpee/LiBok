import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Remove o padding interno (útil para tabelas dentro do card). */
  flush?: boolean;
}

export function Card({ flush = false, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border-default bg-bg-surface",
        !flush && "p-6",
        className,
      )}
      {...rest}
    />
  );
}

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function CardHeader({ title, description, actions, className, ...rest }: CardHeaderProps) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-4", className)} {...rest}>
      <div className="min-w-0">
        <h2 className="text-subtitle text-text-primary">{title}</h2>
        {description ? <p className="text-body text-text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: ReactNode;
  /** Texto de apoio sob o valor. */
  detail?: ReactNode;
  icon?: ReactNode;
}

export function StatCard({ label, value, detail, icon, className, ...rest }: StatCardProps) {
  return (
    <Card className={cn("flex items-start justify-between gap-4", className)} {...rest}>
      <div className="min-w-0">
        <p className="text-label text-text-muted">{label}</p>
        <p className="text-stat text-text-primary">{value}</p>
        {detail ? <p className="text-caption text-text-muted">{detail}</p> : null}
      </div>
      {icon ? (
        <span
          aria-hidden="true"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-bg-brand-subtle text-text-link [&>svg]:h-5 [&>svg]:w-5"
        >
          {icon}
        </span>
      ) : null}
    </Card>
  );
}
