// Cria Aí — Matriz de regras: formatos selecionados → entregas obrigatórias,
// recomendadas, opcionais e incompatíveis. Fonte única de verdade consumida
// pela Etapa 5 do wizard E pelo promptBuilder.

import { FORMAT_LABELS } from "./promptBuilder";

export type CaptionMode = "none" | "short" | "full" | "both";
export type OutputCategory = "required" | "recommended" | "optional";

/** Catálogo de entregas com label legível e justificativa curta. */
export const OUTPUT_CATALOG: Record<string, { label: string; help?: string }> = {
  // Comuns à arte
  textos_artes: { label: "Textos das artes" },
  layouts: { label: "Layouts individuais" },
  prompt_visual: { label: "Prompts visuais individuais" },
  cta: { label: "CTA na peça" },
  conceito: { label: "Conceito criativo", help: "Direciona estética e narrativa." },
  texto_alternativo: { label: "Texto alternativo (acessibilidade)" },

  // Campanha
  estrategia: { label: "Estratégia da campanha", help: "Plano geral, não se repete por peça." },
  engajamento: { label: "Recursos de engajamento" },
  ordem_publicacao: { label: "Ordem de publicação sugerida" },
  adaptacoes_canais: { label: "Adaptações para outros canais" },

  // Distribuição
  hashtags: { label: "Hashtags" },
  whatsapp: { label: "Versão complementar para WhatsApp" },

  // Carrossel
  estrutura_carrossel: { label: "Estrutura completa (capa, internas, fechamento)" },
  continuidade: { label: "Continuidade visual e narrativa entre páginas" },
  adaptacao_stories: { label: "Adaptação do carrossel para Stories" },

  // Sequência de Stories
  estrutura_stories: { label: "Quantidade e função de cada tela" },
  recurso_interativo: { label: "Recurso interativo (enquete, caixa de pergunta…)" },
  transicoes: { label: "Orientação de transição entre telas" },
  adaptacao_status: { label: "Adaptação para Status do WhatsApp" },

  // Status WhatsApp
  sequencia_status: { label: "Sequência de 2 a 3 Status" },
  mensagem_complementar_wpp: { label: "Mensagem complementar para envio no WhatsApp" },

  // Reel
  conceito_reel: { label: "Conceito do Reel" },
  gancho_reel: { label: "Gancho inicial (0-2s)" },
  roteiro: { label: "Roteiro completo (cenas + falas)" },
  cenas: { label: "Lista de cenas" },
  texto_falado: { label: "Texto falado" },
  texto_tela: { label: "Texto na tela" },
  orientacao_gravacao: { label: "Orientação de gravação" },

  // Capa de Reel
  hierarquia_capa: { label: "Hierarquia visual da capa" },

  // Comunicado
  titulo_comunicado: { label: "Título do comunicado" },
  info_essenciais: { label: "Informações essenciais" },
  texto_apoio_comunicado: { label: "Texto de apoio" },
  hierarquia: { label: "Hierarquia do layout" },

  // Banner
  texto_principal_banner: { label: "Texto principal do banner" },
  texto_apoio_banner: { label: "Texto de apoio do banner" },
  dimensoes: { label: "Dimensões" },

  // Texto para grupo
  mensagem_grupo: { label: "Mensagem pronta para o grupo" },
  cta_grupo: { label: "CTA ou orientação final" },

  // Material impresso
  textos_finais: { label: "Textos finais revisados" },
  dimensoes_impresso: { label: "Dimensões de impressão" },
  margens_areas: { label: "Margens e áreas seguras" },
  revisao_ortografica: { label: "Revisão ortográfica" },
  revisao_dados: { label: "Revisão de dados" },
  versao_digital: { label: "Versão digital correspondente" },
};

export type FormatRule = {
  required: string[];
  recommended: string[];
  optional: string[];
  defaultCaption: CaptionMode;
  hashtags: boolean;
};

