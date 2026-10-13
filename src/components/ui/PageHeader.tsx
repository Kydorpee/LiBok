import { ChevronRight } from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { cn } from "./cn";

export interface BreadcrumbItem {
  label: string;
  /** Destino; sem ele o item é texto (o último é sempre texto, a página atual). */
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  /** Botões da tela, alinhados à direita. */
  actions?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  /** Componente de link para o breadcrumb (ex.: `Link` do react-router, recebe `to`). Padrão: `a`. */
  linkAs?: ElementType;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
  linkAs,
  className,
}: PageHeaderProps) {
  const LinkComponent = linkAs ?? "a";
  return (
    <header
      className={cn(
        "flex min-h-header items-center justify-between gap-6 border-b border-border-default bg-bg-surface px-8 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 ? (
          <nav aria-label="Você está em" className="mb-1">
            <ol className="flex items-center gap-1 text-caption text-text-muted">
              {breadcrumb.map((item, i) => {
                const last = i === breadcrumb.length - 1;
                const linkProps = linkAs ? { to: item.href } : { href: item.href };
                return (
                  <li key={`${item.label}-${i}`} className="flex items-center gap-1">
                    {item.href && !last ? (
                      <LinkComponent {...linkProps} className="text-text-link hover:underline">
                        {item.label}
                      </LinkComponent>
                    ) : (
                      <span aria-current={last ? "page" : undefined}>{item.label}</span>
                    )}
                    {last ? null : <ChevronRight className="h-3 w-3" aria-hidden="true" />}
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : null}
        <h1 className="truncate text-title text-text-primary">{title}</h1>
        {subtitle ? <p className="text-body text-text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
