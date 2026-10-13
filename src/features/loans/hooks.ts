import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { LoanInput, LoanQuery } from "../../lib/types";
import { invalidateAfterLoan } from "../invalidate";
import { qk } from "../queryKeys";

export const useLoans = (query: LoanQuery = {}) =>
  useQuery({
    queryKey: qk.loanList(query),
    queryFn: () => api.listLoans(query),
    placeholderData: keepPreviousData,
  });

export const useCopyStatus = (bookId: number | undefined) =>
  useQuery({
    queryKey: qk.copyStatusOf(bookId ?? 0),
    queryFn: () => api.listCopyStatus(bookId as number),
    enabled: bookId !== undefined && Number.isFinite(bookId),
  });

export function useCreateLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoanInput) => api.createLoan(input),
    onSuccess: () => invalidateAfterLoan(qc),
  });
}

export function useReturnLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, returnedAt, markedRead }: { id: number; returnedAt: string; markedRead: boolean }) =>
      api.returnLoan(id, returnedAt, markedRead),
    onSuccess: () => invalidateAfterLoan(qc),
  });
}
