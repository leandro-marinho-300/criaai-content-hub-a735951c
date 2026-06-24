// Cria Aí — Prompt Builder determinístico (sem IA).
// Gera um PACOTE DE PRODUÇÃO POR PEÇA com camada editorial:
// • detecta a intenção editorial (lista numerada, erros, checklist…);
// • respeita a quantidade prometida (ex.: "5 pontos" => exatamente 5 itens);
// • separa contexto da marca (orientação) de conteúdo publicável;
// • escreve textos curtos, valida com copyQuality e bloqueia copy reprovada;
// • monta um prompt operacional ENXUTO por página.

import type { Tables } from "@/integrations/supabase/types";
import { composeCopy, summarizeAudience, type ComposedCopy, type CopyAngle, ALL_ANGLES, variationByAngle } from "./copyComposer";
import {
  checkCopyQuality,
  pickBestCopy,
  enforceLimit,
  worseStatus,
  type QualityIssue,
  type CopyStatus,
} from "./copyQuality";
import { FORMAT_RULES, extractCaptionMode, classifyOutput, reelKeyFromRole, type OutputKind } from "./formatOutputRules";
import { detectEditorialIntent, buildEditorialItems, type EditorialIntent } from "./editorialIntent";

export type Brand = Tables<"brands">;
export type Project = Tables<"content_projects">;

export type GenerationMode = "safe" | "fast";
export type { CopyAngle } from "./copyComposer";
export { ALL_ANGLES, variationByAngle } from "./copyComposer";

// -------- tipos públicos --------

export interface Piece {
  index: number;
  formatKey: string;
  role: string;
  name: string;
  formatLabel: string;
  objective: string;
  communicationAngle: CopyAngle;
  mainPromise: string;
  mainProblem: string;
  mainBenefit: string;
  mainText: string;
  supportText: string;
  bullets: string[];
  cta: string;
  caption?: string;
  hashtags?: string[];
  productionNotes: string[];
  readyPrompt: string;
  warning?: string;
  qualityIssues?: QualityIssue[];
  /** approved | warning | blocked. blocked impede uso direto do prompt. */
  qualityStatus: CopyStatus;
  headlineOptions: string[];
  supportTextOptions: string[];
  /** Classificação da peça: publicável, texto da publicação, material interno. */
  outputKind?: OutputKind;
  /** Origem da copy atual. */
  copySource?: "deterministic" | "manual" | "external_chatgpt";
  /** Histórico curto (últimas 3) de versões anteriores para restauração. */
  revisionHistory?: Array<{
    date: string;
    source: "manual" | "external_chatgpt" | "deterministic";
    mainText: string;
    supportText: string;
    bullets: string[];
    cta: string;
    angle?: string;
    guidance?: Record<string, unknown>;
  }>;
}

export interface CampaignSummary {
  brandName: string;
  internalTitle: string;
  theme: string;
  objective: string;
  formats: string[];
  mainMessage: string;
  callToAction: string;
}

export interface PromptBlock {
  key: string;
  title: string;
  content: string;
}

export interface PromptBuildResult {
  summary: CampaignSummary;
  pieces: Piece[];
  masterPrompt: string;
  blocks: PromptBlock[];
}

export interface BuildArgs {
  brand: Brand;
  project: Project;
  mode?: GenerationMode;
}

// -------- labels (mantidos para o wizard) --------

export const FORMAT_LABELS: Record<string, string> = {
  post: "Post para Feed",
  carrossel: "Carrossel",
  story: "Story",
  sequencia_stories: "Sequência de Stories",
  status_whatsapp: "Status do WhatsApp",
  reel: "Reel",
  capa_reel: "Capa de Reel",
  comunicado: "Comunicado",
  banner: "Banner",
  texto_grupo: "Texto para grupo",
  impresso: "Material impresso",
  outro: "Outro formato",
};

export const OBJECTIVE_LABELS: Record<string, string> = {
  informar: "Informar",
  educar: "Educar",
  vender: "Vender",
  divulgar_servico: "Divulgar serviço",
  divulgar_produto: "Divulgar produto",
  gerar_contatos: "Gerar contatos",
  aumentar_reconhecimento: "Aumentar reconhecimento",
  relacionamento: "Relacionamento",
  comunicado: "Comunicado",
  data_comemorativa: "Data comemorativa",
  bastidores: "Bastidores",
  campanha: "Campanha",
  outro: "Outro",
};

export const OUTPUT_LABELS: Record<string, string> = {
  estrategia: "Estratégia",
  conceito: "Conceito criativo",
  textos_artes: "Textos das artes",
  layouts: "Layouts",
  carrossel: "Carrossel",
  stories: "Stories",
  roteiro_reel: "Roteiro de Reel",
  legenda_curta: "Legenda curta",
  legenda_media: "Legenda intermediária",
  legenda_completa: "Legenda completa",
  whatsapp: "Versão para WhatsApp",
  hashtags: "Hashtags",
  engajamento: "Recursos de engajamento",
  prompt_visual: "Prompt visual",
  texto_alternativo: "Texto alternativo",
  checklist: "Checklist de qualidade",
};

// -------- helpers --------

