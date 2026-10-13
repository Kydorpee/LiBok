import { RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Link } from "react-router";
import { paths } from "../../app/paths";
import { toAppError } from "../../lib/api";
import {
  Button,
  buttonStyles,
  EmptyState,
  PageHeader,
  Skeleton,
  TableCell,
  TableRow,
  type BreadcrumbItem,
} from "../../components/ui";

export function Page({
  title,
  subtitle,
  actions,
  breadcrumb,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  children?: ReactNode;
}) {
  useEffect(() => {
    document.title = title ? `${title} · LiBok` : "LiBok";
  }, [title]);
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={actions} breadcrumb={breadcrumb} linkAs={Link} />
      <div className="flex flex-col gap-6 p-8">{children}</div>
    </>
  );
}

/** Estado de erro de página. DB/IO ganham "Abrir Configurações". */
export function PageError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const err = toAppError(error);
  const system = err.code === "DB" || err.code === "IO";
  const notFound = err.code === "NOT_FOUND";
  return (
    <EmptyState
      role="alert"
      icon={<TriangleAlert />}
      title={
        system ? "Não foi possível acessar os dados" : notFound ? "Não encontrado" : "Algo deu errado"
      }
      message={err.message}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          {onRetry && !notFound ? (
            <Button icon={<RotateCcw />} onClick={onRetry}>
              Tentar novamente
            </Button>
          ) : null}
          {system ? (
            <Link to={paths.settings} className={buttonStyles({ variant: "secondary" })}>
              Abrir Configurações
            </Link>
          ) : null}
        </div>
      }
    />
  );
}

/** Linhas de skeleton para tabelas em carregamento. */
export function TableSkeleton({ colSpan, rows = 5 }: { colSpan: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <TableRow key={i} aria-busy="true">
          <TableCell colSpan={colSpan}>
            <Skeleton className="h-5 w-full" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function FormErrorSummary({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <div
      role="alert"
      className="rounded-md border-2 border-feedback-danger bg-feedback-danger-bg p-4 text-text-danger"
    >
      <p className="flex items-center gap-2 text-body-strong">
        <TriangleAlert className="h-4 w-4" aria-hidden="true" />
        Corrija os campos abaixo para continuar
      </p>
      <ul className="mt-1 list-disc pl-10 text-body">
        {messages.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}
