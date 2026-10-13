import { BookOpen } from "lucide-react";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "./cn";

export interface SidebarItemProps extends ComponentPropsWithoutRef<"a"> {
  /** Ícone (ex.: `<Library />` do lucide-react). */
  icon?: ReactNode;
  /** Item da rota atual (aria-current="page"). */
  active?: boolean;
  /** Componente de link; ex.: `Link` do react-router (passe `to`). Padrão: `a`. */
  as?: ElementType;
  /** Props extras repassadas ao componente (`to`, etc.). */
  to?: string;
}

export function SidebarItem({
  icon,
  active = false,
  as: Component = "a",
  className,
  children,
  ...rest
}: SidebarItemProps) {
  return (
    <Component
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-3 rounded-sm px-3 focus-visible:outline-border-focus-on-sidebar text-body-strong transition-colors [&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:shrink-0",
        active
          ? "bg-bg-sidebar-active text-text-on-sidebar-active"
          : "text-text-on-sidebar hover:bg-bg-sidebar-active/40",
        className,
      )}
      {...rest}
    >
      {icon}
      <span className="truncate">{children}</span>
    </Component>
  );
}

export interface SidebarNavItem extends Omit<SidebarItemProps, "children"> {
  key: string;
  label: string;
}

export interface SidebarGroup {
  /** Título do grupo (ex.: "Circulação"); omita no grupo principal. */
  label?: string;
  items: SidebarNavItem[];
}

export interface SidebarProps {
  groups: SidebarGroup[];
  /** Marca no topo; padrão: logo + "LiBok". */
  brand?: ReactNode;
  /** Rodapé (ex.: seletor de tema e versão). */
  footer?: ReactNode;
  className?: string;
}

export function Sidebar({ groups, brand, footer, className }: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full w-sidebar shrink-0 flex-col gap-6 bg-bg-sidebar px-4 py-6 text-text-on-sidebar",
        className,
      )}
    >
      <div className="flex items-center gap-3 px-2">
        {brand ?? (
          <>
            <span
              aria-hidden="true"
              className="inline-flex h-9 w-9 items-center justify-center rounded-sm bg-brand-accent text-text-on-accent"
            >
              <BookOpen className="h-5 w-5" />
            </span>
            <span className="text-subtitle">LiBok</span>
          </>
        )}
      </div>
      <nav aria-label="Principal" className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {groups.map((group, gi) => (
          <div key={group.label ?? gi} className="flex flex-col gap-1">
            {group.label ? (
              <p className="px-3 pb-1 text-caption font-semibold uppercase tracking-wide">
                {group.label}
              </p>
            ) : null}
            {group.items.map(({ key, label, ...item }) => (
              <SidebarItem key={key} {...item}>
                {label}
              </SidebarItem>
            ))}
          </div>
        ))}
      </nav>
      {footer ? <div className="flex flex-col gap-2 px-2">{footer}</div> : null}
    </aside>
  );
}
