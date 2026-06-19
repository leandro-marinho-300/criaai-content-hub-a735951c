// Cria Aí — Construtor do PEDIDO EXTERNO para ChatGPT e parser do JSON de resposta.
// 100% determinístico, sem chamadas a IA. Cópia e colagem manual.

import type { Tables } from "@/integrations/supabase/types";
import { FORMAT_LABELS, OBJECTIVE_LABELS } from "./promptBuilder";
import {
  type CampaignFields,
  type ImportedCampaignContent,
  type ImportedPiece,
  sanitizeString,
  sanitizeStringArray,
} from "./campaignDevelopment";

type Brand = Tables<"brands">;
type Project = Tables<"content_projects">;

const arr = (v: string[] | null | undefined): string[] =>
  Array.isArray(v) ? v.filter((s) => s && String(s).trim()) : [];
const txt = (v: string | null | undefined): string => (v == null ? "" : String(v).trim());

function summarize(text: string | null | undefined, maxWords = 25): string {
  const t = txt(text);
  if (!t) return "—";
  const words = t.split(/\s+/);
  if (words.length <= maxWords) return t;
  return words.slice(0, maxWords).join(" ") + "…";
}

function listOrNone(xs: string[]): string {
  return xs.length ? xs.map((x) => `- ${x}`).join("\n") : "- nenhum";
}

export interface BuildExternalPromptArgs {
  brand: Brand;
  project: Project;
  /** Diferenciais escolhidos para ESTA campanha. */
  selectedDifferentiators?: string[];
  /** Termos a evitar nesta campanha (somam-se às palavras proibidas da marca). */
  avoidTerms?: string[];
  /** Campos da campanha já preenchidos manualmente (opcional). */
  campaign?: CampaignFields;
}

