// Cria Aí — Prompt Builder determinístico (sem IA).
// Gera um PACOTE DE PRODUÇÃO POR PEÇA: cada formato selecionado se desdobra
// em peças individuais com nome, formato, objetivo, textos, CTA, legenda,
// hashtags, observações de produção e um PROMPT OPERACIONAL pronto para
// colar em uma ferramenta de IA (ex.: ChatGPT) e produzir a arte final.

import type { Tables } from "@/integrations/supabase/types";

export type Brand = Tables<"brands">;
export type Project = Tables<"content_projects">;

export type GenerationMode = "safe" | "fast";

// -------- tipos públicos --------

export interface Piece {
  /** ordem da peça dentro do pacote (1-based) */
  index: number;
  /** chave estável de formato (post, sequencia_stories, ...) */
  formatKey: string;
  /** papel da peça dentro do conjunto (capa, gancho, cta, ...) */
  role: string;
  /** nome legível: "Story 1 — Gancho" */
  name: string;
  /** rótulo de formato com proporção: "Story 9:16" */
  formatLabel: string;
  /** objetivo da peça em uma frase */
  objective: string;
  /** texto principal sugerido para a arte */
  mainText: string;
  /** texto de apoio sugerido */
  supportText: string;
  /** CTA da peça (pode ser vazio quando não se aplica) */
  cta: string;
  /** legenda completa para postar (quando aplicável) */
  caption?: string;
  /** hashtags (quando aplicável) */
  hashtags?: string[];
  /** observações de produção */
  productionNotes: string[];
  /** prompt operacional pronto para colar em uma IA */
  readyPrompt: string;
  /** alerta de informações parciais */
  warning?: string;
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
  /** "summary" | "piece" | "master" */
  key: string;
  title: string;
  /** Para "piece" o conteúdo é JSON.stringify(Piece). Para os demais é texto. */
  content: string;
}

export interface PromptBuildResult {
  summary: CampaignSummary;
  pieces: Piece[];
  masterPrompt: string;
  /** Representação serializada para persistência em content_outputs. */
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

const blank = (v: unknown): boolean =>
  v == null || (typeof v === "string" && v.trim() === "");

const arr = (v: string[] | null | undefined): string[] =>
  Array.isArray(v) ? v.filter((s) => s && s.trim()) : [];

const list = (v: string[] | null | undefined, sep = ", "): string =>
  arr(v).join(sep);

const txt = (v: string | null | undefined, fallback = ""): string =>
  blank(v) ? fallback : String(v).trim();

const shorten = (s: string, max: number): string => {
  const t = (s ?? "").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:!?]+$/, "") + "…";
};

const firstSentence = (s: string): string => {
  const t = (s ?? "").trim();
  if (!t) return "";
  const m = t.match(/^[^.!?\n]+[.!?]?/);
  return (m ? m[0] : t).trim();
};

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

const unique = <T,>(xs: T[]): T[] => Array.from(new Set(xs));

// -------- proporção / rótulo por formato --------

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

const formatLabel = (key: string): string =>
  `${FORMAT_LABELS[key] ?? key} · ${FORMAT_RATIO[key] ?? "conforme uso"}`;

// -------- templates de papéis por formato --------

interface RoleTemplate {
  role: string;
  name: string;
  objective: string;
}

