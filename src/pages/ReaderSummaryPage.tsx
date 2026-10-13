import { ArrowLeftRight, BookCheck, BookUp, ClockAlert, Pencil } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { paths, slugToKind } from "../app/paths";
import {
  Avatar,
  Badge,
  Button,
  buttonStyles,
  Card,
  CardHeader,
  EmptyState,
  ReaderBadge,
  Skeleton,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../components/ui";
import { formatDate } from "../lib/dates";
import type { Loan } from "../lib/types";
import { LoanModal } from "../features/loans/LoanModal";
import { ActiveLoanRow, LoanStatusBadge } from "../features/loans/LoanTables";
import { ReturnModal } from "../features/loans/ReturnModal";
import { useReaderSummary } from "../features/readers/hooks";
import { Page, PageError } from "../features/shared/Page";

export default function ReaderSummaryPage() {
  const { kind: slug, id: idParam } = useParams();
  const kind = slugToKind(slug);
  const id = Number(idParam);
  const q = useReaderSummary(kind, id);
  const [lending, setLending] = useState(false);
  const [returning, setReturning] = useState<Loan | null>(null);

  if (!kind) {
    return (
      <Page title="Leitor">
        <PageError error={{ code: "NOT_FOUND", message: "Tipo de leitor inválido." }} />
      </Page>
    );
  }
  if (q.isError && !q.data) {
    return (
      <Page title="Leitor" breadcrumb={[{ label: "Leitores", href: paths.readers() }, { label: "Resumo" }]}>
        <PageError error={q.error} onRetry={() => void q.refetch()} />
      </Page>
    );
  }
  if (!q.data) {
    return (
      <Page title="Leitor">
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </Page>
    );
  }

  const { reader, student, teacher, activeLoans, history, readings, counts } = q.data;
  const tab = kind === "student" ? "alunos" : "professores";
  const editPath = kind === "student" ? paths.editStudent(id) : paths.editTeacher(id);

  return (
    <Page
      title={reader.name}
      breadcrumb={[{ label: "Leitores", href: paths.readers(tab) }, { label: reader.name }]}
      actions={
        <>
          <Link to={editPath} className={buttonStyles({ variant: "secondary" })}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Editar
          </Link>
          <Button icon={<BookUp />} onClick={() => setLending(true)}>
            Novo empréstimo
          </Button>
        </>
      }
    >
      <Card className="flex flex-wrap items-center gap-5">
        <Avatar name={reader.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-subtitle">{reader.name}</p>
            <ReaderBadge type={kind} />
          </div>
          <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-body text-text-muted">
            {student ? (
              <>
                <div className="flex gap-1">
                  <dt>Matrícula:</dt>
                  <dd className="text-text-primary">{student.registration}</dd>
                </div>
                <div className="flex gap-1">
                  <dt>Turma:</dt>
                  <dd className="text-text-primary">
                    <Link to={paths.classDetail(student.classRoom.id)} className="hover:underline">
                      {student.classRoom.name}
                    </Link>{" "}
                    · {student.classRoom.teacher.name}
                  </dd>
                </div>
                {student.guardian ? (
                  <div className="flex gap-1">
                    <dt>Responsável:</dt>
                    <dd className="text-text-primary">{student.guardian}</dd>
                  </div>
                ) : null}
                {student.contact ? (
                  <div className="flex gap-1">
                    <dt>Contato:</dt>
                    <dd className="text-text-primary">{student.contact}</dd>
                  </div>
                ) : null}
              </>
            ) : null}
            {teacher ? (
              <>
                {teacher.contact ? (
                  <div className="flex gap-1">
                    <dt>Contato:</dt>
                    <dd className="text-text-primary">{teacher.contact}</dd>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-1">
                  <dt>Turmas:</dt>
                  <dd className="flex gap-1">
                    {teacher.classes.length
                      ? teacher.classes.map((c) => (
                          <Link key={c.id} to={paths.classDetail(c.id)}>
                            <Badge variant="code">{c.name}</Badge>
                          </Link>
                        ))
                      : "—"}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
          {student?.notes ? <p className="mt-2 text-body text-text-muted">{student.notes}</p> : null}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Emprestados agora" value={counts.active} icon={<ArrowLeftRight />} />
        <StatCard label="Atrasados" value={counts.overdue} icon={<ClockAlert />} />
        <StatCard label="Livros lidos" value={counts.read} icon={<BookCheck />} />
      </div>

      <Card flush>
        <CardHeader className="px-6 pt-6" title="Empréstimos ativos" />
        <Table caption="Empréstimos ativos">
          <TableHead>
            <TableRow className="h-10 hover:bg-transparent">
              <TableHeaderCell>Livro</TableHeaderCell>
              <TableHeaderCell>Código</TableHeaderCell>
              <TableHeaderCell>Emprestado em</TableHeaderCell>
              <TableHeaderCell>Devolver até</TableHeaderCell>
              <TableHeaderCell>Situação</TableHeaderCell>
              <TableHeaderCell className="text-right">Ação</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {activeLoans.length === 0 ? (
              <TableEmpty colSpan={6}>
                <EmptyState title="Nenhum empréstimo ativo" message="Este leitor não está com livros no momento." />
              </TableEmpty>
            ) : (
              activeLoans.map((l) => <ActiveLoanRow key={l.id} loan={l} onReturn={setReturning} />)
            )}
          </TableBody>
        </Table>
      </Card>

      <Card flush>
        <CardHeader className="px-6 pt-6" title="Histórico" description="Livros já devolvidos" />
        <Table caption="Histórico de empréstimos">
          <TableHead>
            <TableRow className="h-10 hover:bg-transparent">
              <TableHeaderCell>Livro</TableHeaderCell>
              <TableHeaderCell>Código</TableHeaderCell>
              <TableHeaderCell>Emprestado em</TableHeaderCell>
              <TableHeaderCell>Devolvido em</TableHeaderCell>
              <TableHeaderCell>Situação</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {history.length === 0 ? (
              <TableEmpty colSpan={5}>
                <EmptyState title="Sem histórico" message="Ainda não há devoluções registradas." />
              </TableEmpty>
            ) : (
              history.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <p className="text-body-strong">{l.book.title}</p>
                    <p className="text-caption text-text-muted">{l.book.author}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="code">{l.code}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(l.loanedAt)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(l.returnedAt)}</TableCell>
                  <TableCell>
                    <LoanStatusBadge loan={l} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {kind === "student" ? (
        <Card flush>
          <CardHeader className="px-6 pt-6" title="Leituras em turma" description="Livros lidos coletivamente com a turma" />
          <Table caption="Leituras em turma">
            <TableHead>
              <TableRow className="h-10 hover:bg-transparent">
                <TableHeaderCell>Livro</TableHeaderCell>
                <TableHeaderCell>Turma</TableHeaderCell>
                <TableHeaderCell>Data da leitura</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {readings.length === 0 ? (
                <TableEmpty colSpan={3}>
                  <EmptyState title="Sem leituras em turma" message="Nenhuma leitura coletiva registrada para este aluno." />
                </TableEmpty>
              ) : (
                readings.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <p className="text-body-strong">{r.book.title}</p>
                      <p className="text-caption text-text-muted">{r.book.author}</p>
                    </TableCell>
                    <TableCell>{r.classRoom.name}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(r.readAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      ) : null}

      <LoanModal
        open={lending}
        onClose={() => setLending(false)}
        reader={{ kind, id, name: reader.name }}
      />
      <ReturnModal loan={returning} onClose={() => setReturning(null)} />
    </Page>
  );
}
