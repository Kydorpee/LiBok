import { ArrowDown, ArrowDownUp, ArrowUp } from "lucide-react";
import type {
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cn } from "./cn";

export type SortDirection = "asc" | "desc";

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  /** Legenda acessível (oculta visualmente). */
  caption?: string;
}

export function Table({ caption, className, children, ...rest }: TableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-left text-body", className)} {...rest}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export function TableHead({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn("border-b border-border-default bg-bg-subtle", className)} {...rest} />
  );
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TableRow({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "h-row border-b border-border-default last:border-b-0 hover:bg-bg-hover",
        className,
      )}
      {...rest}
    />
  );
}

export function TableCell({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-2 align-middle text-text-primary", className)} {...rest} />;
}

export interface TableHeaderCellProps extends Omit<ThHTMLAttributes<HTMLTableCellElement>, "onClick"> {
  /** Mostra o botão de ordenação (ícone ↕). */
  sortable?: boolean;
  /** Direção atual; `null`/indefinido = não ordenado por esta coluna. */
  sortDirection?: SortDirection | null;
  onSort?: () => void;
}

export function TableHeaderCell({
  sortable = false,
  sortDirection = null,
  onSort,
  className,
  children,
  ...rest
}: TableHeaderCellProps) {
  const Icon = sortDirection === "asc" ? ArrowUp : sortDirection === "desc" ? ArrowDown : ArrowDownUp;
  return (
    <th
      scope="col"
      aria-sort={
        sortable
          ? sortDirection === "asc"
            ? "ascending"
            : sortDirection === "desc"
              ? "descending"
              : "none"
          : undefined
      }
      className={cn("h-10 px-4 text-label text-text-muted", className)}
      {...rest}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className="-mx-2 inline-flex items-center gap-1 rounded-sm px-2 py-1 hover:bg-bg-hover hover:text-text-primary"
        >
          {children}
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export interface TableEmptyProps {
  /** Número de colunas da tabela. */
  colSpan: number;
  children: ReactNode;
}

/** Linha de estado vazio: coloque um `EmptyState` dentro. */
export function TableEmpty({ colSpan, children }: TableEmptyProps) {
  return (
    <tr>
      <td colSpan={colSpan}>{children}</td>
    </tr>
  );
}
