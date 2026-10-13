import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { ReaderKind } from "../../lib/types";
import { qk } from "../queryKeys";

/** Busca de leitores (alunos e professores) para o modal de empréstimo. */
export const useReaderSearch = (text: string, limit?: number) =>
  useQuery({
    queryKey: qk.readerSearch(text, limit),
    queryFn: () => api.searchReaders(text, limit),
    enabled: text.trim().length > 0,
    placeholderData: keepPreviousData,
  });

export const useReaderSummary = (kind: ReaderKind | undefined, id: number | undefined) =>
  useQuery({
    queryKey: qk.readerSummary(kind ?? "student", id ?? 0),
    queryFn: () => api.getReaderSummary(kind as ReaderKind, id as number),
    enabled: kind !== undefined && id !== undefined && Number.isFinite(id),
  });
