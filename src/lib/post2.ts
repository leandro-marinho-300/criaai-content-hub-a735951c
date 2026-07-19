import type { Tables } from "@/integrations/supabase/types";

export const POST2_DRAFT_KEY = "cria-post2-draft-v1";

export type Post2EntryMode = "idea" | "no_ideas" | "preset" | "reference";
export type Post2Objective = "educate" | "inform" | "identify" | "promote" | "sell" | "contact";
export type Post2EditorialType =
  | "direct_guidance"
  | "error_alert"
  | "question_identification"
  | "belief_break"
  | "benefit_opportunity"
  | "institutional"
  | "commercial_offer";
export type Post2Ratio = "4:5" | "1:1";

export interface Post2Draft {
  version: 1;
  entry_mode: Post2EntryMode | "";
  brand_id: string;
  objective: Post2Objective | "";
  editorial_type: Post2EditorialType | "";
  ratio: Post2Ratio;
  theme: string;
  audience: string;
  understanding: string;
  mandatory_information: string;
  call_to_action: string;
  restrictions: string;
  imported_context: string;
  preset_id: string;
  reference_content: string;
  reference_notes: string;
  title_options: string[];
  selected_title_index: number | null;
  custom_title: string;
  support_text: string;
  badge_text: string;
  art_cta: string;
  caption: string;
  hashtags: string;
  visual_direction: string;
  created_at: string;
  updated_at: string;
}

export const POST2_ENTRY_OPTIONS: Array<{
  id: Post2EntryMode;
  label: string;
  description: string;
}> = [
  {
    id: "idea",
    label: "Tenho uma ideia",
    description: "Comece por uma ideia, tema ou mensagem que já deseja transformar em Post.",
  },
  {
    id: "no_ideas",
    label: "Estou sem ideias",
    description: "Receba sugestões considerando a marca, o público e o objetivo do conteúdo.",
  },
  {
    id: "preset",
    label: "Usar Preset",
    description:
      "Comece com uma estrutura editorial já configurada, sem transformar o preset em tema.",
  },
  {
    id: "reference",
    label: "Usar referência",
    description: "Use uma peça ou conteúdo apenas para aprender estrutura, hierarquia e abordagem.",
  },
];

export interface Post2IdeaSuggestion {
  id: string;
  title: string;
  understanding: string;
  cta: string;
  editorial_type: Post2EditorialType;
}

