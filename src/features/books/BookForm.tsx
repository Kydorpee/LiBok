import { zodResolver } from "@hookform/resolvers/zod";
import { BookUp, Plus, Save, Trash2, Eraser } from "lucide-react";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router";
import { paths } from "../../app/paths";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  IconButton,
  Input,
  Select,
  StatusBadge,
  useToast,
} from "../../components/ui";
import { formatDate } from "../../lib/dates";
import type { Book } from "../../lib/types";
import { useCategories } from "../categories/hooks";
import { QuickCategoryModal } from "../categories/QuickCategoryModal";
import { applyAppError, collectErrors } from "../formErrors";
import { LoanModal } from "../loans/LoanModal";
import { toBadgeStatus } from "../loans/status";
import { useCopyStatus } from "../loans/hooks";
import { FormErrorSummary, Page } from "../shared/Page";
import { useCreateBook, useDeleteBook, useUpdateBook } from "./hooks";
import {
  bookSchema,
  bookToForm,
  emptyBookForm,
  formToBookInput,
  type BookFormOutput,
  type BookFormValues,
} from "./schema";

const FIELDS = ["title", "author", "subject", "categoryId", "codes"];
// "codes.2" (backend) -> "codes.2.value" (formulário)
const mapField = (f: string) => (/^codes\.\d+$/.test(f) ? `${f}.value` : f);

