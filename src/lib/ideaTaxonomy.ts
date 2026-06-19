// Cria Aí — Taxonomia editorial unificada do Laboratório de Ideias.
// Objetivo = por que publicar
// Foco     = sobre o que falar
// Abordagem = como desenvolver
// Formato  = onde / em qual estrutura
// Tom      = como a marca fala

export type IdeaObjective =
  | "qualquer"
  | "informar"
  | "educar"
  | "vender"
  | "gerar_contatos"
  | "relacionamento"
  | "autoridade"
  | "inspirar";

export type IdeaFocus =
  | "qualquer"
  | "produto"
  | "servico"
  | "marca"
  | "dor_publico"
  | "campanha"
  | "evento"
  | "data_relevante"
  | "impacto_social"
  | "comunidade";

export type IdeaApproach =
  | "auto"
  | "beneficio"
  | "duvida"
  | "bastidores"
  | "historia_marca"
  | "prova_social"
  | "orientacao_pratica"
  | "erro_comum"
  | "checklist"
  | "passo_a_passo"
  | "comparacao"
  | "mito_verdade"
  | "lista"
  | "antes_de_contratar"
  | "prestacao_contas"
  | "apresentacao_comercial";

export type IdeaFormat =
  | "auto"
  | "post"
  | "carrossel"
  | "story"
  | "sequencia_stories"
  | "status_whatsapp"
  | "reel"
  | "comunicado";

export type IdeaTone =
  | "marca"
  | "educativo"
  | "comercial"
  | "institucional"
  | "acolhedor"
  | "inspirador"
  | "direto"
  | "descontraido";

export const IDEA_OBJECTIVE_LABELS: Record<IdeaObjective, string> = {
  qualquer: "Qualquer objetivo",
  informar: "Informar",
  educar: "Educar",
  vender: "Vender",
  gerar_contatos: "Gerar contatos",
  relacionamento: "Criar relacionamento",
  autoridade: "Fortalecer autoridade",
  inspirar: "Inspirar ou engajar",
};

export const IDEA_FOCUS_LABELS: Record<IdeaFocus, string> = {
  qualquer: "Qualquer foco",
  produto: "Produto",
  servico: "Serviço",
  marca: "Marca ou institucional",
  dor_publico: "Dor ou necessidade do público",
  campanha: "Campanha",
  evento: "Evento",
  data_relevante: "Data relevante",
  impacto_social: "Impacto social",
  comunidade: "Relacionamento com a comunidade",
};

export const IDEA_APPROACH_LABELS: Record<IdeaApproach, string> = {
  auto: "Sugerir automaticamente",
  beneficio: "Benefício",
  duvida: "Dúvida frequente",
  bastidores: "Bastidores",
  historia_marca: "História da marca",
  prova_social: "Prova social",
  orientacao_pratica: "Orientação prática",
  erro_comum: "Erro comum",
  checklist: "Checklist",
  passo_a_passo: "Passo a passo",
  comparacao: "Comparação",
  mito_verdade: "Mito ou verdade",
  lista: "Lista",
  antes_de_contratar: "Antes de comprar ou contratar",
  prestacao_contas: "Prestação de contas",
  apresentacao_comercial: "Apresentação comercial",
};

export const IDEA_FORMAT_LABELS: Record<IdeaFormat, string> = {
  auto: "Sugerir automaticamente",
  post: "Post Feed",
  carrossel: "Carrossel",
  story: "Story",
  sequencia_stories: "Sequência de Stories",
  status_whatsapp: "Status WhatsApp",
  reel: "Reel",
  comunicado: "Comunicado",
};

export const IDEA_TONE_LABELS: Record<IdeaTone, string> = {
  marca: "Seguir o tom da marca",
  educativo: "Educativo",
  comercial: "Comercial",
  institucional: "Institucional",
  acolhedor: "Acolhedor",
  inspirador: "Inspirador",
  direto: "Direto",
  descontraido: "Descontraído",
};

/** Pilar editorial padrão exibido no card a partir do objetivo. */
export const OBJECTIVE_PILLAR: Record<IdeaObjective, string> = {
  qualquer: "Editorial",
  informar: "Informativo",
  educar: "Educativo",
  vender: "Comercial",
  gerar_contatos: "Geração de contatos",
  relacionamento: "Relacionamento",
  autoridade: "Institucional",
  inspirar: "Inspiracional",
};

/** Tooltips dos seletores. */
export const FIELD_TOOLTIPS = {
  objective: "Por que você quer publicar?",
  focus: "Sobre qual assunto?",
  approach: "Como o assunto será desenvolvido?",
  format: "Onde ou em qual estrutura será publicado?",
  tone: "Como a marca deve falar?",
} as const;

/** Compat: mapeia valores legados (que ainda podem existir no banco/estado) para a nova taxonomia. */
export function migrateLegacyObjective(value: string | null | undefined): IdeaObjective {
  switch ((value ?? "").toLowerCase()) {
    case "informar": return "informar";
    case "educar": return "educar";
    case "vender": return "vender";
    case "gerar_contatos": return "gerar_contatos";
    case "relacionamento": return "relacionamento";
    case "autoridade": return "autoridade";
    case "inspirar": return "inspirar";
    case "bastidores":
    case "duvida":
    case "evento":
    case "prestacao_contas":
    case "institucional":
    case "divulgar_produto":
    case "divulgar_servico":
      return "qualquer";
    default:
      return "qualquer";
  }
}

export function migrateLegacyFocus(value: string | null | undefined): IdeaFocus {
  switch ((value ?? "").toLowerCase()) {
    case "produto": return "produto";
    case "servico": return "servico";
    case "historia": return "marca";
    case "duvida": return "dor_publico";
    case "beneficio": return "produto";
    case "bastidores": return "marca";
    case "prova_social": return "marca";
    case "orientacao_pratica": return "dor_publico";
    case "campanha": return "campanha";
    case "data_relevante": return "data_relevante";
    default: return "qualquer";
  }
}
