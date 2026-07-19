// Cria Aí — Matriz de compatibilidade entre Objetivo × Foco × Abordagem × Formato.
// Determinística, sem IA. Usada para ordenar, alertar e (quando incompatible)
// substituir automaticamente após confirmação.

import {
  type IdeaApproach,
  type IdeaFocus,
  type IdeaFormat,
  type IdeaObjective,
  IDEA_APPROACH_LABELS,
  IDEA_FOCUS_LABELS,
  IDEA_FORMAT_LABELS,
  IDEA_OBJECTIVE_LABELS,
} from "./ideaTaxonomy";

export type CompatibilityLevel = "recommended" | "possible" | "weak" | "incompatible";

export const COMPATIBILITY_LABELS: Record<CompatibilityLevel, string> = {
  recommended: "Recomendada",
  possible: "Possível",
  weak: "Combinação fraca",
  incompatible: "Incompatível",
};

const REC: CompatibilityLevel = "recommended";
const POS: CompatibilityLevel = "possible";
const WEA: CompatibilityLevel = "weak";
const INC: CompatibilityLevel = "incompatible";

// Matriz Objetivo × Abordagem. Itens ausentes caem em "possible".
const OBJ_APPROACH: Partial<Record<IdeaObjective, Partial<Record<IdeaApproach, CompatibilityLevel>>>> = {
  educar: {
    orientacao_pratica: REC,
    duvida: REC,
    checklist: REC,
    passo_a_passo: REC,
    erro_comum: REC,
    mito_verdade: REC,
    lista: REC,
    bastidores: POS,
    historia_marca: POS,
    comparacao: POS,
    beneficio: POS,
    antes_de_contratar: POS,
    prova_social: WEA,
    apresentacao_comercial: WEA,
    prestacao_contas: POS,
  },
  vender: {
    beneficio: REC,
    apresentacao_comercial: REC,
    antes_de_contratar: REC,
    prova_social: REC,
    comparacao: REC,
    checklist: POS,
    orientacao_pratica: POS,
    lista: POS,
    bastidores: POS,
    duvida: POS,
    historia_marca: WEA,
    prestacao_contas: WEA,
    mito_verdade: POS,
    erro_comum: POS,
    passo_a_passo: POS,
  },
  gerar_contatos: {
    antes_de_contratar: REC,
    beneficio: REC,
    duvida: REC,
    apresentacao_comercial: POS,
    prova_social: REC,
    orientacao_pratica: POS,
    checklist: POS,
    comparacao: POS,
    bastidores: POS,
    historia_marca: WEA,
    prestacao_contas: WEA,
    erro_comum: POS,
    passo_a_passo: POS,
    lista: POS,
    mito_verdade: POS,
  },
  relacionamento: {
    bastidores: REC,
    historia_marca: REC,
    prova_social: REC,
    duvida: REC,
    prestacao_contas: REC,
    beneficio: POS,
    orientacao_pratica: POS,
    lista: POS,
    erro_comum: POS,
    mito_verdade: POS,
    comparacao: POS,
    checklist: POS,
    passo_a_passo: POS,
    antes_de_contratar: WEA,
    apresentacao_comercial: WEA,
  },
  autoridade: {
    duvida: REC,
    orientacao_pratica: REC,
    erro_comum: REC,
    comparacao: REC,
    historia_marca: REC,
    bastidores: POS,
    checklist: POS,
    passo_a_passo: POS,
    mito_verdade: REC,
    lista: POS,
    prova_social: POS,
    beneficio: POS,
    prestacao_contas: POS,
    antes_de_contratar: POS,
    apresentacao_comercial: WEA,
  },
  informar: {
    historia_marca: REC,
    prestacao_contas: REC,
    bastidores: POS,
    orientacao_pratica: POS,
    duvida: POS,
    lista: POS,
    comparacao: POS,
    erro_comum: POS,
    checklist: POS,
    passo_a_passo: POS,
    beneficio: POS,
    apresentacao_comercial: POS,
    antes_de_contratar: POS,
    prova_social: POS,
    mito_verdade: POS,
  },
  inspirar: {
    historia_marca: REC,
    bastidores: REC,
    prova_social: POS,
    prestacao_contas: POS,
    orientacao_pratica: POS,
    duvida: POS,
    erro_comum: POS,
    comparacao: POS,
    beneficio: POS,
    checklist: WEA,
    passo_a_passo: WEA,
    lista: POS,
    antes_de_contratar: WEA,
    apresentacao_comercial: WEA,
    mito_verdade: POS,
  },
};

