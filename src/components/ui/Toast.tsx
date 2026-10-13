import { CircleAlert, CircleCheck, Info, X, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "./cn";
import { Spinner } from "./Spinner";
import {
  ToastContext,
  type ToastApi,
  type ToastItem,
  type ToastOptions,
  type ToastType,
} from "./toast-context";

const defaultDuration: Record<ToastType, number | null> = {
  success: 4000,
  info: 4000,
  error: 7000,
  loading: null,
};

const iconColor: Record<Exclude<ToastType, "loading">, string> = {
  success: "text-text-success",
  error: "text-text-danger",
  info: "text-text-link",
};

const icons: Record<Exclude<ToastType, "loading">, LucideIcon> = {
  success: CircleCheck,
  error: CircleAlert,
  info: Info,
};

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const { id, type, title, message, duration } = item;
  const [paused, setPaused] = useState(false);
  const total = duration ?? defaultDuration[type];
  const remaining = useRef<number | null>(total);
  useEffect(() => {
    remaining.current = total;
  }, [id, type, total]);
  useEffect(() => {
    if (paused || remaining.current == null) return;
    const started = Date.now();
    const t = setTimeout(() => onDismiss(id), remaining.current);
    return () => {
      clearTimeout(t);
      if (remaining.current != null) remaining.current = Math.max(0, remaining.current - (Date.now() - started));
    };
  }, [id, type, total, paused, onDismiss]);

  const Icon = type === "loading" ? null : icons[type];
  return (
    <div
      role={type === "error" ? "alert" : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
      className={cn(
        "pointer-events-auto flex w-[360px] max-w-full items-start gap-3 rounded-md border bg-bg-surface p-4 shadow-toast",
        type === "error" ? "border-2 border-feedback-danger" : "border-border-default",
      )}
    >
      <span className={cn("mt-0.5 shrink-0", type !== "loading" && iconColor[type])}>
        {Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : <Spinner size={20} label="Carregando" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body-strong text-text-primary">{title}</p>
        {message ? <p className="text-body text-text-muted">{message}</p> : null}
      </div>
      <button
        type="button"
        aria-label="Fechar notificação"
        onClick={() => onDismiss(id)}
        className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-text-muted hover:bg-bg-hover"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Provê `useToast()` e renderiza os toasts no canto inferior direito. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    setItems((list) => [...list, { ...options, id, type: options.type ?? "info" }]);
    return id;
  }, []);

  const update = useCallback((id: number, options: Partial<ToastOptions>) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, ...options, type: options.type ?? t.type } : t)));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      success: (title, message) => toast({ type: "success", title, message }),
      error: (title, message) => toast({ type: "error", title, message }),
      info: (title, message) => toast({ type: "info", title, message }),
      loading: (title, message) => toast({ type: "loading", title, message }),
      update,
      dismiss,
    }),
    [toast, update, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="region"
        aria-live="polite"
        aria-label="Notificações"
        className="pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-3"
      >
        {items.map((item) => (
          <ToastView key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
