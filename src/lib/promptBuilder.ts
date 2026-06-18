// Cria Aí — Prompt Builder determinístico (sem IA).
// Combina marca + briefing + formatos + saídas + modo em blocos copiáveis.

import type { Tables } from "@/integrations/supabase/types";

export type Brand = Tables<"brands">;
export type Project = Tables<"content_projects">;

export type GenerationMode = "safe" | "fast";

export interface PromptBlock {
  key: string;
  title: string;
  content: string;
}

export interface PromptBuildResult {
  blocks: PromptBlock[];
  masterPrompt: string;
}

// -------- helpers --------
const isBlank = (v: unknown): boolean => v == null || (typeof v === "string" && v.trim() === "");
const arr = (v: string[] | null | undefined): string[] => (Array.isArray(v) ? v.filter((s) => s && s.trim()) : []);
const list = (v: string[] | null | undefined, sep = ", "): string => arr(v).join(sep);

function line(label: string, value: unknown): string | null {
  if (isBlank(value)) return null;
  if (Array.isArray(value)) {
    const s = list(value as string[]);
    return s ? `- ${label}: ${s}` : null;
  }
  return `- ${label}: ${String(value).trim()}`;
}

function section(title: string, lines: (string | null | undefined)[]): string | null {
  const body = lines.filter((l): l is string => !!l && l.trim() !== "").join("\n");
  if (!body) return null;
  return `## ${title}\n${body}`;
}

// -------- labels --------
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

// -------- blocks --------
function buildBriefingSummary(brand: Brand, project: Project): PromptBlock | null {
  const body = [
    section("Marca", [
      line("Nome", brand.name),
      line("Segmento", brand.segment),
      line("Descrição", brand.description),
      line("Tom de voz", brand.tone_of_voice),
      line("Público", brand.audience),
    ]),
    section("Briefing", [
      line("Título interno", project.internal_title),
      line("Tema principal", project.theme),
      line("Objetivo", project.objective ? OBJECTIVE_LABELS[project.objective] ?? project.objective : null),
      line("Público específico", project.specific_audience),
      line("Problema ou necessidade", project.audience_problem),
      line("Mensagem principal", project.main_message),
      line("Chamada para ação", project.call_to_action),
      line("Estilo desejado", project.desired_style),
      line("Nível de formalidade", project.formality_level),
    ]),
    section("Dados práticos (NÃO INVENTAR)", [
      line("Data de publicação", project.publication_date),
      line("Data do evento", project.event_date),
      line("Horário", project.event_time),
      line("Local", project.location),
      line("Valor", project.price_information),
      line("Contato", project.contact_information),
      line("Informações obrigatórias", project.mandatory_information),
    ]),
    section("Restrições", [line("Restrições", project.restrictions), line("Observações", project.notes)]),
  ]
    .filter(Boolean)
    .join("\n\n");
  if (!body) return null;
  return { key: "briefing", title: "Resumo do briefing", content: body };
}

function buildBrandRules(brand: Brand, mode: GenerationMode): PromptBlock {
  const parts: string[] = [];
  parts.push(section("Identidade da marca", [
    line("Personalidade", brand.personality),
    line("Tom de voz", brand.tone_of_voice),
    line("Linguagem recomendada", brand.audience_language),
    line("Palavras recomendadas", brand.recommended_words),
    line("Palavras proibidas", brand.prohibited_words),
  ]) ?? "");
  parts.push(section("Visual", [
    line("Cor principal", brand.primary_color),
    line("Cor secundária", brand.secondary_color),
    line("Cores adicionais", brand.additional_colors),
    line("Fontes", brand.fonts),
    line("Estilo visual", brand.visual_style),
    line("Elementos gráficos", brand.graphic_elements),
    line("Referências visuais", brand.visual_references),
  ]) ?? "");
  parts.push(section("Conteúdo permitido / evitar", [
    line("Assuntos permitidos", brand.allowed_topics),
    line("Assuntos a evitar", brand.avoided_topics),
    line("Serviços prioritários", brand.priority_services),
    line("Chamadas para ação recomendadas", brand.calls_to_action),
    line("Informações legais", brand.legal_information),
  ]) ?? "");
  const forbidden = brand.forbidden_inventions?.trim();
  parts.push(
    section("Regras anti-invenção", [
      "- Nunca inventar nomes, datas, valores, telefones, locais, e-mails, links ou depoimentos.",
      "- Usar apenas informações fornecidas no briefing acima.",
      forbidden ? `- Restrições específicas da marca: ${forbidden}` : null,
      mode === "safe"
        ? "- Em caso de dúvida sobre qualquer dado, escrever [PREENCHER] no lugar."
        : "- Em caso de dúvida, omitir o dado em vez de inventar.",
    ]) ?? "",
  );
  return { key: "brand_rules", title: "Regras da marca", content: parts.filter(Boolean).join("\n\n") };
}

