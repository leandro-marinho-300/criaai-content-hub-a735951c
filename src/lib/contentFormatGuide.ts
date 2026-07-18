export type ContentFormatComplexity = "simples" | "media" | "avancada" | "subproduto";

export interface ContentFormatGuideItem {
  key: string;
  label: string;
  shortLabel: string;
  category: "principal" | "subproduto" | "saida";
  useWhen: string;
  generates: string[];
  doesNotGenerate: string[];
  complexity: ContentFormatComplexity;
  approvalHint: string;
  userHint: string;
}

export const CONTENT_FORMAT_GUIDE: ContentFormatGuideItem[] = [
  {
    key: "post",
    label: "Post para Feed",
    shortLabel: "Post",
    category: "principal",
    useWhen: "Use quando a mensagem cabe em uma ideia única, visual e direta.",
    generates: ["texto da arte", "legenda", "CTA", "até 5 hashtags", "prompt de imagem"],
    doesNotGenerate: ["roteiro", "storyboard", "sequência longa"],
    complexity: "simples",
    approvalHint: "Aprovação como peça visual individual.",
    userHint: "Melhor para recados, posicionamentos, ofertas simples e mensagens objetivas.",
  },
  {
    key: "carrossel",
    label: "Carrossel",
    shortLabel: "Carrossel",
    category: "principal",
    useWhen: "Use quando precisa explicar, listar, comparar ou conduzir a pessoa por etapas.",
    generates: ["capa", "slides", "texto por slide", "legenda geral", "CTA", "hashtags"],
    doesNotGenerate: ["texto corrido gigante", "roteiro falado", "storyboard de vídeo"],
    complexity: "media",
    approvalHint: "Aprovação como sequência visual.",
    userHint: "Cada slide deve ter uma função: chamar atenção, explicar, orientar e concluir.",
  },
  {
    key: "story",
    label: "Story",
    shortLabel: "Story",
    category: "principal",
    useWhen: "Use para interação rápida, aviso, bastidor curto ou chamada simples.",
    generates: ["texto curto", "sticker sugerido", "CTA rápido", "prompt visual"],
    doesNotGenerate: ["legenda longa", "hashtags", "roteiro completo"],
    complexity: "simples",
    approvalHint: "Aprovação opcional, dependendo do cliente.",
    userHint: "Precisa ser leve, imediato e fácil de responder.",
  },
  {
    key: "sequencia_stories",
    label: "Sequência de Stories",
    shortLabel: "Seq. Stories",
    category: "principal",
    useWhen: "Use quando uma única tela não basta, mas o conteúdo não precisa virar carrossel.",
    generates: ["Story 1, 2, 3...", "função de cada tela", "sticker", "CTA final"],
    doesNotGenerate: ["carrossel vertical pesado", "legenda tradicional", "roteiro longo"],
    complexity: "media",
    approvalHint: "Aprovação como mini sequência.",
    userHint: "Boa para conduzir uma conversa curta com começo, interação e chamada final.",
  },
  {
    key: "status_whatsapp",
    label: "Status do WhatsApp",
    shortLabel: "WhatsApp",
    category: "principal",
    useWhen: "Use para divulgação curta, direta e fácil de responder.",
    generates: ["frase curta", "CTA direto", "imagem opcional"],
    doesNotGenerate: ["hashtags", "roteiro", "legenda longa", "PDF complexo"],
    complexity: "simples",
    approvalHint: "Geralmente não precisa de aprovação pesada.",
    userHint: "Precisa parecer mensagem rápida, não post completo.",
  },
  {
    key: "reel",
    label: "Reel",
    shortLabel: "Reel",
    category: "principal",
    useWhen: "Use quando o conteúdo precisa ser falado, narrado, demonstrado ou editado em vídeo.",
    generates: [
      "roteiro",
      "cenas",
      "texto na tela",
      "legenda do vídeo",
      "legenda da publicação",
      "capa opcional",
    ],
    doesNotGenerate: ["apenas uma arte estática", "prompt genérico de imagem"],
    complexity: "avancada",
    approvalHint: "Aprovação como pacote de Reel.",
    userHint: "Para Reels novos, prefira o fluxo Criar Reel 2.0.",
  },
  {
    key: "comunicado",
    label: "Comunicado",
    shortLabel: "Comunicado",
    category: "principal",
    useWhen:
      "Use para avisos institucionais, mudanças, horários, orientações ou informações objetivas.",
    generates: ["texto claro", "orientação visual", "CTA informativo"],
    doesNotGenerate: ["roteiro", "storytelling longo"],
    complexity: "simples",
    approvalHint: "Aprovação por clareza da informação.",
    userHint: "Priorize precisão e leitura rápida.",
  },
  {
    key: "banner",
    label: "Banner",
    shortLabel: "Banner",
    category: "principal",
    useWhen: "Use para peças de destaque, chamadas institucionais ou divulgação visual.",
    generates: ["texto principal", "subtítulo", "CTA", "prompt visual"],
    doesNotGenerate: ["legenda longa", "sequência de slides"],
    complexity: "simples",
    approvalHint: "Aprovação como peça visual.",
    userHint: "Texto curto, alto contraste e objetivo claro.",
  },
  {
    key: "texto_grupo",
    label: "Texto para grupo",
    shortLabel: "Grupo",
    category: "principal",
    useWhen: "Use quando o conteúdo será enviado como mensagem para WhatsApp, grupo ou comunidade.",
    generates: ["mensagem pronta", "CTA", "variação curta"],
    doesNotGenerate: ["arte", "hashtags", "roteiro"],
    complexity: "simples",
    approvalHint: "Aprovação pelo texto da mensagem.",
    userHint: "Deve ser copiável, direto e natural.",
  },
  {
    key: "impresso",
    label: "Material impresso",
    shortLabel: "Impresso",
    category: "principal",
    useWhen: "Use para panfleto, cartaz, material informativo ou apoio físico.",
    generates: ["texto da peça", "hierarquia de informação", "orientação visual"],
    doesNotGenerate: ["roteiro", "legenda social"],
    complexity: "media",
    approvalHint: "Aprovação por conteúdo e legibilidade.",
    userHint: "Precisa de informações confirmadas e texto enxuto.",
  },
  {
    key: "outro",
    label: "Outro formato",
    shortLabel: "Outro",
    category: "principal",
    useWhen: "Use quando o formato ainda não está no catálogo principal.",
    generates: ["estrutura personalizada", "orientações conforme o pedido"],
    doesNotGenerate: ["regras automáticas completas"],
    complexity: "media",
    approvalHint: "Aprovação conforme briefing.",
    userHint: "Descreva bem o uso e o tamanho esperado.",
  },
  {
    key: "capa_reel",
    label: "Capa de Reel",
    shortLabel: "Capa Reel",
    category: "subproduto",
    useWhen:
      "Use apenas como apoio de um Reel, quando precisar de capa personalizada ou peça legada.",
    generates: ["título de capa", "subtítulo opcional", "prompt visual", "orientação de corte"],
    doesNotGenerate: ["Reel completo", "roteiro", "legenda da publicação"],
    complexity: "subproduto",
    approvalHint: "Aprovação junto do Reel.",
    userHint: "No Reel 2.0, a capa fica dentro do próprio fluxo do Reel.",
  },
];

export const PRIMARY_CONTENT_FORMATS = CONTENT_FORMAT_GUIDE.filter(
  (item) => item.category === "principal",
);
export const ACCESSORY_CONTENT_FORMATS = CONTENT_FORMAT_GUIDE.filter(
  (item) => item.category === "subproduto",
);
export const FORMAT_GUIDE_BY_KEY = Object.fromEntries(
  CONTENT_FORMAT_GUIDE.map((item) => [item.key, item]),
) as Record<string, ContentFormatGuideItem>;
