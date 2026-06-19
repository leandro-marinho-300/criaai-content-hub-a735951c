// Cria Aí — Fluxo de revisão externa com ChatGPT (sem API, sem IA interna).
// Monta um prompt enxuto a partir da peça + orientações do usuário,
// valida e importa o JSON de resposta colado manualmente.

import type { Piece, Brand, Project } from "./promptBuilder";

export type CommercialIntensity = "none" | "light" | "moderate" | "direct";

export const OBJECTIVE_OPTIONS = [
  { value: "informar", label: "Informar" },
  { value: "despertar_desejo", label: "Despertar desejo" },
  { value: "educar", label: "Educar" },
  { value: "relacionamento", label: "Gerar relacionamento" },
  { value: "vender", label: "Vender" },
  { value: "gerar_contato", label: "Gerar contato" },
  { value: "apresentar_beneficio", label: "Apresentar benefício" },
  { value: "quebrar_objecao", label: "Quebrar objeção" },
  { value: "concluir", label: "Concluir" },
  { value: "outro", label: "Outro" },
] as const;

export const ANGLE_OPTIONS = [
  "criativo", "direto", "inspirador", "educativo", "comercial",
  "acolhedor", "institucional", "prático", "emocional", "curiosidade", "outro",
] as const;

export const INTENSITY_OPTIONS: Array<{ value: CommercialIntensity; label: string }> = [
  { value: "none", label: "Nenhuma" },
  { value: "light", label: "Leve" },
  { value: "moderate", label: "Moderada" },
  { value: "direct", label: "Direta" },
];

export const CTA_OPTIONS = [
  "Sem CTA", "Salvar", "Compartilhar", "Comentar", "Responder",
  "Entrar em contato", "Solicitar orçamento", "Personalizado",
] as const;

export interface ReviewGuidance {
  highlight: string;
  avoid: string;
  objective: string;
  angle: string;
  intensity: CommercialIntensity;
  cta: string;          // rótulo escolhido
  ctaCustom?: string;   // quando "Personalizado"
  mustInclude: string;
  extraInstruction: string;
}

export const EMPTY_GUIDANCE: ReviewGuidance = {
  highlight: "", avoid: "", objective: "informar", angle: "direto",
  intensity: "light", cta: "Sem CTA", ctaCustom: "", mustInclude: "", extraInstruction: "",
};

const trim = (s: string | null | undefined, n = 240) =>
  (s ?? "").toString().trim().replace(/\s+/g, " ").slice(0, n);

function shortPieceSummary(p: Piece): string {
  const bits = [
    p.mainText && `H: ${trim(p.mainText, 90)}`,
    p.supportText && `A: ${trim(p.supportText, 120)}`,
    p.cta && `CTA: ${trim(p.cta, 60)}`,
  ].filter(Boolean);
  return `- ${p.name}: ${bits.join(" · ")}`;
}

function resolveCta(g: ReviewGuidance): string {
  if (g.cta === "Personalizado") return trim(g.ctaCustom || "", 80) || "(personalizado a definir)";
  return g.cta;
}

/** Monta o prompt externo para revisão no ChatGPT. */
export function buildReviewPrompt(args: {
  piece: Piece;
  brand: Brand;
  project: Project;
  otherPieces: Piece[];
  guidance: ReviewGuidance;
}): string {
  const { piece, brand, project, otherPieces, guidance } = args;

  const tone = trim(brand.tone_of_voice || brand.brand_personality || "tom alinhado à marca", 180);
  const theme = trim(project.theme || project.main_message || project.internal_title || "tema da campanha", 160);
  const generalObjective = trim(project.main_objective || project.call_to_action || "", 120);
  const prohibited = Array.isArray(brand.prohibited_words)
    ? brand.prohibited_words.filter(Boolean).slice(0, 20).join(", ")
    : "";
  const issues = (piece.qualityIssues ?? []).map((i) => `- ${i.message}`).join("\n");
  const others = otherPieces
    .filter((p) => p.index !== piece.index)
    .slice(0, 6)
    .map(shortPieceSummary)
    .join("\n");

  const lines: string[] = [];
  lines.push("Revise a copy da peça abaixo e devolva SOMENTE JSON válido (sem markdown, sem bloco de código, sem explicação fora do JSON).");
  lines.push("");
  lines.push("MARCA");
  lines.push(brand.name || "(sem nome)");
  lines.push("");
  lines.push("TOM DE VOZ");
  lines.push(tone);
  lines.push("");
  lines.push("TEMA DA CAMPANHA");
  lines.push(theme);
  if (generalObjective) {
    lines.push("");
    lines.push("OBJETIVO GERAL");
    lines.push(generalObjective);
  }
  lines.push("");
  lines.push("FORMATO");
  lines.push(piece.formatLabel);
  lines.push("");
  lines.push("FUNÇÃO DESTA PEÇA");
  lines.push(`Peça ${piece.index} — ${piece.name} (${piece.objective}).`);
  lines.push("");
  lines.push("COPY ATUAL");
  lines.push(`Headline: ${piece.mainText || "(vazio)"}`);
  lines.push(`Apoio: ${piece.supportText || "(vazio)"}`);
  if (piece.bullets?.length) lines.push(`Bullets: ${piece.bullets.join(" | ")}`);
  lines.push(`CTA: ${piece.cta || "(vazio)"}`);

  if (issues) {
    lines.push("");
    lines.push("PROBLEMAS IDENTIFICADOS");
    lines.push(issues);
  }

  lines.push("");
  lines.push("DESTACAR");
  lines.push(trim(guidance.highlight) || "(o usuário não destacou nada específico)");
  lines.push("");
  lines.push("EVITAR");
  lines.push(trim(guidance.avoid) || "(sem restrições adicionais)");
  lines.push("");
  lines.push("OBJETIVO DESTA PEÇA");
  lines.push(guidance.objective);
  lines.push("");
  lines.push("ÂNGULO");
  lines.push(guidance.angle);
  lines.push("");
  lines.push("INTENSIDADE COMERCIAL");
  lines.push(guidance.intensity);
  lines.push("");
  lines.push("CTA DESEJADO");
  lines.push(resolveCta(guidance));

  if (trim(guidance.mustInclude)) {
    lines.push("");
    lines.push("INFORMAÇÕES OBRIGATÓRIAS");
    lines.push(trim(guidance.mustInclude, 400));
  }
  if (trim(guidance.extraInstruction)) {
    lines.push("");
    lines.push("INSTRUÇÃO ADICIONAL");
    lines.push(trim(guidance.extraInstruction, 600));
  }

  if (others) {
    lines.push("");
    lines.push("TEXTOS DAS OUTRAS PEÇAS (resumo — não repita)");
    lines.push(others);
  }
  if (prohibited) {
    lines.push("");
    lines.push("PALAVRAS PROIBIDAS");
    lines.push(prohibited);
  }

  lines.push("");
  lines.push("REGRAS");
  lines.push("- Escreva em português do Brasil.");
  lines.push("- Não invente dados (preço, data, telefone, condições).");
  lines.push("- Respeite as palavras proibidas e o que está em EVITAR.");
  lines.push("- Não repita os textos das outras peças.");
  lines.push("- Mantenha uma ideia principal por peça.");
  lines.push("- Headline curta. Apoio adequado ao formato.");
  if (guidance.intensity === "none") lines.push("- Não inclua orçamento, venda ou apelo comercial.");
  lines.push("- Respeite o CTA escolhido. Se for 'Sem CTA', deixe o campo vazio.");
  lines.push("");
  lines.push("RESPONDA EXATAMENTE NESTE FORMATO (uma versão):");
  lines.push('{ "headline": "", "support_text": "", "bullets": [], "cta": "", "angle": "", "status": "approved", "warnings": [] }');
  lines.push("");
  lines.push("Ou, se quiser sugerir variações (até 3):");
  lines.push('{ "variations": [ { "headline": "", "support_text": "", "bullets": [], "cta": "", "angle": "", "status": "approved", "warnings": [] } ] }');

  return lines.join("\n");
}