function buildStrategy(project: Project): PromptBlock {
  const objLabel = project.objective ? OBJECTIVE_LABELS[project.objective] ?? project.objective : "não informado";
  const fmts = arr(project.selected_formats).map((f) => FORMAT_LABELS[f] ?? f).join(", ") || "não informado";
  return {
    key: "strategy",
    title: "Estratégia solicitada",
    content: [
      `Objetivo principal: ${objLabel}.`,
      `Formatos a produzir: ${fmts}.`,
      project.main_message ? `Mensagem central: ${project.main_message}.` : null,
      project.specific_audience ? `Direcionado a: ${project.specific_audience}.` : null,
      "Defina ângulo, gancho e jornada da peça antes de produzir os textos.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function buildConcept(): PromptBlock {
  return {
    key: "concept",
    title: "Conceito criativo",
    content: [
      "Proponha 2 conceitos criativos curtos (1 frase cada).",
      "Para cada conceito: gancho de abertura, ideia central e razão por que funciona com este público.",
      "Use apenas elementos da identidade visual e do tom de voz informados.",
    ].join("\n"),
  };
}

function buildArtTexts(brand: Brand, project: Project): PromptBlock {
  return {
    key: "art_texts",
    title: "Textos das artes",
    content: [
      "Crie os textos que ficarão DENTRO das artes, separados em camadas:",
      "- Título (até 6 palavras).",
      "- Subtítulo (até 12 palavras).",
      "- Apoio/legenda da arte (até 18 palavras).",
      brand.calls_to_action && brand.calls_to_action.length
        ? `- CTA: priorize entre [${list(brand.calls_to_action)}].`
        : "- CTA: 1 frase curta e direta.",
      project.formality_level ? `Nível de formalidade: ${project.formality_level}.` : null,
      "Não use emojis se não estiverem alinhados ao tom de voz da marca.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function buildLayouts(): PromptBlock {
  return {
    key: "layouts",
    title: "Estrutura dos layouts",
    content: [
      "Para cada formato, descreva a estrutura visual em camadas:",
      "1. Plano de fundo (cor/imagem/textura).",
      "2. Hierarquia tipográfica (título, subtítulo, apoio).",
      "3. Elemento gráfico de destaque.",
      "4. Posicionamento da logo (canto/área segura).",
      "5. CTA visualmente destacado.",
      "Respeite a área segura de cada formato (proporção e margens).",
    ].join("\n"),
  };
}

function buildCarousel(): PromptBlock {
  return {
    key: "carousel",
    title: "Estrutura do carrossel",
    content: [
      "Monte um carrossel de 5 a 8 slides com este fluxo:",
      "1. Capa: gancho + promessa.",
      "2. Contexto/problema.",
      "3-6. Conteúdo principal em etapas, exemplos ou dicas.",
      "7. Síntese.",
      "8. CTA com instrução clara.",
      "Para cada slide entregue: TÍTULO, TEXTO INTERNO e indicação visual.",
    ].join("\n"),
  };
}

function buildStories(): PromptBlock {
  return {
    key: "stories",
    title: "Estrutura dos Stories",
    content: [
      "Sequência de 3 a 5 stories:",
      "- Story 1: abertura/curiosidade.",
      "- Story 2-3: desenvolvimento com enquete, caixa de pergunta ou quiz quando fizer sentido.",
      "- Story 4: prova/exemplo.",
      "- Story 5: CTA com link/arrastar/responder.",
      "Indique elementos interativos por story.",
    ].join("\n"),
  };
}

function buildReel(): PromptBlock {
  return {
    key: "reel",
    title: "Roteiro de Reel",
    content: [
      "Roteiro de Reel de 15 a 30 segundos no formato:",
      "[0-2s] Gancho visual + frase de impacto.",
      "[2-15s] Desenvolvimento em 2 a 3 blocos com cortes rápidos.",
      "[15-25s] Virada/insight.",
      "[25-30s] CTA falado e em texto na tela.",
      "Para cada bloco entregue: FALA, TEXTO NA TELA e AÇÃO/CENA.",
    ].join("\n"),
  };
}

function buildCaptions(project: Project): PromptBlock {
  const cta = project.call_to_action?.trim();
  return {
    key: "captions",
    title: "Legendas",
    content: [
      "Produza três versões de legenda:",
      "- Curta (até 220 caracteres).",
      "- Intermediária (300 a 600 caracteres).",
      "- Completa (até 1500 caracteres) com gancho, desenvolvimento, prova e CTA.",
      cta ? `Encerre todas com o CTA: "${cta}".` : "Encerre todas com um CTA único e claro.",
      "Não use mais de 2 emojis por legenda, salvo se a marca permitir.",
    ].join("\n"),
  };
}

function buildHashtags(brand: Brand): PromptBlock {
  return {
    key: "hashtags",
    title: "Hashtags",
    content: [
      "Liste 12 a 18 hashtags em PT-BR organizadas em 3 níveis:",
      "- Amplas (alto volume).",
      "- Médias (nicho do segmento).",
      "- Específicas (marca/cidade/serviço).",
      brand.segment ? `Segmento: ${brand.segment}.` : null,
      brand.service_region ? `Região: ${brand.service_region}.` : null,
      "Não inventar hashtags com nome de marca de terceiros.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function buildEngagement(): PromptBlock {
  return {
    key: "engagement",
    title: "Recursos de engajamento",
    content: [
      "Sugira 3 recursos práticos para aumentar o engajamento:",
      "- 1 enquete/caixa de pergunta para Stories.",
      "- 1 pergunta para a legenda incentivar comentários.",
      "- 1 ideia de resposta padrão no WhatsApp para quem chegar pela peça.",
    ].join("\n"),
  };
}

function buildVisualPrompt(brand: Brand, project: Project): PromptBlock {
  return {
    key: "visual_prompt",
    title: "Prompt visual (para gerador de imagem)",
    content: [
      "Descreva uma imagem coerente com a peça em uma frase densa contendo:",
      "- Sujeito e cena.",
      "- Estilo visual (fotografia, ilustração, 3D, etc.).",
      "- Iluminação e atmosfera.",
      "- Paleta de cores baseada na marca.",
      "- Composição e enquadramento.",
      brand.visual_style ? `Estilo da marca: ${brand.visual_style}.` : null,
      brand.primary_color ? `Cor principal: ${brand.primary_color}.` : null,
      project.desired_style ? `Estilo desejado pelo briefing: ${project.desired_style}.` : null,
      "Não incluir texto na imagem (o texto entra na arte).",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function buildWhatsApp(project: Project): PromptBlock {
  return {
    key: "whatsapp",
    title: "Versão para WhatsApp",
    content: [
      "Adapte o conteúdo para WhatsApp:",
      "- Mensagem curta (até 350 caracteres).",
      "- Status do WhatsApp (1 frase + CTA).",
      "- Texto para grupo (com saudação personalizável).",
      project.contact_information ? `Inclua contato apenas se for: ${project.contact_information}.` : "Inclua link/contato somente se fornecido no briefing.",
    ].join("\n"),
  };
}

function buildAudit(brand: Brand, project: Project): PromptBlock {
  return {
    key: "audit",
    title: "Auditoria final (checklist)",
    content: [
      "Antes de entregar, verifique:",
      "[ ] Nenhum dado inventado (datas, valores, locais, contatos).",
      brand.prohibited_words && brand.prohibited_words.length
        ? `[ ] Nenhuma palavra proibida usada: ${list(brand.prohibited_words)}.`
        : "[ ] Linguagem alinhada às palavras recomendadas da marca.",
      "[ ] Tom de voz consistente com a marca.",
      "[ ] CTA presente e claro.",
      project.mandatory_information ? `[ ] Informação obrigatória incluída: ${project.mandatory_information}.` : null,
      "[ ] Ortografia e concordância revisadas.",
      "[ ] Texto legível dentro da área segura de cada formato.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

// -------- builder principal --------
export interface BuildArgs {
  brand: Brand;
  project: Project;
  mode?: GenerationMode;
}

const BLOCK_MAP: Record<string, (b: Brand, p: Project) => PromptBlock | null> = {
  estrategia: (_b, p) => buildStrategy(p),
  conceito: () => buildConcept(),
  textos_artes: (b, p) => buildArtTexts(b, p),
  layouts: () => buildLayouts(),
  carrossel: () => buildCarousel(),
  stories: () => buildStories(),
  roteiro_reel: () => buildReel(),
  legenda_curta: (_b, p) => buildCaptions(p),
  legenda_media: (_b, p) => buildCaptions(p),
  legenda_completa: (_b, p) => buildCaptions(p),
  whatsapp: (_b, p) => buildWhatsApp(p),
  hashtags: (b) => buildHashtags(b),
  engajamento: () => buildEngagement(),
  prompt_visual: (b, p) => buildVisualPrompt(b, p),
  checklist: (b, p) => buildAudit(b, p),
};

export function buildPrompts({ brand, project, mode }: BuildArgs): PromptBuildResult {
  const effectiveMode: GenerationMode = (mode ?? (project.generation_mode as GenerationMode) ?? "safe") as GenerationMode;
  const blocks: PromptBlock[] = [];

  const summary = buildBriefingSummary(brand, project);
  if (summary) blocks.push(summary);
  blocks.push(buildBrandRules(brand, effectiveMode));

  const requested = arr(project.selected_outputs);
  const seen = new Set<string>();
  for (const key of requested) {
    const fn = BLOCK_MAP[key];
    if (!fn) continue;
    const block = fn(brand, project);
    if (block && !seen.has(block.key)) {
      seen.add(block.key);
      blocks.push(block);
    }
  }

  // Garante auditoria final no modo seguro
  if (effectiveMode === "safe" && !seen.has("audit")) {
    blocks.push(buildAudit(brand, project));
  }

  const header = [
    `# Pacote de prompts — ${brand.name}${project.internal_title ? ` · ${project.internal_title}` : ""}`,
    `Modo de geração: ${effectiveMode === "safe" ? "Seguro" : "Rápido"}.`,
    "Use este material como instrução para um gerador de conteúdo. Respeite estritamente os dados informados.",
  ].join("\n");

  const masterPrompt = [header, ...blocks.map((b) => `## ${b.title}\n${b.content}`)].join("\n\n---\n\n");

  return { blocks, masterPrompt };
}
