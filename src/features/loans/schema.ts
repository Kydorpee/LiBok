import { z } from "zod";
import { defaultDueDate, isValidISODate, todayISO } from "../../lib/dates";
import type { LoanInput, ReaderKind } from "../../lib/types";

const isoDate = (msg: string) => z.string().refine(isValidISODate, msg);

/** Modal "Emprestar exemplar". */
export const loanSchema = z
  .object({
    copyId: z.number({ error: "Selecione um exemplar." }).int().positive("Selecione um exemplar."),
    reader: z.object(
      { kind: z.enum(["student", "teacher"]), id: z.number().int().positive() },
      { error: "Selecione o leitor." },
    ),
    loanedAt: isoDate("Data do empréstimo inválida."),
    dueAt: isoDate("Data de devolução inválida."),
  })
  .superRefine((d, ctx) => {
    if (isValidISODate(d.loanedAt) && isValidISODate(d.dueAt) && d.dueAt < d.loanedAt) {
      ctx.addIssue({
        code: "custom",
        path: ["dueAt"],
        message: "A devolução prevista não pode ser anterior ao empréstimo.",
      });
    }
  });

export type LoanFormValues = z.input<typeof loanSchema>;
export type LoanFormOutput = z.output<typeof loanSchema>;

export const emptyLoanForm = (reader?: { kind: ReaderKind; id: number }): Partial<LoanFormValues> => {
  const loanedAt = todayISO();
  return { reader, loanedAt, dueAt: defaultDueDate(loanedAt) };
};

export const formToLoanInput = (v: LoanFormOutput): LoanInput => ({
  copyId: v.copyId,
  readerKind: v.reader.kind,
  readerId: v.reader.id,
  loanedAt: v.loanedAt,
  dueAt: v.dueAt,
});

/** Modal "Registrar devolução". `loanedAt` é só para validar a ordem das datas. */
export const returnSchema = (loanedAt?: string) =>
  z.object({
    returnedAt: isoDate("Data de devolução inválida.").refine(
      (d) => !loanedAt || d >= loanedAt,
      "A devolução não pode ser anterior ao empréstimo.",
    ),
    markedRead: z.boolean(),
  });

export type ReturnFormValues = { returnedAt: string; markedRead: boolean };

export const emptyReturnForm = (): ReturnFormValues => ({ returnedAt: todayISO(), markedRead: true });
