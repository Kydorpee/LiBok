// Backend em memória usado quando o app roda fora do Tauri (navegador) ou com
// VITE_USE_MOCKS=true. Implementa as mesmas regras do briefing (§3/§4/§5).
import { addDays, isValidISODate, loanStatus, todayISO } from "./dates";
import { matchesTokens, normalize } from "./normalize";
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
  CsvPreviewRow,
  ImportRow,
  ImportReport,
  Loan,
  LoanInput,
  LoanPage,
  LoanQuery,
  Page,
  Reader,
  ReaderKind,
  ReaderSummary,
  Shift,
  Stats,
  Student,
  StudentInput,
  StudentQuery,
  Teacher,
  TeacherInput,
} from "./types";

export const CATEGORY_PALETTE = [
  "#8C6E5D",
  "#4F6D7A",
  "#A44A3F",
  "#6B705C",
  "#6D597A",
  "#277DA1",
  "#F9844A",
  "#43AA8B",
];

const SHIFTS: Shift[] = ["morning", "afternoon", "evening", "fullday"];

type CategoryRow = { id: number; name: string; color: string };
type BookRow = {
  id: number;
  title: string;
  author: string;
  subject: string;
  categoryId: number;
  createdAt: string;
  updatedAt: string;
};
type CopyRow = { id: number; bookId: number; code: string };
type TeacherRow = { id: number; name: string; contact?: string };
type ClassRow = { id: number; name: string; schoolYear: number; shift: Shift; teacherId: number };
type StudentRow = {
  id: number;
  name: string;
  registration: string;
  classId: number | null;
  guardian?: string;
  contact?: string;
  notes?: string;
  createdAt: string;
};
type LoanRow = {
  id: number;
  copyId: number | null;
  bookId: number | null;
  studentId: number | null;
  teacherId: number | null;
  code: string;
  title: string;
  author: string;
  loanedAt: string;
  dueAt: string;
  returnedAt?: string;
  markedRead: boolean;
};

type ReadingRow = {
  id: number;
  classId: number | null;
  className: string;
  bookId: number | null;
  title: string;
  author: string;
  readAt: string;
  studentIds: number[];
  createdAt: string;
};

function fail(code: AppError["code"], message: string, field?: string): never {
  const err: AppError = field ? { code, message, field } : { code, message };
  throw err;
}

const clean = (s?: string) => {
  const t = s?.trim();
  return t ? t : undefined;
};

function paginate<T>(all: T[], page = 1, pageSize = 20): Page<T> {
  const p = Math.max(1, Math.floor(page));
  const size = Math.max(1, Math.floor(pageSize));
  return { items: all.slice((p - 1) * size, p * size), total: all.length, page: p, pageSize: size };
}

const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

