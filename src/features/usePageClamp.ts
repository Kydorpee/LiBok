import { useEffect } from "react";

/**
 * Se a página atual ficou fora do intervalo (ex.: o último item da última página foi
 * excluído/devolvido), volta para a última página válida. Devolve `true` enquanto isso
 * acontece, para a tela não mostrar o estado "vazio".
 */
export function usePageClamp(
  data: { items: unknown[]; total: number } | undefined,
  page: number,
  pageSize: number,
  setPage: (p: number) => void,
): boolean {
  const outOfRange = !!data && data.items.length === 0 && data.total > 0 && page > 1;
  useEffect(() => {
    if (outOfRange && data) setPage(Math.max(1, Math.ceil(data.total / pageSize)));
  }, [outOfRange, data, pageSize, setPage]);
  return outOfRange;
}
