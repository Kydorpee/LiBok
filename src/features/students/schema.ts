import { z } from "zod";
import type { Student, StudentInput } from "../../lib/types";

export const studentSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do aluno."),
  registration: z.string().trim().min(1, "Informe a matrícula."),
  classId: z.number({ error: "Selecione a turma." }).int().positive("Selecione a turma."),
  guardian: z.string().trim().optional(),
  contact: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

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
  classId: s.classRoom.id,
  guardian: s.guardian ?? "",
  contact: s.contact ?? "",
  notes: s.notes ?? "",
});

/** Campos opcionais vazios viram `undefined`. */
export const formToStudentInput = (v: StudentFormOutput): StudentInput => ({
  name: v.name,
  registration: v.registration,
  classId: v.classId,
  guardian: v.guardian || undefined,
  contact: v.contact || undefined,
  notes: v.notes || undefined,
});
