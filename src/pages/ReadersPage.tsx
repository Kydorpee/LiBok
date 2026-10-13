import { Eye, Pencil, Plus, SearchX, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { paths } from "../app/paths";
import {
  Avatar,
  Badge,
  Card,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Pagination,
  SearchInput,
  Select,
  TabPanel,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeaderCell,
  TableRow,
  Tabs,
  buttonStyles,
  useToast,
} from "../components/ui";
import { toAppError } from "../lib/api";
import type { Student, Teacher } from "../lib/types";
import { useClasses } from "../features/classes/hooks";
import { Page, PageError, TableSkeleton } from "../features/shared/Page";
import { useDeleteStudent, useStudents } from "../features/students/hooks";
import { useDeleteTeacher, useTeachers } from "../features/teachers/hooks";
import { useDebounced } from "../features/useDebounced";
import { usePageClamp } from "../features/usePageClamp";

const PAGE_SIZE = 10;
type Tab = "alunos" | "professores";

export default function ReadersPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("aba") === "professores" ? "professores" : "alunos";

  const [text, setText] = useState("");
  const [classId, setClassId] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [delStudent, setDelStudent] = useState<Student | null>(null);
  const [delTeacher, setDelTeacher] = useState<Teacher | null>(null);

  const debounced = useDebounced(text);
  const students = useStudents({
    text: debounced.trim() || undefined,
    classId: classId ? Number(classId) : undefined,
    overdueOnly: overdueOnly || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const teachers = useTeachers(debounced.trim() || undefined);
  const classes = useClasses({});
  const removeStudent = useDeleteStudent();
  const removeTeacher = useDeleteTeacher();

  function changeTab(v: string) {
    setParams(v === "professores" ? { aba: "professores" } : {});
    setText("");
    setPage(1);
  }

  async function confirmStudent() {
    if (!delStudent) return;
    try {
      await removeStudent.mutateAsync(delStudent.id);
      toast.success("Aluno excluído", delStudent.name);
    } catch (e) {
      toast.error("Não foi possível excluir o aluno", toAppError(e).message);
    }
    setDelStudent(null);
  }
  async function confirmTeacher() {
    if (!delTeacher) return;
    try {
      await removeTeacher.mutateAsync(delTeacher.id);
      toast.success("Professor excluído", delTeacher.name);
    } catch (e) {
      toast.error("Não foi possível excluir o professor", toAppError(e).message);
    }
    setDelTeacher(null);
  }

  const studentPages = students.data ? Math.max(1, Math.ceil(students.data.total / PAGE_SIZE)) : 1;
  const outOfRange = usePageClamp(students.data, page, PAGE_SIZE, setPage);
  const filtered = !!(debounced.trim() || classId || overdueOnly);

  return (
    <Page
      title="Leitores"
      subtitle="Alunos e professores que podem pegar livros emprestados"
      actions={
        <Link to={tab === "alunos" ? paths.newStudent : paths.newTeacher} className={buttonStyles({})}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {tab === "alunos" ? "Novo aluno" : "Novo professor"}
        </Link>
      }
    >
      <Tabs
        aria-label="Tipo de leitor"
        idBase="readers"
        value={tab}
        onChange={changeTab}
        items={[
          { value: "alunos", label: "Alunos", count: students.data?.total },
          { value: "professores", label: "Professores", count: teachers.data?.length },
        ]}
      />

      <div className="flex flex-wrap items-end gap-3">
        <SearchInput
          wrapperClassName="min-w-72 flex-1"
          label="Buscar"
          placeholder={tab === "alunos" ? "Nome ou matrícula" : "Nome do professor"}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPage(1);
          }}
          onClear={() => setText("")}
        />
        {tab === "alunos" ? (
          <>
            <Select
              wrapperClassName="w-56"
              label="Turma"
              placeholder="Todas"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setPage(1);
              }}
              options={(classes.data ?? []).map((c) => ({ value: String(c.id), label: `${c.name} (${c.schoolYear})` }))}
            />
            <Checkbox
              className="pb-2.5"
              label="Só com atraso"
              checked={overdueOnly}
              onChange={(e) => {
                setOverdueOnly(e.target.checked);
                setPage(1);
              }}
            />
          </>
        ) : null}
      </div>

      <TabPanel idBase="readers" value="alunos" active={tab}>
        {students.isError && !students.data ? (
          <PageError error={students.error} onRetry={() => void students.refetch()} />
        ) : (
          <Card flush>
            <Table caption="Alunos">
              <TableHead>
                <TableRow className="h-10 hover:bg-transparent">
                  <TableHeaderCell>Aluno</TableHeaderCell>
                  <TableHeaderCell>Matrícula</TableHeaderCell>
                  <TableHeaderCell>Turma</TableHeaderCell>
                  <TableHeaderCell>Emprestados</TableHeaderCell>
                  <TableHeaderCell>Atrasados</TableHeaderCell>
                  <TableHeaderCell>Lidos</TableHeaderCell>
                  <TableHeaderCell className="text-right">Ações</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {students.isLoading || outOfRange ? (
                  <TableSkeleton colSpan={7} />
                ) : students.data && students.data.items.length === 0 ? (
                  <TableEmpty colSpan={7}>
                    {filtered ? (
                      <EmptyState icon={<SearchX />} title="Nenhum aluno encontrado" message="Ajuste a busca ou os filtros." />
                    ) : (
                      <EmptyState
                        icon={<Users />}
                        title="Nenhum aluno cadastrado"
                        message="Cadastre turmas e alunos para registrar empréstimos."
                        action={
                          <Link to={paths.newStudent} className={buttonStyles({})}>
                            Novo aluno
                          </Link>
                        }
                      />
                    )}
                  </TableEmpty>
                ) : (
                  students.data?.items.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar name={s.name} size="sm" />
                          <Link to={paths.readerSummary("student", s.id)} className="text-body-strong hover:underline">
                            {s.name}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell>{s.registration}</TableCell>
                      <TableCell>{s.classRoom.name}</TableCell>
                      <TableCell>{s.activeLoans}</TableCell>
                      <TableCell>
                        {s.overdueLoans > 0 ? (
                          <span className="font-medium text-text-danger">{s.overdueLoans} em atraso</span>
                        ) : (
                          0
                        )}
                      </TableCell>
                      <TableCell>{s.readCount}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <IconButton label={`Ver resumo de ${s.name}`} onClick={() => navigate(paths.readerSummary("student", s.id))}>
                            <Eye />
                          </IconButton>
                          <IconButton label={`Editar ${s.name}`} onClick={() => navigate(paths.editStudent(s.id))}>
                            <Pencil />
                          </IconButton>
                          <IconButton label={`Excluir ${s.name}`} tone="danger" onClick={() => setDelStudent(s)}>
                            <Trash2 />
                          </IconButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {students.data && students.data.total > 0 ? (
              <Pagination
                className="border-t border-border-default px-4 py-3"
                page={students.data.page}
                pageCount={studentPages}
                total={students.data.total}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            ) : null}
          </Card>
        )}
      </TabPanel>

      <TabPanel idBase="readers" value="professores" active={tab}>
        {teachers.isError && !teachers.data ? (
          <PageError error={teachers.error} onRetry={() => void teachers.refetch()} />
        ) : (
          <Card flush>
            <Table caption="Professores">
              <TableHead>
                <TableRow className="h-10 hover:bg-transparent">
                  <TableHeaderCell>Professor</TableHeaderCell>
                  <TableHeaderCell>Contato</TableHeaderCell>
                  <TableHeaderCell>Turmas</TableHeaderCell>
                  <TableHeaderCell>Emprestados</TableHeaderCell>
                  <TableHeaderCell>Atrasados</TableHeaderCell>
                  <TableHeaderCell>Lidos</TableHeaderCell>
                  <TableHeaderCell className="text-right">Ações</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {teachers.isLoading ? (
                  <TableSkeleton colSpan={7} />
                ) : teachers.data && teachers.data.length === 0 ? (
                  <TableEmpty colSpan={7}>
                    <EmptyState
                      icon={filtered ? <SearchX /> : <Users />}
                      title={filtered ? "Nenhum professor encontrado" : "Nenhum professor cadastrado"}
                    />
                  </TableEmpty>
                ) : (
                  teachers.data?.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar name={t.name} size="sm" />
                          <Link to={paths.readerSummary("teacher", t.id)} className="text-body-strong hover:underline">
                            {t.name}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell>{t.contact ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {t.classes.length ? t.classes.map((c) => <Badge key={c.id} variant="code">{c.name}</Badge>) : "—"}
                        </div>
                      </TableCell>
                      <TableCell>{t.activeLoans}</TableCell>
                      <TableCell>
                        {t.overdueLoans > 0 ? (
                          <span className="font-medium text-text-danger">{t.overdueLoans} em atraso</span>
                        ) : (
                          0
                        )}
                      </TableCell>
                      <TableCell>{t.readCount}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <IconButton label={`Ver resumo de ${t.name}`} onClick={() => navigate(paths.readerSummary("teacher", t.id))}>
                            <Eye />
                          </IconButton>
                          <IconButton label={`Editar ${t.name}`} onClick={() => navigate(paths.editTeacher(t.id))}>
                            <Pencil />
                          </IconButton>
                          <IconButton label={`Excluir ${t.name}`} tone="danger" onClick={() => setDelTeacher(t)}>
                            <Trash2 />
                          </IconButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        )}
      </TabPanel>

      <ConfirmDialog
        open={!!delStudent}
        title="Excluir aluno"
        message={delStudent ? `Excluir ${delStudent.name}? O histórico de empréstimos do aluno também será apagado.` : ""}
        loading={removeStudent.isPending}
        onConfirm={confirmStudent}
        onCancel={() => setDelStudent(null)}
      />
      <ConfirmDialog
        open={!!delTeacher}
        title="Excluir professor"
        message={delTeacher ? `Excluir ${delTeacher.name}? O histórico de empréstimos do professor também será apagado.` : ""}
        loading={removeTeacher.isPending}
        onConfirm={confirmTeacher}
        onCancel={() => setDelTeacher(null)}
      />
    </Page>
  );
}