export function BookForm({ book }: { book?: Book }) {
  const editing = !!book;
  const toast = useToast();
  const navigate = useNavigate();
  const categories = useCategories();
  const create = useCreateBook();
  const update = useUpdateBook();
  const del = useDeleteBook();
  const copyStatus = useCopyStatus(book?.id);

  const [newCategory, setNewCategory] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lending, setLending] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setFocus,
    setValue,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<BookFormValues, unknown, BookFormOutput>({
    resolver: zodResolver(bookSchema),
    defaultValues: book ? bookToForm(book) : emptyBookForm(),
  });
  const { fields, append, remove } = useFieldArray({ control, name: "codes" });
  const codes = useWatch({ control, name: "codes" });

  const statusByCode = new Map((copyStatus.data ?? []).map((c) => [c.code.trim().toLowerCase(), c]));
  const statusOf = (code: string) => statusByCode.get(code.trim().toLowerCase());
  const isLoaned = (code: string) => {
    const s = statusOf(code)?.status;
    return s === "loaned" || s === "overdue";
  };


  function addCode() {
    append({ value: "" }, { shouldFocus: true });
  }

  async function onSubmit(values: BookFormOutput) {
    const input = formToBookInput(values);
    try {
      if (book) {
        const saved = await update.mutateAsync({ id: book.id, input });
        toast.success("Livro atualizado", saved.title);
        reset(bookToForm(saved));
      } else {
        const saved = await create.mutateAsync(input);
        toast.success("Livro cadastrado", saved.title);
        reset(emptyBookForm());
        setFocus("title");
      }
    } catch (e) {
      const err = applyAppError(e, setError, { fields: FIELDS, mapField });
      toast.error("Não foi possível salvar", err.message);
    }
  }

  async function onDelete() {
    if (!book) return;
    try {
      await del.mutateAsync(book.id);
      toast.success("Livro excluído", book.title);
      navigate(paths.books);
    } catch (e) {
      const err = applyAppError(e, setError);
      toast.error("Não foi possível excluir", err.message);
      setConfirmDelete(false);
    }
  }

  const summary = submitCount > 0 ? collectErrors(errors) : [];
  const count = codes?.filter((c) => c.value.trim()).length ?? 0;
  const saving = isSubmitting || create.isPending || update.isPending;

  const actions = editing ? (
    <>
      <Button variant="secondary" icon={<BookUp />} onClick={() => setLending(true)}>
        Emprestar
      </Button>
      <Button variant="danger" icon={<Trash2 />} onClick={() => setConfirmDelete(true)}>
        Excluir livro
      </Button>
      <Button type="submit" form="book-form" icon={<Save />} loading={saving}>
        Salvar
      </Button>
    </>
  ) : (
    <>
      <Button variant="secondary" icon={<Eraser />} onClick={() => reset(emptyBookForm())}>
        Limpar
      </Button>
      <Button type="submit" form="book-form" icon={<Save />} loading={saving}>
        Salvar
      </Button>
    </>
  );

  return (
    <Page
      title={editing ? "Editar livro" : "Cadastrar livro"}
      subtitle={editing ? book.title : "Preencha os dados e os códigos de registro dos exemplares."}
      breadcrumb={editing ? [{ label: "Acervo", href: paths.books }, { label: book.title }] : undefined}
      actions={actions}
    >
      <form id="book-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        <FormErrorSummary messages={summary.length ? summary : errors.root?.server?.message ? [errors.root.server.message] : []} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Dados do livro" />
            <div className="flex flex-col gap-4">
              <Input
                label="Título *"
                error={errors.title?.message}
                {...register("title")}
              />
              <Input label="Autor *" error={errors.author?.message} {...register("author")} />
              <Input label="Assunto *" error={errors.subject?.message} {...register("subject")} />
              <div className="flex items-end gap-2">
                <Select
                  wrapperClassName="flex-1"
                  label="Categoria *"
                  placeholder="Selecione"
                  error={errors.categoryId?.message}
                  options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
                  {...register("categoryId", { setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)) })}
                />
                <Button variant="secondary" icon={<Plus />} onClick={() => setNewCategory(true)}>
                  Nova categoria
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Exemplares"
              description="Um código de registro por exemplar. Enter adiciona outro."
              actions={<Badge variant="count">{count} {count === 1 ? "exemplar" : "exemplares"}</Badge>}
            />
            <ul className="flex flex-col gap-3">
              {fields.map((field, i) => {
                const value = codes?.[i]?.value ?? "";
                const loaned = editing && isLoaned(value);
                const st = editing ? statusOf(value) : undefined;
                const reg = register(`codes.${i}.value` as const);
                return (
                  <li key={field.id} className="flex items-start gap-2">
                    <Input
                      wrapperClassName="flex-1"
                      aria-label={`Código do exemplar ${i + 1}`}
                      placeholder="Ex.: REG-0001"
                      readOnly={loaned}
                      error={errors.codes?.[i]?.value?.message}
                      {...reg}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (e.currentTarget.value.trim()) addCode();
                        }
                      }}
                    />
                    {st ? (
                      <div className="flex h-control flex-col justify-center">
                        <StatusBadge
                          status={toBadgeStatus(st.status)}
                          detail={
                            st.loan ? `${st.loan.reader.name} até ${formatDate(st.loan.dueAt)}` : undefined
                          }
                        />
                      </div>
                    ) : null}
                    {loaned ? null : (
                      <IconButton
                        label={`Remover exemplar ${i + 1}`}
                        tone="danger"
                        className="mt-1"
                        disabled={fields.length === 1}
                        onClick={() => remove(i)}
                      >
                        <Trash2 />
                      </IconButton>
                    )}
                  </li>
                );
              })}
            </ul>
            {errors.codes?.message || errors.codes?.root?.message ? (
              <p className="mt-2 text-caption text-text-danger">
                {errors.codes?.message ?? errors.codes?.root?.message}
              </p>
            ) : null}
            <Button variant="secondary" size="sm" icon={<Plus />} className="mt-4" onClick={addCode}>
              Adicionar exemplar
            </Button>
            {editing ? (
              <p className="mt-4 text-caption text-text-muted">
                Códigos emprestados não podem ser removidos nem renomeados até a devolução.
              </p>
            ) : null}
          </Card>
        </div>
      </form>

      <QuickCategoryModal
        open={newCategory}
        onClose={() => setNewCategory(false)}
        onCreated={(c) => setValue("categoryId", c.id, { shouldValidate: submitCount > 0 })}
      />
      {book ? (
        <>
          <LoanModal open={lending} onClose={() => setLending(false)} book={{ id: book.id, title: book.title }} />
          <ConfirmDialog
            open={confirmDelete}
            title="Excluir livro"
            message={`Excluir "${book.title}" e seus ${book.quantity} exemplar(es)? Esta ação não pode ser desfeita.`}
            loading={del.isPending}
            onConfirm={onDelete}
            onCancel={() => setConfirmDelete(false)}
          />
        </>
      ) : null}
    </Page>
  );
}