/** Regras por formato. */
export const FORMAT_RULES: Record<string, FormatRule> = {
  post: {
    required: ["textos_artes", "layouts", "prompt_visual", "cta"],
    recommended: ["hashtags", "texto_alternativo", "conceito"],
    optional: ["estrategia", "engajamento", "whatsapp"],
    defaultCaption: "full",
    hashtags: true,
  },
  carrossel: {
    required: ["estrutura_carrossel", "textos_artes", "layouts", "prompt_visual", "continuidade", "cta"],
    recommended: ["hashtags", "texto_alternativo", "conceito"],
    optional: ["estrategia", "engajamento", "adaptacao_stories", "whatsapp"],
    defaultCaption: "full",
    hashtags: true,
  },
  story: {
    required: ["textos_artes", "layouts", "prompt_visual", "cta"],
    recommended: ["conceito", "recurso_interativo"],
    optional: ["estrategia", "whatsapp"],
    defaultCaption: "none",
    hashtags: false,
  },
  sequencia_stories: {
    required: ["estrutura_stories", "textos_artes", "layouts", "prompt_visual", "cta"],
    recommended: ["recurso_interativo", "conceito", "transicoes"],
    optional: ["estrategia", "adaptacao_status"],
    defaultCaption: "none",
    hashtags: false,
  },
  status_whatsapp: {
    required: ["textos_artes", "layouts", "prompt_visual", "cta"],
    recommended: ["sequencia_status", "mensagem_complementar_wpp"],
    optional: ["conceito", "estrategia"],
    defaultCaption: "none",
    hashtags: false,
  },
  reel: {
    required: ["conceito_reel", "gancho_reel", "roteiro", "cenas", "texto_falado", "texto_tela", "cta"],
    recommended: ["hashtags", "orientacao_gravacao", "engajamento"],
    optional: ["estrategia", "whatsapp"],
    defaultCaption: "full",
    hashtags: true,
  },
  capa_reel: {
    required: ["textos_artes", "hierarquia_capa", "layouts", "prompt_visual"],
    recommended: ["texto_alternativo"],
    optional: [],
    defaultCaption: "none",
    hashtags: false,
  },
  comunicado: {
    required: ["titulo_comunicado", "info_essenciais", "texto_apoio_comunicado", "hierarquia", "prompt_visual"],
    recommended: [],
    optional: ["whatsapp"],
    defaultCaption: "none",
    hashtags: false,
  },
  banner: {
    required: ["texto_principal_banner", "texto_apoio_banner", "cta", "hierarquia", "layouts", "dimensoes", "prompt_visual"],
    recommended: [],
    optional: ["conceito"],
    defaultCaption: "none",
    hashtags: false,
  },
  texto_grupo: {
    required: ["mensagem_grupo", "cta_grupo"],
    recommended: [],
    optional: [],
    defaultCaption: "none",
    hashtags: false,
  },
  impresso: {
    required: ["textos_finais", "hierarquia", "layouts", "dimensoes_impresso", "margens_areas", "revisao_ortografica", "revisao_dados"],
    recommended: [],
    optional: ["conceito", "versao_digital"],
    defaultCaption: "none",
    hashtags: false,
  },
  outro: {
    required: [],
    recommended: [],
    optional: Object.keys(OUTPUT_CATALOG),
    defaultCaption: "none",
    hashtags: false,
  },
};

/** Tokens internos para encodar a escolha de legenda em selected_outputs. */
export const CAPTION_TOKENS = {
  none: "caption_none",
  short: "caption_short",
  full: "caption_full",
  both: "caption_both",
} as const;

export const CAPTION_TOKEN_SET: Set<string> = new Set(Object.values(CAPTION_TOKENS));

export function extractCaptionMode(outputs: string[], fallback: CaptionMode): CaptionMode {
  for (const t of outputs) {
    if (t === CAPTION_TOKENS.none) return "none";
    if (t === CAPTION_TOKENS.short) return "short";
    if (t === CAPTION_TOKENS.full) return "full";
    if (t === CAPTION_TOKENS.both) return "both";
  }
  return fallback;
}

export function withCaptionToken(outputs: string[], mode: CaptionMode): string[] {
  const cleaned = outputs.filter((o) => !CAPTION_TOKEN_SET.has(o));
  cleaned.push(CAPTION_TOKENS[mode]);
  return cleaned;
}

export type ResolvedOutputs = {
  /** Ids obrigatórios (não desmarcáveis). */
  requiredOutputs: string[];
  /** Ids recomendados (marcados por padrão). */
  recommendedOutputs: string[];
  /** Ids opcionais disponíveis (não duplicados). */
  optionalOutputs: string[];
  /** Ids incompatíveis com a seleção atual. */
  incompatibleOutputs: string[];
  /** Ids selecionados (req + rec + opcionais manuais), sem duplicidade. */
  selectedOutputs: string[];
  /** Mapa output → formatos que exigem/recomendam. */
  appliesTo: Record<string, { categories: Partial<Record<string, OutputCategory>> }>;
  captionMode: CaptionMode;
  hashtagsApplicable: boolean;
};

const CAPTION_PRIORITY: Record<CaptionMode, number> = { none: 0, short: 1, full: 2, both: 3 };

