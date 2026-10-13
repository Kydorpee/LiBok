import { zodResolver } from "@hookform/resolvers/zod";
import { Eraser, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { paths } from "../app/paths";
import { Button, Card, CardHeader, ConfirmDialog, Input, Select, Skeleton, Textarea, useToast } from "../components/ui";
import type { Student } from "../lib/types";
import { useClasses } from "../features/classes/hooks";
import { applyAppError, collectErrors } from "../features/formErrors";
import { FormErrorSummary, Page, PageError } from "../features/shared/Page";
import { useCreateStudent, useDeleteStudent, useStudent, useUpdateStudent } from "../features/students/hooks";
import {
  emptyStudentForm,
  formToStudentInput,
  studentSchema,
  studentToForm,
  type StudentFormOutput,
  type StudentFormValues,
} from "../features/students/schema";

const FIELDS = ["name", "registration", "classId", "guardian", "contact", "notes"];

function StudentForm({ student, presetClassId }: { student?: Student; presetClassId?: number }) {
  const editing = !!student;
  const toast = useToast();
  const navigate = useNavigate();
  const classes = useClasses({});
  const create = useCreateStudent();
  const update = useUpdateStudent();
  const del = useDeleteStudent();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    control,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<StudentFormValues, unknown, StudentFormOutput>({
    resolver: zodResolver(studentSchema),
    defaultValues: student ? studentToForm(student) : emptyStudentForm(presetClassId),
  });
  const classId = useWatch({ control, name: "classId" });
  const teacher = classes.data?.find((c) => c.id === Number(classId))?.teacher.name;

  async function onSubmit(values: StudentFormOutput) {
    const input = formToStudentInput(values);
    try {
      if (student) {
        const saved = await update.mutateAsync({ id: student.id, input });
        toast.success("Aluno atualizado", saved.name);
        reset(studentToForm(saved));
      } else {
        const saved = await create.mutateAsync(input);
        toast.success("Aluno cadastrado", saved.name);
        reset(emptyStudentForm(values.classId));
        setFocus("name");
      }
    } catch (e) {
      const err = applyAppError(e, setError, { fields: FIELDS });
      toast.error("Não foi possível salvar", err.message);
    }
  }

  async function onDelete() {
    if (!student) return;
    try {
      await del.mutateAsync(student.id);
      toast.success("Aluno excluído", student.name);
      navigate(paths.readers("alunos"));
    } catch (e) {
      const err = applyAppError(e, setError);
      toast.error("Não foi possível excluir", err.message);
      setConfirmDelete(false);
    }
  }

  const summary = submitCount > 0 ? collectErrors(errors) : [];
  const saving = isSubmitting || create.isPending || update.isPending;

  return (
    <Page
      title={editing ? "Editar aluno" : "Cadastrar aluno"}
      subtitle={editing ? student.name : "Preencha os dados do aluno."}
      breadcrumb={[{ label: "Leitores", href: paths.readers("alunos") }, { label: editing ? student.name : "Novo aluno" }]}
      actions={
        <>
          {editing ? (
            <Button variant="danger" icon={<Trash2 />} onClick={() => setConfirmDelete(true)}>
              Excluir aluno
            </Button>
          ) : (
            <Button variant="secondary" icon={<Eraser />} onClick={() => reset(emptyStudentForm())}>
              Limpar
            </Button>
          )}
          <Button type="submit" form="student-form" icon={<Save />} loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="student-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        <FormErrorSummary messages={summary.length ? summary : errors.root?.server?.message ? [errors.root.server.message] : []} />
        <Card>
          <CardHeader title="Dados do aluno" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Nome *"
              error={errors.name?.message}
              {...register("name")}
            />
            <Input label="Matrícula *" error={errors.registration?.message} {...register("registration")} />
            <Select
              label="Turma *"
              placeholder="Selecione"
              error={errors.classId?.message}
              help={teacher ? `Professor responsável: ${teacher}` : undefined}
              options={(classes.data ?? []).map((c) => ({ value: String(c.id), label: `${c.name} (${c.schoolYear})` }))}
              {...register("classId", { setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)) })}
            />
            <Input label="Responsável" error={errors.guardian?.message} {...register("guardian")} />
            <Input label="Contato" error={errors.contact?.message} {...register("contact")} />
            <Textarea
              wrapperClassName="md:col-span-2"
              label="Observações"
              rows={3}
              error={errors.notes?.message}
              {...register("notes")}
            />
          </div>
        </Card>
      </form>
      {student ? (
        <ConfirmDialog
          open={confirmDelete}
          title="Excluir aluno"
          message={`Excluir ${student.name}? O histórico de empréstimos do aluno também será apagado.`}
          loading={del.isPending}
          onConfirm={onDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      ) : null}
    </Page>
  );
}

export default function StudentFormPage() {
  const params = useParams();
  const [search] = useSearchParams();
  const id = params.id ? Number(params.id) : undefined;
  const q = useStudent(id);
  const preset = search.get("turma") ? Number(search.get("turma")) : undefined;

  if (id === undefined) return <StudentForm presetClassId={preset} />;
  if (q.isError) {
    return (
      <Page title="Editar aluno">
        <PageError error={q.error} onRetry={() => void q.refetch()} />
      </Page>
    );
  }
  if (!q.data) {
    return (
      <Page title="Editar aluno">
        <Skeleton className="h-64" />
      </Page>
    );
  }
  return <StudentForm key={q.data.id} student={q.data} />;
}
