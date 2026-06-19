// Cria Aí — Gerador determinístico de ideias.
// Reestruturado para que Objetivo governe o resultado (CTA, selo, ângulo)
// e a Abordagem decida COMO o assunto é desenvolvido.

import type { Tables } from "@/integrations/supabase/types";
import {
  type IdeaApproach,
  type IdeaFocus,
  type IdeaFormat,
  type IdeaObjective,
  type IdeaTone,
  IDEA_APPROACH_LABELS,
  IDEA_FORMAT_LABELS,
  IDEA_OBJECTIVE_LABELS,
  OBJECTIVE_PILLAR,
} from "./ideaTaxonomy";
import {
  evaluateCompatibility,
  type CompatibilityLevel,
} from "./ideaCompatibility";
import {
  approachIsSafe,
  getBrandIdeaSources,
  type BrandIdeaSources,
} from "./brandIdeaSources";

export {
  IDEA_OBJECTIVE_LABELS,
  IDEA_FORMAT_LABELS,
  IDEA_FOCUS_LABELS,
  IDEA_TONE_LABELS,
  IDEA_APPROACH_LABELS,
} from "./ideaTaxonomy";

export type {
  IdeaObjective,
  IdeaFocus,
  IdeaFormat,
  IdeaTone,
  IdeaApproach,
} from "./ideaTaxonomy";

export type Brand = Tables<"brands">;

export type NoveltyBadge =
  | "Ideia nova"
  | "Variação de conteúdo"
  | "Reaproveitamento"
  | "Tema recorrente";

export interface Idea {
  id: string;
  title: string;
  theme: string;
  content_pillar: string;
  objective: string;
  recommended_format: string;
  approach: string;
  angle: string;
  target_audience: string;
  audience_problem: string;
  central_message: string;
  hook: string;
  suggested_cta: string;
  required_information: string[];
  visual_direction: string;
  reason_to_publish: string;
  source_elements: string[];
  novelty_score: number;
  novelty_badge: NoveltyBadge;
  template_key: string;
  compatibility_level: CompatibilityLevel;
  compatibility_reason: string;
  applied_fallback_level: number;
  created_at: string;
}

export interface IdeaGenInput {
  brand: Brand;
  objective?: IdeaObjective;
  focus?: IdeaFocus;
  approach?: IdeaApproach;
  format?: IdeaFormat;
  tone?: IdeaTone;
  quantity: number;
  history?: Array<{
    theme?: string | null;
    objective?: string | null;
    formats?: string[] | null;
    cta?: string | null;
    template_key?: string | null;
  }>;
  excludeTitles?: string[];
  /** Quando true, permite degradar para abordagem auto ou foco automático. */
  allowFallback?: boolean;
  seed?: number;
}

export interface GenerationResult {
  ideas: Idea[];
  requested: number;
  /** quantos níveis de fallback foram aplicados (0 = nenhum). */
  appliedFallbackLevel: number;
  partial: boolean;
  /** explicações para a UI. */
  notes: string[];
  /** Diagnóstico das fontes consultadas. */
  sources: BrandIdeaSources;
}

// =================== CTA RESOLVER ===================

const CTA_POOL: Record<IdeaObjective, string[]> = {
  qualquer: ["Acompanhe nossos conteúdos", "Salve este conteúdo", "Comente o que achou"],
  informar: ["Confira os detalhes", "Salve esta informação", "Compartilhe com quem precisa"],
  educar: [
    "Salve esta dica",
    "Compartilhe com quem precisa",
    "Você já sabia?",
    "Continue acompanhando",
    "Qual ponto gera mais dúvida?",
  ],
  vender: [
    "Peça seu orçamento",
    "Consulte disponibilidade",
    "Fale com a equipe",
    "Conheça os detalhes",
  ],
  gerar_contatos: [
    "Converse com a equipe",
    "Envie uma mensagem",
    "Solicite mais informações",
    "Chame no WhatsApp para conversar",
  ],
  relacionamento: [
    "Conte para a gente",
    "Qual você escolheria?",
    "Já viveu algo parecido?",
    "Responda esta pergunta",
  ],
  autoridade: [
    "Salve para consultar",
    "Acompanhe os próximos conteúdos",
    "Compartilhe se achou útil",
  ],
  inspirar: [
    "Marque alguém que precisa ver isto",
    "Compartilhe esta mensagem",
    "Salve para relembrar",
  ],
};

