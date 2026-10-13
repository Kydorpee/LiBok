import { Undo2 } from "lucide-react";
import { Badge, Button, StatusBadge, TableCell, TableRow } from "../../components/ui";
import { formatDate, relativeDue } from "../../lib/dates";
import type { Loan } from "../../lib/types";
import { toBadgeStatus } from "./status";

/** Célula "Devolver até" com prazo relativo (vermelho quando atrasado). */
export function DueCell({ loan }: { loan: Loan }) {
  if (loan.returnedAt) return <TableCell className="whitespace-nowrap">{formatDate(loan.dueAt)}</TableCell>;
  return (
    <TableCell className="whitespace-nowrap">
      <p className="text-body-strong">{formatDate(loan.dueAt)}</p>
      <p className={`text-caption ${loan.status === "overdue" ? "text-text-danger" : "text-text-muted"}`}>
        {relativeDue(loan.dueAt)}
      </p>
    </TableCell>
  );
}

export function LoanStatusBadge({ loan }: { loan: Loan }) {
  return (
    <StatusBadge
      status={toBadgeStatus(loan.status)}
      detail={loan.status === "returned" && loan.markedRead ? "lido" : undefined}
    />
  );
}

/** Linha de empréstimo ativo (Resumo do leitor). */
export function ActiveLoanRow({ loan, onReturn }: { loan: Loan; onReturn: (l: Loan) => void }) {
  return (
    <TableRow>
      <TableCell>
        <p className="text-body-strong">{loan.book.title}</p>
        <p className="text-caption text-text-muted">{loan.book.author}</p>
      </TableCell>
      <TableCell>
        <Badge variant="code">{loan.code}</Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap">{formatDate(loan.loanedAt)}</TableCell>
      <DueCell loan={loan} />
      <TableCell>
        <LoanStatusBadge loan={loan} />
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant="secondary" icon={<Undo2 />} aria-label={`Devolver ${loan.code}`} onClick={() => onReturn(loan)}>
          Devolver
        </Button>
      </TableCell>
    </TableRow>
  );
}