const blank = (v: unknown): boolean => v == null || (typeof v === "string" && v.trim() === "");
const arr = (v: string[] | null | undefined): string[] => (Array.isArray(v) ? v.filter((s) => s && s.trim()) : []);
const list = (v: string[] | null | undefined, sep = ", "): string => arr(v).join(sep);
const txt = (v: string | null | undefined, fallback = ""): string => (blank(v) ? fallback : String(v).trim());
const unique = <T,>(xs: T[]): T[] => Array.from(new Set(xs));

const slug = (s: string): string =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join("");

const FORMAT_RATIO: Record<string, string> = {
  post: "4:5 (Feed)",
  carrossel: "4:5 (Carrossel)",
  story: "9:16 (Story)",
  sequencia_stories: "9:16 (Story)",
  status_whatsapp: "9:16 (Status)",
  reel: "9:16 (Reel)",
  capa_reel: "9:16 (Capa de Reel)",
  comunicado: "1:1 ou 4:5",
  banner: "16:9 (Banner)",
  texto_grupo: "somente texto",
  impresso: "A4 / personalizado",
  outro: "conforme uso",
};

const formatLabel = (key: string): string => `${FORMAT_LABELS[key] ?? key} · ${FORMAT_RATIO[key] ?? "conforme uso"}`;

// -------- templates de papéis (formatos NÃO-carrossel) --------

interface RoleTemplate {
  role: string;
  name: string;
  objective: string;
}

const ROLE_TEMPLATES: Record<string, RoleTemplate[]> = {
  post: [{ role: "apresentacao", name: "Post Feed — Apresentação", objective: "apresentar a mensagem central com impacto visual e CTA claro" }],
  // carrossel é DINÂMICO, baseado em editorialIntent — não usa este array
  carrossel: [],
  story: [{ role: "unico", name: "Story — Peça única", objective: "comunicar a mensagem central em um único Story" }],
  sequencia_stories: [
    { role: "gancho", name: "Story 1 — Gancho", objective: "gerar curiosidade imediata" },
    { role: "contexto", name: "Story 2 — Contexto", objective: "contextualizar o tema para o público" },
    { role: "beneficio", name: "Story 3 — Benefício", objective: "destacar o benefício principal" },
    { role: "prova", name: "Story 4 — Prova / Diferencial", objective: "reforçar credibilidade ou diferencial" },
    { role: "cta", name: "Story 5 — CTA", objective: "incentivar a ação esperada" },
  ],
  status_whatsapp: [
    { role: "gancho", name: "Status WhatsApp 1 — Gancho", objective: "abrir com curiosidade ou impacto" },
    { role: "principal", name: "Status WhatsApp 2 — Mensagem principal", objective: "comunicar a oferta de forma direta e curta" },
    { role: "cta", name: "Status WhatsApp 3 — CTA", objective: "reforçar o CTA e gerar resposta imediata" },
  ],
  reel: [
    { role: "capa", name: "Reel — Capa", objective: "capa estática atrativa que represente o vídeo" },
    { role: "roteiro", name: "Reel — Roteiro (15-30s)", objective: "roteiro completo do vídeo com falas e cenas" },
    { role: "legenda", name: "Reel — Legenda + CTA", objective: "legenda otimizada para alcance com CTA" },
  ],
  capa_reel: [{ role: "capa", name: "Capa de Reel", objective: "criar capa estática para o Reel" }],
  comunicado: [{ role: "unico", name: "Comunicado — Peça única", objective: "comunicar de forma objetiva e clara" }],
  banner: [{ role: "unico", name: "Banner", objective: "comunicar a mensagem em formato banner" }],
  texto_grupo: [{ role: "unico", name: "Texto para Grupo", objective: "mensagem para enviar em grupo de WhatsApp" }],
  impresso: [{ role: "unico", name: "Material Impresso", objective: "peça para impressão" }],
  outro: [{ role: "unico", name: "Peça Personalizada", objective: "peça conforme briefing" }],
};

// -------- limites de copy por papel --------

interface CopyLimits {
  headlineMax: number;
  supportMax: number;
  bulletMax: number;
}
const LIMITS: Record<string, CopyLimits> = {
  capa: { headlineMax: 70, supportMax: 110, bulletMax: 70 },
  item: { headlineMax: 55, supportMax: 180, bulletMax: 70 },
  cta: { headlineMax: 65, supportMax: 120, bulletMax: 70 },
  default: { headlineMax: 80, supportMax: 220, bulletMax: 70 },
};

function limitsFor(role: string): CopyLimits {
  if (role === "capa" || role === "gancho") return LIMITS.capa;
  if (role.startsWith("item_") || role === "principal") return LIMITS.item;
  if (role === "cta" || role === "reforco") return LIMITS.cta;
  return LIMITS.default;
}

// -------- derivação SEMÂNTICA dos textos por papel --------

interface DerivedTexts {
  mainText: string;
  supportText: string;
  cta: string;
  bullets: string[];
  qualityIssues: QualityIssue[];
  qualityStatus: CopyStatus;
}

function evaluateAndCollect(text: string, opts: Parameters<typeof checkCopyQuality>[1], label: string): { issues: QualityIssue[]; status: CopyStatus } {
  if (!text) return { issues: [], status: "approved" };
  const q = checkCopyQuality(text, opts);
  return {
    issues: q.issues.map((i) => ({ ...i, message: `${label}: ${i.message}` })),
    status: q.status,
  };
}

