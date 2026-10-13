import { beforeEach, describe, expect, it } from "vitest";
import { addDays, todayISO } from "./dates";
import { createMockBackend, type MockBackend } from "./mocks";
import { normalize } from "./normalize";
import type {
  AppError,
  Book,
  BookInput,
  Category,
  ClassRoom,
  CopyStatus,
  LoanPage,
  Page,
  Reader,
  ReaderSummary,
  Stats,
  Student,
  Teacher,
} from "./types";

let be: MockBackend;
const call = <T>(cmd: string, args: Record<string, unknown> = {}) => be.call<T>(cmd, args);

async function rejection(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (e) {
    return e as AppError;
  }
  throw new Error("esperava rejeição");
}

const allBooks = async () => (await call<Page<Book>>("list_books", { query: { pageSize: 100 } })).items;
const bookByTitle = async (title: string) => (await allBooks()).find((b) => b.title === title)!;
const copies = (bookId: number) => call<CopyStatus[]>("list_copy_status", { bookId });

beforeEach(() => {
  be = createMockBackend();
});

describe("mock: livros", () => {
  const input = async (over: Partial<BookInput> = {}): Promise<BookInput> => {
    const cats = await call<Category[]>("list_categories");
    return {
      title: "Novo Livro",
      author: "Autor",
      subject: "Assunto",
      categoryId: cats[0].id,
      codes: ["NOVO-1"],
      ...over,
    };
  };

  it("cria livro com quantidade = número de códigos", async () => {
    const b = await call<Book>("create_book", { input: await input({ codes: ["N-1", "N-2"] }) });
    expect(b.quantity).toBe(2);
    expect(b.availableCount).toBe(2);
  });

  it("bloqueia título duplicado ignorando acentos, caixa e espaços", async () => {
    const e = await rejection(
      call("create_book", { input: await input({ title: "  o PEQUENO principe ", codes: ["X-1"] }) }),
    );
    expect(e.code).toBe("DUPLICATE_TITLE");
    expect(e.field).toBe("title");
  });

  it("bloqueia código duplicado (no input e no banco)", async () => {
    const dupInput = await rejection(call("create_book", { input: await input({ codes: ["A", "a"] }) }));
    expect(dupInput.code).toBe("DUPLICATE_CODE");
    const dupDb = await rejection(call("create_book", { input: await input({ codes: ["REG-0001"] }) }));
    expect(dupDb.code).toBe("DUPLICATE_CODE");
  });

  it("valida obrigatórios", async () => {
    const e = await rejection(call("create_book", { input: await input({ author: " " }) }));
    expect(e).toMatchObject({ code: "VALIDATION", field: "author" });
    const e2 = await rejection(call("create_book", { input: await input({ codes: [] }) }));
    expect(e2).toMatchObject({ code: "VALIDATION", field: "codes" });
  });

  it("busca sem acento/caixa por título, autor, categoria, assunto e código", async () => {
    const q = async (text: string) =>
      (await call<Page<Book>>("list_books", { query: { text } })).items.map((b) => b.title);
    expect(await q("memorias POSTUMAS")).toEqual(["Memórias Póstumas de Brás Cubas"]);
    expect(await q("exupery")).toEqual(["O Pequeno Príncipe"]);
    expect(await q("ficcao")).toContain("Capitães da Areia");
    expect(await q("programacao")).toEqual(["Código Limpo"]);
    expect(await q("reg-0007")).toEqual(["Código Limpo"]);
  });

  it("filtra por disponibilidade, ordena e pagina", async () => {
    const p1 = await call<Page<Book>>("list_books", { query: { pageSize: 5, page: 1, sort: "title" } });
    expect(p1.items).toHaveLength(5);
    expect(p1.total).toBe(12);
    const titles = p1.items.map((b) => b.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
    const unavailable = await call<Page<Book>>("list_books", { query: { availability: "unavailable" } });
    expect(unavailable.total).toBe(0);
    const available = await call<Page<Book>>("list_books", { query: { availability: "available" } });
    expect(available.total).toBe(12);
    expect(unavailable.items.every((b) => b.availableCount === 0)).toBe(true);
    const desc = await call<Page<Book>>("list_books", { query: { sort: "createdAt", dir: "desc", pageSize: 1 } });
    expect(desc.items[0].title).toBe("Brasil: Uma Biografia");
  });

  it("update_book mantém o id dos códigos que continuam e bloqueia remover código emprestado", async () => {
    const hobbit = await bookByTitle("O Hobbit"); // REG-0009 emprestado
    const before = await copies(hobbit.id);
    const kept = before.find((c) => c.code === "REG-0009")!;

    const blocked = await rejection(
      call("update_book", {
        id: hobbit.id,
        input: { title: hobbit.title, author: hobbit.author, subject: hobbit.subject, categoryId: hobbit.category.id, codes: ["REG-0010"] },
      }),
    );
    expect(blocked.code).toBe("HAS_ACTIVE_LOANS");

    const updated = await call<Book>("update_book", {
      id: hobbit.id,
      input: { title: hobbit.title, author: hobbit.author, subject: hobbit.subject, categoryId: hobbit.category.id, codes: ["REG-0009", "REG-0010", "REG-0099"] },
    });
    expect(updated.quantity).toBe(3);
    const after = await copies(hobbit.id);
    expect(after.find((c) => c.code === "REG-0009")!.copyId).toBe(kept.copyId);
  });

  it("bloqueia excluir livro com exemplar emprestado; exclui sem empréstimos ativos", async () => {
    const hobbit = await bookByTitle("O Hobbit");
    expect((await rejection(call("delete_book", { id: hobbit.id }))).code).toBe("HAS_ACTIVE_LOANS");
    const sapiens = await bookByTitle("Sapiens: Uma Breve História da Humanidade");
    await call("delete_book", { id: sapiens.id });
    expect((await rejection(call("get_book", { id: sapiens.id }))).code).toBe("NOT_FOUND");
  });

  it("excluir livro preserva o histórico (copyId e book.id nulos)", async () => {
    const mem = await bookByTitle("Memórias Póstumas de Brás Cubas"); // REG-0006 devolvido
    await call("delete_book", { id: mem.id });
    const page = await call<LoanPage>("list_loans", { query: { status: "returned", text: "REG-0006" } });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ copyId: null, code: "REG-0006" });
    expect(page.items[0].book).toMatchObject({ id: null, title: mem.title });
  });
});

