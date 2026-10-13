import { useState } from "react";
import { Button, Input, Modal, useToast } from "../../components/ui";
import type { Category } from "../../lib/types";
import { toAppError } from "../../lib/api";
import { useCreateCategory } from "./hooks";

/** Criação rápida de categoria (cor automática da paleta). */
export function QuickCategoryModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (c: Category) => void;
}) {
  if (!open) return null;
  return <Body onClose={onClose} onCreated={onCreated} />;
}

function Body({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Category) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const create = useCreateCategory();
  const toast = useToast();

  async function submit() {
    if (!name.trim()) {
      setError("Informe o nome da categoria.");
      return;
    }
    try {
      const c = await create.mutateAsync({ name });
      toast.success("Categoria criada", c.name);
      onCreated(c);
      onClose();
    } catch (e) {
      setError(toAppError(e).message);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Nova categoria"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Criar categoria
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input
          label="Nome da categoria"
          value={name}
          error={error}
          onChange={(e) => {
            setName(e.target.value);
            setError(undefined);
          }}
          data-autofocus
        />
      </form>
    </Modal>
  );
}