// ---------- Parser seguro ----------

export interface ParsedRevision {
  headline: string;
  support_text: string;
  bullets: string[];
  cta: string;
  angle: string;
  status: "approved" | "warning" | "blocked";
  warnings: string[];
}

export type ParseResult =
  | { ok: true; variations: ParsedRevision[] }
  | { ok: false; error: string };

const MAX_RAW = 20_000;
const MAX_FIELD = 1_200;
const MAX_BULLET = 200;
const MAX_BULLETS = 8;
const MAX_WARNINGS = 12;

function sanitizeString(v: unknown, max = MAX_FIELD): string {
  if (typeof v !== "string") return "";
  // remove caracteres de controle e tags
  return v
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, max);
}

function sanitizeArray(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const s = sanitizeString(item, maxLen);
    if (s) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

function normalizeStatus(v: unknown): ParsedRevision["status"] {
  const s = sanitizeString(v, 30).toLowerCase();
  if (s === "blocked" || s === "warning") return s;
  return "approved";
}

function stripCodeFence(s: string): string {
  let t = s.trim();
  // remove "```json ... ```" ou "``` ... ```"
  const fence = /^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/m;
  const m = t.match(fence);
  if (m) t = m[1];
  // se ainda houver lixo antes/depois de { ... }
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  return t.trim();
}

function pickRevision(obj: Record<string, unknown>): ParsedRevision {
  return {
    headline: sanitizeString(obj.headline, 240),
    support_text: sanitizeString(obj.support_text, MAX_FIELD),
    bullets: sanitizeArray(obj.bullets, MAX_BULLETS, MAX_BULLET),
    cta: sanitizeString(obj.cta, 120),
    angle: sanitizeString(obj.angle, 60),
    status: normalizeStatus(obj.status),
    warnings: sanitizeArray(obj.warnings, MAX_WARNINGS, 240),
  };
}

/** Aceita JSON puro, JSON em bloco de código, e estruturas {variations: [...]}. */
export function parseChatGPTRevision(raw: string): ParseResult {
  if (typeof raw !== "string") return { ok: false, error: "Cole o conteúdo como texto." };
  if (raw.length > MAX_RAW) return { ok: false, error: "Resposta muito grande. Cole apenas o JSON da revisão." };
  const cleaned = stripCodeFence(raw);
  if (!cleaned) return { ok: false, error: "Conteúdo vazio." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return { ok: false, error: "JSON inválido. Verifique se copiou apenas o objeto JSON sem texto extra." };
  }
  if (!parsed || typeof parsed !== "object") return { ok: false, error: "Formato inesperado." };

  const obj = parsed as Record<string, unknown>;

  if (Array.isArray(obj.variations)) {
    const list = obj.variations.slice(0, 3).filter((v) => v && typeof v === "object") as Record<string, unknown>[];
    if (!list.length) return { ok: false, error: "Lista 'variations' vazia." };
    return { ok: true, variations: list.map(pickRevision) };
  }

  if (!("headline" in obj) && !("support_text" in obj)) {
    return { ok: false, error: "Campos esperados não encontrados (headline / support_text)." };
  }
  return { ok: true, variations: [pickRevision(obj)] };
}