export function generatePost2IdeaSuggestions(
  draft: Post2Draft,
  brand?: Tables<"brands"> | null,
): Post2IdeaSuggestion[] {
  const name = brand?.name?.trim() || "a marca";
  const segment = brand?.segment?.trim() || "seu segmento";
  const audience = draft.audience.trim() || brand?.audience?.trim() || "o público da marca";
  const needs =
    brand?.audience_needs?.trim() ||
    brand?.audience_difficulties?.trim() ||
    "suas principais necessidades";
  const services =
    brand?.products_services?.trim() ||
    brand?.priority_services?.join(", ") ||
    "o que a marca oferece";
  const differentiators = brand?.differentiators?.trim() || "a forma de trabalhar da marca";

  const objective = draft.objective || "inform";
  const byObjective: Record<Post2Objective, Post2IdeaSuggestion[]> = {
    educate: [
      {
        id: "educate-1",
        title: `Um erro comum de ${audience} ao lidar com ${segment}`,
        understanding: `Explicar um erro frequente de forma prática e mostrar uma orientação mais clara, conectada às necessidades reais de ${audience}.`,
        cta: "Qual parte dessa situação mais gera dúvida para você?",
        editorial_type: "error_alert",
      },
      {
        id: "educate-2",
        title: `O que ${audience} precisa entender antes de escolher ${services}`,
        understanding: `Ensinar os critérios essenciais para tomar uma decisão mais segura, sem promessas ou informações não confirmadas.`,
        cta: "Salve este post para consultar antes de decidir.",
        editorial_type: "direct_guidance",
      },
      {
        id: "educate-3",
        title: `Mito ou verdade sobre ${segment}`,
        understanding: `Corrigir uma crença comum do público com linguagem simples, respeitosa e alinhada ao posicionamento de ${name}.`,
        cta: "Você já tinha ouvido essa afirmação?",
        editorial_type: "belief_break",
      },
    ],
    inform: [
      {
        id: "inform-1",
        title: `O que mudou ou merece atenção em ${segment}`,
        understanding: `Apresentar uma informação relevante para ${audience}, destacando somente fatos confirmados e seus impactos práticos.`,
        cta: "Compartilhe com alguém que precisa saber disso.",
        editorial_type: "direct_guidance",
      },
      {
        id: "inform-2",
        title: `3 pontos para entender melhor ${services}`,
        understanding: `Organizar os principais pontos de forma curta e útil, ajudando o público a compreender o assunto sem excesso de informação.`,
        cta: "Qual desses pontos você quer ver explicado em outro post?",
        editorial_type: "direct_guidance",
      },
      {
        id: "inform-3",
        title: `Uma dúvida frequente de ${audience}`,
        understanding: `Responder uma dúvida recorrente de forma objetiva e alinhada às informações oficiais da marca.`,
        cta: "Deixe sua dúvida nos comentários.",
        editorial_type: "question_identification",
      },
    ],
    identify: [
      {
        id: "identify-1",
        title: `Você também enfrenta isso em ${segment}?`,
        understanding: `Mostrar uma situação real vivida por ${audience} e acolher a dificuldade sem julgamento.`,
        cta: "Isso acontece com você também?",
        editorial_type: "question_identification",
      },
      {
        id: "identify-2",
        title: `Quando ${needs} começa a pesar na rotina`,
        understanding: `Criar identificação com uma dor concreta e mostrar que ela pode ser compreendida e organizada.`,
        cta: "Qual é a maior dificuldade hoje?",
        editorial_type: "question_identification",
      },
      {
        id: "identify-3",
        title: `Você não precisa resolver tudo sozinho`,
        understanding: `Acolher o público e apresentar ${name} como apoio possível, sem transformar o conteúdo em promessa comercial exagerada.`,
        cta: "Converse com a gente para entender o próximo passo.",
        editorial_type: "benefit_opportunity",
      },
    ],
    promote: [
      {
        id: "promote-1",
        title: `Conheça melhor ${services}`,
        understanding: `Apresentar de forma clara o que a marca oferece, para quem é indicado e qual necessidade atende.`,
        cta: "Fale com a gente para saber mais.",
        editorial_type: "institutional",
      },
      {
        id: "promote-2",
        title: `Como ${name} pode apoiar ${audience}`,
        understanding: `Relacionar os serviços da marca às necessidades do público sem inventar resultados ou garantias.`,
        cta: "Envie uma mensagem para entender como funciona.",
        editorial_type: "benefit_opportunity",
      },
      {
        id: "promote-3",
        title: `O diferencial de ${name} em ${segment}`,
        understanding: `Evidenciar ${differentiators} com linguagem concreta, evitando afirmações genéricas ou não comprovadas.`,
        cta: "Conheça nosso jeito de trabalhar.",
        editorial_type: "institutional",
      },
    ],
    sell: [
      {
        id: "sell-1",
        title: `Uma solução para ${needs}`,
        understanding: `Apresentar ${services} como uma possibilidade concreta para uma necessidade do público, sem prometer resultado garantido.`,
        cta: "Solicite mais informações.",
        editorial_type: "commercial_offer",
      },
      {
        id: "sell-2",
        title: `Por que considerar ${name} para ${segment}`,
        understanding: `Mostrar valor, diferenciais e adequação ao público com argumentos verificáveis e linguagem responsável.`,
        cta: "Converse com a equipe.",
        editorial_type: "benefit_opportunity",
      },
      {
        id: "sell-3",
        title: `Seu próximo passo em ${segment}`,
        understanding: `Conduzir o público a uma ação comercial simples, deixando claro o que será oferecido e o que precisa ser confirmado.`,
        cta: "Entre em contato para começar.",
        editorial_type: "commercial_offer",
      },
    ],
    contact: [
      {
        id: "contact-1",
        title: `Tem dúvidas sobre ${services}?`,
        understanding: `Abrir uma conversa com ${audience}, usando uma dúvida real como ponto de partida.`,
        cta: "Envie sua dúvida por mensagem.",
        editorial_type: "question_identification",
      },
      {
        id: "contact-2",
        title: `Vamos entender o que você precisa?`,
        understanding: `Convidar o público a explicar sua necessidade para receber orientação inicial, sem antecipar proposta ou promessa.`,
        cta: "Chame a gente para conversar.",
        editorial_type: "commercial_offer",
      },
      {
        id: "contact-3",
        title: `Descubra qual caminho faz sentido para você`,
        understanding: `Estimular contato para avaliar contexto, objetivo e possibilidades com atendimento personalizado.`,
        cta: "Fale com a equipe e conte seu objetivo.",
        editorial_type: "benefit_opportunity",
      },
    ],
  };

  return byObjective[objective];
}

