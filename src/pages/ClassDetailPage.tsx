import { Eye, Pencil, Presentation, Trash2, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { paths } from "../app/paths";
import {
  Avatar,
  Button,
  buttonStyles,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Modal,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeaderCell,
  TableRow,
  useToast,
} from "../components/ui";
import { toAppError } from "../lib/api";
import type { ClassRoom } from "../lib/types";
import { useClass, useDeleteClass, useUpdateClass } from "../features/classes/hooks";
import { ClassModal } from "../features/classes/ClassModal";
import { SHIFT_LABELS } from "../features/classes/schema";
import { Page, PageError } from "../features/shared/Page";
import { useTeachers } from "../features/teachers/hooks";

function SwapTeacherModal({ classRoom, onClose }: { classRoom: ClassRoom; onClose: () => void }) {
  const toast = useToast();
  const teachers = useTeachers();
  const update = useUpdateClass();
  const [teacherId, setTeacherId] = useState(String(classRoom.teacher.id));

  async function save() {
    try {
      await update.mutateAsync({
        id: classRoom.id,
        input: {
          name: classRoom.name,
          schoolYear: classRoom.schoolYear,
          shift: classRoom.shift,
          teacherId: Number(teacherId),
        },
      });
      toast.success("Professor atualizado", classRoom.name);
      onClose();
    } catch (e) {
      toast.error("Não foi possível trocar o professor", toAppError(e).message);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Trocar professor"
      description={`${classRoom.name} · ${classRoom.schoolYear}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={update.isPending} disabled={Number(teacherId) === classRoom.teacher.id}>
            Salvar
          </Button>
        </>
      }
    >
      <Select
        label="Professor responsável"
        value={teacherId}
        onChange={(e) => setTeacherId(e.target.value)}
        options={(teachers.data ?? []).map((t) => ({ value: String(t.id), label: t.name }))}
        data-autofocus
      />
    </Modal>
  );
}

export default function ClassDetailPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const toast = useToast();
  const q = useClass(id);
  const del = useDeleteClass();
  const [editing, setEditing] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (q.isError && !q.data) {
    return (
      <Page title="Turma" breadcrumb={[{ label: "Turmas", href: paths.classes }, { label: "Turma" }]}>
        <PageError error={q.error} onRetry={() => void q.refetch()} />
      </Page>
    );
  }
  if (!q.data) {
    return (
      <Page title="Turma">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </Page>
    );
  }
  const { classRoom: c, students } = q.data;

  async function onDelete() {
    try {
      await del.mutateAsync(c.id);
      toast.success("Turma excluída", c.name);
      navigate(paths.classes);
    } catch (e) {
      toast.error("Não foi possível excluir a turma", toAppError(e).message);
      setConfirmDelete(false);
    }
  }

  return (
    <Page
      title={c.name}
      subtitle={`${c.schoolYear} · ${SHIFT_LABELS[c.shift]}`}
      breadcrumb={[{ label: "Turmas", href: paths.classes }, { label: c.name }]}
      actions={
        <>
          <Link to={`${paths.newStudent}?turma=${c.id}`} className={buttonStyles({ variant: "secondary" })}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Novo aluno
          </Link>
          <Button variant="secondary" icon={<Pencil />} onClick={() => setEditing(true)}>
            Editar turma
          </Button>
          <Button variant="danger" icon={<Trash2 />} onClick={() => setConfirmDelete(true)}>
            Excluir
          </Button>
        </>
      }
    >
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={c.teacher.name} size="lg" />
          <div>
            <p className="flex items-center gap-1 text-label text-text-muted">
              <Presentation className="h-3.5 w-3.5" aria-hidden="true" />
              Professor responsável
            </p>
            <p className="text-subtitle">{c.teacher.name}</p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => setSwapping(true)}>
          Trocar professor
        </Button>
      </Card>

      <Card flush>
        <CardHeader
          className="px-6 pt-6"
          title="Alunos"
          description={`${c.studentCount} ${c.studentCount === 1 ? "aluno" : "alunos"} · ${c.activeLoans} empréstimo(s) ativo(s) · ${c.overdueLoans} atrasado(s)`}
        />
        <Table caption="Alunos da turma">
          <TableHead>
            <TableRow className="h-10 hover:bg-transparent">
              <TableHeaderCell>Aluno</TableHeaderCell>
              <TableHeaderCell>Matrícula</TableHeaderCell>
              <TableHeaderCell>Emprestados</TableHeaderCell>
              <TableHeaderCell>Atrasados</TableHeaderCell>
              <TableHeaderCell>Lidos</TableHeaderCell>
              <TableHeaderCell className="text-right">Ações</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {students.length === 0 ? (
              <TableEmpty colSpan={6}>
                <EmptyState
                  icon={<Users />}
                  title="Nenhum aluno nesta turma"
                  message="Cadastre o primeiro aluno desta turma."
                  action={
                    <Link to={`${paths.newStudent}?turma=${c.id}`} className={buttonStyles({})}>
                      Novo aluno
                    </Link>
                  }
                />
              </TableEmpty>
            ) : (
              students.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={s.name} size="sm" />
                      <span className="text-body-strong">{s.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{s.registration}</TableCell>
                  <TableCell>{s.activeLoans}</TableCell>
                  <TableCell className={s.overdueLoans ? "text-text-danger" : undefined}>{s.overdueLoans}</TableCell>
                  <TableCell>{s.readCount}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <IconButton label={`Ver resumo de ${s.name}`} onClick={() => navigate(paths.readerSummary("student", s.id))}>
                        <Eye />
                      </IconButton>
                      <IconButton label={`Editar ${s.name}`} onClick={() => navigate(paths.editStudent(s.id))}>
                        <Pencil />
                      </IconButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <ClassModal open={editing} onClose={() => setEditing(false)} classRoom={c} />
      {swapping ? <SwapTeacherModal classRoom={c} onClose={() => setSwapping(false)} /> : null}
      <ConfirmDialog
        open={confirmDelete}
        title="Excluir turma"
        message={`Excluir a turma "${c.name}" (${c.schoolYear})? Só é possível se ela não tiver alunos.`}
        loading={del.isPending}
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </Page>
  );
}
