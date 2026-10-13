import type { ComponentPropsWithoutRef } from "react";
import { cn } from "./cn";

export interface SkipLinkProps extends Omit<ComponentPropsWithoutRef<"a">, "href"> {
  /** Id do alvo (padrão: `main-content`). O alvo deve ter esse id e `tabIndex={-1}`. */
  targetId?: string;
}

/**
 * Link "Pular para o conteúdo": invisível até receber foco. Coloque como primeiro
 * elemento do layout e dê `id="main-content"` (e `tabIndex={-1}`) ao `<main>`.
 */
export function SkipLink({ targetId = "main-content", className, children, ...rest }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      onClick={(e) => {
        const el = document.getElementById(targetId);
        if (el) {
          e.preventDefault();
          el.focus();
          el.scrollIntoView?.();
        }
      }}
      className={cn(
        "sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[70] focus-visible:rounded-md focus-visible:bg-bg-surface focus-visible:px-4 focus-visible:py-2 focus-visible:text-body-strong focus-visible:text-text-primary focus-visible:shadow-modal",
        className,
      )}
      {...rest}
    >
      {children ?? "Pular para o conteúdo"}
    </a>
  );
}
