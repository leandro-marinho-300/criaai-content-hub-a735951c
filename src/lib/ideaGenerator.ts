import type { Tables } from "@/integrations/supabase/types";

export type Brand = Tables<"brands">;

export type IdeaTemplateKey =
  | "duvida_frequente"
  | "erro_comum"
  | "passo_a_passo"
  | "lista"
  | "beneficio"
  | "bastidores"
  | "diferencial"
  | "mito_ou_verdade"
  | "antes_de_contratar"
  | "checklist"
  | "historia_marca"
  | "produto_servico"
  | "data_importante"
  | "relacionamento"
  | "prova_social"
  | "conteudo_local"
  | "institucional"
  | "comercial"
  | "reaproveitamento"
  | "sazonal";

export type IdeaObjective =
  | "qualquer"
  | "informar" | "educar" | "vender"
  | "divulgar_produto" | "divulgar_servico"
  | "gerar_contatos" | "relacionamento" | "bastidores"
  | "autoridade" | "duvida" | "evento"
  | "prestacao_contas" | "institucional";

export type IdeaFormat =
  | "auto" | "post" | "carrossel" | "story" | "status_whatsapp" | "reel" | "comunicado";

export type IdeaFocus =
  | "qualquer" | "produto" | "servico" | "duvida" | "beneficio"
  | "bastidores" | "historia" | "prova_social" | "orientacao_pratica"
  | "campanha" | "data_relevante";

export type IdeaTone =
  | "marca" | "educativo" | "comercial" | "institucional"
  | "acolhedor" | "urgente" | "inspirador" | "descontraido";

export type NoveltyBadge = "Ideia nova" | "Variação de conteúdo" | "Reaproveitamento" | "Tema recorrente";

export interface Idea {
  id: string;
  title: string;
  theme: string;
  content_pillar: string;
  objective: string;
  recommended_format: string;
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
  template_key: IdeaTemplateKey;
  created_at: string;
}

export interface IdeaGenInput {
  brand: Brand;
  objective?: IdeaObjective;
  format?: IdeaFormat;
  focus?: IdeaFocus;
  tone?: IdeaTone;
  quantity: number;
  /** títulos / temas de conteúdos anteriores para variar */
  history?: Array<{ theme?: string | null; objective?: string | null; formats?: string[] | null; cta?: string | null; template_key?: string | null }>;
  /** Sementes a evitar (ex.: sugestões já mostradas na mesma sessão). */
  excludeTitles?: string[];
  /** Seed determinístico para reprodução. */
  seed?: number;
}

// Mapas de exibição
export const IDEA_OBJECTIVE_LABELS: Record<IdeaObjective, string> = {
  qualquer: "Qualquer objetivo",
  informar: "Informar",
  educar: "Educar",
  vender: "Vender",
  divulgar_produto: "Divulgar produto",
  divulgar_servico: "Divulgar serviço",
  gerar_contatos: "Gerar contatos",
  relacionamento: "Criar relacionamento",
  bastidores: "Mostrar bastidores",
  autoridade: "Fortalecer autoridade",
  duvida: "Responder dúvida frequente",
  evento: "Divulgar evento",
  prestacao_contas: "Prestação de contas",
  institucional: "Campanha institucional",
};

export const IDEA_FORMAT_LABELS: Record<IdeaFormat, string> = {
  auto: "Sugerir automaticamente",
  post: "Post Feed",
  carrossel: "Carrossel",
  story: "Stories",
  status_whatsapp: "Status WhatsApp",
  reel: "Reel",
  comunicado: "Comunicado",
};

export const IDEA_FOCUS_LABELS: Record<IdeaFocus, string> = {
  qualquer: "Qualquer tema",
  produto: "Produto",
  servico: "Serviço",
  duvida: "Dúvida do público",
  beneficio: "Benefício",
  bastidores: "Bastidores",
  historia: "História da marca",
  prova_social: "Prova social",
  orientacao_pratica: "Orientação prática",
  campanha: "Campanha",
  data_relevante: "Data relevante",
};