function resolveCta(args: { objective: IdeaObjective; brand: Brand; idx: number }): string {
  const { objective, brand, idx } = args;
  const pool = CTA_POOL[objective] ?? CTA_POOL.qualquer;
  const brandCtas = (brand.calls_to_action ?? []).filter(Boolean) as string[];

  // Em vender / gerar_contatos preferimos uma CTA da marca quando ela for compatível.
  if ((objective === "vender" || objective === "gerar_contatos") && brandCtas.length > 0) {
    return brandCtas[idx % brandCtas.length];
  }
  return pool[idx % pool.length];
}

// =================== TEMPLATES POR ABORDAGEM ===================

type Built = {
  title: string;
  theme: string;
  angle: string;
  central_message: string;
  hook: string;
  required: string[];
  template_key: string;
};

interface TemplateContext {
  brand: Brand;
  sources: BrandIdeaSources;
  rand: () => number;
}

type ApproachBuilder = (ctx: TemplateContext) => Built | null;

function firstSentence(text: unknown): string {
  if (text == null) return "";
  const raw = Array.isArray(text) ? text.filter(Boolean).join(" ") : String(text);
  if (!raw) return "";
  const m = raw.trim().split(/(?<=[.!?])\s+/)[0] ?? raw.trim();
  return m.replace(/\s+/g, " ").trim();
}

function pick<T>(arr: T[], rand: () => number): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(rand() * arr.length)];
}

function clean(s: string): string {
  return s.replace(/[?.!]+$/g, "").trim();
}

