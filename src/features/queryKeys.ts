import type { BookQuery, ClassQuery, LoanQuery, ReaderKind, StudentQuery } from "../lib/types";

/** Chaves de query estáveis. O primeiro elemento é o "domínio", usado nas invalidações. */
export const qk = {
  books: ["books"] as const,
  bookList: (q: BookQuery) => ["books", "list", q] as const,
  book: (id: number) => ["books", "detail", id] as const,
  categories: ["categories"] as const,
  stats: ["stats"] as const,
  copyStatus: ["copyStatus"] as const,
  copyStatusOf: (bookId: number) => ["copyStatus", bookId] as const,
  classes: ["classes"] as const,
  classList: (q: ClassQuery) => ["classes", "list", q] as const,
  classDetail: (id: number) => ["classes", "detail", id] as const,
  classReadings: ["classReadings"] as const,
  classReadingList: (classId: number) => ["classReadings", classId] as const,
  teachers: ["teachers"] as const,
  teacherList: (text?: string) => ["teachers", "list", text ?? ""] as const,
  students: ["students"] as const,
  studentList: (q: StudentQuery) => ["students", "list", q] as const,
  student: (id: number) => ["students", "detail", id] as const,
  readers: ["readers"] as const,
  readerSearch: (text: string, limit?: number) => ["readers", "search", text, limit ?? null] as const,
  readerSummaries: ["readerSummary"] as const,
  readerSummary: (kind: ReaderKind, id: number) => ["readerSummary", kind, id] as const,
  loans: ["loans"] as const,
  loanList: (q: LoanQuery) => ["loans", "list", q] as const,
};
