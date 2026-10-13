import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button, IconButton } from "./Button";
import { cn } from "./cn";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Rodapé (normalmente botões). */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Fecha ao clicar no fundo (padrão: true). */
  closeOnOverlay?: boolean;
  /** Esconde o botão X do cabeçalho. */
  hideCloseButton?: boolean;
  className?: string;
}

/** Pilha de modais abertos: só o do topo reage ao Esc e prende o foco. */
const modalStack: symbol[] = [];

const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" };

/**
 * Diálogo modal: aria-modal, foco preso, Esc fecha, foco volta ao elemento anterior.
 * Foco inicial: `data-autofocus`, senão o primeiro controle do corpo, senão o primeiro focável.
 * Vários modais empilhados: só o do topo reage ao Esc e ao Tab.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnOverlay = true,
  hideCloseButton = false,
  className,
}: ModalProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = () => Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const token = Symbol("modal");
    modalStack.push(token);
    const bodyItems = Array.from(bodyRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const initial =
      panel?.querySelector<HTMLElement>("[data-autofocus]") ?? bodyItems[0] ?? focusables()[0] ?? panel;
    initial?.focus();

    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (modalStack[modalStack.length - 1] !== token) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel?.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const at = modalStack.indexOf(token);
      if (at >= 0) modalStack.splice(at, 1);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (closeOnOverlay && e.target === e.currentTarget) onClose();
      }}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-bg-overlay/60" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-full w-full flex-col rounded-lg border border-border-default bg-bg-surface shadow-modal",
          widths[size],
          className,
        )}
      >
        <header className="flex items-start justify-between gap-4 px-6 pt-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-subtitle text-text-primary">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="mt-1 text-body text-text-muted">
                {description}
              </p>
            ) : null}
          </div>
          {hideCloseButton ? null : (
            <IconButton label="Fechar" onClick={onClose} className="-mr-2 -mt-1">
              <X />
            </IconButton>
          )}
        </header>
        {children ? <div ref={bodyRef} className="overflow-y-auto px-6 py-4">{children}</div> : <div className="h-4" />}
        {footer ? <footer className="flex justify-end gap-2 px-6 pb-6">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = ação destrutiva (padrão). */
  tone?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Excluir",
  cancelLabel = "Cancelar",
  tone = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={message}
      size="sm"
      hideCloseButton
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading} data-autofocus>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
