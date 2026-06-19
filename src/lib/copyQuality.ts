// Cria Aí — Validação determinística de qualidade de copy.
// Não usa IA. Regras heurísticas para detectar textos que parecem
// colagem de bullets do briefing em vez de comunicação final.

export type CopyStatus = "approved" | "warning" | "blocked";

export interface QualityIssue {
  code:
    | "empty"
    | "too_short"
    | "too_long"
    | "too_many_semicolons"
    | "trailing_ellipsis"
    | "no_verb"
    | "raw_list"
    | "repetition"
    | "prohibited_word"
    | "incomplete_sentence"
    | "placeholder_instruction"
    | "missing_subject"
    | "trailing_comma";
  message: string;
  /** "blocked" impede liberação do prompt; "warning" só alerta. */
  severity: "warning" | "blocked";
}

export interface QualityResult {
  status: CopyStatus;
  passed: boolean;
  issues: QualityIssue[];
}

// Verbos comuns em pt-BR
const VERB_HINTS =
  /\b(é|são|está|estão|tem|temos|há|fazer|faz|fazemos|criar|cria|criamos|começa|comece|ajuda|ajudamos|recebe|recebemos|garante|garantimos|oferece|oferecemos|encontra|encontre|pode|podem|conta|contamos|leva|leve|quer|quero|escolha|escolher|peça|veja|saiba|conheça|descubra|aproveite|reserve|agende|fale|entre|venha|transforme|aprenda|melhore|reduza|aumente|conquiste|transforma|aprende|melhora|reduz|aumenta|conquista|seja|sejam|teve|tinha|fica|ficar|virou|gera|geram|merece|merecem|funciona|funcionam|abre|abrem|ganha|ganham|liga|ligam|fala|falam|chega|chegam|vai|vamos|vão|busca|buscamos|consegue|conseguem|pense|pensa|considere|considera|defina|define|verifique|verifica|reserve|use|usa|compare|compara|orienta|orientamos|acompanha|acompanhamos|precisa|precisamos|inclui|incluímos|combina|combinamos)\b/i;

const SENTENCE_END = /[.!?]$/;

// Frases que são instruções internas, jamais copy final.
const PLACEHOLDER_PHRASES =
  /^\s*(listar|validar|inserir|desenvolver|apresentar|falar sobre|descrever|destacar|mostrar como|criar uma|elaborar|sugerir)\b/i;

// "[PREENCHER]" e variações
const PREENCHER_RX = /\[\s*preencher\s*\]|\binformação a confirmar\b/i;

// Frases iniciadas sem referente: "Construído com ...", "Como aproveitar agora"
const MISSING_SUBJECT_RX =
  /^\s*(construído com|como aproveitar agora|como aproveitar)\b/i;