const ROLE_TEMPLATES: Record<string, RoleTemplate[]> = {
  post: [
    { role: "apresentacao", name: "Post Feed — Apresentação", objective: "apresentar a mensagem central com impacto visual e CTA claro" },
  ],
  carrossel: [
    { role: "capa", name: "Carrossel — Página 1 (Capa)", objective: "gancho e promessa que justifique avançar" },
    { role: "contexto", name: "Carrossel — Página 2 (Contexto)", objective: "contextualizar o problema, desejo ou cenário" },
    { role: "desenvolvimento1", name: "Carrossel — Página 3 (Desenvolvimento)", objective: "apresentar o ponto principal de forma direta" },
    { role: "desenvolvimento2", name: "Carrossel — Página 4 (Aprofundamento)", objective: "aprofundar com benefícios, exemplos ou diferenciais" },
    { role: "orientacao", name: "Carrossel — Página 5 (Orientação)", objective: "orientar o próximo passo prático" },
    { role: "fechamento", name: "Carrossel — Página 6 (Fechamento)", objective: "sintetizar a mensagem em frase de impacto" },
    { role: "cta", name: "Carrossel — Página 7 (CTA)", objective: "chamar a ação com clareza e incentivo direto" },
  ],
  story: [
    { role: "unico", name: "Story — Peça única", objective: "comunicar a mensagem central em um único Story" },
  ],
  sequencia_stories: [
    { role: "gancho", name: "Story 1 — Gancho", objective: "gerar curiosidade imediata" },
    { role: "contexto", name: "Story 2 — Contexto", objective: "contextualizar o tema para o público" },
    { role: "beneficio", name: "Story 3 — Benefício", objective: "destacar o benefício principal" },
    { role: "prova", name: "Story 4 — Prova / Diferencial", objective: "reforçar credibilidade ou diferencial" },
    { role: "cta", name: "Story 5 — CTA", objective: "incentivar a ação esperada" },
  ],
  status_whatsapp: [
    { role: "principal", name: "Status WhatsApp — Mensagem", objective: "comunicar a oferta de forma direta e curta" },
    { role: "reforco", name: "Status WhatsApp — Reforço", objective: "reforçar o CTA e gerar resposta" },
  ],
  reel: [
    { role: "capa", name: "Reel — Capa", objective: "capa estática atrativa que represente o vídeo" },
    { role: "roteiro", name: "Reel — Roteiro (15-30s)", objective: "roteiro completo do vídeo com falas e cenas" },
    { role: "legenda", name: "Reel — Legenda + CTA", objective: "legenda otimizada para alcance com CTA" },
  ],
  capa_reel: [
    { role: "capa", name: "Capa de Reel", objective: "criar capa estática para o Reel" },
  ],
  comunicado: [
    { role: "unico", name: "Comunicado — Peça única", objective: "comunicar de forma objetiva e clara" },
  ],
  banner: [
    { role: "unico", name: "Banner", objective: "comunicar a mensagem em formato banner" },
  ],
  texto_grupo: [
    { role: "unico", name: "Texto para Grupo", objective: "mensagem para enviar em grupo de WhatsApp" },
  ],
  impresso: [
    { role: "unico", name: "Material Impresso", objective: "peça para impressão" },
  ],
  outro: [
    { role: "unico", name: "Peça Personalizada", objective: "peça conforme briefing" },
  ],
};

// -------- derivação de textos por papel --------

interface DerivedTexts {
  mainText: string;
  supportText: string;
  cta: string;
}

