import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { BookInput, BookQuery } from "../../lib/types";
import { invalidateAfterBook } from "../invalidate";
import { qk } from "../queryKeys";

export const useBooks = (query: BookQuery) =>
  useQuery({
    queryKey: qk.bookList(query),
    queryFn: () => api.listBooks(query),
    placeholderData: keepPreviousData,
  });

export const useBook = (id: number | undefined) =>
  useQuery({
    queryKey: qk.book(id ?? 0),
    queryFn: () => api.getBook(id as number),
    enabled: id !== undefined && Number.isFinite(id),
  });

export function useCreateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BookInput) => api.createBook(input),
    onSuccess: () => invalidateAfterBook(qc),
  });
}

export function useUpdateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: BookInput }) => api.updateBook(id, input),
    onSuccess: () => invalidateAfterBook(qc),
  });
}

export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteBook(id),
    onSuccess: () => invalidateAfterBook(qc),
  });
}
