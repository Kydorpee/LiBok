import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./cn";

export interface PaginationProps {
  /** Página atual (começa em 1). */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Se informados, mostram "Mostrando x–y de z". */
  total?: number;
  pageSize?: number;
  className?: string;
}

function pageList(page: number, count: number): (number | "gap-l" | "gap-r")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const set = new Set([1, count, page - 1, page, page + 1]);
  const pages = [...set].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  const out: (number | "gap-l" | "gap-r")[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) out.push(i === 1 ? "gap-l" : "gap-r");
    out.push(p);
  });
  return out;
}

const btn =
  "inline-flex h-icon-button min-w-icon-button items-center justify-center rounded-sm px-2 text-body transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export function Pagination({
  page,
  pageCount,
  onPageChange,
  total,
  pageSize,
  className,
}: PaginationProps) {
  const from = total !== undefined && pageSize ? (total === 0 ? 0 : (page - 1) * pageSize + 1) : null;
  const to = total !== undefined && pageSize ? Math.min(page * pageSize, total) : null;
  if (pageCount < 1) return null;
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <p className="text-caption text-text-muted" aria-live="polite">
        {from !== null && to !== null ? `Mostrando ${from}–${to} de ${total}` : `Página ${page} de ${pageCount}`}
      </p>
      <nav aria-label="Paginação" className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Página anterior"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={cn(btn, "text-text-muted hover:bg-bg-hover")}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        {pageList(page, pageCount).map((p) =>
          typeof p === "string" ? (
            <span key={p} aria-hidden="true" className="px-1 text-text-muted">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-label={`Página ${p}`}
              aria-current={p === page ? "page" : undefined}
              onClick={() => onPageChange(p)}
              className={cn(
                btn,
                p === page
                  ? "bg-action-primary text-text-on-action"
                  : "text-text-primary hover:bg-bg-hover",
              )}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          aria-label="Próxima página"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          className={cn(btn, "text-text-muted hover:bg-bg-hover")}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}