function deriveTexts(role: string, project: Project): DerivedTexts {
  const theme = txt(project.theme);
  const main = txt(project.main_message);
  const problem = txt(project.audience_problem);
  const audience = txt(project.specific_audience);
  const product = txt(project.mandatory_information);
  const mandatory = txt(project.mandatory_information);
  const cta = txt(project.call_to_action);
  const contact = txt(project.contact_information);

  const firstMain = firstSentence(main) || theme;

  switch (role) {
    case "gancho":
    case "capa":
      return {
        mainText: shorten(firstMain || theme, 60),
        supportText: shorten(problem || audience || product, 90),
        cta: "",
      };
    case "contexto":
      return {
        mainText: shorten(problem || audience || theme, 80),
        supportText: shorten(audience || product, 90),
        cta: "",
      };
    case "beneficio":
    case "desenvolvimento1":
      return {
        mainText: shorten(firstMain, 80),
        supportText: shorten(product || problem, 110),
        cta: "",
      };
    case "desenvolvimento2":
      return {
        mainText: shorten(product || main, 90),
        supportText: shorten(mandatory || problem, 110),
        cta: "",
      };
    case "orientacao":
      return {
        mainText: "Como aproveitar agora:",
        supportText: shorten(cta || mandatory || product, 110),
        cta: "",
      };
    case "prova":
      return {
        mainText: shorten(mandatory || product || "Por que confiar", 80),
        supportText: shorten(product || main, 110),
        cta: "",
      };
    case "fechamento":
      return {
        mainText: shorten(firstMain, 60),
        supportText: shorten(audience || product, 90),
        cta: "",
      };
    case "cta":
      return {
        mainText: shorten(cta || firstMain, 60),
        supportText: shorten(contact || mandatory, 110),
        cta: cta,
      };
    case "reforco":
      return {
        mainText: shorten(cta || firstMain, 50),
        supportText: shorten(contact, 90),
        cta: cta,
      };
    case "principal":
      return {
        mainText: shorten(firstMain, 70),
        supportText: shorten(cta || product, 110),
        cta: cta,
      };
    case "roteiro":
      return {
        mainText: shorten(firstMain, 90),
        supportText: shorten(product || problem, 140),
        cta: cta,
      };
    case "legenda":
      return {
        mainText: shorten(firstMain, 90),
        supportText: shorten(product || audience, 140),
        cta: cta,
      };
    case "unico":
    case "apresentacao":
    default:
      return {
        mainText: shorten(firstMain, 80),
        supportText: shorten(problem || audience || product, 110),
        cta: cta,
      };
  }
}

// -------- legenda / hashtags --------

const ROLES_WITH_CAPTION = new Set([
  "apresentacao",
  "unico",
  "cta",
  "legenda",
  "principal",
  "fechamento",
]);

function buildCaption(brand: Brand, project: Project, piece: { mainText: string; cta: string; objective: string }): string {
  const lines: string[] = [];
  const hook = piece.mainText || txt(project.theme);
  if (hook) lines.push(hook);
  const message = txt(project.main_message);
  if (message && message !== hook) lines.push("", message);
  const product = txt(project.mandatory_information);
  if (product) lines.push("", product);
  const mandatory = txt(project.mandatory_information);
  if (mandatory) lines.push("", mandatory);
  const cta = piece.cta || txt(project.call_to_action);
  if (cta) lines.push("", `👉 ${cta}`);
  const contact = txt(project.contact_information);
  if (contact) lines.push(contact);
  void brand;
  return lines.join("\n").trim();
}

function buildHashtags(brand: Brand, project: Project): string[] {
  const tags = new Set<string>();
  const push = (raw: string) => {
    const s = slug(raw);
    if (s) tags.add(`#${s}`);
  };
  push(brand.name);
  if (brand.segment) push(brand.segment);
  if (brand.service_region) push(brand.service_region);
  // tokens do tema (apenas o que veio do usuário)
  const themeWords = txt(project.theme).split(/\s+/).filter((w) => w.length >= 5).slice(0, 4);
  themeWords.forEach((w) => push(w));
  // palavras recomendadas da marca (campo livre do cadastro)
  arr(brand.recommended_words).slice(0, 4).forEach((w) => push(w));
  return Array.from(tags).slice(0, 14);
}

// -------- observações de produção --------

function buildProductionNotes(role: string, brand: Brand, project: Project): string[] {
  const notes: string[] = [];
  const style = txt(project.desired_style) || txt(brand.visual_style);
  if (style) notes.push(`Estilo visual: ${style}.`);
  if (brand.primary_color) notes.push(`Usar cor principal da marca: ${brand.primary_color}.`);
  if (brand.fonts) notes.push(`Tipografia da marca: ${brand.fonts}.`);
  if (role === "capa" || role === "gancho" || role === "apresentacao" || role === "unico" || role === "principal") {
    notes.push("Manter respiro no topo para o título e logo discreta no canto.");
  }
  if (role === "cta" || role === "reforco") {
    notes.push("CTA em destaque, com contraste alto e área clicável visualmente clara.");
  }
  if (role.startsWith("desenvolvimento") || role === "contexto" || role === "prova" || role === "orientacao" || role === "fechamento") {
    notes.push("Evitar excesso de elementos: prioridade para legibilidade.");
  }
  if (brand.forbidden_inventions) {
    notes.push(`Restrições da marca: ${brand.forbidden_inventions}.`);
  }
  if (brand.graphic_elements) {
    notes.push(`Elementos gráficos: ${brand.graphic_elements}.`);
  }
  return notes;
}

