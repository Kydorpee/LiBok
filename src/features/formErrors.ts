import type { FieldErrors, FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toAppError } from "../lib/api";
import type { AppError } from "../lib/types";

/**
 * Aplica um erro do backend ao formulário. Se `error.field` existir (e estiver em `fields`,
 * quando informado), marca o campo; senão marca `root.server`. Devolve o AppError normalizado
 * para o chamador exibir o toast.
 *
 * `mapField` traduz o nome do backend para o do formulário (ex.: `codes.2` -> `codes.2.value`).
 */
export function applyAppError<T extends FieldValues>(
  e: unknown,
  setError: UseFormSetError<T>,
  options: { fields?: string[]; mapField?: (field: string) => string } = {},
): AppError {
  const err = toAppError(e);
  const mapped = err.field ? (options.mapField?.(err.field) ?? err.field) : undefined;
  const known = mapped && (!options.fields || options.fields.some((f) => mapped === f || mapped.startsWith(`${f}.`)));
  if (mapped && known) {
    setError(mapped as Path<T>, { type: "server", message: err.message });
  } else {
    setError("root.server", { type: "server", message: err.message });
  }
  return err;
}

/** Junta todas as mensagens de erro de um formulário (para o resumo de erros no topo). */
export function collectErrors(errors: FieldErrors<never> | Record<string, unknown>): string[] {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (typeof n.message === "string" && n.message) out.push(n.message);
    for (const [k, v] of Object.entries(n)) {
      if (k === "ref" || k === "message" || k === "type") continue;
      walk(v);
    }
  };
  walk(errors);
  return [...new Set(out)];
}