export function createMockBackend() {
  const today = () => todayISO();
  let seq = 1000;
  const nextId = () => ++seq;
  // ISO 8601 UTC com 'Z' e sem milissegundos, como o Rust: '2026-10-12T17:03:00Z'.
  const utc = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
  const now = () => utc(new Date());
  /** Instante local `hour:00` do dia 'YYYY-MM-DD', em UTC. */
  const localStamp = (iso: string, hour: number) => {
    const [y, mo, d] = iso.split("-").map(Number);
    return utc(new Date(y, mo - 1, d, hour));
  };

  const categories: CategoryRow[] = [];
  let books: BookRow[] = [];
  let copies: CopyRow[] = [];
  let teachers: TeacherRow[] = [];
  let classes: ClassRow[] = [];
  let students: StudentRow[] = [];
  let loans: LoanRow[] = [];
  let readings: ReadingRow[] = [];

  // ---------- seed ----------
  const seedCategory = (name: string, color: string) => {
    const c = { id: nextId(), name, color };
    categories.push(c);
    return c;
  };
  const seedBook = (
    title: string,
    author: string,
    subject: string,
    cat: CategoryRow,
    codes: string[],
    daysAgo: number,
  ) => {
    const stamp = localStamp(addDays(today(), -daysAgo), 10);
    const b: BookRow = {
      id: nextId(),
      title,
      author,
      subject,
      categoryId: cat.id,
      createdAt: stamp,
      updatedAt: stamp,
    };
    books.push(b);
    codes.forEach((code) => copies.push({ id: nextId(), bookId: b.id, code }));
    return b;
  };

  function seed() {
    const tec = seedCategory("Tecnologia", "#4F6D7A");
    const inf = seedCategory("Infantil", "#EB9486");
    const juv = seedCategory("Juvenil", "#7E7F9A");
    const edu = seedCategory("Educativo", "#CAE7B9");
    const rom = seedCategory("Romance", "#D98E04");
    const fic = seedCategory("Ficção", "#5B8E7D");
    const his = seedCategory("História", "#C08497");

    seedBook("O Pequeno Príncipe", "Antoine de Saint-Exupéry", "Fábula", inf, ["REG-0001", "REG-0002", "REG-0003"], 30);
    seedBook("Dom Casmurro", "Machado de Assis", "Literatura brasileira", rom, ["REG-0004", "REG-0005"], 28);
    seedBook("Memórias Póstumas de Brás Cubas", "Machado de Assis", "Literatura brasileira", fic, ["REG-0006"], 27);
    seedBook("Código Limpo", "Robert C. Martin", "Programação", tec, ["REG-0007", "REG-0008"], 20);
    seedBook("O Hobbit", "J. R. R. Tolkien", "Fantasia", juv, ["REG-0009", "REG-0010"], 18);
    seedBook("Harry Potter e a Pedra Filosofal", "J. K. Rowling", "Fantasia", juv, ["REG-0011", "REG-0012", "REG-0013"], 15);
    seedBook("Sapiens: Uma Breve História da Humanidade", "Yuval Noah Harari", "História geral", his, ["REG-0014"], 12);
    seedBook("Capitães da Areia", "Jorge Amado", "Literatura brasileira", fic, ["REG-0015", "REG-0016"], 10);
    seedBook("A Revolução dos Bichos", "George Orwell", "Sátira política", fic, ["REG-0017"], 8);
    seedBook("Atlas Geográfico Escolar", "IBGE", "Geografia", edu, ["REG-0018", "REG-0019"], 6);
    seedBook("Turma da Mônica: Histórias Escolhidas", "Mauricio de Sousa", "Quadrinhos", inf, ["REG-0020", "REG-0021"], 3);
    seedBook("Brasil: Uma Biografia", "Lilia Moritz Schwarcz", "História do Brasil", his, ["REG-0022"], 1);

    const t1: TeacherRow = { id: nextId(), name: "Marina Alves", contact: "marina.alves@escola.com.br" };
    const t2: TeacherRow = { id: nextId(), name: "Carlos Eduardo Lima", contact: "(11) 98888-1234" };
    const t3: TeacherRow = { id: nextId(), name: "Patrícia Nogueira" };
    teachers.push(t1, t2, t3);

    const year = new Date().getFullYear();
    const c1: ClassRow = { id: nextId(), name: "5º ano A", schoolYear: year, shift: "morning", teacherId: t1.id };
    const c2: ClassRow = { id: nextId(), name: "5º ano B", schoolYear: year, shift: "afternoon", teacherId: t2.id };
    const c3: ClassRow = { id: nextId(), name: "8º ano A", schoolYear: year, shift: "morning", teacherId: t3.id };
    const c4: ClassRow = { id: nextId(), name: "5º ano A", schoolYear: year - 1, shift: "morning", teacherId: t1.id };
    classes.push(c1, c2, c3, c4);

    const mk = (name: string, registration: string, c: ClassRow, extra: Partial<StudentRow> = {}) => {
      const s: StudentRow = {
        id: nextId(),
        name,
        registration,
        classId: c.id,
        createdAt: localStamp(addDays(today(), -60), 9),
        ...extra,
      };
      students.push(s);
      return s;
    };
    const s1 = mk("Ana Beatriz Souza", "2026001", c1, { guardian: "Fernanda Souza", contact: "(11) 97777-0001" });
    const s2 = mk("Bruno Henrique Costa", "2026002", c1);
    const s3 = mk("Camila Ferreira", "2026003", c1, { notes: "Prefere livros de aventura." });
    const s4 = mk("Daniel Oliveira", "2026004", c2);
    const s5 = mk("Eduarda Martins", "2026005", c2, { guardian: "Roberto Martins" });
    const s6 = mk("Felipe Santos", "2026006", c3);
    mk("Gabriela Rocha", "2026007", c3);
    mk("Heitor Pereira", "2026008", c3);

    const copyOf = (code: string) => copies.find((c) => c.code === code)!;
    const loan = (
      code: string,
      who: { s?: StudentRow; t?: TeacherRow },
      loanedAgo: number,
      dueIn: number,
      returnedAgo?: number,
      read = false,
    ) => {
      const copy = copyOf(code);
      const book = books.find((b) => b.id === copy.bookId)!;
      loans.push({
        id: nextId(),
        copyId: copy.id,
        bookId: book.id,
        studentId: who.s?.id ?? null,
        teacherId: who.t?.id ?? null,
        code,
        title: book.title,
        author: book.author,
        loanedAt: addDays(today(), -loanedAgo),
        dueAt: addDays(today(), dueIn),
        returnedAt: returnedAgo === undefined ? undefined : addDays(today(), -returnedAgo),
        markedRead: read,
      });
    };
    loan("REG-0001", { s: s1 }, 5, 9); // ativo
    loan("REG-0004", { s: s2 }, 20, -6); // atrasado
    loan("REG-0009", { s: s4 }, 14, 0); // vence hoje
    loan("REG-0007", { t: t1 }, 3, 11); // professor, ativo
    loan("REG-0011", { s: s5 }, 25, -11); // atrasado
    loan("REG-0002", { s: s1 }, 40, -26, 30, true); // devolvido, lido
    loan("REG-0015", { s: s3 }, 35, -21, 28, false); // devolvido, não lido
    loan("REG-0006", { s: s6 }, 30, -16, 20, true);
    loan("REG-0012", { t: t2 }, 33, -19, 25, true);
  }
  seed();

  // ---------- builders ----------
  const classOf = (id: number) => classes.find((c) => c.id === id);
  const className = (id: number | null) => (id === null ? undefined : classOf(id)?.name);
  const teacherOf = (id: number) => teachers.find((t) => t.id === id);

  const bookKey = (r: { bookId: number | null; title: string }) =>
    r.bookId !== null ? `id:${r.bookId}` : `t:${normalize(r.title)}`;

  function loanCounts(pred: (l: LoanRow) => boolean, studentId?: number) {
    const t = today();
    let active = 0;
    let overdue = 0;
    const readBooks = new Set<string>(); // "lidos" = livros distintos
    for (const l of loans) {
      if (!pred(l)) continue;
      if (l.returnedAt) {
        if (l.markedRead) readBooks.add(bookKey(l));
      } else {
        active++;
        if (l.dueAt < t) overdue++;
      }
    }
    // leituras coletivas em que o aluno estava presente (livro distinto, sem duplicar)
    if (studentId !== undefined)
      for (const r of readings) if (r.studentIds.includes(studentId)) readBooks.add(bookKey(r));
    return { active, overdue, read: readBooks.size };
  }
  const studentCounts = (id: number) => loanCounts((l) => l.studentId === id, id);
  const teacherCounts = (id: number) => loanCounts((l) => l.teacherId === id);

  function toReader(kind: ReaderKind, id: number): Reader {
    if (kind === "student") {
      const s = students.find((x) => x.id === id);
      if (!s) fail("NOT_FOUND", "Aluno não encontrado.");
      const c = studentCounts(id);
      return {
        kind,
        id,
        name: s.name,
        classLabel: className(s.classId),
        activeLoans: c.active,
        overdueLoans: c.overdue,
      };
    }
    const t = teacherOf(id);
    if (!t) fail("NOT_FOUND", "Professor não encontrado.");
    const c = teacherCounts(id);
    return { kind, id, name: t.name, activeLoans: c.active, overdueLoans: c.overdue };
  }

  function toBook(b: BookRow): Book {
    const cat = categories.find((c) => c.id === b.categoryId)!;
    const own = copies.filter((c) => c.bookId === b.id);
    const loaned = own.filter((c) => loans.some((l) => l.copyId === c.id && !l.returnedAt)).length;
    return {
      id: b.id,
      title: b.title,
      author: b.author,
      subject: b.subject,
      category: { id: cat.id, name: cat.name, color: cat.color },
      codes: own.map((c) => c.code),
      quantity: own.length,
      availableCount: own.length - loaned,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
  }

  function toCategory(c: CategoryRow): Category {
    return { ...c, bookCount: books.filter((b) => b.categoryId === c.id).length };
  }

  function toTeacher(t: TeacherRow): Teacher {
    const c = teacherCounts(t.id);
    return {
      id: t.id,
      name: t.name,
      contact: t.contact,
      classes: classes
        .filter((x) => x.teacherId === t.id)
        .map((x) => ({ id: x.id, name: x.name })),
      activeLoans: c.active,
      overdueLoans: c.overdue,
      readCount: c.read,
    };
  }

  function toClass(c: ClassRow): ClassRoom {
    const ids = students.filter((s) => s.classId === c.id).map((s) => s.id);
    const lc = loanCounts((l) => l.studentId !== null && ids.includes(l.studentId));
    const t = teacherOf(c.teacherId)!;
    return {
      id: c.id,
      name: c.name,
      schoolYear: c.schoolYear,
      shift: c.shift,
      teacher: { id: t.id, name: t.name },
      studentCount: ids.length,
      activeLoans: lc.active,
      overdueLoans: lc.overdue,
    };
  }

  function toStudent(s: StudentRow): Student {
    const c = s.classId !== null ? classOf(s.classId) : undefined;
    const t = c ? teacherOf(c.teacherId) : undefined;
    const k = studentCounts(s.id);
    return {
      id: s.id,
      name: s.name,
      registration: s.registration,
      classRoom: c && t ? { id: c.id, name: c.name, teacher: { id: t.id, name: t.name } } : undefined,
      guardian: s.guardian,
      contact: s.contact,
      notes: s.notes,
      activeLoans: k.active,
      overdueLoans: k.overdue,
      readCount: k.read,
      createdAt: s.createdAt,
    };
  }

  const readerOfLoan = (l: LoanRow) =>
    l.studentId !== null ? toReader("student", l.studentId) : toReader("teacher", l.teacherId!);

  function toLoan(l: LoanRow): Loan {
    // título/autor atuais enquanto o livro existir; snapshot só depois que ele é apagado
    const current = l.bookId !== null ? books.find((b) => b.id === l.bookId) : undefined;
    return {
      id: l.id,
      copyId: l.copyId,
      code: l.code,
      book: { id: l.bookId, title: current?.title ?? l.title, author: current?.author ?? l.author },
      reader: readerOfLoan(l),
      loanedAt: l.loanedAt,
      dueAt: l.dueAt,
      returnedAt: l.returnedAt,
      markedRead: l.markedRead,
      status: loanStatus(l, today()),
    };
  }

  function toReading(r: ReadingRow): ClassReading {
    const c = r.classId !== null ? classOf(r.classId) : undefined;
    const current = r.bookId !== null ? books.find((b) => b.id === r.bookId) : undefined;
    const present = r.studentIds
      .map((id) => students.find((s) => s.id === id))
      .filter((s): s is StudentRow => !!s)
      .sort((a, b) => normalize(a.name).localeCompare(normalize(b.name)))
      .map((s) => ({ id: s.id, name: s.name }));
    return {
      id: r.id,
      classRoom: c ? { id: c.id, name: c.name } : { id: null, name: r.className },
      book: { id: r.bookId, title: current?.title ?? r.title, author: current?.author ?? r.author },
      readAt: r.readAt,
      presentCount: present.length,
      classSize: c ? students.filter((s) => s.classId === c.id).length : 0,
      students: present,
      createdAt: r.createdAt,
    };
  }
  const byRecent = (a: ClassReading, b: ClassReading) =>
    b.readAt.localeCompare(a.readAt) || b.id - a.id;

  const hasActiveLoan = (copyId: number) => loans.some((l) => l.copyId === copyId && !l.returnedAt);

  // ---------- validações ----------
  function validateBookInput(input: BookInput, ignoreBookId?: number) {
    const title = input.title?.trim() ?? "";
    const author = input.author?.trim() ?? "";
    const subject = input.subject?.trim() ?? "";
    if (!title) fail("VALIDATION", "Informe o título.", "title");
    if (!author) fail("VALIDATION", "Informe o autor.", "author");
    if (!subject) fail("VALIDATION", "Informe o assunto.", "subject");
    if (!categories.some((c) => c.id === input.categoryId))
      fail("VALIDATION", "Selecione uma categoria.", "categoryId");
    // códigos vazios são descartados em silêncio antes da validação (como no Rust)
    const codes = (input.codes ?? []).map((c) => c.trim()).filter(Boolean);
    if (codes.length === 0)
      fail("VALIDATION", "Informe ao menos um código de registro.", "codes");
    const seen = new Set<string>();
    codes.forEach((code, i) => {
      const n = normalize(code);
      if (seen.has(n)) fail("DUPLICATE_CODE", `O código "${code}" está repetido.`, `codes.${i}`);
      seen.add(n);
    });
    codes.forEach((code, i) => {
      const other = copies.find((c) => normalize(c.code) === normalize(code) && c.bookId !== ignoreBookId);
      if (other) fail("DUPLICATE_CODE", `O código "${code}" já está cadastrado em outro livro.`, `codes.${i}`);
    });
    const tn = normalize(title);
    if (books.some((b) => normalize(b.title) === tn && b.id !== ignoreBookId))
      fail("DUPLICATE_TITLE", "Já existe um livro com este título.", "title");
    return { title, author, subject, categoryId: input.categoryId, codes };
  }

  function validateClass(input: ClassInput, ignoreId?: number) {
    const name = input.name?.trim() ?? "";
    if (!name) fail("VALIDATION", "Informe o nome da turma.", "name");
    if (!Number.isInteger(input.schoolYear) || input.schoolYear < 2000 || input.schoolYear > 2100)
      fail("VALIDATION", "Informe um ano letivo válido.", "schoolYear");
    if (!SHIFTS.includes(input.shift)) fail("VALIDATION", "Selecione o turno.", "shift");
    if (!teacherOf(input.teacherId))
      fail("VALIDATION", "Selecione o professor responsável.", "teacherId");
    if (
      classes.some(
        (c) =>
          c.id !== ignoreId && c.schoolYear === input.schoolYear && normalize(c.name) === normalize(name),
      )
    )
      fail("VALIDATION", "Já existe uma turma com este nome neste ano letivo.", "name");
    return { name, schoolYear: input.schoolYear, shift: input.shift, teacherId: input.teacherId };
  }

  function validateStudent(input: StudentInput, ignoreId?: number) {
    const name = input.name?.trim() ?? "";
    const registration = input.registration?.trim() ?? "";
    if (!name) fail("VALIDATION", "Informe o nome do aluno.", "name");
    if (!registration) fail("VALIDATION", "Informe a matrícula.", "registration");
    // criar exige turma; editar aceita classId null (aluno sem turma)
    if (input.classId === null || input.classId === undefined) {
      if (ignoreId === undefined) fail("VALIDATION", "Selecione a turma.", "classId");
    } else if (!classOf(input.classId)) fail("VALIDATION", "Selecione a turma.", "classId");
    if (students.some((s) => s.id !== ignoreId && normalize(s.registration) === normalize(registration)))
      fail("DUPLICATE_REGISTRATION", "Já existe um aluno com esta matrícula.", "registration");
    return {
      name,
      registration,
      classId: input.classId ?? null,
      guardian: clean(input.guardian),
      contact: clean(input.contact),
      notes: clean(input.notes),
    };
  }

  // ---------- comandos ----------
  const m = {
    // livros
    listBooks(q: BookQuery = {}): Page<Book> {
      let list = books.map(toBook);
      if (q.text) {
        list = list.filter((b) =>
          matchesTokens(q.text!, [b.title, b.author, b.category.name, b.subject, ...b.codes]),
        );
      }
      if (q.categoryId) list = list.filter((b) => b.category.id === q.categoryId);
      if (q.availability === "available") list = list.filter((b) => b.availableCount > 0);
      if (q.availability === "unavailable") list = list.filter((b) => b.availableCount === 0);
      const sort = q.sort ?? "title";
      const dir = q.dir === "desc" ? -1 : 1;
      list.sort((a, b) => {
        const cmp =
          sort === "createdAt"
            ? a.createdAt.localeCompare(b.createdAt) || a.id - b.id
            : normalize(a[sort]).localeCompare(normalize(b[sort]));
        return cmp * dir;
      });
      return paginate(list, q.page, q.pageSize);
    },
    getBook(id: number): Book {
      const b = books.find((x) => x.id === id);
      if (!b) fail("NOT_FOUND", "Livro não encontrado.");
      return toBook(b);
    },
    createBook(input: BookInput): Book {
      const v = validateBookInput(input);
      const stamp = now();
      const b: BookRow = {
        id: nextId(),
        title: v.title,
        author: v.author,
        subject: v.subject,
        categoryId: v.categoryId,
        createdAt: stamp,
        updatedAt: stamp,
      };
      books.push(b);
      v.codes.forEach((code) => copies.push({ id: nextId(), bookId: b.id, code }));
      return toBook(b);
    },
    updateBook(id: number, input: BookInput): Book {
      const b = books.find((x) => x.id === id);
      if (!b) fail("NOT_FOUND", "Livro não encontrado.");
      const v = validateBookInput(input, id);
      const own = copies.filter((c) => c.bookId === id);
      const removed = own.filter((c) => !v.codes.includes(c.code));
      const blocked = removed.find((c) => hasActiveLoan(c.id));
      if (blocked)
        fail(
          "HAS_ACTIVE_LOANS",
          `O código "${blocked.code}" está emprestado e não pode ser removido ou renomeado.`,
          "codes",
        );
      // diff: mantém o id dos códigos que continuam
      const removedIds = removed.map((c) => c.id);
      loans.forEach((l) => {
        if (l.copyId !== null && removedIds.includes(l.copyId)) l.copyId = null;
      });
      copies = copies.filter((c) => !removedIds.includes(c.id));
      v.codes
        .filter((code) => !own.some((c) => c.code === code))
        .forEach((code) => copies.push({ id: nextId(), bookId: id, code }));
      Object.assign(b, {
        title: v.title,
        author: v.author,
        subject: v.subject,
        categoryId: v.categoryId,
        updatedAt: now(),
      });
      return toBook(b);
    },
    deleteBook(id: number): void {
      if (!books.some((x) => x.id === id)) fail("NOT_FOUND", "Livro não encontrado.");
      const ids = copies.filter((c) => c.bookId === id).map((c) => c.id);
      if (ids.some(hasActiveLoan))
        fail("HAS_ACTIVE_LOANS", "Este livro tem exemplares emprestados. Registre as devoluções antes de excluir.");
      loans.forEach((l) => {
        if (l.copyId !== null && ids.includes(l.copyId)) l.copyId = null;
        if (l.bookId === id) l.bookId = null;
      });
      readings.forEach((r) => {
        if (r.bookId !== id) return;
        const b = books.find((x) => x.id === id);
        if (b) Object.assign(r, { title: b.title, author: b.author });
        r.bookId = null;
      });
      copies = copies.filter((c) => c.bookId !== id);
      books = books.filter((b) => b.id !== id);
    },

    // categorias
    listCategories(): Category[] {
      return categories
        .map(toCategory)
        .sort((a, b) => normalize(a.name).localeCompare(normalize(b.name)));
    },
    createCategory(name: string, color?: string): Category {
      const n = name?.trim();
      if (!n) fail("VALIDATION", "Informe o nome da categoria.", "name");
      if (categories.some((c) => normalize(c.name) === normalize(n)))
        fail("VALIDATION", "Já existe uma categoria com este nome.", "name");
      const c = {
        id: nextId(),
        name: n,
        color: color ?? CATEGORY_PALETTE[categories.length % CATEGORY_PALETTE.length],
      };
      categories.push(c);
      return toCategory(c);
    },
    updateCategory(id: number, name: string, color: string): Category {
      const c = categories.find((x) => x.id === id);
      if (!c) fail("NOT_FOUND", "Categoria não encontrada.");
      const n = name?.trim();
      if (!n) fail("VALIDATION", "Informe o nome da categoria.", "name");
      if (categories.some((x) => x.id !== id && normalize(x.name) === normalize(n)))
        fail("VALIDATION", "Já existe uma categoria com este nome.", "name");
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) fail("VALIDATION", "Cor inválida.", "color");
      c.name = n;
      c.color = color;
      return toCategory(c);
    },

    // estatísticas
    getStats(): Stats {
      const t = today();
      const active = loans.filter((l) => !l.returnedAt);
      return {
        totalBooks: books.length,
        totalCopies: copies.length,
        byCategory: categories.map(toCategory).filter((c) => c.bookCount > 0),
        recent: [...books]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
          .slice(0, 5)
          .map(toBook),
        activeLoans: active.length,
        overdueLoans: active.filter((l) => l.dueAt < t).length,
      };
    },

    // CSV / backup (simulados — o navegador não lê arquivos pelo caminho)
    exportCsv(): { rows: number } {
      return { rows: books.length };
    },
    previewCsv(): CsvPreview {
      const raw: ImportRow[] = [
        { line: 2, title: "A Hora da Estrela", author: "Clarice Lispector", subject: "Literatura brasileira", categoryName: "Romance", codes: ["REG-0100"] },
        { line: 3, title: "Poemas Escolhidos", author: "Cecília Meireles", subject: "Poesia", categoryName: "Poesia", codes: ["REG-0101", "REG-0102"] },
        { line: 4, title: "Dom Casmurro", author: "Machado de Assis", subject: "Literatura brasileira", categoryName: "Romance", codes: ["REG-0103"] },
        { line: 5, title: "Vidas Secas", author: "", subject: "Literatura brasileira", categoryName: "Ficção", codes: ["REG-0104"] },
      ];
      return m.validateImportRows(raw);
    },
    // Mesmas regras do §5: obrigatórios, duplicidade contra o banco e entre as próprias linhas.
    validateImportRows(input: ImportRow[]): CsvPreview {
      const seenTitles = new Set<string>();
      const seenCodes = new Set<string>();
      const rows = input.map((r): CsvPreviewRow => {
        const codes = r.codes.map((c) => c.trim()).filter(Boolean);
        const base = { ...r, codes };
        const bad = (field: NonNullable<CsvPreviewRow["field"]>, message: string): CsvPreviewRow => ({
          ...base,
          status: "error",
          message,
          field,
        });
        if (!r.title.trim()) return bad("title", "Título não informado.");
        if (!r.author.trim()) return bad("author", "Autor não informado.");
        if (!r.categoryName.trim()) return bad("categoryName", "Categoria não informada.");
        if (!r.subject.trim()) return bad("subject", "Assunto não informado.");
        if (codes.length === 0) return bad("codes", "Informe ao menos um código de registro.");
        const norm = codes.map(normalize);
        const dupInside = norm.find((c, i) => norm.indexOf(c) !== i);
        if (dupInside !== undefined) return bad("codes", `Código repetido na linha: ${codes[norm.indexOf(dupInside)]}.`);
        const title = normalize(r.title);
        const dup = (field: "title" | "codes", message: string): CsvPreviewRow => ({
          ...base,
          status: "duplicate",
          message,
          field,
        });
        let result: CsvPreviewRow | null = null;
        if (books.some((b) => normalize(b.title) === title)) result = dup("title", "Título já cadastrado.");
        else if (seenTitles.has(title)) result = dup("title", "Título repetido em outra linha da importação.");
        else {
          const hit = codes.find((_c, i) => copies.some((x) => normalize(x.code) === norm[i]) || seenCodes.has(norm[i]));
          if (hit !== undefined) {
            const inDb = copies.some((x) => normalize(x.code) === normalize(hit));
            result = dup(
              "codes",
              inDb ? `Código já cadastrado: ${hit}.` : `Código repetido em outra linha da importação: ${hit}.`,
            );
          }
        }
        if (result) return result;
        seenTitles.add(title);
        norm.forEach((c) => seenCodes.add(c));
        return { ...base, status: "ready" };
      });
      const count = (st: CsvPreviewRow["status"]) => rows.filter((r) => r.status === st).length;
      return { rows, counts: { ready: count("ready"), duplicate: count("duplicate"), error: count("error") } };
    },
    importCsv(): ImportReport {
      return m.importRows(m.previewCsv().rows);
    },
    importRows(input: ImportRow[]): ImportReport {
      const prev = m.validateImportRows(input);
      const report: ImportReport = { imported: 0, skippedDuplicates: [], errors: [] };
      for (const row of prev.rows) {
        if (row.status === "duplicate") report.skippedDuplicates.push(row.title);
        else if (row.status === "error") report.errors.push({ line: row.line, message: row.message ?? "Linha inválida." });
        else {
          let cat = categories.find((c) => normalize(c.name) === normalize(row.categoryName));
          if (!cat) {
            const created = m.createCategory(row.categoryName);
            cat = categories.find((c) => c.id === created.id)!;
          }
          m.createBook({ title: row.title, author: row.author, subject: row.subject, categoryId: cat.id, codes: row.codes });
          report.imported++;
        }
      }
      return report;
    },
    noop(): void {},

    // turmas
    listClasses(q: ClassQuery = {}): ClassRoom[] {
      return classes
        .filter((c) => !q.schoolYear || c.schoolYear === q.schoolYear)
        .filter((c) => !q.shift || c.shift === q.shift)
        .filter((c) => !q.text || matchesTokens(q.text, [c.name, teacherOf(c.teacherId)?.name]))
        .map(toClass)
        .sort((a, b) => b.schoolYear - a.schoolYear || normalize(a.name).localeCompare(normalize(b.name)));
    },
    getClass(id: number): { classRoom: ClassRoom; students: Student[] } {
      const c = classOf(id);
      if (!c) fail("NOT_FOUND", "Turma não encontrada.");
      return {
        classRoom: toClass(c),
        students: students
          .filter((s) => s.classId === id)
          .map(toStudent)
          .sort((a, b) => normalize(a.name).localeCompare(normalize(b.name))),
      };
    },
    createClass(input: ClassInput): ClassRoom {
      const c: ClassRow = { id: nextId(), ...validateClass(input) };
      classes.push(c);
      return toClass(c);
    },
    updateClass(id: number, input: ClassInput): ClassRoom {
      const c = classOf(id);
      if (!c) fail("NOT_FOUND", "Turma não encontrada.");
      Object.assign(c, validateClass(input, id));
      return toClass(c);
    },
    deleteClass(id: number): void {
      if (!classOf(id)) fail("NOT_FOUND", "Turma não encontrada.");
      // alunos ficam sem turma; leituras são mantidas com o nome da turma
      students.forEach((s) => {
        if (s.classId === id) s.classId = null;
      });
      readings.forEach((r) => {
        if (r.classId === id) r.classId = null;
      });
      classes = classes.filter((c) => c.id !== id);
    },

    // leituras coletivas
    listClassReadings(classId: number): ClassReading[] {
      if (!classOf(classId)) fail("NOT_FOUND", "Turma não encontrada.");
      return readings.filter((r) => r.classId === classId).map(toReading).sort(byRecent);
    },
    createClassReading(input: ClassReadingInput): ClassReading {
      if (!classOf(input.classId)) fail("NOT_FOUND", "Turma não encontrada.");
      if (!isValidISODate(input.readAt ?? "")) fail("VALIDATION", "Informe uma data de leitura válida.", "readAt");
      const ids = [...new Set(input.studentIds ?? [])];
      if (ids.length === 0) fail("VALIDATION", "Marque pelo menos um aluno presente.", "studentIds");
      const inClass = new Set(students.filter((s) => s.classId === input.classId).map((s) => s.id));
      if (!ids.every((id) => inClass.has(id)))
        fail("VALIDATION", "Todos os alunos precisam ser da turma.", "studentIds");
      const book = books.find((b) => b.id === input.bookId);
      if (!book) fail("NOT_FOUND", "Livro não encontrado.");
      if (readings.some((r) => r.classId === input.classId && r.bookId === book.id && r.readAt === input.readAt))
        fail("VALIDATION", "Esta turma já registrou este livro nesta data.", "bookId");
      const row: ReadingRow = {
        id: nextId(),
        classId: input.classId,
        className: classOf(input.classId)!.name,
        bookId: book.id,
        title: book.title,
        author: book.author,
        readAt: input.readAt,
        studentIds: ids,
        createdAt: now(),
      };
      readings.push(row);
      return toReading(row);
    },
    deleteClassReading(id: number): void {
      if (!readings.some((r) => r.id === id)) fail("NOT_FOUND", "Leitura não encontrada.");
      readings = readings.filter((r) => r.id !== id);
    },

    // professores
    listTeachers(text?: string): Teacher[] {
      return teachers
        .filter((x) => !text || matchesTokens(text, [x.name]))
        .map(toTeacher)
        .sort((a, b) => normalize(a.name).localeCompare(normalize(b.name)));
    },
    createTeacher(input: TeacherInput): Teacher {
      const name = input.name?.trim();
      if (!name) fail("VALIDATION", "Informe o nome do professor.", "name");
      const t: TeacherRow = { id: nextId(), name, contact: clean(input.contact) };
      teachers.push(t);
      return toTeacher(t);
    },
    updateTeacher(id: number, input: TeacherInput): Teacher {
      const t = teacherOf(id);
      if (!t) fail("NOT_FOUND", "Professor não encontrado.");
      const name = input.name?.trim();
      if (!name) fail("VALIDATION", "Informe o nome do professor.", "name");
      t.name = name;
      t.contact = clean(input.contact);
      return toTeacher(t);
    },
    deleteTeacher(id: number): void {
      if (!teacherOf(id)) fail("NOT_FOUND", "Professor não encontrado.");
      if (classes.some((c) => c.teacherId === id))
        fail(
          "IN_USE",
          "Este professor é responsável por uma turma. Troque o professor da turma antes de excluí-lo.",
        );
      if (loans.some((l) => l.teacherId === id && !l.returnedAt))
        fail("HAS_ACTIVE_LOANS", "Este professor tem empréstimos ativos. Registre as devoluções antes de excluí-lo.");
      loans = loans.filter((l) => l.teacherId !== id);
      teachers = teachers.filter((t) => t.id !== id);
    },

    // alunos
    listStudents(q: StudentQuery = {}): Page<Student> {
      const list = students
        .filter((s) => !q.classId || s.classId === q.classId)
        .filter((s) => !q.noClass || s.classId === null)
        .filter((s) => !q.text || matchesTokens(q.text, [s.name, s.registration, className(s.classId)]))
        .map(toStudent)
        .filter((s) => !q.overdueOnly || s.overdueLoans > 0)
        .sort((a, b) => normalize(a.name).localeCompare(normalize(b.name)));
      return paginate(list, q.page, q.pageSize);
    },
    getStudent(id: number): Student {
      const s = students.find((x) => x.id === id);
      if (!s) fail("NOT_FOUND", "Aluno não encontrado.");
      return toStudent(s);
    },
    createStudent(input: StudentInput): Student {
      const s: StudentRow = { id: nextId(), ...validateStudent(input), createdAt: now() };
      students.push(s);
      return toStudent(s);
    },
    updateStudent(id: number, input: StudentInput): Student {
      const s = students.find((x) => x.id === id);
      if (!s) fail("NOT_FOUND", "Aluno não encontrado.");
      Object.assign(s, validateStudent(input, id));
      return toStudent(s);
    },
    deleteStudent(id: number): void {
      if (!students.some((s) => s.id === id)) fail("NOT_FOUND", "Aluno não encontrado.");
      if (loans.some((l) => l.studentId === id && !l.returnedAt))
        fail("HAS_ACTIVE_LOANS", "Este aluno tem empréstimos ativos. Registre as devoluções antes de excluí-lo.");
      loans = loans.filter((l) => l.studentId !== id);
      readings.forEach((r) => {
        r.studentIds = r.studentIds.filter((x) => x !== id);
      });
      students = students.filter((s) => s.id !== id);
    },

    // leitores
    searchReaders(text: string, limit = 20): Reader[] {
      // texto vazio: os primeiros `limit` em ordem alfabética (como no Rust)
      const q = text ?? "";
      const out: Reader[] = [
        ...students
          .filter((s) => matchesTokens(q, [s.name, s.registration, className(s.classId)]))
          .map((s) => toReader("student", s.id)),
        ...teachers.filter((x) => matchesTokens(q, [x.name])).map((x) => toReader("teacher", x.id)),
      ];
      out.sort((a, b) => normalize(a.name).localeCompare(normalize(b.name)));
      return out.slice(0, limit);
    },
    getReaderSummary(kind: ReaderKind, id: number): ReaderSummary {
      const reader = toReader(kind, id);
      const own = loans
        .filter((l) => (kind === "student" ? l.studentId === id : l.teacherId === id))
        .map(toLoan);
      const activeLoans = own
        .filter((l) => l.status !== "returned")
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
      const history = own
        .filter((l) => l.status === "returned")
        .sort((a, b) => (b.returnedAt ?? "").localeCompare(a.returnedAt ?? "") || b.id - a.id);
      const counts = kind === "student" ? studentCounts(id) : teacherCounts(id);
      return {
        reader,
        student: kind === "student" ? m.getStudent(id) : undefined,
        teacher: kind === "teacher" ? toTeacher(teacherOf(id)!) : undefined,
        activeLoans,
        history,
        readings: kind === "student" ? readings.filter((r) => r.studentIds.includes(id)).map(toReading).sort(byRecent) : [],
        counts: { active: counts.active, overdue: counts.overdue, read: counts.read },
      };
    },

    // empréstimos
    listCopyStatus(bookId: number): CopyStatus[] {
      if (!books.some((b) => b.id === bookId)) fail("NOT_FOUND", "Livro não encontrado.");
      const t = today();
      return copies
        .filter((c) => c.bookId === bookId)
        .map((c): CopyStatus => {
          const l = loans.find((x) => x.copyId === c.id && !x.returnedAt);
          if (!l) return { copyId: c.id, code: c.code, status: "available" };
          return {
            copyId: c.id,
            code: c.code,
            status: l.dueAt < t ? "overdue" : "loaned",
            loan: { id: l.id, reader: readerOfLoan(l), dueAt: l.dueAt },
          };
        });
    },
    createLoan(input: LoanInput): Loan {
      const copy = copies.find((c) => c.id === input.copyId);
      if (!copy) fail("NOT_FOUND", "Exemplar não encontrado.", "copyId");
      const readerExists =
        input.readerKind === "student"
          ? students.some((s) => s.id === input.readerId)
          : teachers.some((t) => t.id === input.readerId);
      if (!readerExists) fail("VALIDATION", "Selecione o leitor.", "readerId");
      if (!isValidISODate(input.loanedAt)) fail("VALIDATION", "Data do empréstimo inválida.", "loanedAt");
      if (!isValidISODate(input.dueAt)) fail("VALIDATION", "Data de devolução inválida.", "dueAt");
      if (input.dueAt < input.loanedAt)
        fail("VALIDATION", "A devolução prevista não pode ser anterior ao empréstimo.", "dueAt");
      if (hasActiveLoan(copy.id))
        fail("COPY_UNAVAILABLE", `O exemplar ${copy.code} já está emprestado.`, "copyId");
      const book = books.find((b) => b.id === copy.bookId)!;
      const row: LoanRow = {
        id: nextId(),
        copyId: copy.id,
        bookId: book.id,
        studentId: input.readerKind === "student" ? input.readerId : null,
        teacherId: input.readerKind === "teacher" ? input.readerId : null,
        code: copy.code,
        title: book.title,
        author: book.author,
        loanedAt: input.loanedAt,
        dueAt: input.dueAt,
        markedRead: false,
      };
      loans.push(row);
      return toLoan(row);
    },
    returnLoan(id: number, returnedAt: string, markedRead: boolean): Loan {
      const l = loans.find((x) => x.id === id);
      if (!l) fail("NOT_FOUND", "Empréstimo não encontrado.");
      if (l.returnedAt) fail("VALIDATION", "Este empréstimo já foi devolvido.");
      if (!isValidISODate(returnedAt)) fail("VALIDATION", "Data de devolução inválida.", "returnedAt");
      if (returnedAt < l.loanedAt)
        fail("VALIDATION", "A devolução não pode ser anterior ao empréstimo.", "returnedAt");
      l.returnedAt = returnedAt;
      l.markedRead = !!markedRead;
      return toLoan(l);
    },
    listLoans(q: LoanQuery = {}): LoanPage {
      const base = loans
        .map(toLoan)
        .filter((l) => !q.readerKind || l.reader.kind === q.readerKind)
        .filter((l) => {
          if (!q.classId) return true;
          if (l.reader.kind !== "student") return false;
          return students.find((s) => s.id === l.reader.id)?.classId === q.classId;
        })
        .filter((l) => !q.text || matchesTokens(q.text, [l.book.title, l.code, l.reader.name]));
      const counts = {
        active: base.filter((l) => l.status !== "returned").length,
        overdue: base.filter((l) => l.status === "overdue").length,
        returned: base.filter((l) => l.status === "returned").length,
        all: base.length,
      };
      const st = q.status ?? "active";
      const filtered = base
        .filter((l) => (st === "all" ? true : st === "active" ? l.status !== "returned" : l.status === st))
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.id - b.id);
      return { ...paginate(filtered, q.page, q.pageSize), counts };
    },
  };

  type Args = Record<string, unknown>;
  const table: Record<string, (a: Args) => unknown> = {
    list_books: (a) => m.listBooks(a.query as BookQuery),
    get_book: (a) => m.getBook(a.id as number),
    create_book: (a) => m.createBook(a.input as BookInput),
    update_book: (a) => m.updateBook(a.id as number, a.input as BookInput),
    delete_book: (a) => m.deleteBook(a.id as number),
    list_categories: () => m.listCategories(),
    create_category: (a) => m.createCategory(a.name as string, a.color as string | undefined),
    update_category: (a) => m.updateCategory(a.id as number, a.name as string, a.color as string),
    get_stats: () => m.getStats(),
    export_csv: () => m.exportCsv(),
    preview_csv: () => m.previewCsv(),
    import_csv: () => m.importCsv(),
    validate_import_rows: (a) => m.validateImportRows(a.rows as ImportRow[]),
    import_rows: (a) => m.importRows(a.rows as ImportRow[]),
    backup_db: () => m.noop(),
    restore_db: () => m.noop(),
    list_classes: (a) => m.listClasses(a.query as ClassQuery),
    get_class: (a) => m.getClass(a.id as number),
    create_class: (a) => m.createClass(a.input as ClassInput),
    update_class: (a) => m.updateClass(a.id as number, a.input as ClassInput),
    delete_class: (a) => m.deleteClass(a.id as number),
    list_class_readings: (a) => m.listClassReadings(a.classId as number),
    create_class_reading: (a) => m.createClassReading(a.input as ClassReadingInput),
    delete_class_reading: (a) => m.deleteClassReading(a.id as number),
    list_teachers: (a) => m.listTeachers(a.text as string | undefined),
    create_teacher: (a) => m.createTeacher(a.input as TeacherInput),
    update_teacher: (a) => m.updateTeacher(a.id as number, a.input as TeacherInput),
    delete_teacher: (a) => m.deleteTeacher(a.id as number),
    list_students: (a) => m.listStudents(a.query as StudentQuery),
    get_student: (a) => m.getStudent(a.id as number),
    create_student: (a) => m.createStudent(a.input as StudentInput),
    update_student: (a) => m.updateStudent(a.id as number, a.input as StudentInput),
    delete_student: (a) => m.deleteStudent(a.id as number),
    search_readers: (a) => m.searchReaders(a.text as string, a.limit as number | undefined),
    get_reader_summary: (a) => m.getReaderSummary(a.kind as ReaderKind, a.id as number),
    list_copy_status: (a) => m.listCopyStatus(a.bookId as number),
    create_loan: (a) => m.createLoan(a.input as LoanInput),
    return_loan: (a) => m.returnLoan(a.id as number, a.returnedAt as string, a.markedRead as boolean),
    list_loans: (a) => m.listLoans(a.query as LoanQuery),
  };

  return {
    async call<T>(cmd: string, args: Args = {}): Promise<T> {
      const fn = table[cmd];
      if (!fn) fail("IO", `Comando desconhecido: ${cmd}`);
      return clone(fn(args)) as T;
    },
  };
}

export type MockBackend = ReturnType<typeof createMockBackend>;
