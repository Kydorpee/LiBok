import type { LoanStatus } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

/** Data local 'YYYY-MM-DD'. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Interpreta 'YYYY-MM-DD' como data local (meio-dia, evita problemas de DST). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export function isValidISODate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return toISODate(parseISODate(iso)) === iso;
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export const DEFAULT_LOAN_DAYS = 7;

/** Devolução prevista padrão: empréstimo + 7 dias. */
export function defaultDueDate(loanedAt: string = todayISO()): string {
  return addDays(loanedAt, DEFAULT_LOAN_DAYS);
}

/** 'YYYY-MM-DD' (ou 'YYYY-MM-DD HH:MM:SS') -> 'dd/mm/aaaa'. */
export function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Timestamp ISO UTC ('2026-10-12T17:03:00Z') -> Date local. */
export function parseTimestamp(iso: string): Date {
  // Aceita também o formato legado 'YYYY-MM-DD HH:MM:SS' (UTC).
  const normalized = /Z$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso.replace(" ", "T")}Z`;
  return new Date(normalized);
}

/** Timestamp ISO UTC -> 'dd/mm/aaaa' na data local. */
export function formatTimestampDate(iso?: string | null): string {
  if (!iso) return "";
  const d = parseTimestamp(iso);
  if (Number.isNaN(d.getTime())) return formatDate(iso);
  return formatDate(toISODate(d));
}

/** Timestamp ISO UTC -> 'dd/mm/aaaa HH:MM' na hora local. */
export function formatTimestamp(iso?: string | null): string {
  if (!iso) return "";
  const d = parseTimestamp(iso);
  if (Number.isNaN(d.getTime())) return formatDate(iso);
  return `${formatDate(toISODate(d))} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Diferença em dias inteiros (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

/** Devolvido se returnedAt; Atrasado se dueAt < hoje; senão Ativo. */
export function loanStatus(
  loan: { dueAt: string; returnedAt?: string | null },
  today: string = todayISO(),
): LoanStatus {
  if (loan.returnedAt) return "returned";
  return loan.dueAt < today ? "overdue" : "active";
}

/** Texto relativo do prazo: "vence hoje", "vence em 3 dias", "7 dias de atraso". */
export function relativeDue(dueAt: string, today: string = todayISO()): string {
  const n = diffDays(today, dueAt);
  if (n === 0) return "vence hoje";
  if (n === 1) return "vence amanhã";
  if (n > 1) return `vence em ${n} dias`;
  return n === -1 ? "1 dia de atraso" : `${-n} dias de atraso`;
}