const stripQuotes = (s: string) => s.replace(/^[“"'«»]\s*|\s*[”"'«»]$/g, "").trim();

export function checkCopyQuality(
  text: string,
  opts: { prohibited?: string[]; minLen?: number; maxLen?: number; isHeadline?: boolean } = {},
): QualityResult {
  const issues: QualityIssue[] = [];
  const t = stripQuotes((text ?? "").trim());
  const minLen = opts.minLen ?? 12;
  const maxLen = opts.maxLen ?? 600;

  if (!t) {
    issues.push({ code: "empty", message: "texto vazio", severity: "blocked" });
    return { status: "blocked", passed: false, issues };
  }

  // Bloqueios duros (qualquer um deles ⇒ blocked)
  if (PREENCHER_RX.test(t)) {
    issues.push({ code: "placeholder_instruction", message: 'contém marcador "[PREENCHER]"', severity: "blocked" });
  }
  if (PLACEHOLDER_PHRASES.test(t)) {
    issues.push({ code: "placeholder_instruction", message: "começa com instrução interna (ex.: Listar, Validar, Inserir)", severity: "blocked" });
  }
  if (MISSING_SUBJECT_RX.test(t)) {
    issues.push({ code: "missing_subject", message: "frase sem sujeito ou referente claro", severity: "blocked" });
  }
  if (/,\s*$/.test(t)) {
    issues.push({ code: "trailing_comma", message: "termina em vírgula", severity: "blocked" });
  }
  for (const w of opts.prohibited ?? []) {
    const ww = (w ?? "").trim();
    if (!ww) continue;
    const re = new RegExp(`\\b${escapeRegex(ww)}\\b`, "i");
    if (re.test(t)) {
      issues.push({ code: "prohibited_word", message: `usa termo proibido pela marca: "${ww}"`, severity: "blocked" });
    }
  }

  // Avisos (warning)
  if (t.length < minLen) issues.push({ code: "too_short", message: "frase muito curta para ser publicada", severity: "warning" });
  if (t.length > maxLen) issues.push({ code: "too_long", message: "texto excede o tamanho recomendado", severity: "warning" });

  const semicolons = (t.match(/;/g) ?? []).length;
  if (semicolons >= 2) issues.push({ code: "too_many_semicolons", message: "excesso de ponto e vírgula", severity: "warning" });
  if (/(\.\.\.|…)$/.test(t)) issues.push({ code: "trailing_ellipsis", message: "termina em reticências indevidas", severity: "warning" });

  if (!VERB_HINTS.test(t) && !/\?$/.test(t) && !opts.isHeadline) {
    issues.push({ code: "no_verb", message: "frase sem verbo principal", severity: "warning" });
  }

  const segs = t.split(/\s*[;|·•—–]\s*|,\s+(?=[a-záéíóúâêôãõç])/i).filter(Boolean);
  if (segs.length >= 4) issues.push({ code: "raw_list", message: "parece lista crua de bullets", severity: "warning" });

  const words = t.toLowerCase().split(/[^a-záéíóúâêôãõç]+/i).filter((w) => w.length > 4);
  const freq = new Map<string, number>();
  words.forEach((w) => freq.set(w, (freq.get(w) ?? 0) + 1));
  if ([...freq.values()].some((c) => c >= 3)) {
    issues.push({ code: "repetition", message: "repetição excessiva de palavras", severity: "warning" });
  }

  if (!opts.isHeadline && t.length > 25 && !SENTENCE_END.test(t)) {
    issues.push({ code: "incomplete_sentence", message: "frase parece incompleta (sem pontuação final)", severity: "warning" });
  }

  const hasBlocked = issues.some((i) => i.severity === "blocked");
  const hasWarn = issues.some((i) => i.severity === "warning");
  const status: CopyStatus = hasBlocked ? "blocked" : hasWarn ? "warning" : "approved";
  return { status, passed: !hasBlocked && !hasWarn, issues };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Escolhe a melhor opção dentre candidatas, priorizando approved > warning > blocked. */
export function pickBestCopy(
  candidates: string[],
  opts: Parameters<typeof checkCopyQuality>[1] = {},
): { text: string; quality: QualityResult } {
  const evaluated = candidates
    .map((c) => ({ text: c, quality: checkCopyQuality(c, opts) }))
    .filter((e) => e.text && e.text.trim().length > 0);
  if (evaluated.length === 0) {
    return {
      text: "",
      quality: { status: "blocked", passed: false, issues: [{ code: "empty", message: "texto vazio", severity: "blocked" }] },
    };
  }
  const approved = evaluated.find((e) => e.quality.status === "approved");
  if (approved) return approved;
  const warning = evaluated.find((e) => e.quality.status === "warning");
  if (warning) return warning;
  evaluated.sort((a, b) => a.quality.issues.length - b.quality.issues.length);
  return evaluated[0];
}

/** Trunca texto preservando palavras, fronteira em pontuação ou espaço. */
export function enforceLimit(s: string, maxChars: number): string {
  const t = (s ?? "").trim();
  if (!t || t.length <= maxChars) return t;
  const cut = t.slice(0, maxChars).replace(/[\s,;:—–-]+\S*$/, "");
  return cut.replace(/[.,;:]+$/, "");
}

/** Pior status entre dois (blocked > warning > approved). */
export function worseStatus(a: CopyStatus, b: CopyStatus): CopyStatus {
  const rank: Record<CopyStatus, number> = { approved: 0, warning: 1, blocked: 2 };
  return rank[a] >= rank[b] ? a : b;
}
