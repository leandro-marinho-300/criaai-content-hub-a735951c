// Cria Aí — Diagnóstico de dados disponíveis na marca para a geração de ideias.
// Determinístico, sem IA. Usado para:
//   • escolher templates com segurança;
//   • explicar exatamente o que falta na marca;
//   • abrir a ficha da marca na seção certa.

import type { Tables } from "@/integrations/supabase/types";
import type { IdeaApproach, IdeaFocus } from "./ideaTaxonomy";

type Brand = Tables<"brands">;

/**
 * Normaliza qualquer valor para um array de strings limpas.
 * Aceita: string[] (Postgres ARRAY), string com `;`/quebras de linha, null, undefined,
 * jsonb ou tipos inesperados. Nunca lança.
 */
function cleanListItem(value: string): string {
  return value
    .replace(/^\s*(?:[-•–—]|\d+[.)])\s*/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cleaned = cleanListItem(value);
    if (!cleaned) continue;
    const key = cleaned.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

function splitScalar(value: unknown): string[] {
  if (value == null) return [];
  let text = "";
  try {
    text = String(value);
  } catch {
    return [];
  }
  return text
    .split(/[;\n\r]+/g)
    .map(cleanListItem)
    .filter(Boolean);
}

function toStringArray(value: unknown): string[] {
  if (value == null) return [];
  const values = Array.isArray(value)
    ? value.flatMap((item) => splitScalar(item))
    : splitScalar(value);
  return uniqueStrings(values);
}

/**
 * Dúvidas frequentemente chegam como um único texto contendo várias perguntas.
 * Ex.: "Como pedir orçamento? O que está incluso? É possível parcelar?".
 * Cada pergunta precisa virar uma fonte editorial independente.
 */
function splitQuestionList(value: unknown): string[] {
  const rawItems = toStringArray(value);
  const questions = rawItems.flatMap((item) => {
    const matches = item.match(/[^?]+\?/g);
    if (!matches || matches.length <= 1) return [item];

    const consumed = matches.join("").length;
    const remainder = item.slice(consumed).trim();
    return remainder ? [...matches, remainder] : matches;
  });

  return uniqueStrings(
    questions
      .map((item) => cleanListItem(item))
      .filter((item) => item.length >= 4),
  );
}

function splitList(value: unknown): string[] {
  return toStringArray(value);
}

function asArray(value: unknown): string[] {
  return toStringArray(value);
}

function asText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter(Boolean).join("\n");
  try { return String(value); } catch { return ""; }
}

export interface BrandIdeaSources {
  usableProducts: string[];
  usableServices: string[];
  usableBenefits: string[];
  usableQuestions: string[];
  usableDifferentiators: string[];
  usableTopics: string[];
  usableDates: string[];
  usableDifficulties: string[];
  usableValues: string[];
  usableNeeds: string[];
  usableHistory: string[];
  usableTestimonials: string[];
  ctas: string[];
  /** rótulos legíveis das fontes preenchidas. */
  availableSources: string[];
  /** rótulos legíveis das fontes ausentes. */
  missingSources: string[];
}

const HAS_PRODUCTS = "Produtos e serviços";
const HAS_PRIORITY = "Produtos/serviços prioritários";
const HAS_DESC = "Descrição da marca";
const HAS_DIFF = "Diferenciais";
const HAS_FAQ = "Dúvidas frequentes";
const HAS_DATES = "Datas importantes";
const HAS_DIFFIC = "Dificuldades do público";
const HAS_NEEDS = "Necessidades do público";
const HAS_VALUES = "Valores do público";
const HAS_TOPICS = "Assuntos permitidos";
const HAS_CTAS = "Chamadas para ação";
const HAS_TESTIMONIALS = "Depoimentos autorizados";

const EMPTY_SOURCES: BrandIdeaSources = {
  usableProducts: [], usableServices: [], usableBenefits: [], usableQuestions: [],
  usableDifferentiators: [], usableTopics: [], usableDates: [], usableDifficulties: [],
  usableValues: [], usableNeeds: [], usableHistory: [], usableTestimonials: [],
  ctas: [], availableSources: [], missingSources: [],
};