export const POST2_OBJECTIVES: Array<{ id: Post2Objective; label: string; description: string }> = [
  {
    id: "educate",
    label: "Educar",
    description: "Ajudar o público a entender ou fazer algo melhor.",
  },
  {
    id: "inform",
    label: "Informar",
    description: "Apresentar uma informação relevante com clareza.",
  },
  {
    id: "identify",
    label: "Gerar identificação",
    description: "Fazer o público se reconhecer em uma situação real.",
  },
  {
    id: "promote",
    label: "Divulgar",
    description: "Dar visibilidade a uma ação, serviço ou novidade.",
  },
  {
    id: "sell",
    label: "Vender",
    description: "Apresentar valor e estimular uma decisão comercial.",
  },
  {
    id: "contact",
    label: "Gerar contato",
    description: "Convidar o público a conversar, pedir orçamento ou saber mais.",
  },
];

export const POST2_EDITORIAL_TYPES: Array<{
  id: Post2EditorialType;
  label: string;
  description: string;
}> = [
  {
    id: "direct_guidance",
    label: "Orientação direta",
    description: "Uma recomendação prática e fácil de aplicar.",
  },
  {
    id: "error_alert",
    label: "Erro ou alerta",
    description: "Mostra um risco, deslize ou detalhe que merece atenção.",
  },
  {
    id: "question_identification",
    label: "Pergunta ou identificação",
    description: "Começa por uma situação que o público vive.",
  },
  {
    id: "belief_break",
    label: "Quebra de crença",
    description: "Corrige uma percepção comum sem atacar o público.",
  },
  {
    id: "benefit_opportunity",
    label: "Benefício ou oportunidade",
    description: "Evidencia uma vantagem concreta ou possibilidade.",
  },
  {
    id: "institutional",
    label: "Institucional",
    description: "Apresenta posicionamento, propósito ou forma de trabalhar.",
  },
  {
    id: "commercial_offer",
    label: "Oferta ou chamada comercial",
    description: "Convida para uma ação comercial com clareza e responsabilidade.",
  },
];

export function createPost2Draft(): Post2Draft {
  const now = new Date().toISOString();
  return {
    version: 1,
    entry_mode: "",
    brand_id: "",
    objective: "",
    editorial_type: "",
    ratio: "4:5",
    theme: "",
    audience: "",
    understanding: "",
    mandatory_information: "",
    call_to_action: "",
    restrictions: "",
    imported_context: "",
    preset_id: "",
    reference_content: "",
    reference_notes: "",
    title_options: [],
    selected_title_index: null,
    custom_title: "",
    support_text: "",
    badge_text: "",
    art_cta: "",
    caption: "",
    hashtags: "",
    visual_direction: "",
    created_at: now,
    updated_at: now,
  };
}

