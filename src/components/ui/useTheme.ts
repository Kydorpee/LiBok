import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "libok-theme";

const listeners = new Set<() => void>();

function isTheme(v: unknown): v is Theme {
  return v === "light" || v === "dark" || v === "system";
}

export function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(v)) return v;
  } catch {
    /* localStorage indisponível */
  }
  return "system";
}

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
}

/** Aplica o tema no <html> (classe `dark` e `data-theme`). */
export function applyTheme(theme: Theme): void {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.setAttribute("data-theme", resolved);
}

let current: Theme = getStoredTheme();
let mediaBound = false;

function emit() {
  listeners.forEach((l) => l());
}

/** Chame uma vez antes do primeiro render (ex.: em main.tsx) para evitar flash de tema. */
export function initTheme(): void {
  current = getStoredTheme();
  applyTheme(current);
  bindMedia();
}

function bindMedia() {
  if (mediaBound) return;
  try {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", () => {
      if (current === "system") {
        applyTheme("system");
        emit();
      }
    });
    mediaBound = true;
  } catch {
    /* sem matchMedia */
  }
}

export function setTheme(theme: Theme): void {
  current = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignora */
  }
  applyTheme(theme);
  bindMedia();
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Tema escolhido (claro/escuro/sistema), tema efetivo e setter. Persistido em localStorage. */
export function useTheme(): {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
} {
  const theme = useSyncExternalStore(subscribe, () => current);
  const resolved = useSyncExternalStore(subscribe, () => resolveTheme(current));
  return { theme, resolvedTheme: resolved, setTheme };
}
