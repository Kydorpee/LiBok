import { createContext } from "react";

export type ToastType = "success" | "error" | "info" | "loading";

export interface ToastOptions {
  type?: ToastType;
  title: string;
  message?: string;
  /** ms até sumir. Padrão: 4000 (sucesso/info), 7000 (erro), sem fechar sozinho (carregando). */
  duration?: number;
}

export interface ToastItem extends ToastOptions {
  id: number;
  type: ToastType;
}

export interface ToastApi {
  /** Mostra um toast e devolve seu id. */
  toast: (options: ToastOptions) => number;
  success: (title: string, message?: string) => number;
  error: (title: string, message?: string) => number;
  info: (title: string, message?: string) => number;
  loading: (title: string, message?: string) => number;
  /** Atualiza um toast existente (ex.: carregando → sucesso). */
  update: (id: number, options: Partial<ToastOptions>) => void;
  dismiss: (id: number) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);
