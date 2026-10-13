import type { QueryClient } from "@tanstack/react-query";
import { qk } from "./queryKeys";

const inv = (qc: QueryClient, keys: readonly (readonly unknown[])[]) =>
  Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));

/** Livro criado/editado/excluído. */
export const invalidateAfterBook = (qc: QueryClient) =>
  inv(qc, [qk.books, qk.categories, qk.stats, qk.copyStatus, qk.loans, qk.readerSummaries]);

/** Categoria criada/editada. */
export const invalidateAfterCategory = (qc: QueryClient) => inv(qc, [qk.categories, qk.books, qk.stats]);

/** Empréstimo criado ou devolvido. */
export const invalidateAfterLoan = (qc: QueryClient) =>
  inv(qc, [
    qk.books,
    qk.copyStatus,
    qk.loans,
    qk.readerSummaries,
    qk.stats,
    qk.classes,
    qk.students,
    qk.teachers,
    qk.readers,
  ]);

/** Turma criada/editada/excluída. */
export const invalidateAfterClass = (qc: QueryClient) =>
  inv(qc, [qk.classes, qk.students, qk.teachers, qk.readers, qk.readerSummaries, qk.loans]);

/** Professor criado/editado/excluído (excluir apaga o histórico dele). */
export const invalidateAfterTeacher = (qc: QueryClient) =>
  inv(qc, [
    qk.teachers,
    qk.classes,
    qk.students,
    qk.readers,
    qk.readerSummaries,
    qk.loans,
    qk.stats,
    qk.books,
    qk.copyStatus,
  ]);

/** Aluno criado/editado/excluído (excluir apaga o histórico dele). */
export const invalidateAfterStudent = (qc: QueryClient) =>
  inv(qc, [
    qk.students,
    qk.classes,
    qk.readers,
    qk.readerSummaries,
    qk.loans,
    qk.stats,
    qk.books,
    qk.copyStatus,
  ]);

/** Importação de CSV. */
export const invalidateAfterImport = (qc: QueryClient) =>
  inv(qc, [qk.books, qk.categories, qk.stats, qk.copyStatus]);

/** Restauração de backup: tudo muda. */
export const invalidateAll = (qc: QueryClient) => qc.invalidateQueries();