function deriveTextsFromComposed(role: string, composed: ComposedCopy, brand: Brand): DerivedTexts {
  const prohibited = arr(brand.prohibited_words);
  const headlines = composed.headline_options;
  const supports = composed.support_text_options;
  const ctaLine = composed.cta_line;
  const bullets = composed.bullet_options;
  const lims = limitsFor(role);

  const headOpts = { prohibited, isHeadline: true as const, minLen: 8, maxLen: lims.headlineMax };
  const paraOpts = { prohibited, minLen: 20, maxLen: lims.supportMax };

  const bestHeadline = pickBestCopy(headlines, headOpts);
  const bestSupport = pickBestCopy(supports, paraOpts);
  const altHeadline = pickBestCopy(headlines.slice(1).concat(headlines), headOpts);

  let mainText = "";
  let supportText = "";
  let cta = "";
  let useBullets: string[] = [];

  switch (role) {
    case "gancho":
    case "capa":
      mainText = bestHeadline.text;
      supportText = composed.main_problem || composed.support_text_options[0] || "";
      break;
    case "contexto":
      mainText = composed.main_problem || bestHeadline.text;
      supportText = bestSupport.text;
      break;
    case "beneficio":
      mainText = composed.key_promise;
      supportText = composed.main_benefit || bestSupport.text;
      useBullets = bullets.slice(0, 3);
      break;
    case "prova":
      mainText = composed.trust_angle;
      supportText = composed.main_benefit || bestSupport.text;
      break;
    case "fechamento":
      mainText = composed.key_promise;
      supportText = bestSupport.text;
      break;
    case "cta":
    case "reforco":
      mainText = ctaLine;
      supportText = composed.trust_angle;
      cta = ctaLine;
      break;
    case "principal":
      mainText = bestHeadline.text;
      supportText = bestSupport.text;
      cta = ctaLine;
      useBullets = bullets.slice(0, 3);
      break;
    case "roteiro":
    case "legenda":
      mainText = bestHeadline.text;
      supportText = bestSupport.text;
      cta = ctaLine;
      break;
    case "unico":
    case "apresentacao":
    default:
      mainText = bestHeadline.text;
      supportText = bestSupport.text;
      cta = ctaLine;
      useBullets = bullets.slice(0, 3);
      break;
  }

  // aplica limites antes de validar
  mainText = enforceLimit(mainText, lims.headlineMax);
  supportText = enforceLimit(supportText, lims.supportMax);
  useBullets = useBullets.map((b) => enforceLimit(b, lims.bulletMax)).filter(Boolean);

  const mainEval = evaluateAndCollect(mainText, { ...headOpts, isHeadline: true }, "Texto principal");
  const suppEval = evaluateAndCollect(supportText, paraOpts, "Texto de apoio");

  const status = worseStatus(mainEval.status, suppEval.status);
  return {
    mainText,
    supportText,
    cta,
    bullets: useBullets,
    qualityIssues: [...mainEval.issues, ...suppEval.issues],
    qualityStatus: status,
  };
}

// -------- legenda ÚNICA por publicação --------

function buildCaptionForCarousel(brand: Brand, project: Project, composed: ComposedCopy, intent: EditorialIntent): string {
  const lines: string[] = [];
  const audience = summarizeAudience(project.specific_audience ?? brand.audience, "você");
  // gancho
  if (composed.headline_options[0]) lines.push(composed.headline_options[0]);
  // resumo
  const summary = intent.expectedItems > 0
    ? `Reunimos ${intent.expectedItems} ${intent.itemNounPlural} para ajudar ${audience} a decidir com mais clareza.`
    : (composed.support_text_options[0] || composed.key_promise);
  if (summary) lines.push("", summary);
  // conexão com a marca
  if (composed.trust_angle) lines.push("", composed.trust_angle);
  // CTA
  if (composed.cta_line) lines.push("", `👉 ${composed.cta_line}`);
  const contact = txt(project.contact_information);
  if (contact) lines.push(contact);
  return lines.join("\n").trim();
}

function buildCaptionSimple(brand: Brand, project: Project, composed: ComposedCopy, piece: { mainText: string; cta: string }): string {
  const lines: string[] = [];
  if (piece.mainText) lines.push(piece.mainText);
  if (composed.support_text_options[0]) lines.push("", composed.support_text_options[0]);
  if (piece.cta || composed.cta_line) lines.push("", `👉 ${piece.cta || composed.cta_line}`);
  const contact = txt(project.contact_information);
  if (contact) lines.push(contact);
  void brand;
  return lines.join("\n").trim();
}

// -------- HASHTAGS limpas (5 a 12) --------

