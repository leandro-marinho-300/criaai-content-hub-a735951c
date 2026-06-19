// Validação de integridade textual antes da exportação para PDF.
// Normaliza para Unicode NFC e detecta corrupção / caracteres de substituição.

export interface IntegrityIssue {
  field: string;
  severity: "error" | "warning";
  message: string;
}

const REPLACEMENT_CHAR = "\uFFFD"; // �
// Caracteres surrogate isolados ou sequências obviamente corrompidas
const BAD_PATTERNS: { re: RegExp; msg: string }[] = [
  { re: /\uFFFD/g, msg: "caractere de substituição (�) presente" },
  { re: /Ø<ß|Ø=ß|Ø>ß/g, msg: "sequência tipicamente corrompida (Ø<ß)" },
  { re: /\?\?\?\?/g, msg: "sequência de pontos de interrogação (???) — possível perda de caracteres" },
  { re: /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, msg: "surrogate alto isolado" },
  { re: /(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, msg: "surrogate baixo isolado" },
];

/** Normaliza para NFC e remove apenas controles invisíveis problemáticos. Não altera conteúdo. */
export function normalizeForPdf(s: string | null | undefined): string {
  if (!s) return "";
  // NFC para padronizar acentos compostos
  let out = s.normalize("NFC");
  // Remove BOM e zero-width que tendem a quebrar o engine do PDF, mas preserva quebras de linha.
  out = out.replace(/\uFEFF/g, "");
  return out;
}

export function validateTextIntegrity(field: string, original: string, prepared: string): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  for (const { re, msg } of BAD_PATTERNS) {
    if (re.test(prepared)) issues.push({ field, severity: "error", message: msg });
  }
  // Comparação básica (após NFC, devem ter o mesmo tamanho semântico)
  const a = original.normalize("NFC");
  const b = prepared.normalize("NFC");
  if (a && b && Math.abs(a.length - b.length) > Math.max(8, a.length * 0.05)) {
    issues.push({
      field,
      severity: "warning",
      message: `texto preparado difere muito do original (${a.length} → ${b.length} caracteres)`,
    });
  }
  // Detecta letras separadas por espaços (ex: "v i a g e m")
  if (/(^|\s)([\p{L}]\s){4,}\p{L}(\s|$)/u.test(prepared)) {
    issues.push({ field, severity: "warning", message: "palavras possivelmente separadas letra por letra" });
  }
  return issues;
}

export function validatePdfTextIntegrity(parts: { field: string; original: string; prepared: string }[]): IntegrityIssue[] {
  return parts.flatMap((p) => validateTextIntegrity(p.field, p.original, p.prepared));
}

/** Sugere um título curto e apresentável a partir de uma string longa. */
export function suggestShortTitle(raw: string, fallback = "Apresentação"): string {
  const cleaned = normalizeForPdf(raw)
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return fallback;
  // Pega a primeira oração / frase curta
  const first = cleaned.split(/[.;:!?]/)[0].trim();
  if (first.length <= 72) return first;
  // Encurta no último espaço antes do limite
  const slice = first.slice(0, 72);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 30 ? slice.slice(0, lastSpace) : slice).trim();
}

/** Normaliza nome de arquivo (slug) preservando legibilidade. */
export function fileSlug(s: string, max = 60): string {
  return normalizeForPdf(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
}