export const IDEA_TONE_LABELS: Record<IdeaTone, string> = {
  marca: "Seguir o tom da marca",
  educativo: "Educativo",
  comercial: "Comercial",
  institucional: "Institucional",
  acolhedor: "Acolhedor",
  urgente: "Urgente",
  inspirador: "Inspirador",
  descontraido: "Descontraído",
};

// --------------------- Utilidades internas ---------------------

function splitList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[;\n\r]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function pickFirstSentence(text: string | null | undefined): string {
  if (!text) return "";
  const m = text.trim().split(/(?<=[.!?])\s+/)[0] ?? text.trim();
  return m.replace(/\s+/g, " ").trim();
}

// PRNG simples e determinístico (Mulberry32)
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function uniqueOrFallback(values: string[], fallback: string): string {
  for (const v of values) {
    if (v && v.trim()) return v.trim();
  }
  return fallback;
}

// --------------------- Modelos editoriais ---------------------

type TemplateContext = {
  brand: Brand;
  products: string[];
  services: string[];
  faqs: string[];
  dates: string[];
  allowed: string[];
  ctas: string[];
  rand: () => number;
};

type TemplateOutput = Omit<Idea, "id" | "created_at" | "novelty_score" | "novelty_badge">;

type Template = {
  key: IdeaTemplateKey;
  label: string;
  pillar: string;
  defaultObjective: string;
  defaultFormat: string;
  /** retorna null quando a marca não tem dados suficientes para gerar a ideia com segurança */
  build: (ctx: TemplateContext) => TemplateOutput | null;
};

