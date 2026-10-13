import { zodResolver } from "@hookform/resolvers/zod";
import { BookUp, CircleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Input,
  Modal,
  ReaderBadge,
  SearchInput,
  Skeleton,
  StatusBadge,
  useToast,
} from "../../components/ui";
import { formatDate } from "../../lib/dates";
import type { Reader, ReaderKind } from "../../lib/types";
import { BookPicker } from "../books/BookPicker";
import { applyAppError } from "../formErrors";
import { qk } from "../queryKeys";
import { SelectedChip } from "../shared/SelectedChip";
import { useReaderSearch } from "../readers/hooks";
import { useDebounced } from "../useDebounced";
import { useCopyStatus, useCreateLoan } from "./hooks";
import {
  emptyLoanForm,
  formToLoanInput,
  loanSchema,
  type LoanFormOutput,
  type LoanFormValues,
} from "./schema";
import { toBadgeStatus } from "./status";

export interface LoanModalProps {
  open: boolean;
  onClose: () => void;
  /** Livro já escolhido (Acervo/Edição). Sem ele, o modal mostra a busca de livro. */
  book?: { id: number; title: string };
  /** Leitor já escolhido (Resumo do leitor). Sem ele, o modal mostra a busca de leitor. */
  reader?: { kind: ReaderKind; id: number; name: string };
}

export function LoanModal(props: LoanModalProps) {
  if (!props.open) return null;
  return <LoanModalBody {...props} />;
}

function readerLabel(r: Pick<Reader, "kind" | "classLabel">) {
  return r.kind === "student" ? "Aluno" : "Professor";
}

