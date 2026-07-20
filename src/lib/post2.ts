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

export interface Post2ConceptOption {
  label: string;
  concept: string;
  title: string;
  support_text: string;
  art_cta: string;
  visual_direction: string;
}

export interface Post2IdeaSuggestion {
  label: string;
  idea: string;
  promise: string;
  why: string;
  notes: string;
  situation: string;
  current_belief: string;
  desired_shift: string;
  cta: string;
}

export interface Post2ImportedContent {
  schema_version: "post_2_0";
  brand: string;
  central_idea: string;
  promise: string;
  selected_execution: {
    label: string;
    concept: string;
  };
  art: {
    title: string;
    support_text: string;
    optional_seal: string;
    art_cta: string;
  };
  publication: {
    caption: string;
    cta: string;
    hashtags: string[];
  };
  visual: {
    concept: string;
    direction: string;
  };
  information_to_confirm: string[];
}

export interface Post2Draft {
  version: 2;
  entry_mode: Post2EntryMode | "";
  brand_id: string;
  objective: Post2Objective | "";
  editorial_type: Post2EditorialType | "";
  ratio: Post2Ratio;
  theme: string;
  audience: string;
  understanding: string;
  situation: string;
  current_belief: string;
  desired_shift: string;
  desired_reaction: string;
  mandatory_information: string;
  call_to_action: string;
  restrictions: string;
  imported_context: string;
  preset_id: string;
  reference_content: string;
  reference_notes: string;
  concept_options: Post2ConceptOption[];
  selected_concept_index: number | null;
  title_options: string[];
  selected_title_index: number | null;
  custom_title: string;
  support_text: string;
  badge_text: string;
  art_cta: string;
  caption: string;
  hashtags: string;
  visual_direction: string;
  imported_content: Post2ImportedContent | null;
  imported_content_raw: string;
  imported_content_imported_at: string;
  project_id: string;
  output_id: string;
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
    version: 2,
    entry_mode: "",
    brand_id: "",
    objective: "",
    editorial_type: "",
    ratio: "4:5",
    theme: "",
    audience: "",
    understanding: "",
    situation: "",
    current_belief: "",
    desired_shift: "",
    desired_reaction: "",
    mandatory_information: "",
    call_to_action: "",
    restrictions: "",
    imported_context: "",
    preset_id: "",
    reference_content: "",
    reference_notes: "",
    concept_options: [],
    selected_concept_index: null,
    title_options: [],
    selected_title_index: null,
    custom_title: "",
    support_text: "",
    badge_text: "",
    art_cta: "",
    caption: "",
    hashtags: "",
    visual_direction: "",
    imported_content: null,
    imported_content_raw: "",
    imported_content_imported_at: "",
    project_id: "",
    output_id: "",
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
    return {
      ...createPost2Draft(),
      ...(JSON.parse(raw) as Partial<Post2Draft>),
      version: 2,
    };
  } catch {
    return createPost2Draft();
  }
}

export function clearPost2Draft() {
  if (typeof window !== "undefined") localStorage.removeItem(POST2_DRAFT_KEY);
}

type Post2Domain = "benefits_club" | "travel" | "dog" | "atelier" | "accounting" | "generic";

