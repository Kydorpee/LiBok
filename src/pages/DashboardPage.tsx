import { ArrowLeftRight, BookCopy, BookOpen, ClockAlert } from "lucide-react";
import { Link } from "react-router";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { paths } from "../app/paths";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Skeleton,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../components/ui";
import { formatTimestampDate } from "../lib/dates";
import { useStats } from "../features/stats/hooks";
import { Page, PageError } from "../features/shared/Page";

export default function DashboardPage() {
  const q = useStats();

  if (q.isError && !q.data) {
    return (
      <Page title="Dashboard">
        <PageError error={q.error} onRetry={() => void q.refetch()} />
      </Page>
    );
  }
  const s = q.data;
  const total = s?.byCategory.reduce((n, c) => n + c.bookCount, 0) ?? 0;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <Page title="Dashboard" subtitle="Visão geral da biblioteca">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {s ? (
          <>
            <StatCard label="Livros (títulos)" value={s.totalBooks} icon={<BookOpen />} />
            <StatCard label="Exemplares" value={s.totalCopies} icon={<BookCopy />} />
            <StatCard
              label="Empréstimos ativos"
              value={s.activeLoans}
              detail={<Link to={paths.loans} className="text-text-link hover:underline">Ver empréstimos</Link>}
              icon={<ArrowLeftRight />}
            />
            <StatCard
              label="Atrasados"
              value={s.overdueLoans}
              detail={s.overdueLoans ? "Devoluções em atraso" : "Nenhum atraso"}
              icon={<ClockAlert />}
            />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Livros por categoria" description="Quantidade de títulos e participação" />
          {!s ? (
            <Skeleton className="h-56" />
          ) : s.byCategory.length === 0 ? (
            <EmptyState icon={<BookOpen />} title="Sem dados" message="Cadastre livros para ver o gráfico." />
          ) : (
            <div className="flex flex-wrap items-center gap-6">
              <div
                role="img"
                aria-label={`Gráfico de rosca: ${s.byCategory.map((c) => `${c.name} ${c.bookCount}`).join(", ")}`}
                className="relative h-52 w-52 shrink-0"
              >
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={s.byCategory}
                      dataKey="bookCount"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={96}
                      paddingAngle={2}
                      stroke="none"
                      isAnimationActive={false}
                    >
                      {s.byCategory.map((c) => (
                        <Cell key={c.id} fill={c.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-title">{total}</span>
                  <span className="text-caption text-text-muted">títulos</span>
                </div>
              </div>
              <ul className="min-w-48 flex-1 space-y-2">
                {s.byCategory.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-body">
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 shrink-0 rounded-full border border-border-strong"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="flex-1">{c.name}</span>
                    <span className="text-body-strong">{c.bookCount}</span>
                    <span className="w-12 text-right text-text-muted">{pct(c.bookCount)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card flush>
          <CardHeader className="px-6 pt-6" title="Últimos cadastrados" />
          <Table caption="Últimos livros cadastrados">
            <TableHead>
              <TableRow className="h-10 hover:bg-transparent">
                <TableHeaderCell>Título</TableHeaderCell>
                <TableHeaderCell>Categoria</TableHeaderCell>
                <TableHeaderCell>Cadastro</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {s ? (
                s.recent.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link to={paths.editBook(b.id)} className="text-body-strong hover:underline">
                        {b.title}
                      </Link>
                      <p className="text-caption text-text-muted">{b.author}</p>
                    </TableCell>
                    <TableCell>
                      <Badge color={b.category.color}>{b.category.name}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatTimestampDate(b.createdAt)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </Page>
  );
}
