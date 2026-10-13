import { zodResolver } from "@hookform/resolvers/zod";
import { Undo2 } from "lucide-react";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { Button, Checkbox, Input, Modal, useToast } from "../../components/ui";
import { formatDate } from "../../lib/dates";
import type { Loan } from "../../lib/types";
import { applyAppError } from "../formErrors";
import { useReturnLoan } from "./hooks";
import { emptyReturnForm, returnSchema, type ReturnFormValues } from "./schema";

export function ReturnModal({ loan, onClose }: { loan: Loan | null; onClose: () => void }) {
  if (!loan) return null;
  return <ReturnModalBody loan={loan} onClose={onClose} />;
}

function ReturnModalBody({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const toast = useToast();
  const ret = useReturnLoan();
  const schema = useMemo(() => returnSchema(loan.loanedAt), [loan.loanedAt]);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ReturnFormValues>({ resolver: zodResolver(schema), defaultValues: emptyReturnForm() });

  async function onSubmit(v: ReturnFormValues) {
    try {
      await ret.mutateAsync({ id: loan.id, returnedAt: v.returnedAt, markedRead: v.markedRead });
      toast.success("Devolução registrada", `${loan.book.title} (${loan.code}) devolvido por ${loan.reader.name}.`);
      onClose();
    } catch (e) {
      const err = applyAppError(e, setError, { fields: ["returnedAt"] });
      toast.error("Não foi possível registrar a devolução", err.message);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Registrar devolução"
      description={`${loan.book.title} · ${loan.code} · ${loan.reader.name}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="return-form" icon={<Undo2 />} loading={ret.isPending}>
            Registrar devolução
          </Button>
        </>
      }
    >
      <form id="return-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <p className="text-caption text-text-muted">
          Emprestado em {formatDate(loan.loanedAt)} · devolver até {formatDate(loan.dueAt)}
        </p>
        <Input
          type="date"
          label="Data da devolução"
          error={errors.returnedAt?.message}
          data-autofocus
          {...register("returnedAt")}
        />
        <Checkbox
          label="Marcar como lido"
          description="Conta no total de livros lidos do leitor."
          {...register("markedRead")}
        />
        {errors.root?.server ? (
          <p role="alert" className="text-body text-text-danger">
            {errors.root.server.message}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