function buildHashtags(brand: Brand, project: Project): string[] {
  const tags = new Set<string>();
  const push = (raw: string) => {
    const s = slug(raw);
    if (!s) return;
    if (s.length < 3 || s.length > 25) return; // descarta hashtags enormes
    tags.add(`#${s}`);
  };
  push(brand.name);
  if (brand.segment) push(brand.segment);
  if (brand.service_region) push(brand.service_region);
  const themeWords = txt(project.theme).split(/\s+/).filter((w) => w.length >= 5 && w.length <= 15).slice(0, 4);
  themeWords.forEach((w) => push(w));
  arr(brand.recommended_words).slice(0, 6).forEach((w) => {
    // se vier "frase inteira", pega só primeiras 2 palavras
    const short = w.split(/\s+/).slice(0, 2).join(" ");
    push(short);
  });
  const out = Array.from(tags).slice(0, 12);
  if (out.length < 5) {
    // garante mínimo de 5 com seeds genéricos do segmento
    const seeds = ["#Marca", "#Conteudo", "#Comunicacao", "#Negocios", "#Atendimento"];
    for (const s of seeds) {
      if (out.length >= 5) break;
      if (!out.includes(s)) out.push(s);
    }
  }
  return out;
}

// -------- observações de produção --------

function buildProductionNotes(role: string, brand: Brand, project: Project): string[] {
  const notes: string[] = [];
  const style = txt(project.desired_style) || txt(brand.visual_style);
  if (style) notes.push(`Estilo visual: ${style}.`);
  if (brand.primary_color) notes.push(`Cor principal: ${brand.primary_color}.`);
  if (brand.fonts) notes.push(`Tipografia: ${brand.fonts}.`);
  if (role === "capa" || role === "gancho" || role === "apresentacao" || role === "unico" || role === "principal") {
    notes.push("Respiro no topo para o título; logo discreta no canto.");
  }
  if (role === "cta" || role === "reforco") {
    notes.push("CTA em destaque, com contraste alto.");
  }
  if (role.startsWith("item_") || role === "contexto" || role === "prova" || role === "fechamento") {
    notes.push("Prioridade para legibilidade; evitar excesso de elementos.");
  }
  if (brand.graphic_elements) notes.push(`Elementos gráficos: ${brand.graphic_elements}.`);
  return notes;
}

// -------- prompt operacional ENXUTO --------

export interface PromptBuildCtx {
  piece: Omit<Piece, "readyPrompt" | "caption" | "hashtags" | "warning">;
  brand: Brand;
  project: Project;
  mode: GenerationMode;
  productionNotes: string[];
  /** Restrições resumidas que aparecem no contexto enxuto. */
  restrictionsBrief?: string;
}

export function buildReadyPrompt(args: PromptBuildCtx): string {
  const { piece, brand, project, mode, productionNotes, restrictionsBrief } = args;

  // se a copy está bloqueada, devolve mensagem clara em vez de "USAR EXATAMENTE"
  if (piece.qualityStatus === "blocked") {
    return [
      `⚠ Esta copy precisa ser revisada antes da produção.`,
      ``,
      `Peça: ${piece.name} (${piece.formatLabel}).`,
      `Objetivo: ${piece.objective}.`,
      ``,
      `Edite o conteúdo desta peça para liberar o prompt operacional.`,
      `Motivos detectados: ${(piece.qualityIssues ?? []).map((i) => i.message).join("; ") || "qualidade insuficiente"}.`,
    ].join("\n");
  }

  const style = txt(project.desired_style) || txt(brand.visual_style) || "alinhado à identidade da marca";
  const identityBits = [
    brand.primary_color ? `cor principal ${brand.primary_color}` : null,
    brand.secondary_color ? `cor secundária ${brand.secondary_color}` : null,
    brand.fonts ? `tipografia ${brand.fonts}` : null,
  ].filter(Boolean).join(", ");

  const block: string[] = [];
  block.push(`Crie a arte para ${piece.formatLabel} da empresa "${brand.name}", no estilo ${style}.`);
  block.push("");
  block.push(`Função desta página: ${piece.objective}.`);

  if (piece.mainText) block.push(`Texto principal (USAR EXATAMENTE): "${piece.mainText}"`);
  if (piece.supportText) block.push(`Texto de apoio (USAR EXATAMENTE): "${piece.supportText}"`);
  if (piece.bullets && piece.bullets.length) {
    block.push("Destaques (bullets curtos):");
    piece.bullets.forEach((b) => block.push(`  • ${b}`));
  }
  if (piece.cta) block.push(`CTA: "${piece.cta}"`);

  if (identityBits) block.push(`Identidade visual: ${identityBits}.`);
  if (productionNotes.length) {
    block.push("Composição:");
    productionNotes.forEach((n) => block.push(`- ${n}`));
  }

  // dados literais quando existirem (não inventar)
  const dataLines: string[] = [];
  if (project.event_date) dataLines.push(`data ${project.event_date}`);
  if (project.event_time) dataLines.push(`horário ${project.event_time}`);
  if (project.location) dataLines.push(`local ${project.location}`);
  if (project.price_information) dataLines.push(`valor ${project.price_information}`);
  if (project.contact_information) dataLines.push(`contato ${project.contact_information}`);
  if (dataLines.length) block.push(`Dados literais (não alterar): ${dataLines.join("; ")}.`);

  block.push("");
  block.push("Regras essenciais:");
  block.push("- Não inventar preço, data, telefone, condição ou benefício fora deste prompt.");
  block.push("- Preferir camadas de texto legíveis a textos longos sobre a imagem.");
  if (restrictionsBrief) block.push(`- Restrições da marca: ${restrictionsBrief}.`);
  if (mode === "safe") block.push("- Em caso de dúvida, escrever [PREENCHER] em vez de inventar.");

  if (piece.role === "roteiro") {
    block.push("");
    block.push("Roteiro do Reel: [0-2s] gancho, [2-15s] desenvolvimento em 2-3 cortes, [15-25s] virada, [25-30s] CTA. Para cada bloco: FALA, TEXTO NA TELA, AÇÃO.");
  }

  return block.join("\n");
}

