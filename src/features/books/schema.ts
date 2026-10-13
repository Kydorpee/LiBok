import { z } from "zod";
import { normalize } from "../../lib/normalize";
import type { Book, BookInput } from "../../lib/types";

/** Formulário do livro. `codes` é lista de objetos para funcionar com `useFieldArray`. */
export const bookSchema = z.object({
    title: z.string().trim().min(1, "Informe o título."),
    author: z.string().trim().min(1, "Informe o autor."),
    subject: z.string().trim().min(1, "Informe o assunto."),
    categoryId: z.number({ error: "Selecione uma categoria." }).int().positive("Selecione uma categoria."),
    codes: z
      .array(z.object({ value: z.string().trim().min(1, "Informe o código de registro.") }))
      .min(1, "Informe ao menos um exemplar.")
      .superRefine((codes, ctx) => {
        const seen = new Set<string>();
        codes.forEach((c, i) => {
          const n = normalize(c.value);
          if (!n) return;
          if (seen.has(n)) {
            ctx.addIssue({ code: "custom", path: [i, "value"], message: "Código repetido neste livro." });
          }
          seen.add(n);
        });
      }),
  });

export type BookFormValues = z.input<typeof bookSchema>;
export type BookFormOutput = z.output<typeof bookSchema>;

export const emptyBookForm = (): BookFormValues => ({
  title: "",
  author: "",
  subject: "",
  categoryId: undefined as unknown as number,
  codes: [{ value: "" }],
});

export const bookToForm = (b: Book): BookFormValues => ({
  title: b.title,
  author: b.author,
  subject: b.subject,
  categoryId: b.category.id,
  codes: b.codes.map((value) => ({ value })),
});

export const formToBookInput = (v: BookFormOutput): BookInput => ({
  title: v.title,
  author: v.author,
  subject: v.subject,
  categoryId: v.categoryId,
  codes: v.codes.map((c) => c.value),
});