// Matriz Foco × Abordagem (filtro mais leve, ausentes = possible).
const FOCUS_APPROACH: Partial<Record<IdeaFocus, Partial<Record<IdeaApproach, CompatibilityLevel>>>> = {
  produto: { beneficio: REC, antes_de_contratar: REC, apresentacao_comercial: REC, comparacao: REC, prova_social: REC, bastidores: POS },
  servico: { antes_de_contratar: REC, bastidores: REC, beneficio: REC, passo_a_passo: REC, duvida: REC, prova_social: REC },
  marca: { historia_marca: REC, bastidores: REC, prestacao_contas: REC, prova_social: POS },
  dor_publico: { erro_comum: REC, duvida: REC, orientacao_pratica: REC, checklist: REC, mito_verdade: REC, beneficio: POS },
  campanha: { apresentacao_comercial: REC, lista: REC, beneficio: REC, comparacao: POS, prova_social: REC },
  evento: { apresentacao_comercial: REC, bastidores: REC, prestacao_contas: REC, lista: POS },
  data_relevante: { historia_marca: REC, prestacao_contas: REC, lista: REC, bastidores: POS },
  impacto_social: { prestacao_contas: REC, historia_marca: REC, prova_social: POS, bastidores: REC },
  comunidade: { bastidores: REC, prova_social: REC, prestacao_contas: REC, historia_marca: POS, duvida: POS },
};

// Restrições de formato. Status WhatsApp e Story limitam abordagens longas.
const FORMAT_APPROACH: Partial<Record<IdeaFormat, Partial<Record<IdeaApproach, CompatibilityLevel>>>> = {
  status_whatsapp: {
    passo_a_passo: WEA,
    checklist: WEA,
    comparacao: WEA,
    lista: POS,
    historia_marca: WEA,
  },
  story: {
    passo_a_passo: POS,
    checklist: POS,
    comparacao: WEA,
  },
  comunicado: {
    bastidores: WEA,
    mito_verdade: WEA,
    historia_marca: POS,
  },
};

const RANK: Record<CompatibilityLevel, number> = {
  recommended: 3,
  possible: 2,
  weak: 1,
  incompatible: 0,
};

function worst(a: CompatibilityLevel, b: CompatibilityLevel): CompatibilityLevel {
  return RANK[a] < RANK[b] ? a : b;
}

export interface CompatibilityResult {
  level: CompatibilityLevel;
  reason: string;
}

export function evaluateCompatibility(args: {
  objective: IdeaObjective;
  focus: IdeaFocus;
  approach: IdeaApproach;
  format: IdeaFormat;
}): CompatibilityResult {
  const { objective, focus, approach, format } = args;

  // "auto" / "qualquer" não restringem
  if (approach === "auto") return { level: "recommended", reason: "Abordagem automática alinhada ao objetivo." };

  const fromObj = OBJ_APPROACH[objective]?.[approach];
  const fromFocus = FOCUS_APPROACH[focus]?.[approach];
  const fromFmt = FORMAT_APPROACH[format]?.[approach];

  let level: CompatibilityLevel = "possible";
  const reasons: string[] = [];

  if (fromObj) {
    level = worst(level, fromObj);
    if (fromObj === "recommended") reasons.push(`Combinação recomendada para “${IDEA_OBJECTIVE_LABELS[objective]}”.`);
    if (fromObj === "weak") reasons.push(`Tende a soar pouco natural com “${IDEA_OBJECTIVE_LABELS[objective]}”.`);
    if (fromObj === "incompatible") reasons.push(`Não combina com “${IDEA_OBJECTIVE_LABELS[objective]}”.`);
  }
  if (fromFocus && focus !== "qualquer") {
    level = worst(level, fromFocus);
    if (fromFocus === "recommended") reasons.push(`Encaixa bem com foco “${IDEA_FOCUS_LABELS[focus]}”.`);
    if (fromFocus === "weak") reasons.push(`Pouco aderente ao foco “${IDEA_FOCUS_LABELS[focus]}”.`);
  }
  if (fromFmt && format !== "auto") {
    level = worst(level, fromFmt);
    if (fromFmt === "weak") reasons.push(`Pode ficar comprimido no formato “${IDEA_FORMAT_LABELS[format]}”.`);
  }

  if (reasons.length === 0) reasons.push("Combinação possível.");
  return { level, reason: reasons.join(" ") };
}

/** Ordena as abordagens por compatibilidade (recomendada → possível → fraca → incompatível). */
export function rankApproaches(args: {
  objective: IdeaObjective;
  focus: IdeaFocus;
  format: IdeaFormat;
}): Array<{ approach: IdeaApproach; level: CompatibilityLevel }> {
  const list = (Object.keys(IDEA_APPROACH_LABELS) as IdeaApproach[]).map((approach) => ({
    approach,
    level: evaluateCompatibility({ ...args, approach }).level,
  }));
  return list.sort((a, b) => RANK[b.level] - RANK[a.level]);
}