// -------- prompt operacional pronto --------

function buildReadyPrompt(args: {
  piece: Omit<Piece, "readyPrompt" | "caption" | "hashtags" | "warning">;
  brand: Brand;
  project: Project;
  mode: GenerationMode;
  productionNotes: string[];
}): string {
  const { piece, brand, project, mode, productionNotes } = args;
  const style = txt(project.desired_style) || txt(brand.visual_style) || "alinhado à identidade da marca";
  const identityBits = [
    brand.primary_color ? `cor principal ${brand.primary_color}` : null,
    brand.secondary_color ? `cor secundária ${brand.secondary_color}` : null,
    brand.fonts ? `tipografia ${brand.fonts}` : null,
    brand.tone_of_voice ? `tom de voz ${brand.tone_of_voice}` : null,
  ].filter(Boolean).join(", ");

  const visualDirection = [
    txt(brand.visual_style),
    txt(brand.graphic_elements),
    txt(brand.visual_references),
  ].filter(Boolean).join(" · ") || "composição limpa, hierarquia clara, espaço de respiro";

  const head =
    `Crie uma arte para ${piece.formatLabel} da empresa "${brand.name}", no estilo ${style}, ` +
    `seguindo rigorosamente as informações abaixo.`;

  const block: string[] = [head, ""];
  block.push(`Objetivo da peça: ${piece.objective}.`);
  if (piece.mainText) block.push(`Texto principal da arte: "${piece.mainText}"`);
  if (piece.supportText) block.push(`Texto de apoio: "${piece.supportText}"`);
  if (piece.cta) block.push(`CTA: "${piece.cta}"`);
  block.push(`Direção visual: ${visualDirection}.`);
  if (identityBits) block.push(`Identidade da marca: ${identityBits}.`);

  const dataLines: string[] = [];
  if (project.event_date) dataLines.push(`data do evento ${project.event_date}`);
  if (project.event_time) dataLines.push(`horário ${project.event_time}`);
  if (project.location) dataLines.push(`local ${project.location}`);
  if (project.price_information) dataLines.push(`valor ${project.price_information}`);
  if (project.contact_information) dataLines.push(`contato ${project.contact_information}`);
  if (dataLines.length) {
    block.push(`Dados literais a respeitar (não alterar): ${dataLines.join("; ")}.`);
  }

  if (productionNotes.length) {
    block.push("");
    block.push("Observações de produção:");
    productionNotes.forEach((n) => block.push(`- ${n}`));
  }

  block.push("");
  block.push("Regras obrigatórias:");
  block.push("- Caso exista imagem de referência anexada, utilizá-la obrigatoriamente como base. Não alterar cor, formato, proporções ou características do produto/serviço.");
  block.push("- Não inventar preço, data, telefone, endereço, benefício, depoimento ou condição comercial que não esteja explicitamente neste prompt.");
  block.push("- Não inserir textos longos diretamente sobre a imagem; preferir camadas de texto separadas e legíveis.");
  if (arr(brand.prohibited_words).length) {
    block.push(`- Não usar as palavras proibidas da marca: ${list(brand.prohibited_words)}.`);
  }
  if (mode === "safe") {
    block.push("- Em caso de dúvida sobre qualquer dado, escrever [PREENCHER] no lugar — nunca inventar.");
  } else {
    block.push("- Em caso de dúvida sobre qualquer dado, omitir — nunca inventar.");
  }

  // Instruções específicas por papel
  if (piece.role === "roteiro") {
    block.push("");
    block.push("Para o roteiro do Reel, entregue: [0-2s] gancho, [2-15s] desenvolvimento em 2-3 cortes, [15-25s] virada/insight, [25-30s] CTA falado e em texto. Para cada bloco: FALA, TEXTO NA TELA e AÇÃO/CENA.");
  }
  if (piece.role === "legenda") {
    block.push("");
    block.push("Para a legenda, entregue versão de até 1200 caracteres com gancho, desenvolvimento, prova e CTA encerrando o texto.");
  }

  return block.join("\n");
}

