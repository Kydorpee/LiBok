import { CircleAlert, EyeOff, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button, IconButton, Input, Modal } from "../../components/ui";
import type { CsvPreviewRow, ImportRow } from "../../lib/types";
import { useCategories } from "../categories/hooks";

type CodeItem = { key: number; value: string };

interface Props {
  /** Linha em correção (null = fechado). Atualizada com o novo status após cada tentativa. */
  row: CsvPreviewRow | null;
  saving?: boolean;
  onSave: (row: ImportRow) => void | Promise<void>;
  onIgnore: (line: number) => void;
  onClose: () => void;
}

const SHORT_ERROR = "Verifique este campo.";

export function FixRowModal({ row, saving, onSave, onIgnore, onClose }: Props) {
  // key por linha: o estado do formulário reinicia ao trocar de linha
  return (
    <Modal
      open={!!row}
      onClose={onClose}
      title={row ? `Corrigir linha ${row.line}` : "Corrigir linha"}
      size="lg"
    >
      {row ? <FixRowForm key={row.line} row={row} saving={saving} onSave={onSave} onIgnore={onIgnore} onClose={onClose} /> : null}
    </Modal>
  );
}

function FixRowForm({ row, saving, onSave, onIgnore, onClose }: Omit<Props, "row"> & { row: CsvPreviewRow }) {
  const categories = useCategories();
  const listId = useId();
  const nextKey = useRef(row.codes.length || 1);
  const [title, setTitle] = useState(row.title);
  const [author, setAuthor] = useState(row.author);
  const [subject, setSubject] = useState(row.subject);
  const [categoryName, setCategoryName] = useState(row.categoryName);
  const [codes, setCodes] = useState<CodeItem[]>(() =>
    (row.codes.length ? row.codes : [""]).map((value, key) => ({ key, value })),
  );
  const root = useRef<HTMLFormElement>(null);

  // Foca o campo apontado pelo erro (ao abrir e a cada nova tentativa que falhar).
  useEffect(() => {
    if (!row.field) return;
    const scope = root.current;
    if (!scope) return;
    const inputs = Array.from(scope.querySelectorAll<HTMLInputElement>("[data-code-input]"));
    const el =
      row.field === "codes"
        ? (inputs.find((i) => i.value.trim() && row.message?.includes(i.value.trim())) ?? inputs[0])
        : scope.querySelector<HTMLElement>(`[data-field="${row.field}"]`);
    el?.focus();
  }, [row.field, row.message, row.status]);

  const bad = (f: NonNullable<CsvPreviewRow["field"]>) => (row.field === f ? SHORT_ERROR : undefined);
  const needsFix = row.status !== "ready";

  function submit(e: FormEvent) {
    e.preventDefault();
    void onSave({
      line: row.line,
      title: title.trim(),
      author: author.trim(),
      subject: subject.trim(),
      categoryName: categoryName.trim(),
      codes: codes.map((c) => c.value.trim()).filter(Boolean),
    });
  }

  function addCode() {
    setCodes((cs) => [...cs, { key: nextKey.current++, value: "" }]);
    requestAnimationFrame(() => {
      const inputs = root.current?.querySelectorAll<HTMLInputElement>("[data-code-input]");
      inputs?.[inputs.length - 1]?.focus();
    });
  }

  return (
    <form ref={root} onSubmit={submit} noValidate className="flex flex-col gap-4">
      {needsFix && row.message ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-feedback-danger bg-bg-subtle p-3 text-body text-text-danger"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {row.message}
        </p>
      ) : null}
      <Input label="Título" data-field="title" data-autofocus={row.field === "title" ? true : undefined}value={title} error={bad("title")} onChange={(e) => setTitle(e.target.value)} />
      <Input label="Autor" data-field="author" data-autofocus={row.field === "author" ? true : undefined}value={author} error={bad("author")} onChange={(e) => setAuthor(e.target.value)} />
      <Input label="Assunto" data-field="subject" data-autofocus={row.field === "subject" ? true : undefined}value={subject} error={bad("subject")} onChange={(e) => setSubject(e.target.value)} />
      <Input
        label="Categoria"
        data-field="categoryName"
        data-autofocus={row.field === "categoryName" ? true : undefined}
        list={listId}
        value={categoryName}
        error={bad("categoryName")}
        help="Se a categoria não existir, ela será criada na importação."
        onChange={(e) => setCategoryName(e.target.value)}
      />
      <datalist id={listId}>
        {(categories.data ?? []).map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-label text-text-primary">Códigos de registro</legend>
        {codes.map((c, i) => (
          <div key={c.key} className="flex items-start gap-2">
            <Input
              wrapperClassName="flex-1"
              aria-label={`Código do exemplar ${i + 1}`}
              data-code-input
              data-autofocus={row.field === "codes" && i === 0 ? true : undefined}
              placeholder="Ex.: REG-0001"
              value={c.value}
              error={row.field === "codes" && row.message?.includes(c.value.trim()) && c.value.trim() ? SHORT_ERROR : undefined}
              onChange={(e) => setCodes((cs) => cs.map((x) => (x.key === c.key ? { ...x, value: e.target.value } : x)))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (e.currentTarget.value.trim()) addCode();
                }
              }}
            />
            <IconButton
              label={`Remover exemplar ${i + 1}`}
              tone="danger"
              className="mt-1"
              disabled={codes.length === 1}
              onClick={() => setCodes((cs) => cs.filter((x) => x.key !== c.key))}
            >
              <Trash2 />
            </IconButton>
          </div>
        ))}
        <div>
          <Button variant="secondary" size="sm" icon={<Plus />} onClick={addCode}>
            Adicionar exemplar
          </Button>
        </div>
      </fieldset>

      <div className="flex flex-wrap justify-between gap-2 pt-2">
        <Button variant="danger" icon={<EyeOff />} onClick={() => onIgnore(row.line)}>
          Ignorar esta linha
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" icon={<Save />} loading={saving}>
            Salvar
          </Button>
        </div>
      </div>
    </form>
  );
}
