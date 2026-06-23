// Cria Aí — Biblioteca determinística de caminhos editoriais para o modo
// "Já tenho um tema". Sem IA: cada caminho conhece sua função, objetivos
// compatíveis, formatos recomendados, abertura típica e um gerador de
// título de prévia baseado no tema do usuário.
//
// Esta lib é a base do banco de caminhos da Fase 2. Aqui ficam apenas as
// definições necessárias para a tela "Tenho tema" da Fase 1.

import type { IdeaObjective } from "./ideaTaxonomy";

export type CreativePathId =
  | "educativo"
  | "inspirador"
  | "comercial"
  | "relacionamento"
  | "autoridade"
  | "curiosidade"
  | "checklist"
  | "erro_comum"
  | "comparacao"
  | "bastidores";

export interface CreativePath {
  id: CreativePathId;
  label: string;
  /** Frase curta que descreve o que este caminho entrega. */
  description: string;
  /** Objetivos editoriais para os quais este caminho é mais natural. */
  recommendedObjectives: IdeaObjective[];
  /** Formatos sugeridos por padrão quando o usuário escolher este caminho. */
  suggestedFormats: string[];
  /** Abertura típica usada nas peças deste caminho. */
  openingStyle: string;
  /** Sugestão de CTA conforme a função do caminho. */
  suggestedCta: string;
  /**
   * Gera um título de prévia a partir do tema fornecido pelo usuário.
   * O título é apenas uma sugestão visual — não vira copy final.
   */
  previewTitle: (theme: string) => string;
}

function cleanTheme(theme: string): string {
  return theme.replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "");
}

function lowerFirst(s: string): string {
  return s.length ? s[0].toLowerCase() + s.slice(1) : s;
}

