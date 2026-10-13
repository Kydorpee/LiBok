import { z } from "zod";
import type { Student, StudentInput } from "../../lib/types";

const requiredClass = z.number({ error: "Selecione a turma." }).int().positive("Selecione a turma.");

/** Cadastro novo exige turma; na edição de aluno sem turma ela pode ficar vazia. */
export const makeStudentSchema = (requireClass = true) => z.object({
  name: z.string().trim().min(1, "Informe o nome do aluno."),
  registration: z.string().trim().min(1, "Informe a matrícula."),
  classId: requireClass ? requiredClass : requiredClass.optional(),
  guardian: z.string().trim().optional(),
  contact: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const studentSchema = makeStudentSchema(true);

export type StudentFormValues = z.input<typeof studentSchema>;
export type StudentFormOutput = z.output<typeof studentSchema>;

export const emptyStudentForm = (classId?: number): StudentFormValues => ({
  name: "",
  registration: "",
  classId: classId as number,
  guardian: "",
  contact: "",
  notes: "",
});

export const studentToForm = (s: Student): StudentFormValues => ({
  name: s.name,
  registration: s.registration,
  classId: s.classRoom?.id as number,
  guardian: s.guardian ?? "",
  contact: s.contact ?? "",
  notes: s.notes ?? "",
});

/** Campos opcionais vazios viram `undefined`. */
export const formToStudentInput = (v: StudentFormOutput): StudentInput => ({
  name: v.name,
  registration: v.registration,
  classId: v.classId ?? null,
  guardian: v.guardian || undefined,
  contact: v.contact || undefined,
  notes: v.notes || undefined,
});