// Resumo enxuto de restrições da marca para usar em cada prompt individual.
export function summarizeRestrictions(brand: Brand, avoidTerms: string[] = []): string {
  const parts: string[] = [];
  if (brand.forbidden_inventions) {
    const f = brand.forbidden_inventions.split(/[.;\n]/)[0].trim().slice(0, 120);
    if (f) parts.push(f);
  }
  const prohibited = arr(brand.prohibited_words).concat(avoidTerms.filter(Boolean));
  if (prohibited.length) {
    parts.push(`palavras proibidas: ${prohibited.join(", ")}`);
  }
  return parts.join("; ");
}

// Lê arrays opcionais salvos no project (selected_differentiators / avoid_terms).
function projectAvoidTerms(project: Project): string[] {
  const raw = (project as unknown as { avoid_terms?: string[] }).avoid_terms;
  return Array.isArray(raw) ? raw.filter((s) => !!s && typeof s === "string") : [];
}

function projectImported(project: Project): {
  campaign?: Record<string, unknown>;
  pieces?: Array<Record<string, unknown>>;
  caption?: { text?: string; hashtags?: string[] };
  source?: string;
} | null {
  const raw = (project as unknown as { campaign_content_json?: unknown }).campaign_content_json;
  if (!raw || typeof raw !== "object") return null;
  return raw as ReturnType<typeof projectImported>;
}


// -------- avaliação de informações parciais --------

function pieceWarning(role: string, project: Project): string | undefined {
  const missing: string[] = [];
  if (!txt(project.main_message)) missing.push("mensagem principal");
  if ((role === "cta" || role === "reforco" || role === "principal") && !txt(project.call_to_action)) missing.push("CTA");
  if (!missing.length) return undefined;
  return `Esta peça foi gerada com base em informações parciais (${missing.join(", ")}). Revise antes de publicar.`;
}

// -------- construção de peças de carrossel via INTENT --------

