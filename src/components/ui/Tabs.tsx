import { useRef, type HTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "./cn";

export interface TabItem {
  value: string;
  label: string;
  /** Contagem exibida ao lado do rótulo. */
  count?: number;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  /** Nome acessível da lista de abas. */
  "aria-label": string;
  /** Prefixo dos ids; permite ligar cada aba ao seu `TabPanel`. */
  idBase?: string;
  className?: string;
}

export function Tabs({ items, value, onChange, idBase = "tabs", className, ...rest }: TabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const enabled = items.filter((i) => !i.disabled);
    const idx = enabled.findIndex((i) => i.value === value);
    let next: TabItem | undefined;
    if (e.key === "ArrowRight") next = enabled[(idx + 1) % enabled.length];
    else if (e.key === "ArrowLeft") next = enabled[(idx - 1 + enabled.length) % enabled.length];
    else if (e.key === "Home") next = enabled[0];
    else if (e.key === "End") next = enabled[enabled.length - 1];
    if (next) {
      e.preventDefault();
      onChange(next.value);
      refs.current[next.value]?.focus();
    }
  }

  return (
    <div
      role="tablist"
      aria-label={rest["aria-label"]}
      onKeyDown={onKeyDown}
      className={cn("flex gap-1 border-b border-border-default", className)}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[item.value] = el;
            }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${item.value}`}
            aria-selected={selected}
            aria-controls={selected ? `${idBase}-panel-${item.value}` : undefined}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={cn(
              "-mb-px inline-flex h-10 items-center gap-2 border-b-2 px-4 text-body-strong transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              selected
                ? "border-action-primary text-text-primary"
                : "border-transparent text-text-muted hover:bg-bg-hover hover:text-text-primary",
            )}
          >
            {item.label}
            {item.count !== undefined ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-caption",
                  selected ? "bg-brand-accent text-text-on-accent" : "bg-bg-subtle text-text-muted",
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export interface TabPanelProps extends HTMLAttributes<HTMLDivElement> {
  idBase?: string;
  value: string;
  /** Aba atualmente ativa; o painel só renderiza quando igual a `value`. */
  active: string;
  children?: ReactNode;
}

export function TabPanel({ idBase = "tabs", value, active, children, ...rest }: TabPanelProps) {
  if (value !== active) return null;
  return (
    <div
      role="tabpanel"
      id={`${idBase}-panel-${value}`}
      aria-labelledby={`${idBase}-tab-${value}`}
      tabIndex={0}
      {...rest}
    >
      {children}
    </div>
  );
}
