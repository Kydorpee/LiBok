import { z } from "zod";
import type { ClassInput, ClassRoom, Shift, TeacherInput } from "../../lib/types";

export const SHIFT_LABELS: Record<Shift, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite",
  fullday: "Integral",
};
export const SHIFTS = Object.keys(SHIFT_LABELS) as Shift[];

export const classSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da turma."),
  schoolYear: z
    .number({ error: "Informe o ano letivo." })
    .int("Informe um ano válido.")
    .min(2000, "Informe um ano válido.")
    .max(2100, "Informe um ano válido."),
  shift: z.enum(["morning", "afternoon", "evening", "fullday"], { error: "Selecione o turno." }),
  teacherId: z.number({ error: "Selecione o professor." }).int().positive("Selecione o professor."),
});

export type ClassFormValues = z.input<typeof classSchema>;
export type ClassFormOutput = z.output<typeof classSchema>;

export const emptyClassForm = (): ClassFormValues => ({
  name: "",
  schoolYear: new Date().getFullYear(),
  shift: "morning",
  teacherId: undefined as unknown as number,
});

export const classToForm = (c: ClassRoom): ClassFormValues => ({
  name: c.name,
  schoolYear: c.schoolYear,
  shift: c.shift,
  teacherId: c.teacher.id,
});

export const formToClassInput = (v: ClassFormOutput): ClassInput => ({ ...v });

/** Professor (criação rápida e cadastro): nome* e contato. */
export const teacherSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do professor."),
  contact: z.string().trim().optional(),
});
export type TeacherFormValues = z.input<typeof teacherSchema>;
export type TeacherFormOutput = z.output<typeof teacherSchema>;

export const formToTeacherInput = (v: TeacherFormOutput): TeacherInput => ({
  name: v.name,
  contact: v.contact || undefined,
});