const BUILDERS: Record<IdeaApproach, ApproachBuilder> = {
  auto: () => null, // selecionado dinamicamente
  beneficio: ({ sources, rand }) => {
    const item = pick(sources.usableProducts, rand);
    if (!item) return null;
    return {
      title: `Como ${item} facilita o seu dia`,
      theme: item,
      angle: "Apresentar benefícios reais — sem inventar resultado.",
      central_message: `Mostrar como ${item} resolve uma necessidade já cadastrada do público.`,
      hook: `${item}: pensado para quem busca praticidade.`,
      required: [`Confirmar quais benefícios reais de ${item} podem ser comunicados.`],
      template_key: "beneficio",
    };
  },
  duvida: ({ sources, rand }) => {
    const q = pick(sources.usableQuestions, rand) ?? pick(sources.usableDifficulties, rand);
    if (!q) return null;
    const c = clean(q).toLowerCase();
    return {
      title: `Você sabe ${c}?`,
      theme: q,
      angle: "Esclarecer uma dúvida real do público sem inventar dados.",
      central_message: `Responder objetivamente: ${q}.`,
      hook: `Tem gente que ainda tem dúvida sobre isso: ${c}.`,
      required: ["Confirmar a resposta correta com a marca antes de publicar."],
      template_key: "duvida",
    };
  },
  bastidores: ({ brand, sources, rand }) => {
    const item = pick(sources.usableProducts, rand) ?? brand.name;
    return {
      title: `O que acontece por trás de ${item}`,
      theme: `Bastidores de ${item}`,
      angle: "Mostrar processo e cuidado, criando aproximação.",
      central_message: `Apresentar o processo real por trás de ${item}.`,
      hook: `Tem muita coisa que você não vê acontecendo por trás de ${String(item).toLowerCase()}.`,
      required: ["Confirmar quais imagens ou vídeos reais de bastidores estão disponíveis."],
      template_key: "bastidores",
    };
  },
  historia_marca: ({ brand, sources }) => {
    const desc = firstSentence(sources.usableHistory[0] ?? brand.description);
    if (!desc) return null;
    return {
      title: `Por que a ${brand.name} existe`,
      theme: "História e propósito",
      angle: "Conectar pela história — sem inventar fatos.",
      central_message: desc,
      hook: `Tudo começou com uma decisão simples aqui na ${brand.name}.`,
      required: ["Confirmar fatos históricos com a marca antes da publicação."],
      template_key: "historia_marca",
    };
  },
  prova_social: ({ sources, rand }) => {
    const t = pick(sources.usableTestimonials, rand);
    if (!t) return null;
    return {
      title: `Quem viveu, conta: ${clean(t).slice(0, 60)}`,
      theme: "Prova social",
      angle: "Apresentar depoimento autorizado — sem inventar.",
      central_message: t,
      hook: `Olha o que um cliente real contou:`,
      required: [
        "Confirmar a autorização escrita do depoimento.",
        "Nunca alterar nome, foto ou conteúdo do cliente.",
      ],
      template_key: "prova_social",
    };
  },
  orientacao_pratica: ({ sources, rand }) => {
    const need =
      pick(sources.usableNeeds, rand) ??
      pick(sources.usableDifficulties, rand) ??
      pick(sources.usableTopics, rand);
    if (!need) return null;
    const c = clean(need).toLowerCase();
    return {
      title: `Orientação prática: ${need}`,
      theme: need,
      angle: "Oferecer uma orientação curta e útil sobre o tema.",
      central_message: `Apresentar uma orientação prática para ${c}.`,
      hook: `Anota aí uma orientação que ajuda bastante: ${c}.`,
      required: ["Validar a orientação com a marca antes de publicar."],
      template_key: "orientacao_pratica",
    };
  },
  erro_comum: ({ sources, rand }) => {
    const dif = pick(sources.usableDifficulties, rand) ?? pick(sources.usableNeeds, rand);
    if (!dif) return null;
    const c = clean(dif).toLowerCase();
    return {
      title: `Um erro comum ao lidar com ${c}`,
      theme: dif,
      angle: "Mostrar o erro comum e a forma correta de agir.",
      central_message: `Apresentar o erro habitual relacionado a “${dif}” e o caminho adequado.`,
      hook: `Você provavelmente já cometeu este erro: ${c}.`,
      required: ["Validar com a marca a forma correta de orientar o público."],
      template_key: "erro_comum",
    };
  },
  checklist: ({ sources, rand }) => {
    const need = pick(sources.usableNeeds, rand) ?? pick(sources.usableTopics, rand);
    if (!need) return null;
    return {
      title: `Checklist: ${need}`,
      theme: need,
      angle: "Lista verificável para o público — sem promessas.",
      central_message: `Oferecer um checklist prático sobre ${need}.`,
      hook: `Salve este checklist sobre ${String(need).toLowerCase()}.`,
      required: ["Validar os itens do checklist com a marca."],
      template_key: "checklist",
    };
  },
  passo_a_passo: ({ sources, rand }) => {
    const need = pick(sources.usableNeeds, rand) ?? pick(sources.usableProducts, rand);
    if (!need) return null;
    const c = clean(need).toLowerCase();
    return {
      title: `Como ${c} em poucos passos`,
      theme: need,
      angle: "Quebrar uma orientação prática em passos curtos.",
      central_message: `Orientar o público em passos sobre: ${need}.`,
      hook: `Salve este passo a passo: ${c}.`,
      required: ["Confirmar com a marca os passos reais a serem recomendados."],
      template_key: "passo_a_passo",
    };
  },
  comparacao: ({ sources, rand }) => {
    const a = pick(sources.usableProducts, rand) ?? pick(sources.usableTopics, rand);
    if (!a) return null;
    return {
      title: `Antes e depois com ${a}`,
      theme: a,
      angle: "Comparar dois cenários reais — sem exagero.",
      central_message: `Mostrar a diferença prática que ${a} oferece.`,
      hook: `A diferença aparece logo nos primeiros dias com ${String(a).toLowerCase()}.`,
      required: ["Confirmar dados e imagens reais de antes/depois antes de publicar."],
      template_key: "comparacao",
    };
  },
  mito_verdade: ({ sources, rand, brand }) => {
    const topic = pick(sources.usableTopics, rand) ?? pick(sources.usableQuestions, rand) ?? brand.segment ?? "";
    if (!topic) return null;
    return {
      title: `Mito ou verdade: ${topic}?`,
      theme: topic,
      angle: "Esclarecer crenças comuns do público de forma direta.",
      central_message: `Diferenciar mito de verdade em torno de “${topic}”.`,
      hook: `Mito ou verdade? ${topic}.`,
      required: ["Confirmar com a marca a resposta correta antes da publicação."],
      template_key: "mito_verdade",
    };
  },
  lista: ({ sources, rand }) => {
    const focus = pick(sources.usableTopics, rand) ?? pick(sources.usableProducts, rand);
    if (!focus) return null;
    const c = clean(focus).toLowerCase();
    return {
      title: `5 pontos que você precisa observar sobre ${c}`,
      theme: focus,
      angle: "Lista curta com pontos críticos para o público.",
      central_message: `Listar pontos relevantes sobre ${focus}.`,
      hook: `5 pontos que poucos contam sobre ${c}.`,
      required: ["Validar com a marca os pontos a serem citados."],
      template_key: "lista",
    };
  },
  antes_de_contratar: ({ sources, rand }) => {
    const item = pick(sources.usableProducts, rand);
    if (!item) return null;
    return {
      title: `O que saber antes de contratar ${item}`,
      theme: item,
      angle: "Reduzir dúvidas antes da decisão.",
      central_message: `Ajudar o público a decidir de forma informada sobre ${item}.`,
      hook: `Antes de fechar ${String(item).toLowerCase()}, vale considerar isto.`,
      required: ["Confirmar com a marca os critérios reais a serem listados."],
      template_key: "antes_de_contratar",
    };
  },
  prestacao_contas: ({ brand, sources, rand }) => {
    const topic = pick(sources.usableDifferentiators, rand) ?? firstSentence(brand.description);
    if (!topic) return null;
    return {
      title: `O que ${brand.name} entregou recentemente`,
      theme: "Prestação de contas",
      angle: "Comunicar entregas reais, com transparência.",
      central_message: `Mostrar de forma transparente o que ${brand.name} vem entregando.`,
      hook: `Algumas entregas recentes que merecem ser contadas:`,
      required: ["Listar somente entregas confirmadas pela marca."],
      template_key: "prestacao_contas",
    };
  },
  apresentacao_comercial: ({ sources, rand }) => {
    const item = pick(sources.usableProducts, rand);
    if (!item) return null;
    return {
      title: `Conheça ${item}`,
      theme: item,
      angle: "Apresentação direta — sem citar preço, desconto ou condição não cadastrada.",
      central_message: `Explicar para quem é indicado ${item} e o que entrega de fato.`,
      hook: `Esta é ${String(item).toLowerCase()} — pensada para quem busca o seguinte:`,
      required: [`Confirmar características reais e fotografias disponíveis de ${item}.`],
      template_key: "apresentacao_comercial",
    };
  },
};

