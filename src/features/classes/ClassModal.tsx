import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { paths } from "../../app/paths";
import { Button, ConfirmDialog, Input, Modal, Select, useToast } from "../../components/ui";
import { toAppError } from "../../lib/api";
import type { ClassRoom } from "../../lib/types";
import { applyAppError } from "../formErrors";
import { useTeachers, useCreateTeacher } from "../teachers/hooks";
import { useCreateClass, useDeleteClass, useUpdateClass } from "./hooks";
import {
  classSchema,
  classToForm,
  emptyClassForm,
  formToClassInput,
  SHIFT_LABELS,
  SHIFTS,
  type ClassFormOutput,
  type ClassFormValues,
} from "./schema";

/** Nova turma / editar turma, com criação rápida de professor. */
export function ClassModal({
  open,
  onClose,
  classRoom,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  classRoom?: ClassRoom;
  onSaved?: (c: ClassRoom) => void;
}) {
  if (!open) return null;
  return <Body onClose={onClose} classRoom={classRoom} onSaved={onSaved} />;
}

function Body({
  onClose,
  classRoom,
  onSaved,
}: {
  onClose: () => void;
  classRoom?: ClassRoom;
  onSaved?: (c: ClassRoom) => void;
}) {
  const toast = useToast();
  const teachers = useTeachers();
  const createTeacher = useCreateTeacher();
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const deleteClass = useDeleteClass();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [quick, setQuick] = useState(false);
  const [teacherName, setTeacherName] = useState("");
  const [teacherError, setTeacherError] = useState<string>();
  const [newTeacherId, setNewTeacherId] = useState<number | null>(null);
  const appliedTeacher = useRef<number | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<ClassFormValues, unknown, ClassFormOutput>({
    resolver: zodResolver(classSchema),
    defaultValues: classRoom ? classToForm(classRoom) : emptyClassForm(),
  });

  // seleciona o professor recém-criado quando a opção já existe no select
  useEffect(() => {
    if (newTeacherId !== null && appliedTeacher.current !== newTeacherId && teachers.data?.some((t) => t.id === newTeacherId)) {
      appliedTeacher.current = newTeacherId;
      setValue("teacherId", newTeacherId, { shouldValidate: true });
    }
  }, [newTeacherId, teachers.data, setValue]);

  async function onSubmit(values: ClassFormOutput) {
    const input = formToClassInput(values);
    try {
      const saved = classRoom
        ? await updateClass.mutateAsync({ id: classRoom.id, input })
        : await createClass.mutateAsync(input);
      toast.success(classRoom ? "Turma atualizada" : "Turma criada", saved.name);
      onSaved?.(saved);
      onClose();
    } catch (e) {
      const err = applyAppError(e, setError, { fields: ["name", "schoolYear", "shift", "teacherId"] });
      toast.error("Não foi possível salvar a turma", err.message);
    }
  }

  async function addTeacher() {
    if (!teacherName.trim()) {
      setTeacherError("Informe o nome do professor.");
      return;
    }
    try {
      const t = await createTeacher.mutateAsync({ name: teacherName });
      toast.success("Professor cadastrado", t.name);
      setNewTeacherId(t.id);
      setQuick(false);
      setTeacherName("");
      setTeacherError(undefined);
    } catch (e) {
      setTeacherError(toAppError(e).message);
    }
  }

  async function onDelete() {
    if (!classRoom) return;
    try {
      await deleteClass.mutateAsync(classRoom.id);
      toast.success("Turma excluída", classRoom.name);
      setConfirmDelete(false);
      onClose();
      navigate(paths.classes);
    } catch (e) {
      toast.error("Não foi possível excluir a turma", toAppError(e).message);
      setConfirmDelete(false);
    }
  }

  const hasStudents = (classRoom?.studentCount ?? 0) > 0;
  const pending = createClass.isPending || updateClass.isPending;

  return (
    <>
    <Modal
      open
      onClose={onClose}
      title={classRoom ? "Editar turma" : "Nova turma"}
      size="md"
      footer={
        <div className="flex w-full items-start justify-between gap-4">
          {classRoom ? (
            <div className="flex min-w-0 flex-col items-start gap-1">
              <Button
                variant="danger"
                icon={<Trash2 />}
                onClick={() => setConfirmDelete(true)}
              >
                Excluir turma
              </Button>
            </div>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" form="class-form" loading={pending}>
              Salvar turma
            </Button>
          </div>
        </div>
      }
    >
      <form id="class-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Input label="Nome *" placeholder="Ex.: 5º ano A" error={errors.name?.message} data-autofocus {...register("name")} />
        <div className="grid grid-cols-2 gap-4">
          <Input
            type="number"
            label="Ano letivo *"
            error={errors.schoolYear?.message}
            {...register("schoolYear", { valueAsNumber: true })}
          />
          <Select
            label="Turno *"
            error={errors.shift?.message}
            options={SHIFTS.map((s) => ({ value: s, label: SHIFT_LABELS[s] }))}
            {...register("shift")}
          />
        </div>
        <div className="flex items-end gap-2">
          <Select
            wrapperClassName="flex-1"
            label="Professor responsável *"
            placeholder="Selecione"
            error={errors.teacherId?.message}
            options={(teachers.data ?? []).map((t) => ({ value: String(t.id), label: t.name }))}
            {...register("teacherId", { setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)) })}
          />
          <Button variant="secondary" icon={<UserPlus />} onClick={() => setQuick((q) => !q)}>
            Novo professor
          </Button>
        </div>
        {quick ? (
          <div className="flex items-start gap-2 rounded-sm border border-border-default bg-bg-subtle p-3">
            <Input
              wrapperClassName="flex-1"
              label="Nome do professor"
              value={teacherName}
              error={teacherError}
              onChange={(e) => {
                setTeacherName(e.target.value);
                setTeacherError(undefined);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addTeacher();
                }
              }}
            />
            <Button className="mt-[26px]" onClick={addTeacher} loading={createTeacher.isPending}>
              Cadastrar
            </Button>
          </div>
        ) : null}
        {errors.root?.server ? (
          <p role="alert" className="text-body text-text-danger">
            {errors.root.server.message}
          </p>
        ) : null}
      </form>
    </Modal>
    {classRoom ? (
      <ConfirmDialog
        open={confirmDelete}
        title="Excluir turma"
        message={
          hasStudents
            ? `Excluir a turma "${classRoom.name}" (${classRoom.schoolYear})? Os ${classRoom.studentCount} alunos ficarão sem turma. O histórico de empréstimos e leituras é mantido.`
            : `Excluir a turma "${classRoom.name}" (${classRoom.schoolYear})?`
        }
        loading={deleteClass.isPending}
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    ) : null}
    </>
  );
}
