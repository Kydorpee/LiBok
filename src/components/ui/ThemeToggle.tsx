import { Monitor, Moon, Sun } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import { cn } from "./cn";
import type { Theme } from "./useTheme";

const options: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

export interface ThemeToggleProps {
  value: Theme;
  onChange: (theme: Theme) => void;
  /** Mostra o texto de cada opção (padrão: só ícones). */
  showLabels?: boolean;
  /** `sidebar` usa as cores da barra lateral. */
  tone?: "default" | "sidebar";
  className?: string;
}

/** Seletor de tema (radiogroup). Use com `useTheme()`. */
export function ThemeToggle({
  value,
  onChange,
  showLabels = false,
  tone = "default",
  className,
}: ThemeToggleProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const idx = options.findIndex((o) => o.value === value);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[options[next].value]?.focus();
  }

  return (
    <div
      role="radiogroup"
      onKeyDown={onKeyDown}
      aria-label="Tema"
      className={cn(
        "inline-flex gap-1 rounded-sm p-1",
        tone === "sidebar" ? "bg-bg-sidebar-active/20" : "bg-bg-subtle",
        className,
      )}
    >
      {options.map(({ value: v, label, icon: Icon }) => {
        const checked = v === value;
        return (
          <button
            key={v}
            ref={(el) => {
              refs.current[v] = el;
            }}
            type="button"
            tabIndex={checked ? 0 : -1}
            role="radio"
            aria-checked={checked}
            aria-label={label}
            title={label}
            onClick={() => onChange(v)}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-2 rounded-sm px-2 text-label transition-colors",
              tone === "sidebar" && "focus-visible:outline-border-focus-on-sidebar",
              checked
                ? tone === "sidebar"
                  ? "bg-bg-sidebar-active text-text-on-sidebar-active"
                  : "bg-bg-surface text-text-primary shadow-toast"
                : tone === "sidebar"
                  ? "text-text-on-sidebar hover:bg-bg-sidebar-active/40"
                  : "text-text-muted hover:text-text-primary",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {showLabels ? label : null}
          </button>
        );
      })}
    </div>
  );
}