const TEMPLATES: Template[] = [
  {
    key: "duvida_frequente",
    label: "Dúvida frequente",
    pillar: "Educativo",
    defaultObjective: "Responder dúvida frequente",
    defaultFormat: "carrossel",
    build: (ctx) => {
      const q = pickFirstSentence(uniqueOrFallback(ctx.faqs, "")) || (ctx.allowed[0] ?? "");
      if (!q) return null;
      return baseIdea(ctx, {
        title: `Você sabe ${q.toLowerCase().replace(/[?.!]+$/g, "")}?`,
        theme: q,
        angle: "Esclarecer uma dúvida real do público sem inventar dados.",
        central_message: `Responder objetivamente: ${q}`,
        hook: `Tem gente que ainda tem dúvida sobre isso: ${q.toLowerCase()}`,
        cta: uniqueOrFallback(ctx.ctas, "Chame no direct e tire suas dúvidas."),
        required: ["Confirmar a resposta correta com a marca antes de publicar."],
      });
    },
  },
  {
    key: "erro_comum",
    label: "Erro comum",
    pillar: "Educativo",
    defaultObjective: "Educar",
    defaultFormat: "carrossel",
    build: (ctx) => {
      const dif = pickFirstSentence(ctx.brand.audience_difficulties) || (ctx.allowed[0] ?? "");
      if (!dif) return null;
      return baseIdea(ctx, {
        title: `Um erro comum ao lidar com ${dif.toLowerCase()}`,
        theme: dif,
        angle: "Mostrar o erro comum e a forma correta de agir.",
        central_message: `Apresentar o erro habitual relacionado a “${dif}” e a solução adequada.`,
        hook: `Você provavelmente já cometeu este erro: ${dif.toLowerCase()}.`,
        cta: uniqueOrFallback(ctx.ctas, "Comente se já passou por isso."),
        required: ["Validar com a marca a forma correta de orientar o público."],
      });
    },
  },
  {
    key: "passo_a_passo",
    label: "Passo a passo",
    pillar: "Educativo",
    defaultObjective: "Educar",
    defaultFormat: "carrossel",
    build: (ctx) => {
      const need = pickFirstSentence(ctx.brand.audience_needs) || (ctx.services[0] ?? ctx.products[0] ?? "");
      if (!need) return null;
      return baseIdea(ctx, {
        title: `Como ${need.toLowerCase()} em poucos passos`,
        theme: need,
        angle: "Quebrar uma orientação prática em passos curtos.",
        central_message: `Orientar o público em passos sobre: ${need}.`,
        hook: `Salve este passo a passo: ${need.toLowerCase()}.`,
        cta: uniqueOrFallback(ctx.ctas, "Salve para consultar depois."),
        required: ["Confirmar com a marca os passos reais a serem recomendados."],
      });
    },
  },
  {
    key: "lista",
    label: "Lista de pontos",
    pillar: "Educativo",
    defaultObjective: "Informar",
    defaultFormat: "carrossel",
    build: (ctx) => {
      const focus = ctx.allowed[0] ?? ctx.services[0] ?? ctx.products[0] ?? "";
      if (!focus) return null;
      const n = 5;
      return baseIdea(ctx, {
        title: `${n} pontos que você precisa observar antes de ${focus.toLowerCase()}`,
        theme: focus,
        angle: "Lista curta com pontos críticos para o público.",
        central_message: `Listar pontos relevantes sobre ${focus}.`,
        hook: `${n} pontos que poucos contam sobre ${focus.toLowerCase()}.`,
        cta: uniqueOrFallback(ctx.ctas, "Comente qual desses faz mais sentido para você."),
        required: ["Validar com a marca os pontos a serem citados."],
      });
    },
  },
  {
    key: "beneficio",
    label: "Benefício",
    pillar: "Comercial",
    defaultObjective: "Vender",
    defaultFormat: "post",
    build: (ctx) => {
      const item = ctx.products[0] ?? ctx.services[0];
      if (!item) return null;
      return baseIdea(ctx, {
        title: `Como ${item} ajuda no dia a dia`,
        theme: item,
        angle: "Apresentar benefícios reais — sem inventar resultados.",
        central_message: `Mostrar como ${item} resolve uma necessidade já cadastrada do público.`,
        hook: `${item}: pensado para facilitar sua rotina.`,
        cta: uniqueOrFallback(ctx.ctas, "Fale com a gente para conhecer."),
        required: [`Confirmar quais benefícios reais de ${item} podem ser comunicados.`],
      });
    },
  },
  {
    key: "bastidores",
    label: "Bastidores",
    pillar: "Bastidores",
    defaultObjective: "Mostrar bastidores",
    defaultFormat: "reel",
    build: (ctx) => {
      const item = ctx.products[0] ?? ctx.services[0] ?? ctx.brand.name;
      return baseIdea(ctx, {
        title: `O que acontece por trás de ${item}`,
        theme: `Bastidores de ${item}`,
        angle: "Mostrar processo e cuidado, criando aproximação.",
        central_message: `Apresentar o processo real por trás de ${item}.`,
        hook: `Tem muita coisa que você não vê acontecendo por trás de ${item.toLowerCase()}.`,
        cta: uniqueOrFallback(ctx.ctas, "Conta nos comentários: você imaginava esse processo?"),
        required: ["Confirmar quais imagens/vídeos reais de bastidores estão disponíveis."],
      });
    },
  },
  {
    key: "diferencial",
    label: "Diferencial",
    pillar: "Institucional",
    defaultObjective: "Fortalecer autoridade",
    defaultFormat: "carrossel",
    build: (ctx) => {
      const dif = pickFirstSentence(ctx.brand.differentiators);
      if (!dif) return null;
      return baseIdea(ctx, {
        title: `O que torna ${ctx.brand.name} diferente`,
        theme: "Diferenciais da marca",
        angle: "Comunicar diferenciais já cadastrados — sem exagerar.",
        central_message: dif,
        hook: `Tem um detalhe que mudou tudo aqui na ${ctx.brand.name}.`,
        cta: uniqueOrFallback(ctx.ctas, "Conheça mais sobre a gente."),
        required: ["Validar quais diferenciais podem ser destacados publicamente."],
      });
    },
  },
  {
    key: "mito_ou_verdade",
    label: "Mito ou verdade",
    pillar: "Educativo",
    defaultObjective: "Educar",
    defaultFormat: "post",
    build: (ctx) => {
      const topic = ctx.allowed[1] ?? ctx.allowed[0] ?? ctx.brand.segment ?? "";
      if (!topic) return null;
      return baseIdea(ctx, {
        title: `Mito ou verdade: ${topic}?`,
        theme: topic,
        angle: "Esclarecer crenças comuns do público de forma direta.",
        central_message: `Diferenciar mito de verdade em torno de “${topic}”.`,
        hook: `Mito ou verdade? ${topic}.`,
        cta: uniqueOrFallback(ctx.ctas, "Comente o que você achava sobre isso."),
        required: ["Confirmar com a marca a resposta correta antes da publicação."],
      });
    },
  },
  {
    key: "antes_de_contratar",
    label: "Antes de contratar",
    pillar: "Comercial",
    defaultObjective: "Gerar contatos",
    defaultFormat: "carrossel",
    build: (ctx) => {
      const item = ctx.services[0] ?? ctx.products[0];
      if (!item) return null;
      return baseIdea(ctx, {
        title: `O que saber antes de contratar ${item}`,
        theme: item,
        angle: "Reduzir dúvidas antes da compra/contratação.",
        central_message: `Ajudar o público a tomar uma decisão informada sobre ${item}.`,
        hook: `Antes de contratar ${item.toLowerCase()}, vale considerar isto.`,
        cta: uniqueOrFallback(ctx.ctas, "Solicite uma conversa para entender se faz sentido para você."),
        required: ["Confirmar com a marca os critérios reais a serem listados."],
      });
    },
  },
  {
    key: "checklist",
    label: "Checklist",
    pillar: "Educativo",
    defaultObjective: "Educar",
    defaultFormat: "carrossel",
    build: (ctx) => {
      const need = pickFirstSentence(ctx.brand.audience_needs) || (ctx.allowed[0] ?? "");
      if (!need) return null;
      return baseIdea(ctx, {
        title: `Checklist: ${need}`,
        theme: need,
        angle: "Lista verificável para o público — sem promessas.",
        central_message: `Oferecer um checklist prático para ${need}.`,
        hook: `Salve este checklist sobre ${need.toLowerCase()}.`,
        cta: uniqueOrFallback(ctx.ctas, "Salve para usar depois."),
        required: ["Validar os itens do checklist com a marca."],
      });
    },
  },
  {
    key: "historia_marca",
    label: "História da marca",
    pillar: "Institucional",
    defaultObjective: "Campanha institucional",
    defaultFormat: "reel",
    build: (ctx) => {
      const desc = pickFirstSentence(ctx.brand.description);
      if (!desc) return null;
      return baseIdea(ctx, {
        title: `Por que a ${ctx.brand.name} existe`,
        theme: "História e propósito",
        angle: "Conectar pela história — sem inventar fatos.",
        central_message: desc,
        hook: `Tudo começou com uma decisão simples aqui na ${ctx.brand.name}.`,
        cta: uniqueOrFallback(ctx.ctas, "Acompanhe nossa história."),
        required: ["Confirmar fatos históricos com a marca antes da publicação."],
      });
    },
  },
  {
    key: "produto_servico",
    label: "Produto/serviço",
    pillar: "Comercial",
    defaultObjective: "Divulgar produto",
    defaultFormat: "carrossel",
    build: (ctx) => {
      const item = ctx.products[0] ?? ctx.services[0];
      if (!item) return null;
      return baseIdea(ctx, {
        title: `Conheça ${item}`,
        theme: item,
        angle: "Apresentação direta para quem ainda não conhece.",
        central_message: `Explicar para quem é indicado ${item} e o que entrega de fato.`,
        hook: `Esta é ${item.toLowerCase()} — e ela foi pensada para quem busca o seguinte:`,
        cta: uniqueOrFallback(ctx.ctas, "Chame no WhatsApp para conhecer."),
        required: [`Confirmar características reais e fotografias disponíveis de ${item}.`],
      });
    },
  },
  {
    key: "data_importante",
    label: "Data importante",
    pillar: "Sazonal",
    defaultObjective: "Campanha institucional",
    defaultFormat: "post",
    build: (ctx) => {
      const date = ctx.dates[0];
      if (!date) return null;
      return baseIdea(ctx, {
        title: `Conteúdo para: ${date}`,
        theme: date,
        angle: "Aproveitar uma data já cadastrada pela marca.",
        central_message: `Marcar a data “${date}” com uma mensagem coerente com a marca.`,
        hook: `Hoje é uma data importante por aqui: ${date}.`,
        cta: uniqueOrFallback(ctx.ctas, "Marque alguém que precisa ver isto."),
        required: ["Confirmar com a marca o tom e a mensagem oficial para a data."],
      });
    },
  },
  {
    key: "relacionamento",
    label: "Relacionamento",
    pillar: "Relacionamento",
    defaultObjective: "Criar relacionamento",
    defaultFormat: "story",
    build: (ctx) => {
      const topic = ctx.allowed[0] ?? ctx.brand.segment ?? "";
      if (!topic) return null;
      return baseIdea(ctx, {
        title: `Enquete: ${topic}`,
        theme: topic,
        angle: "Convidar o público a interagir — sem cobrança comercial.",
        central_message: `Abrir uma conversa em torno de ${topic}.`,
        hook: `Queremos saber sua opinião sobre ${topic.toLowerCase()}.`,
        cta: uniqueOrFallback(ctx.ctas, "Responda a enquete no story."),
        required: ["Definir as opções da enquete com a marca."],
      });
    },
  },
  {
    key: "conteudo_local",
    label: "Conteúdo local",
    pillar: "Relacionamento",
    defaultObjective: "Criar relacionamento",
    defaultFormat: "story",
    build: (ctx) => {
      const region = ctx.brand.service_region;
      if (!region) return null;
      return baseIdea(ctx, {
        title: `Quem é de ${region} vai entender`,
        theme: `Região de ${region}`,
        angle: "Falar de algo específico da região de atendimento.",
        central_message: `Conversar com quem está em ${region}, criando identificação local.`,
        hook: `Aqui em ${region} tem uma particularidade que merece destaque.`,
        cta: uniqueOrFallback(ctx.ctas, "Marca quem é da região!"),
        required: ["Confirmar qual aspecto local pode ser citado sem inventar dados."],
      });
    },
  },
  {
    key: "institucional",
    label: "Institucional",
    pillar: "Institucional",
    defaultObjective: "Campanha institucional",
    defaultFormat: "post",
    build: (ctx) => {
      const dif = pickFirstSentence(ctx.brand.differentiators) || pickFirstSentence(ctx.brand.description);
      if (!dif) return null;
      return baseIdea(ctx, {
        title: `Como a ${ctx.brand.name} pensa o que faz`,
        theme: "Valores e modo de trabalho",
        angle: "Compartilhar valores com base em informações cadastradas.",
        central_message: dif,
        hook: `Existe uma forma específica de fazer aqui na ${ctx.brand.name}.`,
        cta: uniqueOrFallback(ctx.ctas, "Conheça quem está por trás da marca."),
        required: ["Validar os valores que podem ser publicamente comunicados."],
      });
    },
  },
  {
    key: "comercial",
    label: "Conteúdo comercial",
    pillar: "Comercial",
    defaultObjective: "Vender",
    defaultFormat: "post",
    build: (ctx) => {
      const item = ctx.products[0] ?? ctx.services[0];
      if (!item) return null;
      return baseIdea(ctx, {
        title: `Convite para conhecer ${item}`,
        theme: item,
        angle: "Chamada comercial — sem citar preço, desconto ou condição não cadastrada.",
        central_message: `Convidar o público a conhecer ${item} e abrir conversa.`,
        hook: `Se você anda buscando ${item.toLowerCase()}, esta mensagem é para você.`,
        cta: uniqueOrFallback(ctx.ctas, "Chame no WhatsApp para conversar."),
        required: ["Confirmar com a marca se há alguma condição ativa a ser comunicada — não inventar preço."],
      });
    },
  },
  {
    key: "reaproveitamento",
    label: "Reaproveitamento",
    pillar: "Educativo",
    defaultObjective: "Informar",
    defaultFormat: "story",
    build: (ctx) => {
      const focus = ctx.allowed[0] ?? ctx.services[0] ?? ctx.products[0];
      if (!focus) return null;
      return baseIdea(ctx, {
        title: `Transformar um conteúdo já feito em ${focus}`,
        theme: focus,
        angle: "Aproveitar conteúdo anterior em novo formato.",
        central_message: `Reapresentar um conteúdo já produzido em formato diferente, abordando ${focus}.`,
        hook: `Tem um conteúdo nosso anterior que merece ser revisto:`,
        cta: uniqueOrFallback(ctx.ctas, "Confira o conteúdo completo no feed."),
        required: ["Selecionar o conteúdo de referência a ser reaproveitado."],
      });
    },
  },
  {
    key: "prova_social",
    label: "Prova social",
    pillar: "Comercial",
    defaultObjective: "Vender",
    defaultFormat: "post",
    build: (ctx) => {
      // Não inventa depoimentos — só sugere estrutura
      return baseIdea(ctx, {
        title: "Estrutura para depoimento de cliente",
        theme: "Prova social",
        angle: "Apresentar depoimento autorizado — sem inventar.",
        central_message: "Apresentar depoimento real, com autorização do cliente.",
        hook: "Quem já viveu, conta:",
        cta: uniqueOrFallback(ctx.ctas, "Quer ser nosso próximo depoimento? Chame no direct."),
        required: [
          "Selecionar um depoimento real autorizado por escrito.",
          "Nunca inventar nome, foto ou conteúdo de cliente.",
        ],
      });
    },
  },
  {
    key: "sazonal",
    label: "Sazonal",
    pillar: "Sazonal",
    defaultObjective: "Campanha institucional",
    defaultFormat: "story",
    build: (ctx) => {
      const date = ctx.dates[1] ?? ctx.dates[0];
      if (!date) return null;
      return baseIdea(ctx, {
        title: `Conteúdo sazonal: ${date}`,
        theme: date,
        angle: "Uso editorial de data sazonal cadastrada na marca.",
        central_message: `Aproveitar a data ${date} para uma mensagem oportuna.`,
        hook: `Está chegando ${date}.`,
        cta: uniqueOrFallback(ctx.ctas, "Marque alguém que vai gostar disto."),
        required: ["Confirmar a data e a forma como a marca quer aparecer."],
      });
    },
  },
];

