import { BookCheck, BookOpen, Eye, Pencil, Presentation, Trash2, UserPlus, Users } from "lucide-react";
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
import { formatDate } from "../lib/dates";
import type { ClassReading, ClassRoom } from "../lib/types";
import {
  useClass,
  useClassReadings,
  useDeleteClassReading,
  useUpdateClass,
} from "../features/classes/hooks";
import { ClassReadingModal } from "../features/classes/ClassReadingModal";
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
  const [editing, setEditing] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [reading, setReading] = useState(false);
  const [deletingReading, setDeletingReading] = useState<ClassReading | null>(null);
  const readings = useClassReadings(id);
  const delReading = useDeleteClassReading();

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

  async function onDeleteReading() {
    if (!deletingReading) return;
    try {
      await delReading.mutateAsync(deletingReading.id);
      toast.success("Leitura excluída", deletingReading.book.title);
    } catch (e) {
      toast.error("Não foi possível excluir a leitura", toAppError(e).message);
    }
    setDeletingReading(null);
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
          <Button
            icon={<BookCheck />}
            onClick={() => setReading(true)}
            disabled={students.length === 0}
            title={students.length === 0 ? "Cadastre alunos na turma para registrar uma leitura." : undefined}
          >
            Nova leitura
          </Button>
          <Button variant="secondary" icon={<Pencil />} onClick={() => setEditing(true)}>
            Editar turma
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

      <Card flush>
        <CardHeader
          className="px-6 pt-6"
          title="Leituras da turma"
          description="Livros lidos em grupo, com os alunos presentes"
        />
        <Table caption="Leituras da turma">
          <TableHead>
            <TableRow className="h-10 hover:bg-transparent">
              <TableHeaderCell>Data</TableHeaderCell>
              <TableHeaderCell>Livro</TableHeaderCell>
              <TableHeaderCell>Presença</TableHeaderCell>
              <TableHeaderCell className="text-right">Ações</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {readings.data?.length ? (
              readings.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(r.readAt)}</TableCell>
                  <TableCell>
                    <p className="text-body-strong">{r.book.title}</p>
                    <p className="text-caption text-text-muted">{r.book.author}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    Presentes {r.presentCount} de {r.classSize}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <IconButton
                        label={`Excluir leitura de ${r.book.title} em ${formatDate(r.readAt)}`}
                        onClick={() => setDeletingReading(r)}
                      >
                        <Trash2 />
                      </IconButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableEmpty colSpan={4}>
                <EmptyState
                  icon={<BookOpen />}
                  title="Nenhuma leitura registrada"
                  message={readings.isError ? "Não foi possível carregar as leituras." : "Use \"Nova leitura\" para registrar um livro lido pela turma."}
                />
              </TableEmpty>
            )}
          </TableBody>
        </Table>
      </Card>

      <ClassReadingModal
        open={reading}
        onClose={() => setReading(false)}
        classId={c.id}
        students={students.map((s) => ({ id: s.id, name: s.name }))}
      />
      <ConfirmDialog
        open={deletingReading !== null}
        title="Excluir leitura"
        message={deletingReading ? `Excluir a leitura de "${deletingReading.book.title}" de ${formatDate(deletingReading.readAt)}? O livro deixa de contar como lido para os alunos que só o leram nela.` : ""}
        loading={delReading.isPending}
        onConfirm={onDeleteReading}
        onCancel={() => setDeletingReading(null)}
      />
      <ClassModal open={editing} onClose={() => setEditing(false)} classRoom={c} />
      {swapping ? <SwapTeacherModal classRoom={c} onClose={() => setSwapping(false)} /> : null}
    </Page>
  );
}