function buildCarouselPieces(args: {
  indexStart: number;
  brand: Brand;
  project: Project;
  composed: ComposedCopy;
  intent: EditorialIntent;
  angle: CopyAngle;
  mode: GenerationMode;
}): { pieces: Piece[]; nextIndex: number } {
  const { brand, project, composed, intent, angle, mode } = args;
  const restrictionsBrief = summarizeRestrictions(brand, projectAvoidTerms(project));
  const fmtLabel = formatLabel("carrossel");
  const pieces: Piece[] = [];
  let index = args.indexStart;

  // CAPA
  index += 1;
  const capaDerived = deriveTextsFromComposed("capa", composed, brand);
  const capaName = "Carrossel — Página 1 (Capa)";
  const capaBase: Omit<Piece, "readyPrompt" | "caption" | "hashtags" | "warning"> = {
    index, formatKey: "carrossel", role: "capa", name: capaName, formatLabel: fmtLabel,
    objective: "gancho e promessa que justifique avançar",
    communicationAngle: angle,
    mainPromise: composed.key_promise,
    mainProblem: composed.main_problem,
    mainBenefit: composed.main_benefit,
    mainText: capaDerived.mainText,
    supportText: capaDerived.supportText,
    bullets: [],
    cta: "",
    productionNotes: buildProductionNotes("capa", brand, project),
    qualityIssues: capaDerived.qualityIssues.length ? capaDerived.qualityIssues : undefined,
    qualityStatus: capaDerived.qualityStatus,
    headlineOptions: composed.headline_options,
    supportTextOptions: composed.support_text_options,
  };
  const capaPiece: Piece = {
    ...capaBase,
    readyPrompt: buildReadyPrompt({ piece: capaBase, brand, project, mode, productionNotes: capaBase.productionNotes, restrictionsBrief }),
  };
  // legenda ÚNICA da publicação fica na capa
  capaPiece.caption = buildCaptionForCarousel(brand, project, composed, intent);
  pieces.push(capaPiece);

  // ITENS (se for lista numerada / checklist / etc.)
  if (intent.expectedItems > 0) {
    const items = buildEditorialItems(intent, brand, project, intent.expectedItems);
    const itemLims = limitsFor("item");
    items.forEach((it, i) => {
      index += 1;
      const num = i + 1;
      const rawTitle = `${num}. ${it.title}`;
      const mainText = enforceLimit(rawTitle, itemLims.headlineMax);
      const supportText = enforceLimit(it.support, itemLims.supportMax);

      const mainEval = evaluateAndCollect(mainText, { isHeadline: true, prohibited: arr(brand.prohibited_words), minLen: 3, maxLen: itemLims.headlineMax }, "Texto principal");
      const suppEval = evaluateAndCollect(supportText, { prohibited: arr(brand.prohibited_words), minLen: 15, maxLen: itemLims.supportMax }, "Texto de apoio");
      const status = worseStatus(mainEval.status, suppEval.status);
      const issues = [...mainEval.issues, ...suppEval.issues];

      const role = `item_${num}`;
      const objective = it.generic
        ? `Apresentar o ${intent.itemNounSingular} ${num} (orientação geral — confirmar com a marca antes de publicar)`
        : `Apresentar o ${intent.itemNounSingular} ${num} com base em informações do briefing`;

      const base: Omit<Piece, "readyPrompt" | "caption" | "hashtags" | "warning"> = {
        index, formatKey: "carrossel", role,
        name: `Carrossel — Página ${num + 1} (${cap(intent.itemNounSingular)} ${num})`,
        formatLabel: fmtLabel,
        objective,
        communicationAngle: angle,
        mainPromise: composed.key_promise,
        mainProblem: composed.main_problem,
        mainBenefit: composed.main_benefit,
        mainText,
        supportText,
        bullets: [],
        cta: "",
        productionNotes: buildProductionNotes(role, brand, project),
        qualityIssues: issues.length ? issues : undefined,
        qualityStatus: status,
        headlineOptions: [mainText],
        supportTextOptions: [supportText],
      };
      const piece: Piece = {
        ...base,
        readyPrompt: buildReadyPrompt({ piece: base, brand, project, mode, productionNotes: base.productionNotes, restrictionsBrief }),
      };
      if (it.generic) {
        piece.warning = "Orientação geral segura — confirme com a marca antes de publicar.";
      }
      pieces.push(piece);
    });
  } else {
    // sem promessa numérica: usa estrutura clássica (contexto + desenvolvimento + fechamento)
    const classic: { role: string; nameSuffix: string; objective: string }[] = [
      { role: "contexto", nameSuffix: "Contexto", objective: "contextualizar o problema, desejo ou cenário" },
      { role: "beneficio", nameSuffix: "Benefício", objective: "apresentar o benefício principal de forma direta" },
      { role: "prova", nameSuffix: "Prova", objective: "reforçar credibilidade ou diferencial" },
      { role: "fechamento", nameSuffix: "Fechamento", objective: "sintetizar a mensagem em frase de impacto" },
    ];
    classic.forEach((c, i) => {
      index += 1;
      const derived = deriveTextsFromComposed(c.role, composed, brand);
      const base: Omit<Piece, "readyPrompt" | "caption" | "hashtags" | "warning"> = {
        index, formatKey: "carrossel", role: c.role,
        name: `Carrossel — Página ${i + 2} (${c.nameSuffix})`,
        formatLabel: fmtLabel,
        objective: c.objective,
        communicationAngle: angle,
        mainPromise: composed.key_promise,
        mainProblem: composed.main_problem,
        mainBenefit: composed.main_benefit,
        mainText: derived.mainText,
        supportText: derived.supportText,
        bullets: derived.bullets,
        cta: "",
        productionNotes: buildProductionNotes(c.role, brand, project),
        qualityIssues: derived.qualityIssues.length ? derived.qualityIssues : undefined,
        qualityStatus: derived.qualityStatus,
        headlineOptions: composed.headline_options,
        supportTextOptions: composed.support_text_options,
      };
      pieces.push({
        ...base,
        readyPrompt: buildReadyPrompt({ piece: base, brand, project, mode, productionNotes: base.productionNotes, restrictionsBrief }),
      });
    });
  }

  // CTA final
  index += 1;
  const ctaDerived = deriveTextsFromComposed("cta", composed, brand);
  const ctaBase: Omit<Piece, "readyPrompt" | "caption" | "hashtags" | "warning"> = {
    index, formatKey: "carrossel", role: "cta",
    name: `Carrossel — Página ${pieces.length + 1} (CTA)`,
    formatLabel: fmtLabel,
    objective: "chamar a ação com clareza e incentivo direto",
    communicationAngle: angle,
    mainPromise: composed.key_promise,
    mainProblem: composed.main_problem,
    mainBenefit: composed.main_benefit,
    mainText: ctaDerived.mainText,
    supportText: ctaDerived.supportText,
    bullets: [],
    cta: ctaDerived.cta,
    productionNotes: buildProductionNotes("cta", brand, project),
    qualityIssues: ctaDerived.qualityIssues.length ? ctaDerived.qualityIssues : undefined,
    qualityStatus: ctaDerived.qualityStatus,
    headlineOptions: composed.headline_options,
    supportTextOptions: composed.support_text_options,
  };
  pieces.push({
    ...ctaBase,
    readyPrompt: buildReadyPrompt({ piece: ctaBase, brand, project, mode, productionNotes: ctaBase.productionNotes, restrictionsBrief }),
  });

  return { pieces, nextIndex: index };
}

