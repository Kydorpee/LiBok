import { zodResolver } from "@hookform/resolvers/zod";
import { Eraser, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { paths } from "../app/paths";
import { Button, Card, CardHeader, ConfirmDialog, Input, Skeleton, useToast } from "../components/ui";
import type { Teacher } from "../lib/types";
import { formToTeacherInput, teacherSchema, type TeacherFormOutput, type TeacherFormValues } from "../features/classes/schema";
import { applyAppError, collectErrors } from "../features/formErrors";
import { FormErrorSummary, Page, PageError } from "../features/shared/Page";
import { useCreateTeacher, useDeleteTeacher, useTeachers, useUpdateTeacher } from "../features/teachers/hooks";

function TeacherForm({ teacher }: { teacher?: Teacher }) {
  const editing = !!teacher;
  const toast = useToast();
  const navigate = useNavigate();
  const create = useCreateTeacher();
  const update = useUpdateTeacher();
  const del = useDeleteTeacher();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<TeacherFormValues, unknown, TeacherFormOutput>({
    resolver: zodResolver(teacherSchema),
    defaultValues: { name: teacher?.name ?? "", contact: teacher?.contact ?? "" },
  });

  async function onSubmit(values: TeacherFormOutput) {
    const input = formToTeacherInput(values);
    try {
      if (teacher) {
        const saved = await update.mutateAsync({ id: teacher.id, input });
        toast.success("Professor atualizado", saved.name);
        reset({ name: saved.name, contact: saved.contact ?? "" });
      } else {
        const saved = await create.mutateAsync(input);
        toast.success("Professor cadastrado", saved.name);
        reset({ name: "", contact: "" });
      }
    } catch (e) {
      const err = applyAppError(e, setError, { fields: ["name", "contact"] });
      toast.error("Não foi possível salvar", err.message);
    }
  }

  async function onDelete() {
    if (!teacher) return;
    try {
      await del.mutateAsync(teacher.id);
      toast.success("Professor excluído", teacher.name);
      navigate(paths.readers("professores"));
    } catch (e) {
      const err = applyAppError(e, setError);
      toast.error("Não foi possível excluir", err.message);
      setConfirmDelete(false);
    }
  }

  const summary = submitCount > 0 ? collectErrors(errors) : [];

  return (
    <Page
      title={editing ? "Editar professor" : "Cadastrar professor"}
      subtitle={editing ? teacher.name : "Nome e contato do professor."}
      breadcrumb={[{ label: "Leitores", href: paths.readers("professores") }, { label: editing ? teacher.name : "Novo professor" }]}
      actions={
        <>
          {editing ? (
            <Button variant="danger" icon={<Trash2 />} onClick={() => setConfirmDelete(true)}>
              Excluir professor
            </Button>
          ) : (
            <Button variant="secondary" icon={<Eraser />} onClick={() => reset({ name: "", contact: "" })}>
              Limpar
            </Button>
          )}
          <Button type="submit" form="teacher-form" icon={<Save />} loading={isSubmitting || create.isPending || update.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="teacher-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        <FormErrorSummary messages={summary.length ? summary : errors.root?.server?.message ? [errors.root.server.message] : []} />
        <Card>
          <CardHeader title="Dados do professor" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="Nome *" error={errors.name?.message} {...register("name")} />
            <Input label="Contato" error={errors.contact?.message} {...register("contact")} />
          </div>
        </Card>
      </form>
      {teacher ? (
        <ConfirmDialog
          open={confirmDelete}
          title="Excluir professor"
          message={`Excluir ${teacher.name}? O histórico de empréstimos do professor também será apagado.`}
          loading={del.isPending}
          onConfirm={onDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      ) : null}
    </Page>
  );
}

export default function TeacherFormPage() {
  const idParam = useParams().id;
  const id = idParam ? Number(idParam) : undefined;
  // não há get_teacher no contrato: usa a lista e filtra
  const q = useTeachers();
  if (id === undefined) return <TeacherForm />;
  if (q.isError) {
    return (
      <Page title="Editar professor">
        <PageError error={q.error} onRetry={() => void q.refetch()} />
      </Page>
    );
  }
  const teacher = q.data?.find((t) => t.id === id);
  if (!q.data) {
    return (
      <Page title="Editar professor">
        <Skeleton className="h-40" />
      </Page>
    );
  }
  if (!teacher) {
    return (
      <Page title="Editar professor">
        <PageError error={{ code: "NOT_FOUND", message: "Professor não encontrado." }} />
      </Page>
    );
  }
  return <TeacherForm key={teacher.id} teacher={teacher} />;
}
