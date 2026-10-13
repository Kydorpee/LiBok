import { invoke } from "@tauri-apps/api/core";
import { createMockBackend } from "./mocks";
import type {
  AppError,
  Book,
  BookInput,
  BookQuery,
  Category,
  ClassInput,
  ClassReading,
  ClassReadingInput,
  ClassQuery,
  ClassRoom,
  CopyStatus,
  CsvPreview,
  ImportReport,
  ImportRow,
  Loan,
  LoanInput,
  LoanPage,
  LoanQuery,
  Page,
  Reader,
  ReaderKind,
  ReaderSummary,
  Stats,
  Student,
  StudentInput,
  StudentQuery,
  Teacher,
  TeacherInput,
} from "./types";

const ERROR_CODES: AppError["code"][] = [
  "VALIDATION",
  "DUPLICATE_TITLE",
  "DUPLICATE_CODE",
  "DUPLICATE_REGISTRATION",
  "COPY_UNAVAILABLE",
  "HAS_ACTIVE_LOANS",
  "IN_USE",
  "NOT_FOUND",
  "IO",
  "DB",
];

export function isAppError(e: unknown): e is AppError {
  return (
    typeof e === "object" &&
    e !== null &&
    typeof (e as AppError).message === "string" &&
    ERROR_CODES.includes((e as AppError).code)
  );
}

/** Normaliza qualquer valor rejeitado (AppError, string, Error) para AppError. */
export function toAppError(e: unknown): AppError {
  if (isAppError(e)) return e;
  if (typeof e === "string") return { code: "IO", message: e };
  if (e instanceof Error) return { code: "IO", message: e.message };
  return { code: "IO", message: "Ocorreu um erro inesperado." };
}

/** Mocks ativos fora do Tauri (navegador) ou com VITE_USE_MOCKS=true. */
export function isMockMode(): boolean {
  if (import.meta.env.VITE_USE_MOCKS === "true") return true;
  return typeof window === "undefined" || !("__TAURI_INTERNALS__" in window);
}

let mock: ReturnType<typeof createMockBackend> | undefined;

/** Descarta os dados em memória do mock (usado nos testes). */
export function resetMock(): void {
  mock = undefined;
}

async function call<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  try {
    if (isMockMode()) {
      mock ??= createMockBackend();
      return await mock.call<T>(cmd, args);
    }
    return await invoke<T>(cmd, args);
  } catch (e) {
    throw toAppError(e);
  }
}

// Convenção de argumentos: structs de entrada vão como `{ query }` / `{ input }`;
// escalares usam o próprio nome do campo (o §5 não fixa os nomes dos parâmetros).
export const api = {
  // livros
  listBooks: (query: BookQuery = {}) => call<Page<Book>>("list_books", { query }),
  getBook: (id: number) => call<Book>("get_book", { id }),
  createBook: (input: BookInput) => call<Book>("create_book", { input }),
  updateBook: (id: number, input: BookInput) => call<Book>("update_book", { id, input }),
  deleteBook: (id: number) => call<void>("delete_book", { id }),
  // categorias
  listCategories: () => call<Category[]>("list_categories"),
  createCategory: (name: string, color?: string) => call<Category>("create_category", { name, color }),
  updateCategory: (id: number, name: string, color: string) =>
    call<Category>("update_category", { id, name, color }),
  // stats
  getStats: () => call<Stats>("get_stats"),
  // csv / backup
  exportCsv: (path: string) => call<{ rows: number }>("export_csv", { path }),
  previewCsv: (path: string) => call<CsvPreview>("preview_csv", { path }),
  importCsv: (path: string) => call<ImportReport>("import_csv", { path }),
  validateImportRows: (rows: ImportRow[]) => call<CsvPreview>("validate_import_rows", { rows }),
  importRows: (rows: ImportRow[]) => call<ImportReport>("import_rows", { rows }),
  backupDb: (path: string) => call<void>("backup_db", { path }),
  restoreDb: (path: string) => call<void>("restore_db", { path }),
  // turmas
  listClasses: (query: ClassQuery = {}) => call<ClassRoom[]>("list_classes", { query }),
  getClass: (id: number) => call<{ classRoom: ClassRoom; students: Student[] }>("get_class", { id }),
  createClass: (input: ClassInput) => call<ClassRoom>("create_class", { input }),
  updateClass: (id: number, input: ClassInput) => call<ClassRoom>("update_class", { id, input }),
  deleteClass: (id: number) => call<void>("delete_class", { id }),
  // leituras coletivas
  listClassReadings: (classId: number) => call<ClassReading[]>("list_class_readings", { classId }),
  createClassReading: (input: ClassReadingInput) => call<ClassReading>("create_class_reading", { input }),
  deleteClassReading: (id: number) => call<void>("delete_class_reading", { id }),
  // professores
  listTeachers: (text?: string) => call<Teacher[]>("list_teachers", { text }),
  createTeacher: (input: TeacherInput) => call<Teacher>("create_teacher", { input }),
  updateTeacher: (id: number, input: TeacherInput) => call<Teacher>("update_teacher", { id, input }),
  deleteTeacher: (id: number) => call<void>("delete_teacher", { id }),
  // alunos
  listStudents: (query: StudentQuery = {}) => call<Page<Student>>("list_students", { query }),
  getStudent: (id: number) => call<Student>("get_student", { id }),
  createStudent: (input: StudentInput) => call<Student>("create_student", { input }),
  updateStudent: (id: number, input: StudentInput) => call<Student>("update_student", { id, input }),
  deleteStudent: (id: number) => call<void>("delete_student", { id }),
  // leitores
  searchReaders: (text: string, limit?: number) => call<Reader[]>("search_readers", { text, limit }),
  getReaderSummary: (kind: ReaderKind, id: number) =>
    call<ReaderSummary>("get_reader_summary", { kind, id }),
  // empréstimos
  listCopyStatus: (bookId: number) => call<CopyStatus[]>("list_copy_status", { bookId }),
  createLoan: (input: LoanInput) => call<Loan>("create_loan", { input }),
  returnLoan: (id: number, returnedAt: string, markedRead: boolean) =>
    call<Loan>("return_loan", { id, returnedAt, markedRead }),
  listLoans: (query: LoanQuery = {}) => call<LoanPage>("list_loans", { query }),
};