// =================== ORDEM DE ABORDAGENS POR OBJETIVO ===================

const APPROACH_ORDER_BY_OBJECTIVE: Record<IdeaObjective, IdeaApproach[]> = {
  qualquer: [
    "orientacao_pratica", "duvida", "beneficio", "bastidores", "historia_marca",
    "lista", "checklist", "passo_a_passo", "comparacao", "mito_verdade",
    "erro_comum", "antes_de_contratar", "apresentacao_comercial", "prestacao_contas", "prova_social",
  ],
  educar: [
    "orientacao_pratica", "duvida", "checklist", "passo_a_passo", "erro_comum",
    "mito_verdade", "lista", "comparacao", "bastidores", "historia_marca",
    "beneficio", "antes_de_contratar", "prestacao_contas",
  ],
  vender: [
    "beneficio", "apresentacao_comercial", "antes_de_contratar", "prova_social",
    "comparacao", "checklist", "lista", "duvida", "orientacao_pratica", "bastidores",
  ],
  gerar_contatos: [
    "antes_de_contratar", "beneficio", "duvida", "prova_social", "apresentacao_comercial",
    "orientacao_pratica", "checklist", "comparacao", "bastidores",
  ],
  relacionamento: [
    "bastidores", "historia_marca", "duvida", "prestacao_contas", "prova_social",
    "lista", "mito_verdade", "comparacao", "erro_comum",
  ],
  autoridade: [
    "orientacao_pratica", "duvida", "erro_comum", "comparacao", "historia_marca",
    "mito_verdade", "checklist", "passo_a_passo", "lista",
  ],
  informar: [
    "historia_marca", "prestacao_contas", "lista", "orientacao_pratica", "comparacao",
    "duvida", "checklist", "passo_a_passo", "bastidores",
  ],
  inspirar: [
    "historia_marca", "bastidores", "prova_social", "prestacao_contas",
    "orientacao_pratica", "duvida", "comparacao",
  ],
};

// =================== UTILITÁRIOS ===================

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// =================== GERAÇÃO ===================

interface AttemptArgs {
  brand: Brand;
  sources: BrandIdeaSources;
  objective: IdeaObjective;
  focus: IdeaFocus;
  approachOrder: IdeaApproach[];
  format: IdeaFormat;
  tone: IdeaTone;
  quantity: number;
  excludeTitles: Set<string>;
  recentThemes: Set<string>;
  recentTemplates: Map<string, number>;
  rand: () => number;
  seedBase: number;
  fallbackLevel: number;
}

