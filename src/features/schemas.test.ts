import { describe, expect, it } from "vitest";
import { bookSchema, formToBookInput } from "./books/schema";
import { classSchema } from "./classes/schema";
import { loanSchema, returnSchema } from "./loans/schema";
import { formToStudentInput, studentSchema } from "./students/schema";

const msgs = (r: { success: boolean; error?: { issues: { message: string; path: PropertyKey[] }[] } }) =>
  r.error?.issues.map((i) => `${i.path.join(".")}: ${i.message}`) ?? [];

describe("schemas de formulário", () => {
  it("livro: obrigatórios e códigos repetidos", () => {
    const r = bookSchema.safeParse({
      title: " ",
      author: "A",
      subject: "S",
      categoryId: undefined,
      codes: [{ value: "X-1" }, { value: "x-1" }],
    });
    expect(r.success).toBe(false);
    const m = msgs(r);
    expect(m).toContain("title: Informe o título.");
    expect(m).toContain("categoryId: Selecione uma categoria.");
    expect(m).toContain("codes.1.value: Código repetido neste livro.");
  });

  it("livro: exige ao menos um exemplar e converte para BookInput", () => {
    expect(bookSchema.safeParse({ title: "T", author: "A", subject: "S", categoryId: 1, codes: [] }).success).toBe(false);
    const ok = bookSchema.parse({ title: " T ", author: "A", subject: "S", categoryId: 1, codes: [{ value: " R1 " }] });
    expect(formToBookInput(ok)).toEqual({ title: "T", author: "A", subject: "S", categoryId: 1, codes: ["R1"] });
  });

  it("turma e aluno", () => {
    expect(msgs(classSchema.safeParse({ name: "", schoolYear: 1999, shift: "x", teacherId: 0 })).length).toBe(4);
    const s = studentSchema.parse({ name: "A", registration: " 1 ", classId: 2, guardian: "", contact: " ", notes: "" });
    expect(formToStudentInput(s)).toEqual({ name: "A", registration: "1", classId: 2, guardian: undefined, contact: undefined, notes: undefined });
  });

  it("empréstimo: leitor obrigatório e prazo não anterior; devolução", () => {
    const base = { copyId: 3, reader: { kind: "student", id: 1 }, loanedAt: "2026-10-12", dueAt: "2026-10-26" };
    expect(loanSchema.safeParse(base).success).toBe(true);
    expect(msgs(loanSchema.safeParse({ ...base, reader: undefined }))).toContain("reader: Selecione o leitor.");
    expect(msgs(loanSchema.safeParse({ ...base, dueAt: "2026-10-01" }))).toContain(
      "dueAt: A devolução prevista não pode ser anterior ao empréstimo.",
    );
    expect(returnSchema("2026-10-12").safeParse({ returnedAt: "2026-10-11", markedRead: true }).success).toBe(false);
    expect(returnSchema("2026-10-12").safeParse({ returnedAt: "2026-10-12", markedRead: true }).success).toBe(true);
  });
});