function cap(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// -------- geração principal --------

export function buildPieces(args: BuildArgs): Piece[] {
  const { brand, project, mode } = args;
  const effectiveMode: GenerationMode = (mode ?? (project.generation_mode as GenerationMode) ?? "safe") as GenerationMode;

  const composed: ComposedCopy = composeCopy({ brand, project });
  const obj = (project.objective ?? "").toLowerCase();
  const angle: CopyAngle = obj.includes("vender") || obj.includes("contato")
    ? "comercial"
    : obj.includes("comunicado") || obj.includes("informar")
      ? "institucional"
      : "acolhedor";
  void ALL_ANGLES; void variationByAngle;

  const intent = detectEditorialIntent({
    internalTitle: project.internal_title,
    theme: project.theme,
    promise: project.main_message,
    objective: project.objective,
    formats: project.selected_formats,
  });
  const avoidTerms = projectAvoidTerms(project);
  const restrictionsBrief = summarizeRestrictions(brand, avoidTerms);

  const formats = unique(arr(project.selected_formats));
  const pieces: Piece[] = [];
  let index = 0;

  for (const formatKey of formats) {
    if (formatKey === "carrossel") {
      const result = buildCarouselPieces({ indexStart: index, brand, project, composed, intent, angle, mode: effectiveMode });
      pieces.push(...result.pieces);
      index = result.nextIndex;
      continue;
    }

    const templates = ROLE_TEMPLATES[formatKey] ?? ROLE_TEMPLATES.outro;
    for (const tmpl of templates) {
      index += 1;
      const derived = deriveTextsFromComposed(tmpl.role, composed, brand);
      const fmtLabel = formatLabel(formatKey);
      const productionNotes = buildProductionNotes(tmpl.role, brand, project);

      const base: Omit<Piece, "readyPrompt" | "caption" | "hashtags" | "warning"> = {
        index, formatKey, role: tmpl.role, name: tmpl.name, formatLabel: fmtLabel,
        objective: tmpl.objective,
        communicationAngle: angle,
        mainPromise: composed.key_promise,
        mainProblem: composed.main_problem,
        mainBenefit: composed.main_benefit,
        mainText: derived.mainText,
        supportText: derived.supportText,
        bullets: derived.bullets,
        cta: derived.cta,
        productionNotes,
        qualityIssues: derived.qualityIssues.length ? derived.qualityIssues : undefined,
        qualityStatus: derived.qualityStatus,
        headlineOptions: composed.headline_options,
        supportTextOptions: composed.support_text_options,
      };

      const readyPrompt = buildReadyPrompt({ piece: base, brand, project, mode: effectiveMode, productionNotes, restrictionsBrief });
      const piece: Piece = { ...base, readyPrompt };

      const fmtRule = FORMAT_RULES[formatKey];
      const captionAllowedByFormat = fmtRule ? fmtRule.defaultCaption !== "none" : false;
      const captionMode = extractCaptionMode(arr(project.selected_outputs), "none");

      const ROLES_WITH_SIMPLE_CAPTION = new Set(["apresentacao", "unico", "principal", "legenda"]);
      if (ROLES_WITH_SIMPLE_CAPTION.has(tmpl.role) && captionAllowedByFormat && captionMode !== "none") {
        piece.caption = buildCaptionSimple(brand, project, composed, { mainText: derived.mainText, cta: derived.cta });
        if (captionMode === "short") {
          piece.caption = piece.caption.split("\n").slice(0, 2).join("\n");
        }
      }

      const warning = pieceWarning(tmpl.role, project);
      if (warning) piece.warning = warning;

      pieces.push(piece);
    }
  }

  // -------- HASHTAGS: aplicar regras por formato após gerar tudo --------
  const wantsHashtags = arr(project.selected_outputs).includes("hashtags");
  if (wantsHashtags) {
    const tags = buildHashtags(brand, project);
    pieces.forEach((p) => {
      const fmtRule = FORMAT_RULES[p.formatKey];
      const hashtagsAllowed = fmtRule ? fmtRule.hashtags : false;
      // Carrossel: hashtags só na capa (junto com a legenda única)
      const isCarouselNonCover = p.formatKey === "carrossel" && p.role !== "capa";
      if (hashtagsAllowed && !isCarouselNonCover) {
        p.hashtags = tags;
      }
    });
  }

  // -------- OVERRIDE com conteúdo importado do ChatGPT (se houver) --------
  const imported = projectImported(project);
  if (imported?.pieces?.length) {
    const importedPieces = imported.pieces;
    const importedCaption = imported.caption;
    pieces.forEach((p, i) => {
      const src = importedPieces[i];
      if (!src) return;
      const headline = typeof src.headline === "string" ? src.headline.trim() : "";
      const support = typeof src.support_text === "string" ? src.support_text.trim() : "";
      const cta = typeof src.cta === "string" ? src.cta.trim() : "";
      const bullets = Array.isArray(src.bullets) ? (src.bullets as string[]).filter(Boolean) : [];
      if (headline) p.mainText = headline;
      if (support) p.supportText = support;
      if (cta) p.cta = cta;
      if (bullets.length) p.bullets = bullets;
      p.copySource = "external_chatgpt";
      // re-avalia qualidade considerando avoid_terms
      const prohibited = arr(brand.prohibited_words).concat(avoidTerms);
      const headEval = evaluateAndCollect(p.mainText, { isHeadline: true, prohibited, minLen: 3 }, "Texto principal");
      const suppEval = evaluateAndCollect(p.supportText, { prohibited, minLen: 15 }, "Texto de apoio");
      p.qualityStatus = worseStatus(headEval.status, suppEval.status);
      p.qualityIssues = [...headEval.issues, ...suppEval.issues];
      // reconstrói o prompt operacional com a copy nova
      p.readyPrompt = buildReadyPrompt({
        piece: p,
        brand,
        project,
        mode: effectiveMode,
        productionNotes: p.productionNotes,
        restrictionsBrief,
      });
    });
    // Substitui legenda da capa do carrossel se o ChatGPT mandou caption
    if (importedCaption?.text) {
      const cover = pieces.find((p) => p.formatKey === "carrossel" && p.role === "capa");
      if (cover) cover.caption = importedCaption.text;
    }
  }

  return pieces;
}

function buildSummary(brand: Brand, project: Project): CampaignSummary {
  return {
    brandName: brand.name,
    internalTitle: txt(project.internal_title),
    theme: txt(project.theme),
    objective: project.objective ? OBJECTIVE_LABELS[project.objective] ?? project.objective : "",
    formats: arr(project.selected_formats).map((f) => FORMAT_LABELS[f] ?? f),
    mainMessage: txt(project.main_message),
    callToAction: txt(project.call_to_action),
  };
}

function summaryToText(s: CampaignSummary): string {
  const lines: string[] = [];
  lines.push(`Marca: ${s.brandName}`);
  if (s.internalTitle) lines.push(`Projeto: ${s.internalTitle}`);
  if (s.theme) lines.push(`Tema: ${s.theme}`);
  if (s.objective) lines.push(`Objetivo: ${s.objective}`);
  if (s.formats.length) lines.push(`Formatos: ${s.formats.join(", ")}`);
  if (s.mainMessage) lines.push(`Mensagem central: ${s.mainMessage}`);
  if (s.callToAction) lines.push(`CTA principal: ${s.callToAction}`);
  return lines.join("\n");
}

function pieceToReadableText(p: Piece): string {
  const lines: string[] = [];
  lines.push(`# ${p.name}`);
  lines.push(`Formato: ${p.formatLabel}`);
  lines.push(`Objetivo: ${p.objective}`);
  lines.push("");
  if (p.mainPromise) lines.push(`Promessa: ${p.mainPromise}`);
  if (p.mainProblem) lines.push(`Dor: ${p.mainProblem}`);
  if (p.mainBenefit) lines.push(`Benefício: ${p.mainBenefit}`);
  if (p.mainText) lines.push(`Texto principal: ${p.mainText}`);
  if (p.supportText) lines.push(`Texto de apoio: ${p.supportText}`);
  if (p.bullets && p.bullets.length) lines.push(`Bullets: ${p.bullets.map((b) => `• ${b}`).join("  ")}`);
  if (p.cta) lines.push(`CTA: ${p.cta}`);
  if (p.caption) { lines.push("", "Legenda da publicação:"); lines.push(p.caption); }
  if (p.hashtags && p.hashtags.length) lines.push("", `Hashtags: ${p.hashtags.join(" ")}`);
  if (p.productionNotes.length) {
    lines.push("", "Observações de produção:");
    p.productionNotes.forEach((n) => lines.push(`- ${n}`));
  }
  if (p.qualityStatus === "blocked") {
    lines.push("", "🚫 Copy bloqueada — revise antes da produção.");
  } else if (p.qualityIssues && p.qualityIssues.length) {
    lines.push("", "⚠ Avisos de copy:");
    p.qualityIssues.forEach((q) => lines.push(`- ${q.message}`));
  }
  lines.push("", "Prompt para colar em uma IA:");
  lines.push(p.readyPrompt);
  if (p.warning) lines.push("", `⚠ ${p.warning}`);
  return lines.join("\n");
}

export function buildPrompts(args: BuildArgs): PromptBuildResult {
  const { brand, project } = args;
  const pieces = buildPieces(args);
  const summary = buildSummary(brand, project);

  const masterParts: string[] = [];
  masterParts.push(`# Pacote de produção — ${brand.name}${summary.internalTitle ? ` · ${summary.internalTitle}` : ""}`);
  masterParts.push(summaryToText(summary));
  masterParts.push("");
  masterParts.push(`Total de peças geradas: ${pieces.length}.`);
  masterParts.push("");
  pieces.forEach((p) => {
    masterParts.push("---");
    masterParts.push(pieceToReadableText(p));
    masterParts.push("");
  });
  const masterPrompt = masterParts.join("\n");

  const blocks: PromptBlock[] = [];
  blocks.push({ key: "summary", title: "Resumo da campanha", content: summaryToText(summary) });
  pieces.forEach((p) => {
    blocks.push({ key: "piece", title: p.name, content: JSON.stringify(p) });
  });
  blocks.push({ key: "master", title: "Prompt mestre (opcional)", content: masterPrompt });

  return { summary, pieces, masterPrompt, blocks };
}

export function parsePiece(content: string): Piece | null {
  try {
    const obj = JSON.parse(content);
    if (obj && typeof obj === "object" && typeof obj.name === "string" && typeof obj.readyPrompt === "string") {
      // backfill para peças antigas sem qualityStatus
      if (!obj.qualityStatus) obj.qualityStatus = "approved";
      return obj as Piece;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function pieceToPlainText(p: Piece): string {
  return pieceToReadableText(p);
}