function attempt(args: AttemptArgs): Idea[] {
  const ideas: Idea[] = [];
  let counter = 0;
  for (let pass = 0; pass < 3 && ideas.length < args.quantity; pass++) {
    for (const approach of args.approachOrder) {
      if (ideas.length >= args.quantity) break;
      const safety = approachIsSafe(approach, args.sources);
      if (!safety.ok) continue;
      const builder = BUILDERS[approach];
      const built = builder({ brand: args.brand, sources: args.sources, rand: args.rand });
      if (!built) continue;
      const titleKey = built.title.toLowerCase();
      if (args.excludeTitles.has(titleKey)) continue;
      // Não excluir o tema inteiro: apenas evitar o título idêntico.
      const compat = evaluateCompatibility({
        objective: args.objective,
        focus: args.focus,
        approach,
        format: args.format,
      });
      if (compat.level === "incompatible") continue;

      const recommended_format =
        args.format !== "auto" ? IDEA_FORMAT_LABELS[args.format] : suggestFormat(approach);

      let score = 0;
      if (!args.recentThemes.has(built.theme.toLowerCase())) score += 3; else score -= 2;
      const tplCount = args.recentTemplates.get(built.template_key) ?? 0;
      if (tplCount === 0) score += 2; else if (tplCount >= 2) score -= 2;
      const badge: NoveltyBadge =
        score >= 4 ? "Ideia nova" :
        score >= 1 ? "Variação de conteúdo" :
        score >= -2 ? "Reaproveitamento" : "Tema recorrente";

      const idea: Idea = {
        id: `idea_${args.seedBase}_${args.fallbackLevel}_${counter++}`,
        title: built.title,
        theme: built.theme,
        content_pillar: OBJECTIVE_PILLAR[args.objective],
        objective: IDEA_OBJECTIVE_LABELS[args.objective],
        recommended_format,
        approach: IDEA_APPROACH_LABELS[approach],
        angle: built.angle,
        target_audience: args.brand.audience ?? "Público da marca",
        audience_problem: firstSentence(args.brand.audience_difficulties) || firstSentence(args.brand.audience_needs) || "",
        central_message: built.central_message,
        hook: built.hook,
        suggested_cta: resolveCta({ objective: args.objective, brand: args.brand, idx: counter }),
        required_information: built.required,
        visual_direction: args.brand.visual_style || "",
        reason_to_publish: built.angle,
        source_elements: args.sources.availableSources,
        novelty_score: score,
        novelty_badge: badge,
        template_key: built.template_key,
        compatibility_level: compat.level,
        compatibility_reason: compat.reason,
        applied_fallback_level: args.fallbackLevel,
        created_at: new Date().toISOString(),
      };

      args.excludeTitles.add(titleKey);
      ideas.push(idea);
    }
  }
  return ideas;
}

function suggestFormat(approach: IdeaApproach): string {
  switch (approach) {
    case "bastidores":
    case "historia_marca":
      return IDEA_FORMAT_LABELS.reel;
    case "checklist":
    case "passo_a_passo":
    case "lista":
    case "duvida":
    case "erro_comum":
    case "antes_de_contratar":
    case "comparacao":
      return IDEA_FORMAT_LABELS.carrossel;
    case "prova_social":
    case "beneficio":
    case "apresentacao_comercial":
    case "mito_verdade":
      return IDEA_FORMAT_LABELS.post;
    case "prestacao_contas":
      return IDEA_FORMAT_LABELS.comunicado;
    default:
      return IDEA_FORMAT_LABELS.post;
  }
}

function buildApproachOrder(args: {
  objective: IdeaObjective;
  focus: IdeaFocus;
  format: IdeaFormat;
  approach: IdeaApproach;
}): IdeaApproach[] {
  if (args.approach !== "auto") {
    // se houver abordagem explícita, ela vem primeiro; variações vêm depois.
    const rest = APPROACH_ORDER_BY_OBJECTIVE[args.objective].filter((a) => a !== args.approach);
    return [args.approach, ...rest];
  }
  const order = APPROACH_ORDER_BY_OBJECTIVE[args.objective];
  // reordena pela compatibilidade exata (objetivo+foco+formato).
  const ranked = order
    .map((approach) => ({
      approach,
      level: evaluateCompatibility({
        objective: args.objective,
        focus: args.focus,
        approach,
        format: args.format,
      }).level,
    }))
    .sort((a, b) => rankLevel(b.level) - rankLevel(a.level))
    .map((x) => x.approach);
  return ranked;
}

function rankLevel(l: CompatibilityLevel): number {
  return l === "recommended" ? 3 : l === "possible" ? 2 : l === "weak" ? 1 : 0;
}