export function getBrandIdeaSources(brand: Brand | null | undefined): BrandIdeaSources {
  if (!brand) return { ...EMPTY_SOURCES, missingSources: [HAS_PRODUCTS, HAS_DESC] };
  try {
    const b = brand as unknown as Record<string, unknown>;
    const rawTestimonials = b.testimonials;
    const usableTestimonials = splitList(rawTestimonials);

    const productsList = splitList(b.products_services);
    const priorityList = splitList(b.priority_services);
    const allProducts = Array.from(new Set([...priorityList, ...productsList]));

    const sources: BrandIdeaSources = {
      usableProducts: allProducts,
      usableServices: allProducts,
      usableBenefits: [
        ...splitList(b.differentiators),
        ...splitList(b.audience_needs),
      ].slice(0, 12),
      usableQuestions: splitQuestionList(b.frequently_asked_questions),
      usableDifferentiators: splitList(b.differentiators),
      usableTopics: asArray(b.allowed_topics),
      usableDates: splitList(b.important_dates),
      usableDifficulties: splitList(b.audience_difficulties),
      usableValues: splitList(b.audience_values),
      usableNeeds: splitList(b.audience_needs),
      usableHistory: splitList(b.description),
      usableTestimonials,
      ctas: asArray(b.calls_to_action),
      availableSources: [],
      missingSources: [],
    };

    const checks: Array<[string, boolean]> = [
      [HAS_PRODUCTS, productsList.length > 0],
      [HAS_PRIORITY, priorityList.length > 0],
      [HAS_DESC, splitList(b.description).length > 0],
      [HAS_DIFF, sources.usableDifferentiators.length > 0],
      [HAS_FAQ, sources.usableQuestions.length > 0],
      [HAS_DATES, sources.usableDates.length > 0],
      [HAS_DIFFIC, sources.usableDifficulties.length > 0],
      [HAS_NEEDS, sources.usableNeeds.length > 0],
      [HAS_VALUES, sources.usableValues.length > 0],
      [HAS_TOPICS, sources.usableTopics.length > 0],
      [HAS_CTAS, sources.ctas.length > 0],
      [HAS_TESTIMONIALS, usableTestimonials.length > 0],
    ];

    for (const [label, has] of checks) {
      if (has) sources.availableSources.push(label);
      else sources.missingSources.push(label);
    }

    return sources;
  } catch (err) {
    console.error("[brandIdeaSources] normalização falhou", err);
    return { ...EMPTY_SOURCES };
  }
}

/** A marca tem dado mínimo para gerar qualquer ideia? (apenas bloqueia se TUDO estiver vazio.) */
export function hasAnyIdeaData(s: BrandIdeaSources): boolean {
  return s.availableSources.length > 0;
}

export interface ApproachRequirement {
  ok: boolean;
  missingLabel?: string;
  reason?: string;
}

/** Diz se uma abordagem específica pode ser gerada com segurança a partir das fontes. */
export function approachIsSafe(approach: IdeaApproach, sources: BrandIdeaSources): ApproachRequirement {
  switch (approach) {
    case "prova_social":
      if (sources.usableTestimonials.length === 0) {
        return {
          ok: false,
          missingLabel: HAS_TESTIMONIALS,
          reason: "Esta abordagem precisa de um depoimento ou caso autorizado.",
        };
      }
      return { ok: true };
    case "duvida":
      return sources.usableQuestions.length > 0 || sources.usableDifficulties.length > 0
        ? { ok: true }
        : { ok: false, missingLabel: HAS_FAQ, reason: "Cadastre ao menos uma dúvida frequente ou dificuldade do público." };
    case "antes_de_contratar":
    case "apresentacao_comercial":
    case "beneficio":
      return sources.usableProducts.length > 0
        ? { ok: true }
        : { ok: false, missingLabel: HAS_PRODUCTS, reason: "Cadastre um produto ou serviço para esta abordagem." };
    case "historia_marca":
      return sources.usableHistory.length > 0
        ? { ok: true }
        : { ok: false, missingLabel: HAS_DESC, reason: "Preencha a descrição da marca para narrar a história." };
    case "erro_comum":
    case "orientacao_pratica":
    case "checklist":
    case "passo_a_passo":
      return sources.usableDifficulties.length > 0 || sources.usableNeeds.length > 0 || sources.usableTopics.length > 0
        ? { ok: true }
        : { ok: false, missingLabel: HAS_DIFFIC, reason: "Cadastre dificuldades, necessidades ou assuntos permitidos." };
    case "prestacao_contas":
      return sources.usableHistory.length > 0 || sources.usableDifferentiators.length > 0
        ? { ok: true }
        : { ok: false, missingLabel: HAS_DESC, reason: "Sem informações da marca não é possível prestar contas." };
    default:
      return { ok: true };
  }
}

/** Diz se um foco tem dados mínimos. */
export function focusIsSupported(focus: IdeaFocus, sources: BrandIdeaSources): ApproachRequirement {
  switch (focus) {
    case "produto":
    case "servico":
      return sources.usableProducts.length > 0
        ? { ok: true }
        : { ok: false, missingLabel: HAS_PRODUCTS, reason: "Cadastre um produto ou serviço." };
    case "dor_publico":
      return sources.usableDifficulties.length > 0 || sources.usableNeeds.length > 0
        ? { ok: true }
        : { ok: false, missingLabel: HAS_DIFFIC, reason: "Cadastre dificuldades ou necessidades do público." };
    case "data_relevante":
      return sources.usableDates.length > 0
        ? { ok: true }
        : { ok: false, missingLabel: HAS_DATES, reason: "Cadastre ao menos uma data importante." };
    case "marca":
      return sources.usableHistory.length > 0 || sources.usableDifferentiators.length > 0
        ? { ok: true }
        : { ok: false, missingLabel: HAS_DESC, reason: "Preencha descrição ou diferenciais da marca." };
    default:
      return { ok: true };
  }
}
