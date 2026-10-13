import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { invalidateAll } from "../invalidate";

export const useBackupDb = () => useMutation({ mutationFn: (path: string) => api.backupDb(path) });

export function useRestoreDb() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => api.restoreDb(path),
    onSuccess: () => invalidateAll(qc),
  });
}