export function buildExternalCampaignPrompt(args: BuildExternalPromptArgs): string {
  const { brand, project, selectedDifferentiators, avoidTerms, campaign } = args;

  const formats = arr(project.selected_formats).map((f) => FORMAT_LABELS[f] ?? f);
  const objective = project.objective ? OBJECTIVE_LABELS[project.objective] ?? project.objective : "—";

  const differentiatorsAvailable = txt(brand.differentiators)
    ? txt(brand.differentiators).split(/[\n;•]/).map((s) => s.trim()).filter(Boolean)
    : [];
  const differentiatorsChosen = arr(selectedDifferentiators);
  const avoid = Array.from(
    new Set([
      ...arr(avoidTerms),
      ...arr(brand.prohibited_words),
    ]),
  );

  const mandatory: string[] = [];
  if (project.mandatory_information) mandatory.push(...project.mandatory_information.split(/\n+/).map((s) => s.trim()).filter(Boolean));
  if (project.event_date) mandatory.push(`Data do evento: ${project.event_date}`);
  if (project.event_time) mandatory.push(`Horário: ${project.event_time}`);
  if (project.location) mandatory.push(`Local: ${project.location}`);
  if (project.price_information) mandatory.push(`Valor: ${project.price_information}`);
  if (project.contact_information) mandatory.push(`Contato: ${project.contact_information}`);

  const audienceShort = summarize(project.specific_audience ?? brand.audience, 25);
  const toneShort = summarize([brand.tone_of_voice, brand.communication_style].filter(Boolean).join(". "), 25);
  const restrictions = summarize(
    [project.restrictions, brand.forbidden_inventions].filter(Boolean).join(". "),
    40,
  );

  const projectContext = [
    project.theme,
    project.main_message,
    project.audience_problem,
    project.notes,
  ].filter(Boolean).join("\n\n");

  // Campos já preenchidos manualmente, se houver
  const preset: string[] = [];
  if (campaign?.angle) preset.push(`Ângulo definido: ${campaign.angle}`);
  if (campaign?.central_message) preset.push(`Mensagem central definida: ${campaign.central_message}`);
  if (campaign?.main_cta) preset.push(`CTA já definido: ${campaign.main_cta}`);

  const formatsForJson = arr(project.selected_formats).map((f) => `"${f}"`).join(", ");

  const lines: string[] = [];
  lines.push("Desenvolva o conteúdo da campanha abaixo e devolva SOMENTE JSON válido.");
  lines.push("");
  lines.push("=== CONTEXTO ===");
  lines.push(`MARCA: ${brand.name}`);
  lines.push(`PROJETO: ${txt(project.internal_title) || "—"}`);
  lines.push(`TEMA: ${txt(project.theme) || "—"}`);
  lines.push(`OBJETIVO: ${objective}`);
  lines.push(`FORMATOS: ${formats.join(", ") || "—"}`);
  lines.push(`PÚBLICO RESUMIDO: ${audienceShort}`);
  lines.push(`TOM DA MARCA: ${toneShort}`);
  lines.push("");
  lines.push("CONTEXTO DO PROJETO:");
  lines.push(projectContext || "—");
  lines.push("");
  lines.push("DIFERENCIAIS DISPONÍVEIS (use só se realmente relevantes):");
  lines.push(listOrNone(differentiatorsAvailable));
  lines.push("");
  lines.push("DIFERENCIAIS SELECIONADOS PARA ESTA CAMPANHA:");
  lines.push(listOrNone(differentiatorsChosen));
  lines.push("");
  lines.push("EVITAR NESTA CAMPANHA (não citar, mesmo indiretamente):");
  lines.push(listOrNone(avoid));
  lines.push("");
  lines.push("INFORMAÇÕES OBRIGATÓRIAS (preservar literalmente quando aparecerem):");
  lines.push(listOrNone(mandatory));
  lines.push("");
  lines.push(`RESTRIÇÕES: ${restrictions}`);
  if (preset.length) {
    lines.push("");
    lines.push("CAMPOS JÁ DEFINIDOS PELO USUÁRIO (manter):");
    preset.forEach((p) => lines.push(`- ${p}`));
  }
  lines.push("");
  lines.push("=== TAREFA ===");
  lines.push("Desenvolva a campanha de forma ORIGINAL e ESPECÍFICA para o tema do projeto.");
  lines.push("- Não use os diferenciais da marca como assunto principal das peças.");
  lines.push("- Não repita 'atendimento humano', 'suporte', 'orçamento' ou frases institucionais salvo quando forem realmente relevantes ou estiverem em DIFERENCIAIS SELECIONADOS.");
  lines.push("- Respeite a lista EVITAR estritamente.");
  lines.push("- Se o tema/título contiver promessa numérica (ex.: '5 pontos'), entregue exatamente essa quantidade de itens.");
  lines.push("- Para Carrossel: uma entrada por página (capa + N itens + CTA).");
  lines.push("- Para Sequência de Stories / Status do WhatsApp: uma entrada por tela.");
  lines.push("- Para Reel: blocos do roteiro (capa, cenas, CTA).");
  lines.push("- Não invente preço, data, telefone ou condição fora das INFORMAÇÕES OBRIGATÓRIAS.");
  lines.push("");
  lines.push("=== FORMATO DA RESPOSTA (JSON puro, sem comentários) ===");
  lines.push("{");
  lines.push('  "campaign": {');
  lines.push('    "angle": "",');
  lines.push('    "central_message": "",');
  lines.push('    "main_promise": "",');
  lines.push('    "main_pain": "",');
  lines.push('    "main_benefit": "",');
  lines.push('    "audience_desires": [],');
  lines.push('    "key_points": [],');
  lines.push('    "selected_differentiators": [],');
  lines.push('    "terms_to_avoid": [],');
  lines.push('    "commercial_intensity": "none | light | moderate | direct",');
  lines.push('    "cta_strategy": "",');
  lines.push('    "main_cta": "",');
  lines.push('    "narrative_structure": "",');
  lines.push('    "visual_focus": ""');
  lines.push("  },");
  lines.push('  "pieces": [');
  lines.push("    {");
  lines.push(`      "id": "p1", "format": ${formatsForJson ? `one of [${formatsForJson}]` : '""'}, "role": "capa | item_1 | cta | gancho | principal | …",`);
  lines.push('      "objective": "", "angle": "", "headline": "", "support_text": "",');
  lines.push('      "bullets": [], "cta": "", "visual_focus": "", "continuity_note": "", "warnings": []');
  lines.push("    }");
  lines.push("  ],");
  lines.push('  "caption": { "text": "", "hashtags": [] },');
  lines.push('  "warnings": []');
  lines.push("}");
  lines.push("");
  lines.push("Responda APENAS com o JSON. Sem texto antes ou depois. Sem blocos de markdown.");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// PARSER do JSON devolvido pelo ChatGPT
// ---------------------------------------------------------------------------

const MAX_RAW_SIZE = 200_000; // 200 KB

export interface ParseResult {
  ok: boolean;
  content?: ImportedCampaignContent;
  error?: string;
}

const ALLOWED_INTENSITY = new Set(["none", "light", "moderate", "direct"]);

function stripMarkdownFence(raw: string): string {
  let s = raw.trim();
  // remove blocos ```json ... ``` ou ``` ... ```
  s = s.replace(/^```(?:json|JSON)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
  // Se vier com texto fora do JSON, tenta encontrar o primeiro { ... } balanceado
  if (!s.startsWith("{")) {
    const first = s.indexOf("{");
    const last = s.lastIndexOf("}");
    if (first >= 0 && last > first) s = s.slice(first, last + 1);
  }
  return s;
}

function parsePiecesArray(input: unknown): ImportedPiece[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 60).map((p) => {
    const o = (p ?? {}) as Record<string, unknown>;
    return {
      id: sanitizeString(o.id, 60),
      format: sanitizeString(o.format, 40),
      role: sanitizeString(o.role, 40),
      objective: sanitizeString(o.objective, 300),
      angle: sanitizeString(o.angle, 60),
      headline: sanitizeString(o.headline, 240),
      support_text: sanitizeString(o.support_text, 600),
      bullets: sanitizeStringArray(o.bullets, 12, 200),
      cta: sanitizeString(o.cta, 180),
      visual_focus: sanitizeString(o.visual_focus, 400),
      continuity_note: sanitizeString(o.continuity_note, 300),
      warnings: sanitizeStringArray(o.warnings, 10, 280),
    } as ImportedPiece;
  });
}

function parseCampaignFields(input: unknown): CampaignFields {
  const o = (input ?? {}) as Record<string, unknown>;
  const intensity = sanitizeString(o.commercial_intensity, 20).toLowerCase();
  return {
    angle: sanitizeString(o.angle, 160),
    central_message: sanitizeString(o.central_message, 400),
    main_promise: sanitizeString(o.main_promise, 400),
    main_pain: sanitizeString(o.main_pain, 400),
    main_benefit: sanitizeString(o.main_benefit, 400),
    audience_desires: sanitizeStringArray(o.audience_desires, 15, 200),
    key_points: sanitizeStringArray(o.key_points, 15, 200),
    selected_differentiators: sanitizeStringArray(o.selected_differentiators, 15, 120),
    terms_to_avoid: sanitizeStringArray(o.terms_to_avoid, 30, 80),
    commercial_intensity: (ALLOWED_INTENSITY.has(intensity)
      ? (intensity as CampaignFields["commercial_intensity"])
      : undefined),
    cta_strategy: sanitizeString(o.cta_strategy, 300),
    main_cta: sanitizeString(o.main_cta, 180),
    narrative_structure: sanitizeString(o.narrative_structure, 300),
    visual_focus: sanitizeString(o.visual_focus, 300),
  };
}

export function parseCampaignJSON(raw: string): ParseResult {
  if (!raw || typeof raw !== "string") return { ok: false, error: "Resposta vazia." };
  if (raw.length > MAX_RAW_SIZE) return { ok: false, error: "Resposta muito grande (limite 200 KB)." };
  const cleaned = stripMarkdownFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return { ok: false, error: `JSON inválido: ${(e as Error).message}` };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "A resposta precisa ser um objeto JSON com 'campaign' e 'pieces'." };
  }
  const obj = parsed as Record<string, unknown>;

  const campaign = parseCampaignFields(obj.campaign);
  const pieces = parsePiecesArray(obj.pieces);
  const captionInput = (obj.caption ?? {}) as Record<string, unknown>;
  const content: ImportedCampaignContent = {
    campaign,
    pieces,
    caption: {
      text: sanitizeString(captionInput.text, 1500),
      hashtags: sanitizeStringArray(captionInput.hashtags, 30, 40),
    },
    warnings: sanitizeStringArray(obj.warnings, 10, 280),
    source: "external_chatgpt",
    imported_at: new Date().toISOString(),
  };

  if (!pieces.length && !campaign.central_message && !campaign.main_promise) {
    return { ok: false, error: "JSON sem 'pieces' nem campos essenciais de 'campaign'." };
  }
  return { ok: true, content };
}