function baseIdea(
  ctx: TemplateContext,
  parts: {
    title: string;
    theme: string;
    angle: string;
    central_message: string;
    hook: string;
    cta: string;
    required: string[];
  },
): TemplateOutput {
  const audience = ctx.brand.audience ?? "Público da marca";
  const problem = pickFirstSentence(ctx.brand.audience_difficulties) || pickFirstSentence(ctx.brand.audience_needs) || "";
  return {
    title: parts.title,
    theme: parts.theme,
    content_pillar: "Educativo",
    objective: "Informar",
    recommended_format: "post",
    angle: parts.angle,
    target_audience: audience,
    audience_problem: problem,
    central_message: parts.central_message,
    hook: parts.hook,
    suggested_cta: parts.cta,
    required_information: parts.required,
    visual_direction: ctx.brand.visual_style || "",
    reason_to_publish: parts.angle,
    source_elements: [],
    template_key: "duvida_frequente",
  };
}

// --------------------- Geração ---------------------

export function generateIdeas(input: IdeaGenInput): Idea[] {
  const { brand, quantity } = input;
  const seedBase = input.seed ?? hashStr(brand.id + (input.objective ?? "") + (input.format ?? "") + (input.focus ?? "") + (input.tone ?? ""));
  const rand = mulberry32(seedBase);

  const ctx: TemplateContext = {
    brand,
    products: splitList(brand.products_services),
    services: splitList(brand.products_services),
    faqs: splitList(brand.frequently_asked_questions),
    dates: splitList(brand.important_dates),
    allowed: (brand.allowed_topics ?? []).filter(Boolean) as string[],
    ctas: (brand.calls_to_action ?? []).filter(Boolean) as string[],
    rand,
  };

  // Filtragem por foco/objetivo
  let pool = TEMPLATES.slice();
  if (input.focus && input.focus !== "qualquer") {
    const focusMap: Partial<Record<IdeaFocus, IdeaTemplateKey[]>> = {
      produto: ["produto_servico", "beneficio", "comercial"],
      servico: ["produto_servico", "antes_de_contratar", "comercial"],
      duvida: ["duvida_frequente", "mito_ou_verdade", "erro_comum"],
      beneficio: ["beneficio", "produto_servico"],
      bastidores: ["bastidores"],
      historia: ["historia_marca", "institucional"],
      prova_social: ["prova_social"],
      orientacao_pratica: ["passo_a_passo", "checklist", "lista"],
      campanha: ["institucional", "comercial"],
      data_relevante: ["data_importante", "sazonal"],
    };
    const keys = focusMap[input.focus];
    if (keys?.length) pool = pool.filter((t) => keys.includes(t.key));
  }
  if (input.objective && input.objective !== "qualquer") {
    // sem corte agressivo: só prioriza
    pool = pool.sort((a, b) => {
      const oa = a.defaultObjective.toLowerCase();
      const ob = b.defaultObjective.toLowerCase();
      const oTarget = (IDEA_OBJECTIVE_LABELS[input.objective!] ?? "").toLowerCase();
      const sa = oa.includes(oTarget) ? -1 : 0;
      const sb = ob.includes(oTarget) ? -1 : 0;
      return sa - sb;
    });
  }

  // Embaralhamento determinístico
  pool = shuffle(pool, rand);

  const ideas: Idea[] = [];
  const usedTitles = new Set((input.excludeTitles ?? []).map((t) => t.toLowerCase()));
  const recentThemes = new Set(
    (input.history ?? []).slice(0, 10).map((h) => (h.theme ?? "").toLowerCase()).filter(Boolean),
  );
  const recentTemplates = new Map<string, number>();
  for (const h of input.history ?? []) {
    if (h.template_key) recentTemplates.set(h.template_key, (recentTemplates.get(h.template_key) ?? 0) + 1);
  }

  let cursor = 0;
  let safety = 0;
  while (ideas.length < quantity && safety < pool.length * 3) {
    safety++;
    const tpl = pool[cursor % pool.length];
    cursor++;
    const built = tpl.build(ctx);
    if (!built) continue;
    if (usedTitles.has(built.title.toLowerCase())) continue;

    const recommended_format =
      input.format && input.format !== "auto" ? IDEA_FORMAT_LABELS[input.format] : labelFor(tpl.defaultFormat);
    const objective =
      input.objective && input.objective !== "qualquer" ? IDEA_OBJECTIVE_LABELS[input.objective] : tpl.defaultObjective;

    let score = 0;
    if (!recentThemes.has(built.theme.toLowerCase())) score += 3; else score -= 4;
    if (!recentTemplates.has(tpl.key)) score += 2; else score -= 2;
    if ((recentTemplates.get(tpl.key) ?? 0) >= 2) score -= 3;

    const badge: NoveltyBadge =
      score >= 4 ? "Ideia nova" :
      score >= 1 ? "Variação de conteúdo" :
      score >= -2 ? "Reaproveitamento" : "Tema recorrente";

    const idea: Idea = {
      ...built,
      template_key: tpl.key,
      content_pillar: tpl.pillar,
      objective,
      recommended_format,
      id: `idea_${seedBase}_${cursor}`,
      created_at: new Date().toISOString(),
      novelty_score: score,
      novelty_badge: badge,
      source_elements: collectSources(brand),
    };

    usedTitles.add(idea.title.toLowerCase());
    ideas.push(idea);
  }

  return ideas;
}

function labelFor(formatKey: string): string {
  const map: Record<string, string> = {
    post: "Post Feed",
    carrossel: "Carrossel",
    story: "Stories",
    sequencia_stories: "Sequência de Stories",
    status_whatsapp: "Status WhatsApp",
    reel: "Reel",
    comunicado: "Comunicado",
  };
  return map[formatKey] ?? "Post Feed";
}

function collectSources(brand: Brand): string[] {
  const out: string[] = [];
  if (brand.products_services) out.push("Produtos/serviços cadastrados");
  if (brand.audience) out.push("Público");
  if (brand.audience_difficulties) out.push("Dificuldades do público");
  if (brand.tone_of_voice) out.push("Tom de voz");
  if (brand.frequently_asked_questions) out.push("Dúvidas frequentes");
  if (brand.important_dates) out.push("Datas importantes");
  if (brand.differentiators) out.push("Diferenciais");
  return out;
}

/** Retorna uma única ideia rápida (para o atalho do dashboard). */
export function quickIdea(brand: Brand, excludeTitles: string[] = []): Idea | null {
  const list = generateIdeas({ brand, quantity: 1, excludeTitles, seed: Date.now() & 0xffffffff });
  return list[0] ?? null;
}
