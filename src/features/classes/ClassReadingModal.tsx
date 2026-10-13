import { BookCheck, CircleAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button, Checkbox, Input, Modal, useToast } from "../../components/ui";
import { toAppError } from "../../lib/api";
import { isValidISODate, todayISO } from "../../lib/dates";
import type { Ref } from "../../lib/types";
import { BookPicker, type PickedBook } from "../books/BookPicker";
import { useCreateClassReading } from "./hooks";

type Errors = { bookId?: string; studentIds?: string; readAt?: string; root?: string };

/** Nova leitura coletiva da turma: livro, data e alunos presentes (todos marcados por padrão). */
export function ClassReadingModal({
  open,
  onClose,
  classId,
  students,
}: {
  open: boolean;
  onClose: () => void;
  classId: number;
  students: Ref[];
}) {
  if (!open) return null;
  return <Body onClose={onClose} classId={classId} students={students} />;
}

function Body({ onClose, classId, students }: { onClose: () => void; classId: number; students: Ref[] }) {
  const toast = useToast();
  const create = useCreateClassReading();
  const [book, setBook] = useState<PickedBook | null>(null);
  const [readAt, setReadAt] = useState(todayISO());
  const [present, setPresent] = useState<Set<number>>(() => new Set(students.map((s) => s.id)));
  const [errors, setErrors] = useState<Errors>({});

  const toggle = (id: number, on: boolean) => {
    setPresent((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
    setErrors((e) => ({ ...e, studentIds: undefined }));
  };

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    const local: Errors = {};
    if (!book) local.bookId = "Escolha o livro lido.";
    if (!isValidISODate(readAt)) local.readAt = "Informe uma data válida.";
    if (present.size === 0) local.studentIds = "Marque pelo menos um aluno presente.";
    if (local.bookId || local.readAt || local.studentIds) {
      setErrors(local);
      return;
    }
    const studentIds = students.filter((s) => present.has(s.id)).map((s) => s.id);
    try {
      const reading = await create.mutateAsync({ classId, bookId: book!.id, readAt, studentIds });
      const n = reading.presentCount;
      toast.success("Leitura registrada", `${reading.book.title} para ${n} ${n === 1 ? "aluno" : "alunos"}`);
      onClose();
    } catch (e) {
      const err = toAppError(e);
      const field = err.field;
      if (field === "bookId" || field === "studentIds" || field === "readAt") {
        setErrors({ [field]: err.message });
      } else {
        setErrors({ root: err.message });
      }
      toast.error("Não foi possível registrar a leitura", err.message);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Nova leitura"
      description="Registre o livro lido em sala pelos alunos presentes."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="class-reading-form"
            icon={<BookCheck />}
            loading={create.isPending}
            disabled={present.size === 0}
          >
            Registrar leitura
          </Button>
        </>
      }
    >
      <form id="class-reading-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {errors.root ? (
          <p role="alert" className="flex items-center gap-2 text-body text-text-danger">
            <CircleAlert className="h-4 w-4" aria-hidden="true" />
            {errors.root}
          </p>
        ) : null}

        <BookPicker
          value={book}
          onChange={(b) => {
            setBook(b);
            setErrors((e) => ({ ...e, bookId: undefined }));
          }}
          error={errors.bookId}
        />

        <Input
          type="date"
          label="Data da leitura"
          value={readAt}
          onChange={(e) => {
            setReadAt(e.target.value);
            setErrors((x) => ({ ...x, readAt: undefined }));
          }}
          error={errors.readAt}
        />

        <fieldset className="flex flex-col gap-2" aria-describedby="reading-present-count">
          <legend className="mb-1 text-label text-text-primary">Alunos presentes</legend>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p id="reading-present-count" role="status" className="text-body text-text-muted">
              {present.size} de {students.length} presentes
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPresent(new Set(students.map((s) => s.id)))}
              >
                Marcar todos
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setPresent(new Set())}>
                Desmarcar todos
              </Button>
            </div>
          </div>
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-sm border border-border-default p-2">
            {students.map((s) => (
              <li key={s.id}>
                <Checkbox
                  label={s.name}
                  checked={present.has(s.id)}
                  onChange={(e) => toggle(s.id, e.target.checked)}
                />
              </li>
            ))}
          </ul>
          {errors.studentIds ? (
            <p role="alert" className="text-caption text-text-danger">
              {errors.studentIds}
            </p>
          ) : present.size === 0 ? (
            <p className="text-caption text-text-danger">Marque pelo menos um aluno presente.</p>
          ) : null}
        </fieldset>
      </form>
    </Modal>
  );
}
