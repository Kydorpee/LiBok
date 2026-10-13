import { useState } from "react";
import { SearchInput } from "../../components/ui";
import { SelectedChip } from "../shared/SelectedChip";
import { useDebounced } from "../useDebounced";
import { useBooks } from "./hooks";

export interface PickedBook {
  id: number;
  title: string;
}

/** Seletor de livro com busca no acervo (usado no empréstimo e na nova leitura). */
export function BookPicker({
  value,
  onChange,
  error,
  showAvailability = false,
  autoFocus = true,
}: {
  value: PickedBook | null;
  onChange: (book: PickedBook | null) => void;
  error?: string;
  showAvailability?: boolean;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const results = useBooks({ text: useDebounced(text), pageSize: 5 });

  return (
    <section aria-label="Livro" className="flex flex-col gap-2">
      {value ? (
        <SelectedChip
          label="Livro"
          value={value.title}
          onClear={() => {
            onChange(null);
            setText("");
          }}
        />
      ) : (
        <>
          <SearchInput
            label="Livro"
            placeholder="Buscar por título, autor ou código"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onClear={() => setText("")}
            data-autofocus={autoFocus ? true : undefined}
          />
          {text.trim() ? (
            <ul className="flex max-h-40 flex-col overflow-y-auto rounded-sm border border-border-default">
              {results.data?.items.length ? (
                results.data.items.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => onChange({ id: b.id, title: b.title })}
                      className="flex w-full flex-col px-3 py-2 text-left hover:bg-bg-hover"
                    >
                      <span className="text-body-strong">{b.title}</span>
                      <span className="text-caption text-text-muted">
                        {b.author}
                        {showAvailability ? ` · Disponíveis ${b.availableCount} de ${b.quantity}` : ""}
                      </span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-body text-text-muted">Nenhum livro encontrado.</li>
              )}
            </ul>
          ) : null}
        </>
      )}
      {error ? <p className="text-caption text-text-danger">{error}</p> : null}
    </section>
  );
}
