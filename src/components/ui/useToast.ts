import { useContext } from "react";
import { ToastContext, type ToastApi } from "./toast-context";

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve ser usado dentro de <ToastProvider>.");
  return ctx;
}