export function resolveOutputsFromFormats(
  selectedFormats: string[],
  previousSelections: string[] = [],
  previousCaption?: CaptionMode,
): ResolvedOutputs {
  const formats = selectedFormats.filter((f) => FORMAT_RULES[f]);
  const required = new Set<string>();
  const recommended = new Set<string>();
  const optional = new Set<string>();
  const appliesTo: Record<string, { categories: Partial<Record<string, OutputCategory>> }> = {};

  const noteApply = (id: string, fmt: string, cat: OutputCategory) => {
    if (!appliesTo[id]) appliesTo[id] = { categories: {} };
    appliesTo[id].categories[fmt] = cat;
  };

  let captionDefault: CaptionMode = "none";
  let hashtagsApplicable = false;

  for (const fmt of formats) {
    const rule = FORMAT_RULES[fmt];
    rule.required.forEach((id) => { required.add(id); noteApply(id, fmt, "required"); });
    rule.recommended.forEach((id) => { recommended.add(id); noteApply(id, fmt, "recommended"); });
    rule.optional.forEach((id) => { optional.add(id); noteApply(id, fmt, "optional"); });
    if (CAPTION_PRIORITY[rule.defaultCaption] > CAPTION_PRIORITY[captionDefault]) {
      captionDefault = rule.defaultCaption;
    }
    if (rule.hashtags) hashtagsApplicable = true;
  }

  // dedup: required > recommended > optional
  recommended.forEach((id) => { if (required.has(id)) recommended.delete(id); });
  optional.forEach((id) => { if (required.has(id) || recommended.has(id)) optional.delete(id); });

  // hashtags compatibility gate
  if (!hashtagsApplicable) {
    required.delete("hashtags");
    recommended.delete("hashtags");
    optional.delete("hashtags");
  }

  const requiredOutputs = Array.from(required);
  const recommendedOutputs = Array.from(recommended);
  const optionalOutputs = Array.from(optional);
  const allKnown = new Set<string>([...requiredOutputs, ...recommendedOutputs, ...optionalOutputs]);

  const incompatibleOutputs = Object.keys(OUTPUT_CATALOG).filter((id) => !allKnown.has(id));

  // Reconciliar seleção anterior:
  //   - mantém opcionais ainda compatíveis
  //   - mantém recomendados desmarcados (presença = está marcado)
  const prevCleaned = previousSelections.filter((id) => !CAPTION_TOKEN_SET.has(id));
  const prevSet = new Set(prevCleaned);
  // Recomendados: marcados por padrão, mas se usuário tinha desmarcado anteriormente, respeitar.
  const previouslyKnewRec = recommendedOutputs.filter((id) => prevCleaned.length > 0 && !prevSet.has(id) && Object.keys(OUTPUT_CATALOG).includes(id));
  // Heurística: se o output estava no catálogo anterior e o usuário NÃO o tinha selecionado, manter desmarcado.
  // Para simplificar, consideramos "previamente conhecido" = qualquer item recomendado que aparecia em previousSelections OU não — sem histórico granular, manteremos default (marcado). O usuário ajusta livremente.
  void previouslyKnewRec;

  const finalSelected = new Set<string>(requiredOutputs);
  recommendedOutputs.forEach((id) => finalSelected.add(id));
  // opcionais: só se estavam selecionados antes
  optionalOutputs.forEach((id) => { if (prevSet.has(id)) finalSelected.add(id); });

  const captionMode = previousCaption && CAPTION_PRIORITY[previousCaption] >= 0 ? previousCaption : captionDefault;

  return {
    requiredOutputs,
    recommendedOutputs,
    optionalOutputs,
    incompatibleOutputs,
    selectedOutputs: Array.from(finalSelected),
    appliesTo,
    captionMode: hashtagsApplicable || captionMode !== "none" ? captionMode : "none",
    hashtagsApplicable,
  };
}

export function formatLabelShort(key: string): string {
  return FORMAT_LABELS[key] ?? key;
}

export function appliesToLabel(
  id: string,
  appliesTo: ResolvedOutputs["appliesTo"],
  cat: OutputCategory,
): string {
  const entry = appliesTo[id];
  if (!entry) return "";
  const fmts = Object.entries(entry.categories)
    .filter(([, c]) => c === cat)
    .map(([f]) => formatLabelShort(f));
  return fmts.join(" e ");
}

// ============================================================================
// Reel — classificação de saídas (Etapa 1 da reestruturação)
// ----------------------------------------------------------------------------
// Separa o que é PUBLICADO (vídeo/capa), o que é TEXTO da publicação (legenda,
// CTA, hashtags, alt) e o que é MATERIAL INTERNO de produção (roteiro, cenas,
// storyboard, orientações). Fonte única consumida pelo promptBuilder, pela
// página de resultado, pela galeria e pelo calendário.
// ============================================================================