function brandCorpus(brand?: Tables<"brands"> | null) {
  return [
    brand?.name,
    brand?.segment,
    brand?.description,
    brand?.products_services,
    brand?.audience,
    brand?.audience_needs,
    brand?.audience_difficulties,
    brand?.frequently_asked_questions,
    ...(brand?.priority_services ?? []),
    ...(brand?.allowed_topics ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function detectDomain(brand?: Tables<"brands"> | null): Post2Domain {
  const text = brandCorpus(brand);
  if (/clube de benef[ií]cios|telemedicina|desconto.*sa[uú]de|bem clube/.test(text)) {
    return "benefits_club";
  }
  if (/viagem|turismo|travel|hotel|destino|f[eé]rias|roteiro|passagem/.test(text)) {
    return "travel";
  }
  if (/cachorro|canino|adestra|comportamento animal|pet|tutor/.test(text)) {
    return "dog";
  }
  if (/atelier|costura|bolsa|artesanal|moda|acess[oó]rio/.test(text)) {
    return "atelier";
  }
  if (/contabilidade|contador|fiscal|imposto|empresa|mei|cnpj|nota fiscal/.test(text)) {
    return "accounting";
  }
  return "generic";
}

export function buildPost2NoIdeaSuggestions(
  brand?: Tables<"brands"> | null,
  objective?: Post2Objective | "",
  editorialType?: Post2EditorialType | "",
): Post2IdeaSuggestion[] {
  const brandName = brand?.name?.trim() || "a marca";
  const domain = detectDomain(brand);
  const audience = compactText(brand?.audience || "o público da marca", 90);
  const objectiveResult = objectiveResultLabel(objective);
  const editorialHint =
    POST2_EDITORIAL_TYPES.find((item) => item.id === editorialType)?.label.toLowerCase() ||
    "abordagem clara";

  if (domain === "benefits_club") {
    const services = knownBenefitServices(brand);
    const faq = findQuestion(brand?.frequently_asked_questions, /plano de sa[uú]de/i);
    return [
      {
        label: "Dúvida frequente",
        idea: faq || `${brandName} é plano de saúde?`,
        promise: `Você vai entender o que é um clube de benefícios, o que ele não substitui e como pode apoiar a rotina sem ser confundido com plano de saúde.`,
        why: `Reduz uma confusão comum e ajuda ${audience} a avaliar a proposta com mais segurança.`,
        notes:
          "Diferenciar clube de benefícios e plano de saúde. Não inventar cobertura, carência, rede, preço ou economia garantida.",
        situation:
          "A pessoa conhece o nome do serviço, mas ainda não entende a diferença entre clube de benefícios e plano de saúde.",
        current_belief: "Muita gente confunde clube de benefícios com plano de saúde.",
        desired_shift: `Entender o papel real de ${brandName} e decidir se a proposta faz sentido para a rotina.`,
        cta: `Quer entender como ${brandName} funciona? Fale com a gente.`,
      },
      {
        label: "Situação cotidiana",
        idea: "Quando cuidar da saúde pesa no orçamento",
        promise: `Você vai perceber como um clube de benefícios pode ampliar o acesso a serviços e descontos sem prometer economia específica.`,
        why: `Gera identificação e conecta a marca a uma necessidade concreta do dia a dia.`,
        notes:
          "Evitar dramatização. Não usar linguagem de cobertura médica nem apresentar o serviço como plano de saúde.",
        situation:
          "Uma família precisa cuidar da saúde, mas consultas e serviços podem apertar o orçamento do mês.",
        current_belief:
          "A pessoa acredita que precisa adiar o cuidado ou assumir um custo que não cabe na rotina.",
        desired_shift:
          "Perceber que existem alternativas para ampliar o acesso a serviços e benefícios com mais previsibilidade.",
        cta: `Conheça como ${brandName} pode fazer parte da sua rotina.`,
      },
      {
        label: "Benefício prático",
        idea: `O que você encontra em ${brandName}?`,
        promise: `Você vai conhecer os benefícios confirmados pela marca, como ${services}, e entender como eles podem entrar na rotina.`,
        why: `Torna a proposta mais concreta e ajuda o público a entender o valor de uso.`,
        notes: `Usar somente serviços confirmados no cadastro. Aplicar ${editorialHint} e priorizar ${objectiveResult}.`,
        situation:
          "A pessoa ouviu falar no clube, mas ainda não consegue visualizar como os benefícios entram na rotina.",
        current_belief: "Ela percebe o serviço como algo abstrato ou difícil de usar.",
        desired_shift: `Entender, em poucos segundos, quais benefícios ${brandName} reúne e para quem eles podem ser úteis.`,
        cta: `Veja os benefícios e tire suas dúvidas com ${brandName}.`,
      },
    ];
  }

  if (domain === "travel") {
    return [
      {
        label: "Decisão prática",
        idea: "3 perguntas antes de escolher o próximo destino",
        promise:
          "Você vai descobrir como escolher pelo perfil, ritmo e prioridade da viagem, sem depender apenas do destino mais famoso.",
        why: "Transforma uma decisão ampla em um critério simples e útil.",
        notes: "Não citar preço, disponibilidade, atração, evento ou regra local sem confirmação.",
        situation:
          "A pessoa quer viajar, mas se perde entre muitas opções e recomendações genéricas.",
        current_belief:
          "Ela acredita que precisa escolher primeiro o destino e só depois pensar no tipo de experiência.",
        desired_shift:
          "Escolher a viagem pelo que deseja viver, pelo perfil do grupo e pelo nível de planejamento necessário.",
        cta: `Conte para ${brandName} como você quer viajar.`,
      },
      {
        label: "Erro de planejamento",
        idea: "O detalhe que muita gente esquece antes de fechar uma viagem",
        promise:
          "Você vai entender por que confirmar perfil do grupo, ritmo e necessidades evita escolhas desconectadas da viagem desejada.",
        why: "Cria atenção sem apelar para medo e reforça o valor do planejamento.",
        notes:
          "Não prometer viagem sem imprevistos. Não inventar regras de fornecedores ou destinos.",
        situation:
          "A viagem parece resolvida, mas um detalhe importante do perfil do viajante ainda não foi considerado.",
        current_belief: "Basta escolher destino e hospedagem para o planejamento estar completo.",
        desired_shift:
          "Perceber que uma boa viagem começa pela combinação entre pessoas, expectativas e decisões práticas.",
        cta: `Converse com ${brandName} antes de fechar sua próxima viagem.`,
      },
      {
        label: "Identificação",
        idea: "Sua viagem combina mais com descanso, descoberta ou conexão?",
        promise:
          "Você vai reconhecer qual estilo de experiência procura antes de montar o roteiro.",
        why: "Estimula comentário e abre espaço para atendimento personalizado.",
        notes: "Evitar estereótipos e promessas emocionais exageradas.",
        situation:
          "Pessoas diferentes podem desejar experiências completamente diferentes no mesmo destino.",
        current_belief: "Existe um roteiro ideal que serve para todo mundo.",
        desired_shift:
          "Entender que o roteiro precisa acompanhar o estilo, o ritmo e o propósito de cada viajante.",
        cta: "Qual dessas experiências combina mais com você?",
      },
    ];
  }

  if (domain === "dog") {
    return [
      {
        label: "Sinal antes da reação",
        idea: "Seu cachorro avisa antes de reagir — mas você pode não perceber",
        promise:
          "Você vai conhecer sinais discretos de desconforto que podem aparecer antes de uma reação mais intensa.",
        why: "Educa o tutor com uma situação observável e evita culpabilização.",
        notes: "Não diagnosticar, não prometer correção e não recomendar punição.",
        situation:
          "O tutor percebe apenas o rosnado ou a reação final e não reconhece os sinais anteriores.",
        current_belief: "A reação aconteceu do nada.",
        desired_shift:
          "Perceber que o cachorro comunica desconforto antes da reação e que observar esses sinais ajuda na rotina.",
        cta: "Qual desses sinais você já percebeu no seu cachorro?",
      },
      {
        label: "Erro cotidiano",
        idea: "Você pode estar reforçando o comportamento que tenta interromper",
        promise:
          "Você vai entender como atenção, toque ou contato visual podem ensinar o cachorro a repetir um comportamento.",
        why: "Conecta teoria a uma cena comum e entrega uma orientação prática.",
        notes: "Não culpar o tutor e não tratar o cachorro como desobediente por intenção.",
        situation:
          "O cachorro pula, late ou insiste e recebe atenção enquanto o tutor tenta fazê-lo parar.",
        current_belief:
          "Qualquer repreensão mostra claramente ao cachorro o que ele deve deixar de fazer.",
        desired_shift:
          "Entender que a consequência imediata pode reforçar o comportamento, mesmo sem essa intenção.",
        cta: "Qual comportamento você mais tenta interromper na rotina?",
      },
      {
        label: "Orientação prática",
        idea: "O “não” interrompe, mas não ensina o que fazer",
        promise:
          "Você vai entender por que indicar uma resposta alternativa deixa a comunicação mais clara para o cachorro.",
        why: "Transforma uma dúvida comum em uma ação simples e observável.",
        notes: "Evitar tom de culpa e promessas de obediência imediata.",
        situation:
          "O tutor repete “não”, mas o cachorro volta ao mesmo comportamento pouco depois.",
        current_belief: "Repetir “não” é suficiente para ensinar a resposta esperada.",
        desired_shift: "Perceber que interromper e ensinar são coisas diferentes.",
        cta: "Qual resposta você gostaria de ensinar no lugar do “não”?",
      },
    ];
  }

  if (domain === "atelier") {
    return [
      {
        label: "Detalhe artesanal",
        idea: "O detalhe que muda a percepção de uma peça artesanal",
        promise:
          "Você vai perceber como acabamento, material e proporção influenciam a experiência de uso de uma peça artesanal.",
        why: "Ajuda o público a perceber valor além da aparência inicial.",
        notes: "Não inventar material, estoque, preço ou prazo.",
        situation: "A pessoa vê duas peças parecidas, mas não sabe quais detalhes observar.",
        current_belief:
          "A diferença entre uma peça artesanal e uma peça comum está apenas no visual.",
        desired_shift: "Perceber o cuidado de construção, acabamento e escolha de materiais.",
        cta: `Conheça os detalhes das peças de ${brandName}.`,
      },
      {
        label: "Bastidor",
        idea: "Uma peça começa antes da primeira costura",
        promise:
          "Você vai conhecer as escolhas de uso, proporção, material e acabamento que orientam a criação.",
        why: "Mostra processo real e fortalece percepção de cuidado artesanal.",
        notes: "Não inventar etapas, equipe ou materiais que não estejam confirmados.",
        situation:
          "Antes de costurar, é preciso decidir como a peça será usada e qual experiência ela deve oferecer.",
        current_belief: "O processo artesanal começa quando a máquina é ligada.",
        desired_shift:
          "Entender que projeto, escolha e preparação também fazem parte do valor da peça.",
        cta: "Qual detalhe você mais valoriza em uma peça artesanal?",
      },
      {
        label: "Escolha consciente",
        idea: "Antes de escolher uma bolsa, repare nestes três pontos",
        promise:
          "Você vai saber o que observar em tamanho, organização interna e acabamento conforme a rotina de uso.",
        why: "Entrega utilidade e aproxima o produto de uma decisão real.",
        notes: "Não comparar marcas nem prometer durabilidade absoluta.",
        situation:
          "A pessoa escolhe apenas pela aparência e depois percebe que a peça não acompanha a rotina.",
        current_belief: "Uma bolsa bonita automaticamente funciona bem para qualquer uso.",
        desired_shift: "Escolher considerando beleza, função e acabamento.",
        cta: `Converse com ${brandName} sobre a sua rotina.`,
      },
    ];
  }

  if (domain === "accounting") {
    return [
      {
        label: "Cuidado fiscal",
        idea: "Antes de emitir uma nota fiscal, confira este ponto",
        promise:
          "Você vai conhecer um cuidado de conferência que pode reduzir retrabalho antes da emissão.",
        why: "Entrega uma ação útil e fortalece autoridade com responsabilidade.",
        notes: "Não inventar alíquota, prazo, regra municipal ou enquadramento.",
        situation:
          "A nota está pronta para emissão, mas dados de serviço ou tomador ainda não foram conferidos.",
        current_belief:
          "Se o sistema permitiu emitir, todos os dados estão necessariamente corretos.",
        desired_shift:
          "Perceber que uma conferência simples pode evitar cancelamento e retrabalho.",
        cta: `Fale com ${brandName} para revisar o processo da sua empresa.`,
      },
      {
        label: "Dúvida recorrente",
        idea: "Documento enviado não significa obrigação concluída",
        promise:
          "Você vai entender a diferença entre receber um documento, validar as informações e concluir a obrigação.",
        why: "Corrige uma percepção comum da rotina empresarial.",
        notes: "Não citar obrigação ou prazo específico sem contexto confirmado.",
        situation:
          "A empresa envia documentos e presume que todas as etapas posteriores aconteceram automaticamente.",
        current_belief: "O simples envio do arquivo encerra o processo contábil ou fiscal.",
        desired_shift:
          "Entender que conferência, processamento e retorno fazem parte da conclusão.",
        cta: "Como está o fluxo de documentos da sua empresa?",
      },
      {
        label: "Organização prática",
        idea: "O que separar antes de falar com a contabilidade",
        promise:
          "Você vai saber como organizar documentos e informações antes de falar com a contabilidade.",
        why: "Ajuda o cliente e reduz ruído no processo.",
        notes: "Usar categorias gerais. Não inventar lista obrigatória para todos os casos.",
        situation: "A empresa precisa resolver uma demanda, mas as informações estão espalhadas.",
        current_belief: "A contabilidade consegue localizar ou reconstruir tudo sem contexto.",
        desired_shift:
          "Perceber que uma preparação simples torna o atendimento mais rápido e seguro.",
        cta: `Converse com ${brandName} sobre o seu caso.`,
      },
    ];
  }

  const faq = findQuestion(brand?.frequently_asked_questions);
  const need =
    firstUsefulItem(brand?.audience_needs) || firstUsefulItem(brand?.audience_difficulties);
  const service =
    brand?.priority_services?.[0] ||
    firstUsefulItem(brand?.products_services) ||
    brand?.segment ||
    "a solução";
  return [
    {
      label: "Dúvida real",
      idea: faq || `Como funciona ${compactText(service, 58)}?`,
      promise: `Você vai entender uma dúvida concreta de ${audience} com linguagem simples e sem informações inventadas.`,
      why: `Ajuda a marca a ${objectiveResult} partindo de uma pergunta que o público reconhece.`,
      notes: "Usar somente informações confirmadas no cadastro da marca.",
      situation: `A pessoa tem interesse em ${compactText(service, 60)}, mas ainda não entendeu um ponto essencial.`,
      current_belief: "Ela acredita que precisa decidir antes de tirar as dúvidas.",
      desired_shift: "Entender o próximo passo com clareza e segurança.",
      cta: `Qual é a sua principal dúvida sobre ${compactText(service, 45)}?`,
    },
    {
      label: "Necessidade do público",
      idea: need
        ? titleFromNeed(need)
        : `Quando ${compactText(service, 48)} vira uma dificuldade na rotina`,
      promise: `Você vai reconhecer uma situação real e entender uma orientação útil, sem cair em anúncio genérico.`,
      why: "Gera identificação antes de apresentar a marca como apoio.",
      notes: `Aplicar ${editorialHint} e respeitar todas as restrições cadastradas.`,
      situation: need || `Uma situação cotidiana relacionada a ${compactText(service, 60)}.`,
      current_belief: "A pessoa trata a dificuldade como inevitável ou adia a decisão.",
      desired_shift: "Perceber que existe um caminho mais claro para lidar com a situação.",
      cta: `Isso também acontece com você?`,
    },
    {
      label: "Valor na prática",
      idea: `O que muda quando você conta com ${brandName}?`,
      promise: `Você vai entender o valor prático da marca a partir de um benefício confirmado, sem repetir a descrição institucional inteira.`,
      why: `Conecta proposta e rotina com foco em ${objectiveResult}.`,
      notes: "Não usar adjetivos vazios nem promessas genéricas. Mostrar um benefício verificável.",
      situation: `A pessoa conhece o serviço, mas ainda não visualiza como ele ajuda em uma necessidade real.`,
      current_belief: "Todas as opções parecem iguais quando apresentadas apenas por descrição.",
      desired_shift: `Entender o diferencial de ${brandName} por meio de uma situação concreta.`,
      cta: `Conheça melhor ${brandName}.`,
    },
  ];
}

function cleanTheme(theme: string) {
  return theme.trim().replace(/[.!?]+$/, "");
}

export function generatePost2Titles(draft: Post2Draft, brand?: Tables<"brands"> | null): string[] {
  if (draft.concept_options.length) {
    return draft.concept_options
      .map((option) => option.title)
      .filter(Boolean)
      .slice(0, 3);
  }
  const theme = normalizeTitle(draft.theme || "Um ponto importante para o seu público");
  const understanding = conciseSentence(draft.understanding, 72);
  return [
    theme,
    understanding || `O que você precisa entender sobre ${cleanTheme(theme).toLowerCase()}`,
    buildOutcomeTitle(draft.desired_shift || draft.understanding, theme),
  ]
    .filter((item, index, items) => Boolean(item) && items.indexOf(item) === index)
    .slice(0, 3);
}

export function getSelectedPost2Title(draft: Post2Draft) {
  if (draft.custom_title.trim()) return draft.custom_title.trim();
  if (draft.selected_title_index !== null) {
    return draft.title_options[draft.selected_title_index] ?? "";
  }
  return (
    draft.title_options[0] ?? draft.concept_options[draft.selected_concept_index ?? 0]?.title ?? ""
  );
}

export function generatePost2Result(
  draft: Post2Draft,
  brand?: Tables<"brands"> | null,
): Partial<Post2Draft> {
  const title = getSelectedPost2Title(draft) || generatePost2Titles(draft, brand)[0];
  const theme = cleanTheme(draft.theme) || title;
  const cta = draft.call_to_action.trim() || defaultCta(draft.objective, theme, brand?.name);
  const supportText =
    draft.support_text.trim() ||
    conciseSentence(draft.understanding, draft.ratio === "4:5" ? 130 : 95);
  const artCta = draft.art_cta.trim() || shortenArtCta(cta);
  const captionParts = [title, supportText, draft.mandatory_information.trim(), cta].filter(
    (item, index, items) => item && items.indexOf(item) === index,
  );
  const caption = captionParts.join("\n\n").replace(/\n{3,}/g, "\n\n");
  const visualDirection =
    draft.visual_direction.trim() || buildVisualDirection(draft, brand, title);
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
  const imported = draft.imported_content;
  if (!imported) {
    return "Importe o conteúdo editorial gerado pelo ChatGPT antes de montar o pedido visual.";
  }
  const title = draft.custom_title || imported.art.title;
  const dimensions = draft.ratio === "4:5" ? "4:5, 1080 × 1350 px" : "1:1, 1080 × 1080 px";
  const colors =
    [brand?.primary_color, brand?.secondary_color, ...(brand?.additional_colors ?? [])]
      .filter(Boolean)
      .join(", ") || "não informadas; não inventar paleta oficial";
  const selectedConcept = draft.concept_options[draft.selected_concept_index ?? 0];
  const pending: string[] = [];
  if (!brand?.logo_url) pending.push("logo oficial não disponível");
  if (!brand?.fonts) pending.push("tipografia oficial não informada");
  if (!brand?.primary_color) pending.push("cor principal não informada");

  return `Crie uma única arte final para Post do Instagram no formato ${dimensions}.

REGRA CRÍTICA
- Somente o conteúdo do bloco “TEXTO EXATO QUE PODE APARECER NA ARTE” pode ser renderizado como texto.
- Todo o restante deste pedido é instrução interna de criação e NÃO pode aparecer no layout.
- Não escrever na arte rótulos como “objetivo”, “tipo editorial”, “conceito”, “direção visual”, “usar pergunta”, “corrigir percepção”, “CTA”, “texto de apoio” ou qualquer explicação estratégica.
- Não inserir a legenda da publicação dentro da arte.

MARCA — CONTEXTO INTERNO, NÃO RENDERIZAR
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
Logo oficial: ${brand?.logo_url ? "usar somente se o arquivo oficial estiver anexado nesta conversa" : "não disponível; não inventar"}

ESTRATÉGIA — CONTEXTO INTERNO, NÃO RENDERIZAR
Objetivo: ${POST2_OBJECTIVES.find((item) => item.id === draft.objective)?.label ?? "Não definido"}
Tema: ${draft.theme.trim() || "Não definido"}
Caminho criativo: ${POST2_EDITORIAL_TYPES.find((item) => item.id === draft.editorial_type)?.label ?? "Não definido"}
Conceito escolhido: ${imported.visual.concept || selectedConcept?.concept || draft.understanding.trim() || "Não definido"}

TEXTO EXATO QUE PODE APARECER NA ARTE
Título principal: ${title || "Não definido"}
Texto de apoio: ${draft.support_text.trim() || imported.art.support_text || "Não usar"}
Selo ou destaque: ${draft.badge_text.trim() || imported.art.optional_seal || "Não usar"}
CTA curto: ${draft.art_cta.trim() || imported.art.art_cta || "Não usar"}
${draft.mandatory_information.trim() ? `Informação adicional obrigatória, usar exatamente como escrita: ${draft.mandatory_information.trim()}` : "Informação adicional obrigatória: não usar"}

DIREÇÃO VISUAL — NÃO RENDERIZAR COMO TEXTO
${draft.visual_direction.trim() || imported.visual.direction || buildVisualDirection(draft, brand, title)}

RESTRIÇÕES
- Não inventar informações, preços, datas, disponibilidade, promessas, benefícios, logotipo ou dados comerciais.
- Não alterar nem parafrasear os textos aprovados.
- Não copiar identidade visual, imagens ou composição autoral de referências externas.
- Não criar mockup, tela de celular, apresentação da peça ou elementos fora da área da arte.
- Manter alto contraste, leitura imediata no celular, respiro e margens de segurança.
${draft.restrictions.trim() ? `- Cuidados informados pelo usuário: ${draft.restrictions.trim()}` : ""}
${brand?.forbidden_inventions ? `- Restrições da marca: ${brand.forbidden_inventions}` : ""}
${brand?.prohibited_words?.length ? `- Palavras proibidas: ${brand.prohibited_words.join(", ")}` : ""}

PENDÊNCIAS A CONFIRMAR — NÃO RENDERIZAR
${pending.length ? pending.map((item) => `- ${item}`).join("\n") : "Nenhuma pendência visual identificada."}

ENTREGA
- Uma única peça visual pronta para aprovação.
- Sem mockup e sem explicações ao redor da arte.
- Respeitar rigorosamente a hierarquia e os textos aprovados.`
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function exportPost2Json(draft: Post2Draft, brand?: Tables<"brands"> | null) {
  return JSON.stringify(
    {
      schema_version: "post2-v2",
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
        hashtags: draft.hashtags.split(/\s+/).filter(Boolean),
      },
      generated_content: draft.imported_content,
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
      ? "Composição vertical 4:5. Reservar o terço superior para o título, o centro para um único elemento visual e a base para apoio e CTA."
      : "Composição quadrada 1:1. Usar hierarquia compacta, título dominante e um único elemento visual central.";
  const style = brand?.visual_style || "visual limpo, profissional e coerente com a marca";
  return `${ratioRule} Priorizar o título “${title}”. Aplicar ${style}. Evitar excesso de blocos, ícones decorativos sem função e textos pequenos. O elemento visual deve representar o assunto concreto da peça, não a instrução estratégica.`;
}

function defaultCta(objective: Post2Objective | "", theme: string, brandName?: string | null) {
  const brand = brandName?.trim() || "a marca";
  if (objective === "contact") return `Fale com ${brand} para entender o próximo passo.`;
  if (objective === "sell") return `Conheça a solução e fale com ${brand}.`;
  if (objective === "promote") return "Saiba mais sobre esta novidade.";
  if (objective === "identify") return "Isso também acontece com você?";
  return `Qual é a sua principal dúvida sobre ${theme.toLowerCase()}?`;
}

function shortenArtCta(cta: string) {
  const clean = cta.trim().replace(/[.!?]+$/, "");
  const normalized = clean.toLowerCase();
  if (normalized.includes("quer entender como")) return "Entenda como funciona";
  if (normalized.includes("conheça como")) return "Conheça como funciona";
  if (normalized.includes("veja os benefícios")) return "Conheça os benefícios";
  if (/fale com .* para entender/i.test(clean)) return "Fale com a gente";
  if (/converse com .* para entender/i.test(clean)) return "Converse com a gente";
  if (clean.length <= 34) return clean;
  return clean.split(/[,.]/)[0].slice(0, 34).trim();
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

export function buildPost2ConceptOptions(
  draft: Post2Draft,
  brand?: Tables<"brands"> | null,
  round = 0,
): Post2ConceptOption[] {
  const domain = detectDomain(brand);
  if (domain === "benefits_club") return buildBenefitsClubConcepts(draft, brand, round);

  const theme = normalizeTitle(draft.theme || "Um tema importante");
  const promise = conciseSentence(draft.understanding, draft.ratio === "4:5" ? 125 : 95);
  const situation = conciseSentence(draft.situation, 78);
  const shift = conciseSentence(draft.desired_shift, 90);
  const artCta = shortenArtCta(draft.call_to_action || draft.desired_reaction || "Saiba mais");
  const baseVisual = ratioVisualBase(draft.ratio);
  const options: Post2ConceptOption[] = [
    {
      label: "Tema direto",
      concept: `Apresentar a ideia central sem rodeios e com uma única mensagem visual.`,
      title: theme,
      support_text: promise || shift || "Entenda o ponto principal de forma simples e objetiva.",
      art_cta: artCta,
      visual_direction: `${baseVisual} Usar uma imagem ou símbolo diretamente ligado ao tema, sem metáforas genéricas.`,
    },
    {
      label: "Situação real",
      concept: `Abrir pela situação vivida pelo público e conectar a cena à orientação da marca.`,
      title: buildSituationTitle(situation, theme),
      support_text:
        promise || "Uma situação comum pode revelar o que precisa ser observado antes de decidir.",
      art_cta: artCta,
      visual_direction: `${baseVisual} Representar uma cena cotidiana específica, com pessoas naturais e sem dramatização.`,
    },
    {
      label: "Mudança de olhar",
      concept: `Trocar uma percepção comum por uma compreensão mais útil e concreta.`,
      title: buildOutcomeTitle(shift || draft.understanding, theme),
      support_text: promise || shift || "Veja o assunto por um ângulo mais claro e prático.",
      art_cta: artCta,
      visual_direction: `${baseVisual} Usar contraste visual entre percepção inicial e novo entendimento, sem escrever a estratégia na arte.`,
    },
  ];
  return rotateOptions(options, round);
}

function buildBenefitsClubConcepts(
  draft: Post2Draft,
  brand?: Tables<"brands"> | null,
  round = 0,
): Post2ConceptOption[] {
  const brandName = brand?.name?.trim() || "o clube";
  const theme = normalizeTitle(draft.theme || `${brandName} é plano de saúde?`);
  const text = `${draft.theme} ${draft.understanding} ${draft.current_belief}`.toLowerCase();
  const isPlanQuestion = /plano de sa[uú]de|clube de benef[ií]cios/.test(text);
  const isBudget = /or[cç]amento|economia|gasto|consulta.*pes/.test(text);
  const services = knownBenefitServices(brand);
  const baseVisual = ratioVisualBase(draft.ratio);
  const cta = shortenArtCta(draft.call_to_action || "Entenda como funciona");

  if (isPlanQuestion) {
    return rotateOptions(
      [
        {
          label: "Pergunta direta",
          concept: "Responder a principal dúvida do público com uma diferença objetiva e segura.",
          title: theme.endsWith("?") ? theme : `${theme}?`,
          support_text: `Não é a mesma coisa que um plano de saúde. Entenda o papel de um clube de benefícios antes de escolher.`,
          art_cta: "Entenda como funciona",
          visual_direction: `${baseVisual} Título em destaque e comparação visual simples entre “plano de saúde” e “clube de benefícios”, sem criar tabela técnica nem inventar cobertura.`,
        },
        {
          label: "Comparação clara",
          concept: "Corrigir a confusão sem atacar quem ainda não conhece o modelo.",
          title: "Plano de saúde e clube de benefícios não são a mesma coisa",
          support_text:
            "Cada solução tem uma finalidade. Conheça a proposta antes de decidir o que faz sentido para a sua rotina.",
          art_cta: "Veja a diferença",
          visual_direction: `${baseVisual} Usar dois blocos visuais equilibrados e poucos elementos. Não listar coberturas, carências ou condições não confirmadas.`,
        },
        {
          label: "Valor na prática",
          concept: "Explicar a proposta do clube a partir dos benefícios confirmados da marca.",
          title: `O que ${brandName} oferece na prática?`,
          support_text: `Acesso a ${services}, de acordo com as condições e parceiros disponíveis.`,
          art_cta: cta,
          visual_direction: `${baseVisual} Usar três elementos visuais relacionados aos benefícios confirmados, sem transformar a arte em lista extensa ou anúncio genérico.`,
        },
      ],
      round,
    );
  }

  if (isBudget) {
    return rotateOptions(
      [
        {
          label: "Situação cotidiana",
          concept: "Começar por uma dificuldade financeira real sem dramatizar.",
          title: "A consulta apertou o orçamento?",
          support_text:
            "Conheça uma alternativa para acessar serviços e benefícios com mais previsibilidade na rotina.",
          art_cta: "Conheça como funciona",
          visual_direction: `${baseVisual} Cena familiar e cotidiana, com expressão natural. Evitar símbolos de emergência, sofrimento ou promessa de economia garantida.`,
        },
        {
          label: "Benefício direto",
          concept: "Apresentar acesso e economia como proposta de uso, não como promessa absoluta.",
          title: "Mais acesso à saúde e benefícios no dia a dia",
          support_text: `${brandName} reúne ${services} para apoiar a rotina de quem busca alternativas de cuidado e economia.`,
          art_cta: cta,
          visual_direction: `${baseVisual} Composição positiva, humana e simples, com um único foco visual e no máximo três ícones de apoio.`,
        },
        {
          label: "Pergunta de identificação",
          concept: "Fazer o público reconhecer a situação antes de apresentar a marca.",
          title: "Você já adiou um cuidado porque o custo não cabia no mês?",
          support_text:
            "Existem alternativas para ampliar o acesso a serviços sem tratar o clube como plano de saúde.",
          art_cta: "Saiba mais",
          visual_direction: `${baseVisual} Usar uma pessoa organizando a rotina ou as despesas, sem inserir gráficos, números ou preços inventados.`,
        },
      ],
      round,
    );
  }

  return rotateOptions(
    [
      {
        label: "Tema direto",
        concept:
          "Apresentar o assunto principal com linguagem simples e sem explicação institucional longa.",
        title: theme,
        support_text:
          conciseSentence(draft.understanding, 120) ||
          `Entenda como ${brandName} pode apoiar a rotina com benefícios e serviços confirmados.`,
        art_cta: cta,
        visual_direction: `${baseVisual} Usar um elemento visual relacionado ao benefício central da peça e manter o texto em poucos blocos.`,
      },
      {
        label: "Como funciona",
        concept: "Tornar a proposta concreta para quem ainda não entende o serviço.",
        title: `Como funciona ${brandName}?`,
        support_text: `Conheça ${services} e veja como esses benefícios podem entrar na sua rotina.`,
        art_cta: "Entenda como funciona",
        visual_direction: `${baseVisual} Composição explicativa, mas não técnica. Usar uma sequência visual simples de três benefícios confirmados.`,
      },
      {
        label: "Benefício na rotina",
        concept: "Conectar a marca a uma necessidade cotidiana do público.",
        title: "Benefícios que fazem sentido no dia a dia",
        support_text: `${brandName} reúne serviços e vantagens para facilitar o acesso a cuidado, bem-estar e economia.`,
        art_cta: "Conheça os benefícios",
        visual_direction: `${baseVisual} Cena humana, acolhedora e profissional. Evitar banco de imagens médico dramático ou aparência de plano de saúde.`,
      },
    ],
    round,
  );
}

export function applyPost2Concept(
  draft: Post2Draft,
  option: Post2ConceptOption,
): Partial<Post2Draft> {
  return {
    custom_title: option.title,
    selected_title_index: null,
    support_text: option.support_text,
    art_cta: option.art_cta,
    visual_direction: option.visual_direction,
  };
}

function ratioVisualBase(ratio: Post2Ratio) {
  return ratio === "4:5"
    ? "Composição vertical 4:5, com título forte no terço superior, um elemento visual principal no centro e CTA curto na base."
    : "Composição quadrada 1:1, com título dominante, elemento visual central e poucos blocos de texto.";
}

function rotateOptions<T>(items: T[], round: number) {
  if (!items.length) return items;
  const offset = Math.abs(round) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function knownBenefitServices(brand?: Tables<"brands"> | null) {
  const text = brandCorpus(brand);
  const services: string[] = [];
  if (/telemedicina/.test(text)) services.push("telemedicina");
  if (/desconto/.test(text)) services.push("descontos");
  if (/parceir/.test(text)) services.push("benefícios em parceiros");
  if (/bem-estar|bem estar/.test(text)) services.push("benefícios de bem-estar");
  if (/consulta/.test(text) && !services.includes("telemedicina"))
    services.push("serviços de saúde");
  return services.slice(0, 3).join(", ") || "serviços e benefícios confirmados pela marca";
}

function objectiveResultLabel(objective?: Post2Objective | "") {
  const map: Record<Post2Objective, string> = {
    educate: "educar com clareza",
    inform: "informar sem excesso",
    identify: "gerar identificação",
    promote: "dar visibilidade",
    sell: "apresentar valor",
    contact: "gerar conversa",
  };
  return objective ? map[objective] : "comunicar com clareza";
}

function findQuestion(value?: string | null, preferred?: RegExp) {
  if (!value) return "";
  const candidates = value
    .split(/\n|[;•]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((item) => item.match(/[^?]+\?/g) ?? [item]);
  const selected = preferred ? candidates.find((item) => preferred.test(item)) : candidates[0];
  if (!selected) return "";
  const clean = compactText(selected, 84);
  return clean.endsWith("?") ? clean : `${clean}?`;
}

function firstUsefulItem(value?: string | null) {
  if (!value) return "";
  return (
    value
      .split(/\n|[;•]/)
      .map((item) => item.trim())
      .find((item) => item.length >= 8) || ""
  );
}

function titleFromNeed(value: string) {
  const clean = compactText(value, 66).replace(/[.!?]+$/, "");
  if (/^como\b/i.test(clean) || clean.endsWith("?")) return normalizeTitle(clean);
  return normalizeTitle(`Quando ${clean.charAt(0).toLowerCase()}${clean.slice(1)}`);
}

function compactText(value: string | null | undefined, max: number) {
  const clean = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= max) return clean;
  return `${clean
    .slice(0, max)
    .replace(/\s+\S*$/, "")
    .trim()}…`;
}

function conciseSentence(value: string | null | undefined, max: number) {
  const clean = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "");
  if (!clean) return "";
  const compact = compactText(clean, max);
  return `${compact}${/[.!?…]$/.test(compact) ? "" : "."}`;
}

function normalizeTitle(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function buildSituationTitle(situation: string, fallback: string) {
  if (!situation) return `Isso acontece na sua rotina?`;
  const clean = situation
    .replace(/^(uma|um|a|o)\s+(pessoa|família|cliente|tutor)\s+/i, "")
    .replace(/^(quando|em que)\s+/i, "")
    .replace(/[.!?]+$/, "");
  if (clean.length <= 68) return normalizeTitle(clean.endsWith("?") ? clean : `${clean}?`);
  return `Isso também acontece quando o assunto é ${cleanTheme(fallback).toLowerCase()}?`;
}

function buildOutcomeTitle(value: string, fallback: string) {
  const clean = value
    .replace(/^(entender|perceber|compreender|mostrar|explicar)\s+(que\s+)?/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
  if (clean && clean.length <= 72) return normalizeTitle(clean);
  return `Um novo olhar sobre ${cleanTheme(fallback).toLowerCase()}`;
}
