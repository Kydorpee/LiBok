import { ChevronDown, CircleAlert, Search, X } from "lucide-react";
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "./cn";

interface FieldChromeProps {
  label?: ReactNode;
  /** Texto de ajuda sob o campo. */
  help?: ReactNode;
  /** Mensagem de erro (ativa o estado de erro: borda 2px, ícone e aria-invalid). */
  error?: ReactNode;
}

interface FieldShellProps extends FieldChromeProps {
  id: string;
  className?: string;
  children: ReactNode;
}

function FieldShell({ id, label, help, error, className, children }: FieldShellProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={id} className="text-label text-text-primary">
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1 text-caption text-text-danger">
          <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="text-caption text-text-muted">
          {help}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, help: ReactNode, error: ReactNode) {
  return error ? `${id}-error` : help ? `${id}-help` : undefined;
}

const controlStyles = (error?: boolean) =>
  cn(
    "w-full rounded-sm bg-bg-surface text-body text-text-primary placeholder:text-text-muted disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:opacity-60",
    error ? "border-2 border-feedback-danger" : "border border-border-strong",
  );

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldChromeProps {
  /** Classe do contêiner (a classe normal vai para o <input>). */
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, help, error, id, className, wrapperClassName, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} help={help} error={error} className={wrapperClassName}>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, help, error)}
        className={cn(controlStyles(!!error), "h-control px-3", className)}
        {...rest}
      />
    </FieldShell>
  );
});

export interface SearchInputProps extends Omit<InputProps, "type" | "help" | "error"> {
  /** Se informado e houver valor, mostra o botão de limpar. */
  onClear?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { label, id, className, wrapperClassName, onClear, value, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const hasValue = typeof value === "string" ? value.length > 0 : Boolean(value);
  return (
    <FieldShell id={fieldId} label={label} className={wrapperClassName}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <input
          ref={ref}
          id={fieldId}
          type="search"
          value={value}
          className={cn(
            controlStyles(false),
            "h-control pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden",
            className,
          )}
          {...rest}
        />
        {onClear && hasValue ? (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={onClear}
            className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-sm text-text-muted hover:bg-bg-hover"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </FieldShell>
  );
});

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldChromeProps {
  /** Alternativa a passar <option> como children. */
  options?: SelectOption[];
  /** Opção inicial vazia (value=""). */
  placeholder?: string;
  wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, help, error, id, className, wrapperClassName, options, placeholder, children, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} help={help} error={error} className={wrapperClassName}>
      <div className="relative">
        <select
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fieldId, help, error)}
          className={cn(controlStyles(!!error), "h-control appearance-none pl-3 pr-9", className)}
          {...rest}
        >
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {options?.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
      </div>
    </FieldShell>
  );
});

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>,
    FieldChromeProps {
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, help, error, id, className, wrapperClassName, rows = 4, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} help={help} error={error} className={wrapperClassName}>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, help, error)}
        className={cn(controlStyles(!!error), "resize-y px-3 py-2", className)}
        {...rest}
      />
    </FieldShell>
  );
});
