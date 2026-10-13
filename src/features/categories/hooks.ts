import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { invalidateAfterCategory } from "../invalidate";
import { qk } from "../queryKeys";

export const useCategories = () => useQuery({ queryKey: qk.categories, queryFn: () => api.listCategories() });

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, color }: { name: string; color?: string }) => api.createCategory(name, color),
    onSuccess: () => invalidateAfterCategory(qc),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, color }: { id: number; name: string; color: string }) =>
      api.updateCategory(id, name, color),
    onSuccess: () => invalidateAfterCategory(qc),
  });
}