export function savePost2Draft(draft: Post2Draft) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    POST2_DRAFT_KEY,
    JSON.stringify({ ...draft, updated_at: new Date().toISOString() }),
  );
}

export function loadPost2Draft(): Post2Draft {
  if (typeof window === "undefined") return createPost2Draft();
  try {
    const raw = localStorage.getItem(POST2_DRAFT_KEY);
    if (!raw) return createPost2Draft();
    return { ...createPost2Draft(), ...(JSON.parse(raw) as Partial<Post2Draft>) };
  } catch {
    return createPost2Draft();
  }
}

export function clearPost2Draft() {
  if (typeof window !== "undefined") localStorage.removeItem(POST2_DRAFT_KEY);
}

function cleanTheme(theme: string) {
  return theme.trim().replace(/[.!?]+$/, "");
}

export function generatePost2Titles(draft: Post2Draft, brand?: Tables<"brands"> | null): string[] {
  const theme = cleanTheme(draft.theme) || "este tema";
  const audience = draft.audience.trim() || brand?.audience?.trim() || "seu público";
  const understanding = draft.understanding.trim();

  const byType: Record<Post2EditorialType, string[]> = {
    direct_guidance: [
      `${capitalize(theme)}: o que fazer na prática`,
      `Um caminho mais claro para ${theme.toLowerCase()}`,
      `Antes de agir, entenda isto sobre ${theme.toLowerCase()}`,
    ],
    error_alert: [
      `O erro que muda tudo em ${theme.toLowerCase()}`,
      `Atenção a este detalhe sobre ${theme.toLowerCase()}`,
      `${capitalize(theme)}: o que pode estar passando despercebido`,
    ],
    question_identification: [
      `Você também passa por isso com ${theme.toLowerCase()}?`,
      `${capitalize(audience)}, isso acontece com você?`,
      `Por que ${theme.toLowerCase()} parece tão difícil?`,
    ],
    belief_break: [
      `Talvez o problema não seja ${theme.toLowerCase()}`,
      `O que quase ninguém explica sobre ${theme.toLowerCase()}`,
      `${capitalize(theme)} não funciona como muita gente imagina`,
    ],
    benefit_opportunity: [
      `O que você ganha ao entender ${theme.toLowerCase()}`,
      `${capitalize(theme)} pode ser mais simples do que parece`,
      `Uma oportunidade escondida em ${theme.toLowerCase()}`,
    ],
    institutional: [
      `Como enxergamos ${theme.toLowerCase()}`,
      `${capitalize(theme)} com mais clareza e cuidado`,
      `Nosso jeito de trabalhar com ${theme.toLowerCase()}`,
    ],
    commercial_offer: [
      `${capitalize(theme)} com orientação do início ao fim`,
      `Pronto para avançar em ${theme.toLowerCase()}?`,
      `O próximo passo para ${theme.toLowerCase()}`,
    ],
  };

  const selected = draft.editorial_type
    ? byType[draft.editorial_type]
    : [
        capitalize(theme),
        `O que você precisa saber sobre ${theme.toLowerCase()}`,
        understanding ? capitalize(understanding) : `Um novo olhar para ${theme.toLowerCase()}`,
      ];

  return [...new Set(selected.map((title) => title.replace(/\s+/g, " ").trim()))].slice(0, 3);
}

export function getSelectedPost2Title(draft: Post2Draft) {
  if (draft.custom_title.trim()) return draft.custom_title.trim();
  if (draft.selected_title_index !== null)
    return draft.title_options[draft.selected_title_index] ?? "";
  return draft.title_options[0] ?? "";
}

