// Cria Aí — Diagnóstico de dados disponíveis na marca para a geração de ideias.
// Determinístico, sem IA. Usado para:
//   • escolher templates com segurança;
//   • explicar exatamente o que falta na marca;
//   • abrir a ficha da marca na seção certa.

import type { Tables } from "@/integrations/supabase/types";
import type { IdeaApproach, IdeaFocus } from "./ideaTaxonomy";

type Brand = Tables<"brands">;

function splitList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[;\n\r]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function asArray(value: string[] | null | undefined): string[] {
  return (value ?? []).filter((v) => typeof v === "string" && v.trim().length > 0);
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

export function getBrandIdeaSources(brand: Brand): BrandIdeaSources {
  // testimonials pode estar em campos não estruturados; só consideramos prova social
  // quando houver um campo explícito (compat: campo `testimonials` se existir).
  const rawTestimonials = (brand as unknown as { testimonials?: string | null }).testimonials ?? null;
  const usableTestimonials = splitList(rawTestimonials);

  const productsList = splitList(brand.products_services);
  const priorityList = splitList((brand as unknown as { priority_services?: string | null }).priority_services ?? null);
  const allProducts = Array.from(new Set([...priorityList, ...productsList]));

  const sources: BrandIdeaSources = {
    usableProducts: allProducts,
    usableServices: allProducts, // mesmo campo no schema atual
    usableBenefits: [
      ...splitList(brand.differentiators),
      ...splitList(brand.audience_needs),
    ].slice(0, 12),
    usableQuestions: splitList(brand.frequently_asked_questions),
    usableDifferentiators: splitList(brand.differentiators),
    usableTopics: asArray(brand.allowed_topics),
    usableDates: splitList(brand.important_dates),
    usableDifficulties: splitList(brand.audience_difficulties),
    usableValues: splitList((brand as unknown as { audience_values?: string | null }).audience_values ?? null),
    usableNeeds: splitList(brand.audience_needs),
    usableHistory: splitList(brand.description),
    usableTestimonials,
    ctas: asArray(brand.calls_to_action),
    availableSources: [],
    missingSources: [],
  };

  const checks: Array<[string, boolean]> = [
    [HAS_PRODUCTS, productsList.length > 0],
    [HAS_PRIORITY, priorityList.length > 0],
    [HAS_DESC, !!brand.description?.trim()],
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