describe("mock: categorias e estatísticas", () => {
  it("cria categoria com cor da paleta, bloqueia nome duplicado e conta livros", async () => {
    const c = await call<Category>("create_category", { name: "Poesia" });
    expect(c.color).toMatch(/^#[0-9A-F]{6}$/i);
    expect(c.bookCount).toBe(0);
    expect((await rejection(call("create_category", { name: " poesia " }))).field).toBe("name");
    const cats = await call<Category[]>("list_categories");
    expect(cats.find((x) => x.name === "Ficção")!.bookCount).toBe(3);
  });

  it("get_stats traz totais, categorias, recentes e empréstimos", async () => {
    const s = await call<Stats>("get_stats");
    expect(s.totalBooks).toBe(12);
    expect(s.totalCopies).toBe(22);
    expect(s.byCategory.reduce((n, c) => n + c.bookCount, 0)).toBe(12);
    expect(s.recent).toHaveLength(5);
    expect(s.recent[0].title).toBe("Brasil: Uma Biografia");
    expect(s.activeLoans).toBe(5);
    expect(s.overdueLoans).toBe(2);
  });
});

describe("mock: circulação", () => {
  const principe = () => bookByTitle("O Pequeno Príncipe");

  it("empresta, marca indisponível e bloqueia segundo empréstimo do mesmo exemplar", async () => {
    const b = await principe(); // REG-0001 emprestado, 0002/0003 livres
    const st = await copies(b.id);
    expect(st.map((c) => c.status)).toEqual(["loaned", "available", "available"]);
    const busy = st[0];
    const students = await call<Page<Student>>("list_students", { query: {} });
    const today = todayISO();
    const e = await rejection(
      call("create_loan", {
        input: { copyId: busy.copyId, readerKind: "student", readerId: students.items[0].id, loanedAt: today, dueAt: addDays(today, 14) },
      }),
    );
    expect(e.code).toBe("COPY_UNAVAILABLE");

    const free = st[1];
    const loan = await call<{ status: string; code: string; dueAt: string }>("create_loan", {
      input: { copyId: free.copyId, readerKind: "student", readerId: students.items[0].id, loanedAt: today, dueAt: addDays(today, 14) },
    });
    expect(loan).toMatchObject({ status: "active", code: "REG-0002", dueAt: addDays(today, 14) });
    expect((await call<Book>("get_book", { id: b.id })).availableCount).toBe(1);
  });

  it("valida datas do empréstimo", async () => {
    const b = await principe();
    const free = (await copies(b.id))[1];
    const s = (await call<Page<Student>>("list_students", { query: {} })).items[0];
    const e = await rejection(
      call("create_loan", {
        input: { copyId: free.copyId, readerKind: "student", readerId: s.id, loanedAt: "2026-10-12", dueAt: "2026-10-01" },
      }),
    );
    expect(e).toMatchObject({ code: "VALIDATION", field: "dueAt" });
  });

  it("status atrasado é calculado pela data", async () => {
    const overdue = await call<LoanPage>("list_loans", { query: { status: "overdue" } });
    expect(overdue.items).toHaveLength(2);
    expect(overdue.items.every((l) => l.status === "overdue" && l.dueAt < todayISO())).toBe(true);
    const dc = await bookByTitle("Dom Casmurro");
    expect((await copies(dc.id)).find((c) => c.code === "REG-0004")!.status).toBe("overdue");
  });

  it("lista com contagens por aba; Ativos inclui atrasados; ordena por devolver até", async () => {
    const page = await call<LoanPage>("list_loans", { query: { status: "active" } });
    expect(page.counts).toEqual({ active: 5, overdue: 2, returned: 4, all: 9 });
    expect(page.items).toHaveLength(5);
    const due = page.items.map((l) => l.dueAt);
    expect(due).toEqual([...due].sort());
    const search = await call<LoanPage>("list_loans", { query: { status: "all", text: "ana beatriz" } });
    expect(search.items.every((l) => l.reader.name === "Ana Beatriz Souza")).toBe(true);
    expect(search.counts.all).toBe(2);
  });

  it("devolve com marcação de lido e atualiza o resumo do leitor", async () => {
    const students = (await call<Page<Student>>("list_students", { query: { text: "bruno" } })).items;
    const bruno = students[0];
    let sum = await call<ReaderSummary>("get_reader_summary", { kind: "student", id: bruno.id });
    expect(sum.counts).toEqual({ active: 1, overdue: 1, read: 0 });
    const loan = sum.activeLoans[0];
    const ret = await call<{ status: string; markedRead: boolean }>("return_loan", {
      id: loan.id,
      returnedAt: todayISO(),
      markedRead: true,
    });
    expect(ret).toMatchObject({ status: "returned", markedRead: true });
    sum = await call<ReaderSummary>("get_reader_summary", { kind: "student", id: bruno.id });
    expect(sum.counts).toEqual({ active: 0, overdue: 0, read: 1 });
    expect(sum.history).toHaveLength(1);
    expect((await rejection(call("return_loan", { id: loan.id, returnedAt: todayISO(), markedRead: false }))).code).toBe(
      "VALIDATION",
    );
  });

  it("devolução sem marcar como lido não conta em lidos", async () => {
    const ana = (await call<Page<Student>>("list_students", { query: { text: "ana" } })).items[0];
    const sum = await call<ReaderSummary>("get_reader_summary", { kind: "student", id: ana.id });
    expect(sum.counts.read).toBe(1); // REG-0002 devolvido e lido
    await call("return_loan", { id: sum.activeLoans[0].id, returnedAt: todayISO(), markedRead: false });
    const after = await call<ReaderSummary>("get_reader_summary", { kind: "student", id: ana.id });
    expect(after.counts.read).toBe(1);
    expect(after.history).toHaveLength(2);
  });

  it("search_readers acha alunos e professores sem acento", async () => {
    const r = await call<{ kind: string; name: string }[]>("search_readers", { text: "patricia" });
    expect(r).toEqual([expect.objectContaining({ kind: "teacher", name: "Patrícia Nogueira" })]);
    const both = await call<{ kind: string }[]>("search_readers", { text: "a", limit: 3 });
    expect(both).toHaveLength(3);
  });
});

describe("mock: turmas, professores e alunos", () => {
  const year = new Date().getFullYear();

  it("lista turmas com filtros e contagens", async () => {
    const all = await call<ClassRoom[]>("list_classes", { query: {} });
    expect(all).toHaveLength(4);
    const c = all.find((x) => x.name === "5º ano A" && x.schoolYear === year)!;
    expect(c).toMatchObject({ studentCount: 3, activeLoans: 2, overdueLoans: 1 });
    expect(await call<ClassRoom[]>("list_classes", { query: { schoolYear: year - 1 } })).toHaveLength(1);
    expect(await call<ClassRoom[]>("list_classes", { query: { shift: "afternoon" } })).toHaveLength(1);
    expect(await call<ClassRoom[]>("list_classes", { query: { text: "8o ano" } })).toHaveLength(1);
    expect(await call<ClassRoom[]>("list_classes", { query: { text: "9o ano" } })).toHaveLength(0);
    expect(await call<ClassRoom[]>("list_classes", { query: { text: "marina" } })).toHaveLength(2);
  });

  it("nome + ano de turma são únicos; turma com alunos não exclui (IN_USE)", async () => {
    const [t] = await call<Teacher[]>("list_teachers", {});
    const dup = await rejection(
      call("create_class", { input: { name: "5º ANO a", schoolYear: year, shift: "evening", teacherId: t.id } }),
    );
    expect(dup).toMatchObject({ code: "VALIDATION", field: "name" });
    await call("create_class", { input: { name: "5º ano A", schoolYear: year + 1, shift: "evening", teacherId: t.id } });
    const all = await call<ClassRoom[]>("list_classes", {});
    const withStudents = all.find((c) => c.studentCount > 0)!;
    expect((await rejection(call("delete_class", { id: withStudents.id }))).code).toBe("IN_USE");
    const empty = all.find((c) => c.studentCount === 0)!;
    await call("delete_class", { id: empty.id });
  });

  it("professor responsável por turma não exclui; sem turma mas com empréstimo ativo bloqueia", async () => {
    const [marina] = await call<Teacher[]>("list_teachers", { text: "marina" });
    expect((await rejection(call("delete_teacher", { id: marina.id }))).code).toBe("IN_USE");
    const novo = await call<Teacher>("create_teacher", { input: { name: "Rui Barbosa" } });
    const hist = await call<Book>("get_book", { id: (await bookByTitle("Código Limpo")).id });
    const st = await copies(hist.id);
    const today = todayISO();
    await call("create_loan", {
      input: { copyId: st.find((c) => c.status === "available")!.copyId, readerKind: "teacher", readerId: novo.id, loanedAt: today, dueAt: addDays(today, 14) },
    });
    expect((await rejection(call("delete_teacher", { id: novo.id }))).code).toBe("HAS_ACTIVE_LOANS");
  });

  it("matrícula é única (DUPLICATE_REGISTRATION) e aluno com empréstimo ativo não exclui", async () => {
    const c = (await call<ClassRoom[]>("list_classes", {}))[0];
    const base = { name: "Novo Aluno", registration: " 2026001 ", classId: c.id };
    const e = await rejection(call("create_student", { input: base }));
    expect(e).toMatchObject({ code: "DUPLICATE_REGISTRATION", field: "registration" });
    const s = await call<Student>("create_student", { input: { ...base, registration: "9999", guardian: "  " } });
    expect(s.guardian).toBeUndefined();
    await call("delete_student", { id: s.id });

    const ana = (await call<Page<Student>>("list_students", { query: { text: "ana" } })).items[0];
    expect((await rejection(call("delete_student", { id: ana.id }))).code).toBe("HAS_ACTIVE_LOANS");
  });

  it("excluir aluno sem ativos apaga o histórico junto", async () => {
    const fel = (await call<Page<Student>>("list_students", { query: { text: "felipe" } })).items[0];
    await call("delete_student", { id: fel.id });
    const loans = await call<LoanPage>("list_loans", { query: { text: "felipe" } });
    expect(loans.counts.all).toBe(0);
  });

  it("filtra alunos por turma e só com atraso, com paginação", async () => {
    const overdue = await call<Page<Student>>("list_students", { query: { overdueOnly: true } });
    expect(overdue.items.map((s) => s.name).sort()).toEqual(["Bruno Henrique Costa", "Eduarda Martins"]);
    const p = await call<Page<Student>>("list_students", { query: { pageSize: 3, page: 3 } });
    expect(p.total).toBe(8);
    expect(p.items).toHaveLength(2);
  });
});

describe("mock: CSV", () => {
  it("prévia classifica linhas e a importação cria a categoria que faltar", async () => {
    const prev = await call<import("./types").CsvPreview>("preview_csv", { path: "x.csv" });
    expect(prev.counts).toEqual({ ready: 2, duplicate: 1, error: 1 });
    expect(prev.rows.find((r) => r.status === "error")).toMatchObject({ line: 5, message: "Autor não informado." });

    const rep = await call<import("./types").ImportReport>("import_csv", { path: "x.csv" });
    expect(rep).toMatchObject({ imported: 2, skippedDuplicates: ["Dom Casmurro"] });
    expect(rep.errors).toEqual([{ line: 5, message: "Autor não informado." }]);
    const cats = await call<Category[]>("list_categories");
    expect(cats.find((c) => c.name === "Poesia")?.bookCount).toBe(1);
    expect((await call<Stats>("get_stats")).totalBooks).toBe(14);
  });

  it("código duplicado informa o índice no field", async () => {
    const cats = await call<Category[]>("list_categories");
    const e = await rejection(
      call("create_book", { input: { title: "Z", author: "A", subject: "S", categoryId: cats[0].id, codes: ["NOVO", "REG-0001"] } }),
    );
    expect(e).toMatchObject({ code: "DUPLICATE_CODE", field: "codes.1" });
  });
});

describe("mock: paridade com o Rust (F-09)", () => {
  const baseInput = async (over: Partial<BookInput>): Promise<BookInput> => {
    const cats = await call<Category[]>("list_categories");
    return { title: "T", author: "A", subject: "S", categoryId: cats[0].id, codes: ["X-1"], ...over };
  };

  it("normalize: NFKD, sem diacríticos, minúsculo e espaços colapsados", () => {
    expect(normalize("  5º   Ano Á ")).toBe("5o ano a");
    expect(normalize("Ação\tÇ")).toBe("acao c");
  });

  it("list_loans sem status devolve só os ativos (inclui atrasados)", async () => {
    const page = await call<LoanPage>("list_loans", { query: {} });
    expect(page.items.every((l) => l.status !== "returned")).toBe(true);
    expect(page.total).toBe(page.counts.active);
  });

  it("search_readers com texto vazio devolve até 20 em ordem alfabética", async () => {
    const all = await call<Reader[]>("search_readers", { text: "" });
    expect(all.length).toBeGreaterThan(3);
    expect(all.length).toBeLessThanOrEqual(20);
    const names = all.map((r) => normalize(r.name));
    expect(names).toEqual([...names].sort());
    expect(await call<Reader[]>("search_readers", { text: "", limit: 3 })).toHaveLength(3);
  });

  it("Teacher.classes[].name traz só o nome da turma, sem ano", async () => {
    const [marina] = await call<Teacher[]>("list_teachers", { text: "marina" });
    expect(marina.classes.map((c) => c.name)).toEqual(["5º ano A", "5º ano A"]);
  });

  it("busca por palavras com AND, em qualquer ordem", async () => {
    const hit = await call<Page<Book>>("list_books", { query: { text: "machado dom" } });
    expect(hit.items.map((b) => b.title)).toEqual(["Dom Casmurro"]);
    expect((await call<Page<Book>>("list_books", { query: { text: "machado hobbit" } })).total).toBe(0);
  });

  it("busca de alunos e leitores casa também a turma", async () => {
    const students = await call<Page<Student>>("list_students", { query: { text: "8o ano heitor" } });
    expect(students.items.map((s) => s.name)).toEqual(["Heitor Pereira"]);
    const readers = await call<Reader[]>("search_readers", { text: "5o ano eduarda" });
    expect(readers.map((r) => r.name)).toEqual(["Eduarda Martins"]);
  });

  it("códigos vazios são descartados em silêncio", async () => {
    const b = await call<Book>("create_book", { input: await baseInput({ title: "Com Vazios", codes: ["V-1", "  ", ""] }) });
    expect(b.codes).toEqual(["V-1"]);
    const e = await rejection(call("create_book", { input: await baseInput({ title: "Só Vazios", codes: [" "] }) }));
    expect(e).toMatchObject({ code: "VALIDATION", field: "codes" });
  });

  it("createdAt/updatedAt saem em ISO UTC com Z", async () => {
    const b = await call<Book>("create_book", { input: await baseInput({ title: "Datado", codes: ["D-1"] }) });
    expect(b.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect((await bookByTitle("Dom Casmurro")).createdAt).toMatch(/Z$/);
  });

  it("empréstimo mantém book.id ao remover o código e mostra o título atual", async () => {
    const book = await bookByTitle("O Pequeno Príncipe");
    await call("update_book", {
      id: book.id,
      input: { ...(await baseInput({})), title: "O Pequeno Príncipe Nova Edição", author: book.author, subject: book.subject, categoryId: book.category.id, codes: ["REG-0001", "REG-0003"] },
    });
    const after = await call<LoanPage>("list_loans", { query: { status: "returned", text: "principe nova" } });
    expect(after.items[0]).toMatchObject({ copyId: null, code: "REG-0002" });
    expect(after.items[0].book).toMatchObject({ id: book.id, title: "O Pequeno Príncipe Nova Edição" });
  });

  it("livros lidos = livros distintos", async () => {
    const [ana] = (await call<Page<Student>>("list_students", { query: { text: "ana beatriz" } })).items;
    expect(ana.readCount).toBe(1); // REG-0002 devolvido e lido
    const book = await bookByTitle("O Pequeno Príncipe");
    const c = (await copies(book.id)).find((x) => x.code === "REG-0003")!;
    const loan = await call<{ id: number }>("create_loan", {
      input: { copyId: c.copyId, readerKind: "student", readerId: ana.id, loanedAt: todayISO(), dueAt: addDays(todayISO(), 7) },
    });
    await call("return_loan", { id: loan.id, returnedAt: todayISO(), markedRead: true });
    // mesmo livro lido de novo: continua 1
    expect((await call<Student>("get_student", { id: ana.id })).readCount).toBe(1);
  });
});