// -------- avaliação de informações parciais --------

function pieceWarning(role: string, project: Project): string | undefined {
  const missing: string[] = [];
  if (!txt(project.main_message)) missing.push("mensagem principal");
  if ((role === "cta" || role === "reforco" || role === "principal") && !txt(project.call_to_action)) missing.push("CTA");
  if ((role === "prova" || role === "desenvolvimento2") && !txt(project.mandatory_information))
    missing.push("informações obrigatórias / descrição do produto");
  if (!missing.length) return undefined;
  return `Esta peça foi gerada com base em informações parciais (${missing.join(", ")}). Revise antes de publicar.`;
}

// -------- geração principal --------

export function buildPieces(args: BuildArgs): Piece[] {
  const { brand, project, mode } = args;
  const effectiveMode: GenerationMode =
    (mode ?? (project.generation_mode as GenerationMode) ?? "safe") as GenerationMode;

  const formats = unique(arr(project.selected_formats));
  const pieces: Piece[] = [];
  let index = 0;

  for (const formatKey of formats) {
    const templates = ROLE_TEMPLATES[formatKey] ?? ROLE_TEMPLATES.outro;
    for (const tmpl of templates) {
      index += 1;
      const derived = deriveTexts(tmpl.role, project);
      const fmtLabel = formatLabel(formatKey);
      const productionNotes = buildProductionNotes(tmpl.role, brand, project);

      const base: Omit<Piece, "readyPrompt" | "caption" | "hashtags" | "warning"> = {
        index,
        formatKey,
        role: tmpl.role,
        name: tmpl.name,
        formatLabel: fmtLabel,
        objective: tmpl.objective,
        mainText: derived.mainText,
        supportText: derived.supportText,
        cta: derived.cta,
        productionNotes,
      };

      const readyPrompt = buildReadyPrompt({ piece: base, brand, project, mode: effectiveMode, productionNotes });

      const piece: Piece = { ...base, readyPrompt };

      if (ROLES_WITH_CAPTION.has(tmpl.role)) {
        piece.caption = buildCaption(brand, project, { mainText: derived.mainText, cta: derived.cta, objective: tmpl.objective });
        piece.hashtags = buildHashtags(brand, project);
      }

      const warning = pieceWarning(tmpl.role, project);
      if (warning) piece.warning = warning;

      pieces.push(piece);
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
  if (p.mainText) lines.push(`Texto principal: ${p.mainText}`);
  if (p.supportText) lines.push(`Texto de apoio: ${p.supportText}`);
  if (p.cta) lines.push(`CTA: ${p.cta}`);
  if (p.caption) { lines.push("", "Legenda:"); lines.push(p.caption); }
  if (p.hashtags && p.hashtags.length) { lines.push("", `Hashtags: ${p.hashtags.join(" ")}`); }
  if (p.productionNotes.length) {
    lines.push("", "Observações de produção:");
    p.productionNotes.forEach((n) => lines.push(`- ${n}`));
  }
  lines.push("", "Prompt pronto para colar em uma IA:");
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

// Utilitário para a UI: parse seguro de uma peça persistida.
export function parsePiece(content: string): Piece | null {
  try {
    const obj = JSON.parse(content);
    if (obj && typeof obj === "object" && typeof obj.name === "string" && typeof obj.readyPrompt === "string") {
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
