import { ArrowLeftRight, BookUp, SearchX, Undo2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { paths } from "../app/paths";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Pagination,
  ReaderBadge,
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
} from "../components/ui";
import { formatDate } from "../lib/dates";
import type { Loan, LoanQuery, ReaderKind } from "../lib/types";
import { useLoans } from "../features/loans/hooks";
import { LoanModal } from "../features/loans/LoanModal";
import { DueCell, LoanStatusBadge } from "../features/loans/LoanTables";
import { ReturnModal } from "../features/loans/ReturnModal";
import { Page, PageError, TableSkeleton } from "../features/shared/Page";
import { useDebounced } from "../features/useDebounced";
import { usePageClamp } from "../features/usePageClamp";

const PAGE_SIZE = 10;
type Tab = NonNullable<LoanQuery["status"]>;

export default function LoansPage() {
  const [tab, setTab] = useState<Tab>("active");
  const [text, setText] = useState("");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const [lending, setLending] = useState(false);
  const [returning, setReturning] = useState<Loan | null>(null);

  const debounced = useDebounced(text);
  const loans = useLoans({
    status: tab,
    text: debounced.trim() || undefined,
    readerKind: (kind || undefined) as ReaderKind | undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const counts = loans.data?.counts;
  const pageCount = loans.data ? Math.max(1, Math.ceil(loans.data.total / PAGE_SIZE)) : 1;
  const outOfRange = usePageClamp(loans.data, page, PAGE_SIZE, setPage);
  const filtered = !!(debounced.trim() || kind);

  function changeTab(v: string) {
    setTab(v as Tab);
    setPage(1);
  }

  return (
    <Page
      title="Empréstimos"
      subtitle="Acompanhe os livros emprestados e registre devoluções"
      actions={
        <Button icon={<BookUp />} onClick={() => setLending(true)}>
          Novo empréstimo
        </Button>
      }
    >
      <Tabs
        aria-label="Situação dos empréstimos"
        idBase="loans"
        value={tab}
        onChange={changeTab}
        items={[
          { value: "active", label: "Ativos", count: counts?.active },
          { value: "overdue", label: "Atrasados", count: counts?.overdue },
          { value: "returned", label: "Devolvidos", count: counts?.returned },
          { value: "all", label: "Todos", count: counts?.all },
        ]}
      />
      <div className="flex flex-wrap items-end gap-3">
        <SearchInput
          wrapperClassName="min-w-72 flex-1"
          label="Buscar"
          placeholder="Livro, código ou leitor"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPage(1);
          }}
          onClear={() => setText("")}
        />
        <Select
          wrapperClassName="w-48"
          label="Leitor"
          placeholder="Todos"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "student", label: "Alunos" },
            { value: "teacher", label: "Professores" },
          ]}
        />
      </div>

      <TabPanel idBase="loans" value={tab} active={tab}>
        {loans.isError && !loans.data ? (
          <PageError error={loans.error} onRetry={() => void loans.refetch()} />
        ) : (
          <Card flush>
            <Table caption="Empréstimos">
              <TableHead>
                <TableRow className="h-10 hover:bg-transparent">
                  <TableHeaderCell>Livro</TableHeaderCell>
                  <TableHeaderCell>Código</TableHeaderCell>
                  <TableHeaderCell>Leitor</TableHeaderCell>
                  <TableHeaderCell>Emprestado em</TableHeaderCell>
                  <TableHeaderCell>{tab === "returned" ? "Devolvido em" : "Devolver até"}</TableHeaderCell>
                  <TableHeaderCell>Situação</TableHeaderCell>
                  <TableHeaderCell className="text-right">Ação</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loans.isLoading || outOfRange ? (
                  <TableSkeleton colSpan={7} />
                ) : loans.data && loans.data.items.length === 0 ? (
                  <TableEmpty colSpan={7}>
                    {filtered ? (
                      <EmptyState icon={<SearchX />} title="Nenhum empréstimo encontrado" message="Ajuste a busca ou os filtros." />
                    ) : (
                      <EmptyState
                        icon={<ArrowLeftRight />}
                        title="Nenhum empréstimo nesta aba"
                        message="Os empréstimos registrados aparecerão aqui."
                      />
                    )}
                  </TableEmpty>
                ) : (
                  loans.data?.items.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <p className="text-body-strong">{l.book.title}</p>
                        <p className="text-caption text-text-muted">{l.book.author}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="code">{l.code}</Badge>
                      </TableCell>
                      <TableCell>
                        <Link to={paths.readerSummary(l.reader.kind, l.reader.id)} className="text-body-strong hover:underline">
                          {l.reader.name}
                        </Link>
                        <div className="mt-0.5 flex items-center gap-2">
                          <ReaderBadge type={l.reader.kind} />
                          {l.reader.classLabel ? (
                            <span className="text-caption text-text-muted">{l.reader.classLabel}</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(l.loanedAt)}</TableCell>
                      {l.returnedAt ? (
                        <TableCell className="whitespace-nowrap">{formatDate(l.returnedAt)}</TableCell>
                      ) : (
                        <DueCell loan={l} />
                      )}
                      <TableCell>
                        <LoanStatusBadge loan={l} />
                      </TableCell>
                      <TableCell className="text-right">
                        {l.status !== "returned" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={<Undo2 />}
                            aria-label={`Devolver ${l.code} (${l.book.title})`}
                            onClick={() => setReturning(l)}
                          >
                            Devolver
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {loans.data && loans.data.total > 0 ? (
              <Pagination
                className="border-t border-border-default px-4 py-3"
                page={loans.data.page}
                pageCount={pageCount}
                total={loans.data.total}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            ) : null}
          </Card>
        )}
      </TabPanel>

      <LoanModal open={lending} onClose={() => setLending(false)} />
      <ReturnModal loan={returning} onClose={() => setReturning(null)} />
    </Page>
  );
}
