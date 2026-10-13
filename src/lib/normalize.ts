/**
 * Espelha o `normalize` do Rust: NFKD, sem diacríticos, minúsculo e espaços colapsados.
 * Ex.: "5º  Ano Á" -> "5o ano a".
 */
export function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Palavras do texto normalizado (todas obrigatórias na busca — AND). */
export function tokens(s: string): string[] {
  const n = normalize(s);
  return n ? n.split(" ") : [];
}

/** Cada palavra da busca deve aparecer em pelo menos um dos campos (AND entre palavras). */
export function matchesTokens(query: string, fields: (string | undefined)[]): boolean {
  const norm = fields.map((f) => normalize(f ?? ""));
  return tokens(query).every((t) => norm.some((f) => f.includes(t)));
}
