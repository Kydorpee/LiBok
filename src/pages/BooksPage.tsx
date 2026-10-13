import { BookUp, Library, Pencil, Plus, SearchX, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { paths } from "../app/paths";
import {
  Badge,
  Button,
  buttonStyles,
  Card,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Pagination,
  SearchInput,
  Select,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeaderCell,
  TableRow,
  useToast,
  type SortDirection,
} from "../components/ui";
import { toAppError } from "../lib/api";
import { formatTimestampDate } from "../lib/dates";
import type { Book, BookQuery } from "../lib/types";
import { useBooks, useDeleteBook } from "../features/books/hooks";
import { useCategories } from "../features/categories/hooks";
import { LoanModal } from "../features/loans/LoanModal";
import { Page, PageError, TableSkeleton } from "../features/shared/Page";
import { useDebounced } from "../features/useDebounced";
import { usePageClamp } from "../features/usePageClamp";

const PAGE_SIZE = 10;
type SortKey = NonNullable<BookQuery["sort"]>;

export default function BooksPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [availability, setAvailability] = useState<NonNullable<BookQuery["availability"]>>("all");
  const [sort, setSort] = useState<SortKey>("title");
  const [dir, setDir] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<Book | null>(null);
  const [lending, setLending] = useState<Book | null>(null);

  const debounced = useDebounced(text, 250);
  const query: BookQuery = {
    text: debounced.trim() || undefined,
    categoryId: categoryId ? Number(categoryId) : undefined,
    availability,
    sort,
    dir,
    page,
    pageSize: PAGE_SIZE,
  };
  const books = useBooks(query);
  const categories = useCategories();
  const del = useDeleteBook();

  const outOfRange = usePageClamp(books.data, page, PAGE_SIZE, setPage);
  const filtered = !!(query.text || query.categoryId || availability !== "all");
  const pageCount = books.data ? Math.max(1, Math.ceil(books.data.total / PAGE_SIZE)) : 1;

  function toggleSort(key: SortKey) {
    if (sort === key) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSort(key);
      setDir("asc");
    }
    setPage(1);
  }
  const dirOf = (key: SortKey) => (sort === key ? dir : null);

  function clearFilters() {
    setText("");
    setCategoryId("");
    setAvailability("all");
    setPage(1);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete.id);
      toast.success("Livro excluído", toDelete.title);
    } catch (e) {
      toast.error("Não foi possível excluir", toAppError(e).message);
    }
    setToDelete(null);
  }

  return (
    <Page
      title="Acervo"
      subtitle={books.data ? `${books.data.total} ${books.data.total === 1 ? "título" : "títulos"}` : "Pesquise e gerencie os livros"}
      actions={
        <Link to={paths.newBook} className={buttonStyles({})}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Cadastrar livro
        </Link>
      }
    >
      <div className="flex flex-wrap items-end gap-3">
        <SearchInput
          wrapperClassName="min-w-72 flex-1"
          label="Buscar"
          placeholder="Título, autor, categoria, assunto ou código"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPage(1);
          }}
          onClear={() => setText("")}
        />
        <Select
          wrapperClassName="w-52"
          label="Categoria"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
          placeholder="Todas"
          options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
        />
        <Select
          wrapperClassName="w-52"
          label="Disponibilidade"
          value={availability}
          onChange={(e) => {
            setAvailability(e.target.value as typeof availability);
            setPage(1);
          }}
          options={[
            { value: "all", label: "Todos" },
            { value: "available", label: "Com exemplar disponível" },
            { value: "unavailable", label: "Todos emprestados" },
          ]}
        />
      </div>

      {books.isError && !books.data ? (
        <PageError error={books.error} onRetry={() => void books.refetch()} />
      ) : (
        <Card flush>
          <Table caption="Livros do acervo">
            <TableHead>
              <TableRow className="h-10 hover:bg-transparent">
                <TableHeaderCell sortable sortDirection={dirOf("title")} onSort={() => toggleSort("title")}>
                  Título
                </TableHeaderCell>
                <TableHeaderCell sortable sortDirection={dirOf("author")} onSort={() => toggleSort("author")}>
                  Autor
                </TableHeaderCell>
                <TableHeaderCell>Categoria</TableHeaderCell>
                <TableHeaderCell>Assunto</TableHeaderCell>
                <TableHeaderCell sortable sortDirection={dirOf("createdAt")} onSort={() => toggleSort("createdAt")}>
                  Cadastro
                </TableHeaderCell>
                <TableHeaderCell>Disponíveis</TableHeaderCell>
                <TableHeaderCell className="text-right">Ações</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {books.isLoading || outOfRange ? (
                <TableSkeleton colSpan={7} />
              ) : books.data && books.data.items.length === 0 ? (
                <TableEmpty colSpan={7}>
                  {filtered ? (
                    <EmptyState
                      icon={<SearchX />}
                      title="Nenhum livro encontrado"
                      message="Tente outro termo de busca ou limpe os filtros."
                      action={
                        <Button variant="secondary" onClick={clearFilters}>
                          Limpar filtros
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={<Library />}
                      title="O acervo está vazio"
                      message="Cadastre o primeiro livro ou importe uma planilha CSV."
                      action={
                        <Link to={paths.newBook} className={buttonStyles({})}>
                          Cadastrar livro
                        </Link>
                      }
                    />
                  )}
                </TableEmpty>
              ) : (
                books.data?.items.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="max-w-72">
                      <p className="text-body-strong">{b.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {b.codes.slice(0, 3).map((c) => (
                          <Badge key={c} variant="code">
                            {c}
                          </Badge>
                        ))}
                        {b.codes.length > 3 ? <Badge variant="code">+{b.codes.length - 3}</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>{b.author}</TableCell>
                    <TableCell>
                      <Badge color={b.category.color}>{b.category.name}</Badge>
                    </TableCell>
                    <TableCell>{b.subject}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatTimestampDate(b.createdAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <p className="text-body-strong">
                        {b.availableCount} de {b.quantity}
                      </p>
                      <p className="text-caption text-text-muted">
                        {b.availableCount === 0 ? "todos emprestados" : "disponível"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<BookUp />}
                          aria-label={`Emprestar ${b.title}`}
                          onClick={() => setLending(b)}
                        >
                          Emprestar
                        </Button>
                        <IconButton label={`Editar ${b.title}`} onClick={() => navigate(paths.editBook(b.id))}>
                          <Pencil />
                        </IconButton>
                        <IconButton label={`Excluir ${b.title}`} tone="danger" onClick={() => setToDelete(b)}>
                          <Trash2 />
                        </IconButton>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {books.data && books.data.total > 0 ? (
            <Pagination
              className="border-t border-border-default px-4 py-3"
              page={books.data.page}
              pageCount={pageCount}
              total={books.data.total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          ) : null}
        </Card>
      )}

      <LoanModal
        open={!!lending}
        onClose={() => setLending(null)}
        book={lending ? { id: lending.id, title: lending.title } : undefined}
      />
      <ConfirmDialog
        open={!!toDelete}
        title="Excluir livro"
        message={toDelete ? `Excluir "${toDelete.title}" e seus ${toDelete.quantity} exemplar(es)? Esta ação não pode ser desfeita.` : ""}
        loading={del.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </Page>
  );
}
