import { useParams } from "react-router";
import { paths } from "../app/paths";
import { Skeleton } from "../components/ui";
import { BookForm } from "../features/books/BookForm";
import { useBook } from "../features/books/hooks";
import { Page, PageError } from "../features/shared/Page";

export default function EditBookPage() {
  const id = Number(useParams().id);
  const q = useBook(id);
  if (q.isError) {
    return (
      <Page title="Editar livro" breadcrumb={[{ label: "Acervo", href: paths.books }, { label: "Editar" }]}>
        <PageError error={q.error} onRetry={() => void q.refetch()} />
      </Page>
    );
  }
  if (!q.data) {
    return (
      <Page title="Editar livro">
        <div aria-busy="true" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </Page>
    );
  }
  // key: reinicia o formulário ao trocar de livro
  return <BookForm key={q.data.id} book={q.data} />;
}
