// Cria Aí — Validação determinística de qualidade de copy.
// Não usa IA. Apenas regras heurísticas para detectar textos que parecem
// colagem de bullets do briefing em vez de comunicação final.

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
    | "incomplete_sentence";
  message: string;
}

export interface QualityResult {
  passed: boolean;
  issues: QualityIssue[];
}

// verbos comuns em pt-BR que normalmente aparecem em copy de marketing
const VERB_HINTS =
  /\b(é|são|está|estão|tem|temos|há|fazer|faz|fazemos|criar|cria|criamos|começa|comece|ajuda|ajudamos|recebe|recebemos|garante|garantimos|oferece|oferecemos|encontra|encontre|pode|podem|conta|contamos|leva|leve|quer|quero|escolha|escolher|peça|veja|saiba|conheça|descubra|aproveite|reserve|agende|fale|entre|venha|transforme|aprenda|melhore|reduza|aumente|conquiste|transforma|aprende|melhora|reduz|aumenta|conquista|seja|sejam|seja|teve|tinha|fica|ficar|virou|gera|geram|merece|merecem|funciona|funcionam|abre|abrem|ganha|ganham|liga|ligam|fala|falam|chega|chegam|vai|vamos|vão|busca|buscamos|consegue|conseguem)\b/i;

// pontuação fluida pt-BR
const SENTENCE_END = /[.!?]$/;

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
    return { passed: false, issues: [{ code: "empty", message: "texto vazio" }] };
  }
  if (t.length < minLen) issues.push({ code: "too_short", message: "frase muito curta para ser publicada" });
  if (t.length > maxLen) issues.push({ code: "too_long", message: "texto excede o tamanho recomendado" });

  // pontuação
  const semicolons = (t.match(/;/g) ?? []).length;
  if (semicolons >= 2) issues.push({ code: "too_many_semicolons", message: "excesso de ponto e vírgula" });
  if (/(\.\.\.|…)$/.test(t)) issues.push({ code: "trailing_ellipsis", message: "termina em reticências indevidas" });

  // verbo
  if (!VERB_HINTS.test(t) && !/\?$/.test(t) && !opts.isHeadline) {
    issues.push({ code: "no_verb", message: "frase sem verbo principal" });
  }

  // lista crua: muitos segmentos separados por ; ou — ou ,
  const segs = t.split(/\s*[;|·•—–]\s*|,\s+(?=[a-záéíóúâêôãõç])/i).filter(Boolean);
  if (segs.length >= 4) issues.push({ code: "raw_list", message: "parece lista crua de bullets" });

  // repetição de palavras (> 4 letras, 3+ ocorrências)
  const words = t.toLowerCase().split(/[^a-záéíóúâêôãõç]+/i).filter((w) => w.length > 4);
  const freq = new Map<string, number>();
  words.forEach((w) => freq.set(w, (freq.get(w) ?? 0) + 1));
  if ([...freq.values()].some((c) => c >= 3)) {
    issues.push({ code: "repetition", message: "repetição excessiva de palavras" });
  }

  // frase incompleta: > 25 caracteres mas sem pontuação final e não é título
  if (!opts.isHeadline && t.length > 25 && !SENTENCE_END.test(t)) {
    issues.push({ code: "incomplete_sentence", message: "frase parece incompleta (sem pontuação final)" });
  }

  // palavras proibidas
  for (const w of opts.prohibited ?? []) {
    const ww = (w ?? "").trim();
    if (!ww) continue;
    const re = new RegExp(`\\b${escapeRegex(ww)}\\b`, "i");
    if (re.test(t)) {
      issues.push({ code: "prohibited_word", message: `usa termo proibido pela marca: "${ww}"` });
    }
  }

  return { passed: issues.length === 0, issues };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Escolhe a melhor opção dentre candidatas, priorizando as que passam. */
export function pickBestCopy(
  candidates: string[],
  opts: Parameters<typeof checkCopyQuality>[1] = {},
): { text: string; quality: QualityResult } {
  const evaluated = candidates
    .map((c) => ({ text: c, quality: checkCopyQuality(c, opts) }))
    .filter((e) => e.text && e.text.trim().length > 0);
  if (evaluated.length === 0) return { text: "", quality: { passed: false, issues: [{ code: "empty", message: "texto vazio" }] } };
  const passed = evaluated.find((e) => e.quality.passed);
  if (passed) return passed;
  // nenhum passou: retorna o de menor número de issues
  evaluated.sort((a, b) => a.quality.issues.length - b.quality.issues.length);
  return evaluated[0];
}
