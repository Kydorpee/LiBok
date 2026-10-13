import type { ReaderKind } from "../lib/types";

/** Segmentos de URL em pt-BR para o tipo de leitor. */
export const KIND_SLUG: Record<ReaderKind, string> = { student: "aluno", teacher: "professor" };

export function slugToKind(slug: string | undefined): ReaderKind | undefined {
  if (slug === "aluno") return "student";
  if (slug === "professor") return "teacher";
  return undefined;
}

export const paths = {
  dashboard: "/",
  books: "/acervo",
  newBook: "/cadastrar",
  editBook: (id: number | string) => `/acervo/${id}/editar`,
  importExport: "/importar-exportar",
  settings: "/configuracoes",
  classes: "/turmas",
  classDetail: (id: number | string) => `/turmas/${id}`,
  /** Lista de leitores; `tab` vira o parâmetro `?aba=alunos|professores`. */
  readers: (tab?: "alunos" | "professores") => (tab ? `/leitores?aba=${tab}` : "/leitores"),
  newStudent: "/leitores/alunos/novo",
  editStudent: (id: number | string) => `/leitores/alunos/${id}/editar`,
  newTeacher: "/leitores/professores/novo",
  editTeacher: (id: number | string) => `/leitores/professores/${id}/editar`,
  readerSummary: (kind: ReaderKind, id: number | string) => `/leitores/${KIND_SLUG[kind]}/${id}`,
  loans: "/emprestimos",
};