export function generatePost2Result(
  draft: Post2Draft,
  brand?: Tables<"brands"> | null,
): Partial<Post2Draft> {
  const title = getSelectedPost2Title(draft) || generatePost2Titles(draft, brand)[0];
  const theme = cleanTheme(draft.theme);
  const audience = draft.audience.trim() || brand?.audience?.trim() || "público da marca";
  const understanding = draft.understanding.trim() || `compreender melhor ${theme.toLowerCase()}`;
  const cta = draft.call_to_action.trim() || defaultCta(draft.objective, theme);
  const tone = brand?.tone_of_voice?.trim() || "claro, humano e direto";

  const supportText = draft.support_text.trim() || sentenceCase(understanding);
  const artCta = draft.art_cta.trim() || shortenCta(cta);
  const caption = [
    title,
    "",
    `${sentenceCase(understanding)}.`,
    draft.mandatory_information.trim() ? `\n${draft.mandatory_information.trim()}` : "",
    "",
    cta,
  ]
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  const visualDirection = buildVisualDirection(draft, brand, title);
  const hashtags = draft.hashtags.trim() || buildHashtags(brand, theme);

  return {
    support_text: supportText,
    art_cta: artCta,
    caption,
    visual_direction: visualDirection,
    hashtags,
  };
}

