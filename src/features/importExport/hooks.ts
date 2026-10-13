import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { invalidateAfterImport } from "../invalidate";

export const useExportCsv = () => useMutation({ mutationFn: (path: string) => api.exportCsv(path) });

export const usePreviewCsv = () => useMutation({ mutationFn: (path: string) => api.previewCsv(path) });

export function useImportCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => api.importCsv(path),
    onSuccess: () => invalidateAfterImport(qc),
  });
}
