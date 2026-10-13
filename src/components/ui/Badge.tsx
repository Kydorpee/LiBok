import {
  BookUp,
  CircleCheck,
  ClockAlert,
  GraduationCap,
  Presentation,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** categoria: bolinha colorida + texto neutro; codigo: etiqueta de exemplar; contagem: destaque areia. */
  variant?: "category" | "code" | "count";
  /** Cor da categoria (vem do banco, ex.: `#CAE7B9`). Só usada em `category`. */
  color?: string;
}

export function Badge({ variant = "category", color, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-caption",
        variant === "category" && "border border-border-default bg-bg-surface text-text-primary",
        variant === "code" && "bg-bg-subtle font-mono text-text-primary border border-border-default",
        variant === "count" && "bg-brand-accent font-semibold text-text-on-accent",
        className,
      )}
      {...rest}
    >
      {variant === "category" && color ? (
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-full border border-border-strong"
          style={{ backgroundColor: color }}
        />
      ) : null}
      {children}
    </span>
  );
}

export type LoanStatus = "available" | "borrowed" | "overdue" | "returned";

const statusConfig: Record<LoanStatus, { label: string; icon: LucideIcon; className: string }> = {
  available: {
    label: "Disponível",
    icon: CircleCheck,
    className: "bg-feedback-success-bg text-text-success",
  },
  borrowed: {
    label: "Emprestado",
    icon: BookUp,
    className: "bg-bg-brand-subtle text-text-link",
  },
  overdue: {
    label: "Atrasado",
    icon: ClockAlert,
    className: "border border-feedback-danger bg-feedback-danger-bg text-text-danger",
  },
  returned: {
    label: "Devolvido",
    icon: Undo2,
    className: "bg-bg-subtle text-text-muted",
  },
};

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: LoanStatus;
  /** Texto extra após o rótulo (ex.: "lido"). */
  detail?: string;
}

export function StatusBadge({ status, detail, className, ...rest }: StatusBadgeProps) {
  const { label, icon: Icon, className: tone } = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-caption font-medium",
        tone,
        className,
      )}
      {...rest}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {label}
      {detail ? <span className="font-normal">· {detail}</span> : null}
    </span>
  );
}

export type ReaderType = "student" | "teacher";

export interface ReaderBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  type: ReaderType;
}

export function ReaderBadge({ type, className, ...rest }: ReaderBadgeProps) {
  const Icon = type === "student" ? GraduationCap : Presentation;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-bg-subtle px-2.5 py-0.5 text-caption font-medium text-text-primary border border-border-default",
        className,
      )}
      {...rest}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {type === "student" ? "Aluno" : "Professor"}
    </span>
  );
}