export function generateIdeasWithMeta(input: IdeaGenInput): GenerationResult {
  const brand = input.brand;
  const objective = input.objective ?? "qualquer";
  const focus = input.focus ?? "qualquer";
  const approach = input.approach ?? "auto";
  const format = input.format ?? "auto";
  const tone = input.tone ?? "marca";
  const allowFallback = input.allowFallback !== false;

  const sources = getBrandIdeaSources(brand);
  const seedBase = input.seed ?? hashStr(brand.id + objective + focus + approach + format + tone);
  const rand = mulberry32(seedBase);
  const excludeTitles = new Set((input.excludeTitles ?? []).map((t) => t.toLowerCase()));
  const recentThemes = new Set(
    (input.history ?? []).slice(0, 10).map((h) => (h.theme ?? "").toLowerCase()).filter(Boolean),
  );
  const recentTemplates = new Map<string, number>();
  for (const h of input.history ?? []) {
    if (h.template_key) recentTemplates.set(h.template_key, (recentTemplates.get(h.template_key) ?? 0) + 1);
  }

  const notes: string[] = [];

  // NÍVEL 1: exato
  let order = buildApproachOrder({ objective, focus, format, approach });
  let ideas = attempt({
    brand, sources, objective, focus, approachOrder: order, format, tone,
    quantity: input.quantity, excludeTitles, recentThemes, recentTemplates, rand, seedBase,
    fallbackLevel: 0,
  });

  // NÍVEL 2: relaxar abordagem (caso usuário tenha escolhido uma específica)
  if (ideas.length < input.quantity && allowFallback && approach !== "auto") {
    const extraOrder = APPROACH_ORDER_BY_OBJECTIVE[objective].filter((a) => a !== approach);
    const more = attempt({
      brand, sources, objective, focus, approachOrder: extraOrder, format, tone,
      quantity: input.quantity - ideas.length,
      excludeTitles, recentThemes, recentTemplates, rand, seedBase, fallbackLevel: 1,
    });
    if (more.length > 0) {
      notes.push(
        `Não encontramos ideias suficientes com a abordagem “${IDEA_APPROACH_LABELS[approach]}”. Incluímos variações compatíveis.`,
      );
      ideas = ideas.concat(more);
    }
  }

  // NÍVEL 3: foco automático
  if (ideas.length < input.quantity && allowFallback && focus !== "qualquer") {
    const more = attempt({
      brand, sources, objective, focus: "qualquer",
      approachOrder: APPROACH_ORDER_BY_OBJECTIVE[objective], format, tone,
      quantity: input.quantity - ideas.length,
      excludeTitles, recentThemes, recentTemplates, rand, seedBase, fallbackLevel: 2,
    });
    if (more.length > 0) {
      notes.push("Ampliamos o foco para complementar as ideias.");
      ideas = ideas.concat(more);
    }
  }

  // NÍVEL 4: usar pilares / assuntos permitidos sem restrição de formato
  if (ideas.length < input.quantity && allowFallback && format !== "auto") {
    const more = attempt({
      brand, sources, objective, focus: "qualquer",
      approachOrder: APPROACH_ORDER_BY_OBJECTIVE[objective], format: "auto", tone,
      quantity: input.quantity - ideas.length,
      excludeTitles, recentThemes, recentTemplates, rand, seedBase, fallbackLevel: 3,
    });
    if (more.length > 0) {
      notes.push("Sugerimos o formato automaticamente para completar as ideias.");
      ideas = ideas.concat(more);
    }
  }

  const partial = ideas.length < input.quantity;
  if (partial && ideas.length > 0) {
    notes.unshift(`Encontramos ${ideas.length} ideias seguras com essa combinação.`);
  }

  return {
    ideas,
    requested: input.quantity,
    appliedFallbackLevel: ideas.reduce((m, i) => Math.max(m, i.applied_fallback_level), 0),
    partial,
    notes,
    sources,
  };
}

/** Compat: retorna apenas a lista. */
export function generateIdeas(input: IdeaGenInput): Idea[] {
  return generateIdeasWithMeta(input).ideas;
}

export function quickIdea(brand: Brand, excludeTitles: string[] = []): Idea | null {
  const r = generateIdeasWithMeta({
    brand,
    quantity: 1,
    excludeTitles,
    seed: Date.now() & 0xffffffff,
    allowFallback: true,
  });
  return r.ideas[0] ?? null;
}
