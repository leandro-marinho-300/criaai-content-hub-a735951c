/**
 * parseTags — Normaliza e separa entradas de etiquetas.
 *
 * Regras:
 *  - Separadores aceitos: ponto e vírgula (`;`) e quebras de linha (\n, \r\n, \r).
 *  - NÃO separa por vírgula (uma etiqueta pode conter expressão com vírgula).
 *  - Faz trim, ignora itens vazios e separadores repetidos.
 *  - Remove duplicados de forma case-insensitive (preserva escrita original).
 *  - Mescla com etiquetas existentes (também sem duplicar).
 */
export function parseTags(input: string, existingTags: string[] = []): string[] {
  if (input == null) return dedupe(existingTags);
  const parts = String(input)
    .split(/[;\r\n]+/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return dedupe([...existingTags, ...parts]);
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const v = (raw ?? "").toString().trim();
    if (!v) continue;
    const key = v.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/** Helper: verifica se uma string de entrada contém um separador suportado. */
export function hasTagSeparator(input: string): boolean {
  return /[;\r\n]/.test(input ?? "");
}