function LoanModalBody({ onClose, book: bookProp, reader: readerProp }: LoanModalProps) {
  const toast = useToast();
  const qc = useQueryClient();
  const create = useCreateLoan();

  const [pickedBook, setPickedBook] = useState<{ id: number; title: string } | null>(null);
  const [readerText, setReaderText] = useState("");
  const book = bookProp ?? pickedBook;

  const {
    handleSubmit,
    register,
    setValue,
    setError,
    control,
    formState: { errors },
  } = useForm<LoanFormValues, unknown, LoanFormOutput>({
    resolver: zodResolver(loanSchema),
    defaultValues: emptyLoanForm(readerProp ? { kind: readerProp.kind, id: readerProp.id } : undefined),
  });

  const copyId = useWatch({ control, name: "copyId" });
  const reader = useWatch({ control, name: "reader" });
  const [pickedReader, setPickedReader] = useState<{ name: string; kind: ReaderKind } | null>(
    readerProp ? { name: readerProp.name, kind: readerProp.kind } : null,
  );

  const copies = useCopyStatus(book?.id);
  const firstAvailable = copies.data?.find((c) => c.status === "available");
  const allBorrowed = !!copies.data && copies.data.length > 0 && !firstAvailable;
  const selectedCopy = copies.data?.find((c) => c.copyId === copyId);

  useEffect(() => {
    if (copies.data && copyId === undefined && firstAvailable) {
      setValue("copyId", firstAvailable.copyId);
    }
  }, [copies.data, copyId, firstAvailable, setValue]);

  const readerResults = useReaderSearch(useDebounced(readerText), 6);

  const nextReturn = allBorrowed
    ? copies.data!.map((c) => c.loan?.dueAt ?? "").filter(Boolean).sort()[0]
    : undefined;

  async function onSubmit(values: LoanFormOutput) {
    if (!copies.data?.some((c) => c.copyId === values.copyId)) {
      setValue("copyId", undefined as unknown as number);
      setError("copyId", { message: "Escolha um exemplar do livro selecionado." });
      return;
    }
    try {
      const loan = await create.mutateAsync(formToLoanInput(values));
      toast.success("Empréstimo registrado", `${loan.code} para ${loan.reader.name}, devolução até ${formatDate(loan.dueAt)}.`);
      onClose();
    } catch (e) {
      const err = applyAppError(e, setError, {
        fields: ["copyId", "reader", "loanedAt", "dueAt"],
        mapField: (f) => (f === "readerId" ? "reader" : f),
      });
      toast.error("Não foi possível emprestar", err.message);
      if (err.code === "COPY_UNAVAILABLE") {
        setValue("copyId", undefined as unknown as number);
        void qc.invalidateQueries({ queryKey: qk.copyStatus });
      }
    }
  }

  const errorMessages = errors.root?.server?.message;

  return (
    <Modal
      open
      onClose={onClose}
      title="Emprestar exemplar"
      description={book ? book.title : "Escolha o livro, o exemplar e o leitor."}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="loan-form"
            icon={<BookUp />}
            loading={create.isPending}
            disabled={!book || allBorrowed}
          >
            {selectedCopy ? `Emprestar ${selectedCopy.code}` : "Emprestar"}
          </Button>
        </>
      }
    >
      <form id="loan-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        {errorMessages ? (
          <p role="alert" className="flex items-center gap-2 text-body text-text-danger">
            <CircleAlert className="h-4 w-4" aria-hidden="true" />
            {errorMessages}
          </p>
        ) : null}

        {/* Livro */}
        {!bookProp ? (
          <BookPicker
            value={pickedBook}
            showAvailability
            onChange={(b) => {
              if (!b) setValue("copyId", undefined as unknown as number);
              setPickedBook(b);
            }}
          />
        ) : null}

        {/* Exemplares */}
        {book ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-label text-text-primary">Exemplar</legend>
            {copies.isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : copies.isError ? (
              <p className="text-body text-text-danger">Não foi possível carregar os exemplares.</p>
            ) : (
              copies.data?.map((c) => {
                const available = c.status === "available";
                const id = `copy-${c.copyId}`;
                return (
                  <label
                    key={c.copyId}
                    htmlFor={id}
                    className={`flex items-center gap-3 rounded-sm border px-3 py-2 ${
                      copyId === c.copyId ? "border-2 border-action-primary" : "border-border-default"
                    } ${available ? "cursor-pointer hover:bg-bg-hover" : "cursor-not-allowed opacity-80"}`}
                  >
                    <input
                      id={id}
                      type="radio"
                      name="copy"
                      className="h-4 w-4 accent-action-primary"
                      disabled={!available}
                      checked={copyId === c.copyId}
                      onChange={() => setValue("copyId", c.copyId, { shouldValidate: true })}
                    />
                    <span className="font-mono text-body-strong">{c.code}</span>
                    <StatusBadge status={toBadgeStatus(c.status)} />
                    {c.loan ? (
                      <span className="text-caption text-text-muted">
                        Com {c.loan.reader.name} ({readerLabel(c.loan.reader)}) até {formatDate(c.loan.dueAt)}
                      </span>
                    ) : null}
                  </label>
                );
              })
            )}
            {allBorrowed ? (
              <p role="status" className="rounded-sm bg-feedback-warning-bg p-3 text-body text-text-warning">
                Todos os exemplares estão emprestados.
                {nextReturn ? ` Próxima devolução prevista: ${formatDate(nextReturn)}.` : ""}
              </p>
            ) : null}
            {errors.copyId ? (
              <p className="text-caption text-text-danger">{errors.copyId.message}</p>
            ) : null}
          </fieldset>
        ) : null}

        {/* Leitor */}
        <section aria-label="Leitor" className="flex flex-col gap-2">
          {readerProp || (reader && pickedReader) ? (
            <SelectedChip
              label="Leitor"
              value={pickedReader?.name ?? readerProp?.name ?? ""}
              badge={<ReaderBadge type={pickedReader?.kind ?? readerProp!.kind} />}
              onClear={
                readerProp
                  ? undefined
                  : () => {
                      setValue("reader", undefined as unknown as LoanFormValues["reader"]);
                      setPickedReader(null);
                    }
              }
            />
          ) : (
            <>
              <SearchInput
                label="Leitor"
                placeholder="Buscar aluno ou professor pelo nome"
                value={readerText}
                onChange={(e) => setReaderText(e.target.value)}
                onClear={() => setReaderText("")}
                data-autofocus={bookProp ? true : undefined}
              />
              {readerText.trim() ? (
                <ul className="flex max-h-40 flex-col overflow-y-auto rounded-sm border border-border-default">
                  {readerResults.data?.length ? (
                    readerResults.data.map((r) => (
                      <li key={`${r.kind}-${r.id}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setValue("reader", { kind: r.kind, id: r.id }, { shouldValidate: true });
                            setPickedReader({ name: r.name, kind: r.kind });
                            setReaderText("");
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-bg-hover"
                        >
                          <span className="text-body-strong">{r.name}</span>
                          <ReaderBadge type={r.kind} />
                          {r.classLabel ? (
                            <span className="text-caption text-text-muted">{r.classLabel}</span>
                          ) : null}
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="px-3 py-2 text-body text-text-muted">Nenhum leitor encontrado.</li>
                  )}
                </ul>
              ) : null}
              {errors.reader ? (
                <p className="text-caption text-text-danger">{errors.reader.message}</p>
              ) : null}
            </>
          )}
        </section>

        {/* Datas */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            type="date"
            label="Data do empréstimo"
            error={errors.loanedAt?.message}
            {...register("loanedAt")}
          />
          <Input
            type="date"
            label="Devolução prevista"
            help="Padrão: 7 dias."
            error={errors.dueAt?.message}
            {...register("dueAt")}
          />
        </div>
      </form>
    </Modal>
  );
}
