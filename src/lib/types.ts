// Espelha exatamente o contrato IPC do docs/BRIEFING.md §5.
// Alterações aqui exigem aprovação do orquestrador.

export type Category = { id: number; name: string; color: string; bookCount: number };
export type Book = {
  id: number;
  title: string;
  author: string;
  subject: string;
  category: { id: number; name: string; color: string };
  codes: string[];
  quantity: number;
  availableCount: number;
  createdAt: string;
  updatedAt: string;
};
export type BookInput = {
  title: string;
  author: string;
  subject: string;
  categoryId: number;
  codes: string[];
};
export type BookQuery = {
  text?: string;
  categoryId?: number;
  availability?: "all" | "available" | "unavailable";
  sort?: "title" | "author" | "createdAt";
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};
export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
export type Stats = {
  totalBooks: number;
  totalCopies: number;
  byCategory: Category[];
  recent: Book[];
  activeLoans: number;
  overdueLoans: number;
};
export type ImportReport = {
  imported: number;
  skippedDuplicates: string[];
  errors: { line: number; message: string }[];
};
export type AppError = {
  code:
    | "VALIDATION"
    | "DUPLICATE_TITLE"
    | "DUPLICATE_CODE"
    | "DUPLICATE_REGISTRATION"
    | "COPY_UNAVAILABLE"
    | "HAS_ACTIVE_LOANS"
    | "IN_USE"
    | "NOT_FOUND"
    | "IO"
    | "DB";
  message: string;
  field?: string;
};

// Circulação — datas sempre 'YYYY-MM-DD'
export type Shift = "morning" | "afternoon" | "evening" | "fullday";
export type ReaderKind = "student" | "teacher";
export type LoanStatus = "active" | "overdue" | "returned";
export type Ref = { id: number; name: string };
export type Reader = {
  kind: ReaderKind;
  id: number;
  name: string;
  classLabel?: string;
  activeLoans: number;
  overdueLoans: number;
};
export type Teacher = {
  id: number;
  name: string;
  contact?: string;
  classes: Ref[];
  activeLoans: number;
  overdueLoans: number;
  readCount: number;
};
export type TeacherInput = { name: string; contact?: string };
export type ClassRoom = {
  id: number;
  name: string;
  schoolYear: number;
  shift: Shift;
  teacher: Ref;
  studentCount: number;
  activeLoans: number;
  overdueLoans: number;
};
export type ClassInput = { name: string; schoolYear: number; shift: Shift; teacherId: number };
export type ClassQuery = { text?: string; schoolYear?: number; shift?: Shift };
export type Student = {
  id: number;
  name: string;
  registration: string;
  classRoom: Ref & { teacher: Ref };
  guardian?: string;
  contact?: string;
  notes?: string;
  activeLoans: number;
  overdueLoans: number;
  readCount: number;
  createdAt: string;
};
export type StudentInput = {
  name: string;
  registration: string;
  classId: number;
  guardian?: string;
  contact?: string;
  notes?: string;
};
export type StudentQuery = {
  text?: string;
  classId?: number;
  overdueOnly?: boolean;
  page?: number;
  pageSize?: number;
};
export type Loan = {
  id: number;
  copyId: number | null;
  code: string;
  book: { id: number | null; title: string; author: string };
  reader: Reader;
  loanedAt: string;
  dueAt: string;
  returnedAt?: string;
  markedRead: boolean;
  status: LoanStatus;
};
export type LoanInput = {
  copyId: number;
  readerKind: ReaderKind;
  readerId: number;
  loanedAt: string;
  dueAt: string;
};
export type LoanQuery = {
  status?: "active" | "overdue" | "returned" | "all";
  text?: string;
  classId?: number;
  readerKind?: ReaderKind;
  page?: number;
  pageSize?: number;
};
export type LoanPage = Page<Loan> & {
  counts: { active: number; overdue: number; returned: number; all: number };
};
export type CopyStatus = {
  copyId: number;
  code: string;
  status: "available" | "loaned" | "overdue";
  loan?: { id: number; reader: Reader; dueAt: string };
};
export type ReaderSummary = {
  reader: Reader;
  student?: Student;
  teacher?: Teacher;
  activeLoans: Loan[];
  history: Loan[];
  readings: ClassReading[];
  counts: { active: number; overdue: number; read: number };
};

// Convenções do §5 (CsvPreview)
export type CsvPreviewRow = {
  line: number;
  title: string;
  author: string;
  subject: string;
  categoryName: string;
  codes: string[];
  status: "ready" | "duplicate" | "error";
  message?: string;
};
export type CsvPreview = {
  rows: CsvPreviewRow[];
  counts: { ready: number; duplicate: number; error: number };
};

// Leitura coletiva da turma (§5)
export type ClassReading = {
  id: number;
  classRoom: Ref;
  book: { id: number | null; title: string; author: string };
  readAt: string;
  presentCount: number;
  classSize: number;
  students: Ref[];
  createdAt: string;
};
export type ClassReadingInput = {
  classId: number;
  bookId: number;
  readAt: string;
  studentIds: number[];
};
