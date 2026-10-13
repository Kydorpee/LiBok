import type { VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { buttonStyles } from "./button-styles";
import { cn } from "./cn";
import { Spinner } from "./Spinner";

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {
  /** Mostra spinner, desabilita o clique e marca aria-busy. */
  loading?: boolean;
  /** Ícone à esquerda do rótulo. */
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading = false, icon, disabled, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonStyles({ variant, size }), className)}
      {...rest}
    >
      {loading ? <Spinner size={16} label="Carregando" /> : icon}
      {children}
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  /** Nome acessível (obrigatório, o botão não tem texto). */
  label: string;
  tone?: "neutral" | "danger";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, tone = "neutral", className, children, type = "button", title, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={title ?? label}
      className={cn(
        "inline-flex h-icon-button w-icon-button shrink-0 items-center justify-center rounded-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:h-4 [&>svg]:w-4",
        tone === "danger"
          ? "text-text-danger hover:bg-feedback-danger-bg"
          : "text-text-muted hover:bg-bg-hover hover:text-text-primary",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