export type OutputKind =
  | "publishable_asset"
  | "publication_copy"
  | "production_material"
  | "reference_material";

export interface FormatOutputRule {
  format: string;
  category: "image" | "carousel" | "video" | "story" | "text" | "print";
  requiredOutputs: string[];
  optionalOutputs: string[];
  /** "single_publication" | "story_sequence" | "carousel" | "none" */
  calendarUnit: "single_publication" | "story_sequence" | "carousel" | "none";
  /** Chaves que devem aparecer na galeria de artes finais. */
  galleryOutputs: string[];
  /** Chaves classificadas como material de produção (não publicável). */
  productionOutputs: string[];
  /** Mapeamento chave → tipo (publishable / copy / production). */
  outputKinds: Record<string, OutputKind>;
}

export const FORMAT_OUTPUT_RULES: Record<string, FormatOutputRule> = {
  reel: {
    format: "reel",
    category: "video",
    requiredOutputs: ["script", "caption"],
    optionalOutputs: ["cover", "hashtags", "final_video", "storyboard", "alt_text"],
    calendarUnit: "single_publication",
    galleryOutputs: ["cover", "final_video"],
    productionOutputs: ["script", "scene_list", "storyboard", "editing_notes", "scene_reference"],
    outputKinds: {
      final_video: "publishable_asset",
      cover: "publishable_asset",
      caption: "publication_copy",
      cta: "publication_copy",
      hashtags: "publication_copy",
      alt_text: "publication_copy",
      script: "production_material",
      scene_list: "production_material",
      storyboard: "production_material",
      editing_notes: "production_material",
      scene_reference: "reference_material",
    },
  },
};

/** Mapa role (promptBuilder) → chave canônica usada nas regras de Reel. */
const REEL_ROLE_TO_KEY: Record<string, string> = {
  capa: "cover",
  roteiro: "script",
  legenda: "caption",
  cta: "cta",
};

export function reelKeyFromRole(role: string): string {
  return REEL_ROLE_TO_KEY[role] ?? role;
}

export function getFormatOutputRule(format: string): FormatOutputRule | undefined {
  return FORMAT_OUTPUT_RULES[format];
}

/** Classifica uma saída para um formato. Faz inferência segura quando o
 * formato ainda não tem regra explícita. */
export function classifyOutput(format: string, outputKey: string): OutputKind {
  const rule = FORMAT_OUTPUT_RULES[format];
  if (rule && rule.outputKinds[outputKey]) return rule.outputKinds[outputKey];
  // fallback heurístico (não-reel ou chaves desconhecidas)
  if (["caption", "cta", "hashtags", "alt_text"].includes(outputKey)) return "publication_copy";
  if (["script", "scene_list", "storyboard", "editing_notes"].includes(outputKey)) return "production_material";
  return "publishable_asset";
}

export function isPublishableOutput(format: string, outputKey: string): boolean {
  return classifyOutput(format, outputKey) === "publishable_asset";
}

export function isProductionMaterial(format: string, outputKey: string): boolean {
  return classifyOutput(format, outputKey) === "production_material";
}

/** Para Reel: prompt visual SÓ é gerado para capa e referências de cena.
 * Roteiro, legenda, CTA, hashtags, falas e lista de cenas NÃO geram prompt. */
export function shouldGenerateVisualPrompt(format: string, outputKey: string): boolean {
  if (format === "reel") {
    return outputKey === "cover" || outputKey === "scene_reference";
  }
  // Para outros formatos mantém comportamento atual (publishable gera prompt).
  return isPublishableOutput(format, outputKey);
}

export function shouldShowInFinalGallery(format: string, outputKey: string): boolean {
  const rule = FORMAT_OUTPUT_RULES[format];
  if (rule) return rule.galleryOutputs.includes(outputKey);
  return isPublishableOutput(format, outputKey);
}

export function shouldSendToCalendar(format: string, outputKey: string): boolean {
  const rule = FORMAT_OUTPUT_RULES[format];
  if (!rule) return isPublishableOutput(format, outputKey);
  if (rule.calendarUnit === "none") return false;
  // single_publication: somente as peças publicáveis viram parte da unidade.
  return rule.galleryOutputs.includes(outputKey) || rule.outputKinds[outputKey] === "publication_copy";
}

export const OUTPUT_KIND_LABEL: Record<OutputKind, string> = {
  publishable_asset: "PUBLICAR",
  publication_copy: "USAR NA PUBLICAÇÃO",
  production_material: "MATERIAL INTERNO",
  reference_material: "REFERÊNCIA",
};

