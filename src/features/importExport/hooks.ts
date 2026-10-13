import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { ImportRow } from "../../lib/types";
import { invalidateAfterImport } from "../invalidate";

export const useExportCsv = () => useMutation({ mutationFn: (path: string) => api.exportCsv(path) });

export const usePreviewCsv = () => useMutation({ mutationFn: (path: string) => api.previewCsv(path) });

export const useValidateImportRows = () =>
  useMutation({ mutationFn: (rows: ImportRow[]) => api.validateImportRows(rows) });

export function useImportRows() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: ImportRow[]) => api.importRows(rows),
    onSuccess: () => invalidateAfterImport(qc),
  });
}