export function buildPost2LayoutPrompt(draft: Post2Draft, brand?: Tables<"brands"> | null): string {
  const title = getSelectedPost2Title(draft);
  const dimensions = draft.ratio === "4:5" ? "4:5, 1080 × 1350 px" : "1:1, 1080 × 1080 px";
  const colors =
    [brand?.primary_color, brand?.secondary_color, ...(brand?.additional_colors ?? [])]
      .filter(Boolean)
      .join(", ") || "não informadas; não inventar paleta de marca";
  const pending: string[] = [];
  if (!brand?.logo_url) pending.push("logo oficial não disponível");
  if (!brand?.fonts) pending.push("tipografia oficial não informada");
  if (!brand?.primary_color) pending.push("cor principal não informada");

  return `Crie uma arte para Post do Instagram no formato ${dimensions}.

IMPORTANTE
- Não use IA interna de outro aplicativo.
- Não invente informações, preços, datas, promessas, logotipo ou dados comerciais.
- Não altere os textos aprovados abaixo.
- Não transforme a legenda da publicação em texto dentro da arte.
- Gere uma única peça visual, sem mockup, sem tela de celular e sem elementos fora da área da arte.

MARCA
Nome: ${brand?.name ?? "Marca não selecionada"}
Segmento: ${brand?.segment ?? "Não informado"}
Descrição: ${brand?.description ?? "Não informada"}
Público: ${draft.audience.trim() || brand?.audience || "Não informado"}
Tom: ${brand?.tone_of_voice ?? "Não informado"}
Personalidade: ${brand?.personality ?? "Não informada"}
Cores: ${colors}
Tipografia: ${brand?.fonts ?? "Não informada"}
Estilo visual: ${brand?.visual_style ?? "Não informado"}
Elementos gráficos: ${brand?.graphic_elements ?? "Não informados"}
Logo oficial: ${brand?.logo_url ? "disponível no cadastro da marca; usar somente se estiver anexado nesta conversa" : "não disponível; não inventar"}

OBJETIVO DA PEÇA
${POST2_OBJECTIVES.find((item) => item.id === draft.objective)?.label ?? "Não definido"}

CONTEXTO EDITORIAL
Tema: ${draft.theme.trim()}
Tipo editorial: ${POST2_EDITORIAL_TYPES.find((item) => item.id === draft.editorial_type)?.label ?? "Não definido"}
Mensagem que o público deve entender: ${draft.understanding.trim() || "Não informada"}

CONTEÚDO OBRIGATÓRIO NA ARTE
Título principal: ${title}
Texto de apoio: ${draft.support_text.trim() || "Sem texto de apoio"}
Selo ou destaque: ${draft.badge_text.trim() || "Não usar"}
CTA curto na arte: ${draft.art_cta.trim() || "Não usar"}

DIREÇÃO VISUAL
${draft.visual_direction.trim() || buildVisualDirection(draft, brand, title)}

INFORMAÇÕES OBRIGATÓRIAS
${draft.mandatory_information.trim() || "Nenhuma informação adicional informada."}

RESTRIÇÕES E CUIDADOS
${draft.restrictions.trim() || "Não inventar dados e manter leitura confortável no celular."}
${brand?.forbidden_inventions ? `Restrições da marca: ${brand.forbidden_inventions}` : ""}
${brand?.prohibited_words?.length ? `Palavras proibidas: ${brand.prohibited_words.join(", ")}` : ""}

PENDÊNCIAS A CONFIRMAR
${pending.length ? pending.map((item) => `- ${item}`).join("\n") : "Nenhuma pendência visual identificada."}

ENTREGA
- Uma única arte final para aprovação.
- Alto contraste e leitura imediata no celular.
- Respeitar margens de segurança.
- Não incluir a legenda da publicação dentro do layout.
- Não copiar identidade visual de referências externas.`
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function exportPost2Json(draft: Post2Draft, brand?: Tables<"brands"> | null) {
  return JSON.stringify(
    {
      schema_version: "post2-v1",
      format: "post",
      ratio: draft.ratio,
      brand: brand ? { id: brand.id, name: brand.name, segment: brand.segment } : null,
      objective: draft.objective,
      editorial_type: draft.editorial_type,
      theme: draft.theme,
      audience: draft.audience || brand?.audience || "",
      art: {
        title: getSelectedPost2Title(draft),
        support_text: draft.support_text,
        badge: draft.badge_text,
        cta: draft.art_cta,
      },
      publication: {
        caption: draft.caption,
        hashtags: draft.hashtags.split(/\s+/).filter(Boolean).slice(0, 5),
      },
      visual_direction: draft.visual_direction,
      layout_prompt: buildPost2LayoutPrompt(draft, brand),
      mandatory_information: draft.mandatory_information,
      restrictions: draft.restrictions,
    },
    null,
    2,
  );
}

function buildVisualDirection(
  draft: Post2Draft,
  brand: Tables<"brands"> | null | undefined,
  title: string,
) {
  const ratioRule =
    draft.ratio === "4:5"
      ? "Composição vertical 4:5, com título ocupando a metade superior e área visual de apoio na metade inferior."
      : "Composição quadrada 1:1, com hierarquia compacta, título em bloco dominante e poucos elementos.";
  const style = brand?.visual_style || "visual limpo, profissional e coerente com o tom da marca";
  return `${ratioRule} Dar prioridade absoluta ao título “${title}”. Usar ${style}. Manter respiro, contraste forte, leitura rápida no celular e no máximo um elemento visual principal. O CTA deve ser discreto e não competir com a mensagem central.`;
}

function defaultCta(objective: Post2Objective | "", theme: string) {
  if (objective === "contact")
    return "Quer entender como isso se aplica ao seu caso? Entre em contato.";
  if (objective === "sell") return "Fale com a gente para conhecer a solução.";
  if (objective === "promote") return "Saiba mais e acompanhe os próximos passos.";
  if (objective === "identify")
    return `Isso também acontece com você quando o assunto é ${theme.toLowerCase()}?`;
  return `Qual é a sua maior dúvida sobre ${theme.toLowerCase()}?`;
}

function shortenCta(cta: string) {
  const clean = cta.trim().replace(/[.!?]+$/, "");
  if (clean.length <= 42) return clean;
  return clean.split(/[,.]/)[0].slice(0, 42).trim();
}

function buildHashtags(brand: Tables<"brands"> | null | undefined, theme: string) {
  const normalize = (value: string) =>
    `#${value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "")
      .slice(0, 28)}`;
  return [
    brand?.name,
    brand?.segment,
    ...theme
      .split(/\s+/)
      .filter((item) => item.length > 5)
      .slice(0, 3),
  ]
    .filter(Boolean)
    .map((item) => normalize(String(item)))
    .filter((item, index, array) => item.length > 1 && array.indexOf(item) === index)
    .slice(0, 5)
    .join(" ");
}

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function sentenceCase(value: string) {
  const clean = value.trim().replace(/[.!?]+$/, "");
  return capitalize(clean);
}
