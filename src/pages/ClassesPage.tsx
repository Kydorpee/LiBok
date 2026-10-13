import { AlertTriangle, GraduationCap, Plus, School, SearchX, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { paths } from "../app/paths";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  SearchInput,
  Select,
  Skeleton,
} from "../components/ui";
import type { Shift } from "../lib/types";
import { useClasses } from "../features/classes/hooks";
import { ClassModal } from "../features/classes/ClassModal";
import { SHIFT_LABELS, SHIFTS } from "../features/classes/schema";
import { Page, PageError } from "../features/shared/Page";
import { useDebounced } from "../features/useDebounced";

export default function ClassesPage() {
  const [text, setText] = useState("");
  const [year, setYear] = useState("");
  const [shift, setShift] = useState("");
  const [creating, setCreating] = useState(false);
  const debounced = useDebounced(text);

  const all = useClasses({});
  const list = useClasses({
    text: debounced.trim() || undefined,
    schoolYear: year ? Number(year) : undefined,
    shift: (shift || undefined) as Shift | undefined,
  });
  const years = [...new Set((all.data ?? []).map((c) => c.schoolYear))].sort((a, b) => b - a);
  const filtered = !!(debounced.trim() || year || shift);

  return (
    <Page
      title="Turmas"
      subtitle="Turmas, professores responsáveis e alunos"
      actions={
        <Button icon={<Plus />} onClick={() => setCreating(true)}>
          Nova turma
        </Button>
      }
    >
      <div className="flex flex-wrap items-end gap-3">
        <SearchInput
          wrapperClassName="min-w-72 flex-1"
          label="Buscar"
          placeholder="Nome da turma ou professor"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onClear={() => setText("")}
        />
        <Select
          wrapperClassName="w-44"
          label="Ano letivo"
          placeholder="Todos"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
        />
        <Select
          wrapperClassName="w-44"
          label="Turno"
          placeholder="Todos"
          value={shift}
          onChange={(e) => setShift(e.target.value)}
          options={SHIFTS.map((s) => ({ value: s, label: SHIFT_LABELS[s] }))}
        />
      </div>

      {list.isError && !list.data ? (
        <PageError error={list.error} onRetry={() => void list.refetch()} />
      ) : list.isLoading ? (
        <div aria-busy="true" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : list.data && list.data.length === 0 ? (
        <Card>
          {filtered ? (
            <EmptyState icon={<SearchX />} title="Nenhuma turma encontrada" message="Ajuste a busca ou os filtros." />
          ) : (
            <EmptyState
              icon={<School />}
              title="Nenhuma turma cadastrada"
              message="Cadastre a primeira turma para começar a registrar alunos."
              action={
                <Button icon={<Plus />} onClick={() => setCreating(true)}>
                  Nova turma
                </Button>
              }
            />
          )}
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.data?.map((c) => (
            <li key={c.id}>
              <Link
                to={paths.classDetail(c.id)}
                className="block h-full rounded-lg border border-border-default bg-bg-surface p-5 transition-colors hover:bg-bg-hover"
              >
                <h2 className="text-subtitle">{c.name}</h2>
                <p className="text-body text-text-muted">
                  {c.schoolYear} · {SHIFT_LABELS[c.shift]}
                </p>
                <p className="mt-3 flex items-center gap-2 text-body">
                  <GraduationCap className="h-4 w-4 text-text-muted" aria-hidden="true" />
                  {c.teacher.name}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="code">
                    <Users className="h-3 w-3" aria-hidden="true" />
                    {c.studentCount} {c.studentCount === 1 ? "aluno" : "alunos"}
                  </Badge>
                  <Badge variant="code">
                    {c.activeLoans} {c.activeLoans === 1 ? "empréstimo" : "empréstimos"}
                  </Badge>
                  {c.overdueLoans > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-feedback-danger bg-feedback-danger-bg px-2.5 py-0.5 text-caption font-medium text-text-danger">
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      {c.overdueLoans} {c.overdueLoans === 1 ? "atrasado" : "atrasados"}
                    </span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <ClassModal open={creating} onClose={() => setCreating(false)} />
    </Page>
  );
}