export const CREATIVE_PATHS: CreativePath[] = [
  {
    id: "educativo",
    label: "Educativo",
    description: "Explica e organiza um assunto em pontos claros para quem ainda está aprendendo.",
    recommendedObjectives: ["educar", "autoridade", "informar"],
    suggestedFormats: ["carrossel", "sequencia_stories"],
    openingStyle: "Pergunta + lista de pontos.",
    suggestedCta: "Salve para consultar depois.",
    previewTitle: (t) => `5 pontos para observar sobre ${lowerFirst(cleanTheme(t))}`,
  },
  {
    id: "inspirador",
    label: "Inspirador",
    description: "Constrói desejo e visualização. Foca em sensação, possibilidade e identificação.",
    recommendedObjectives: ["inspirar", "relacionamento", "autoridade"],
    suggestedFormats: ["post", "reel"],
    openingStyle: "Cena/imagem que convida a imaginar.",
    suggestedCta: "Compartilhe com quem você levaria junto.",
    previewTitle: (t) => `Imagine viver ${lowerFirst(cleanTheme(t))} do seu jeito`,
  },
  {
    id: "comercial",
    label: "Comercial",
    description: "Apresenta benefícios, diferenciais e leva à ação de compra ou contato.",
    recommendedObjectives: ["vender", "gerar_contatos"],
    suggestedFormats: ["post", "carrossel", "status_whatsapp"],
    openingStyle: "Benefício direto + prova rápida.",
    suggestedCta: "Fale com a equipe e veja as opções.",
    previewTitle: (t) => `${cleanTheme(t)}: o que está incluído e como garantir`,
  },
  {
    id: "relacionamento",
    label: "Relacionamento",
    description: "Convida o público a responder, contar uma escolha ou se identificar com uma situação.",
    recommendedObjectives: ["relacionamento", "inspirar"],
    suggestedFormats: ["story", "sequencia_stories", "post"],
    openingStyle: "Pergunta direta para o público.",
    suggestedCta: "Conte para a gente nos comentários.",
    previewTitle: (t) => `Qual ${lowerFirst(cleanTheme(t))} mais combina com você?`,
  },
  {
    id: "autoridade",
    label: "Autoridade",
    description: "Explica critérios, processo ou boas práticas que mostram domínio do assunto.",
    recommendedObjectives: ["autoridade", "educar"],
    suggestedFormats: ["carrossel", "post"],
    openingStyle: "Critério + explicação técnica acessível.",
    suggestedCta: "Continue acompanhando para mais critérios.",
    previewTitle: (t) => `Como avaliamos ${lowerFirst(cleanTheme(t))} antes de recomendar`,
  },
  {
    id: "curiosidade",
    label: "Curiosidade",
    description: "Abre com algo pouco conhecido e desperta vontade de saber mais.",
    recommendedObjectives: ["informar", "autoridade", "relacionamento"],
    suggestedFormats: ["post", "carrossel", "reel"],
    openingStyle: "Fato pouco conhecido + pergunta.",
    suggestedCta: "Você já tinha percebido isso?",
    previewTitle: (t) => `O que quase ninguém observa em ${lowerFirst(cleanTheme(t))}`,
  },
  {
    id: "checklist",
    label: "Checklist",
    description: "Apresenta uma lista verificável de itens para uma decisão ou preparação.",
    recommendedObjectives: ["educar", "vender", "autoridade"],
    suggestedFormats: ["carrossel", "sequencia_stories"],
    openingStyle: "Lista numerada de verificações.",
    suggestedCta: "Salve este checklist.",
    previewTitle: (t) => `Checklist: ${cleanTheme(t)} sem esquecer nada`,
  },
  {
    id: "erro_comum",
    label: "Erro comum",
    description: "Aponta um equívoco frequente e mostra como evitar.",
    recommendedObjectives: ["educar", "autoridade", "vender"],
    suggestedFormats: ["post", "carrossel"],
    openingStyle: "Erro frequente + correção.",
    suggestedCta: "Compartilhe com quem precisa ver isso.",
    previewTitle: (t) => `Um erro comum ao pensar em ${lowerFirst(cleanTheme(t))}`,
  },
  {
    id: "comparacao",
    label: "Comparação",
    description: "Compara opções, caminhos ou cenários para ajudar na escolha.",
    recommendedObjectives: ["vender", "educar", "autoridade"],
    suggestedFormats: ["carrossel", "post"],
    openingStyle: "Opção A vs Opção B com critérios.",
    suggestedCta: "Qual você escolheria?",
    previewTitle: (t) => `${cleanTheme(t)}: como comparar antes de decidir`,
  },
  {
    id: "bastidores",
    label: "Bastidores",
    description: "Mostra processo, cuidado ou pessoas por trás do conteúdo da marca.",
    recommendedObjectives: ["relacionamento", "autoridade", "inspirar"],
    suggestedFormats: ["story", "sequencia_stories", "reel"],
    openingStyle: "Cena de processo + breve narração.",
    suggestedCta: "Compartilhe nos stories da sua marca.",
    previewTitle: (t) => `Bastidores: como preparamos ${lowerFirst(cleanTheme(t))}`,
  },
];

export const CREATIVE_PATHS_BY_ID: Record<CreativePathId, CreativePath> =
  Object.fromEntries(CREATIVE_PATHS.map((p) => [p.id, p])) as Record<CreativePathId, CreativePath>;

/**
 * Ordena os caminhos por prioridade conforme o objetivo informado.
 * Quando o objetivo está vazio, devolve a lista padrão.
 */
export function rankPathsByObjective(
  objective: IdeaObjective | "" | null | undefined,
): CreativePath[] {
  if (!objective || objective === "qualquer") return CREATIVE_PATHS;
  return [...CREATIVE_PATHS].sort((a, b) => {
    const ai = a.recommendedObjectives.includes(objective) ? 0 : 1;
    const bi = b.recommendedObjectives.includes(objective) ? 0 : 1;
    return ai - bi;
  });
}

export function isCreativePathId(value: unknown): value is CreativePathId {
  return typeof value === "string" && value in CREATIVE_PATHS_BY_ID;
}
