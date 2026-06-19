// Cria Aí — Detecção de intenção editorial.
// Analisa título, tema, promessa, objetivo e formato para identificar
// que tipo de conteúdo o usuário quer (lista numerada, erros, checklist,
// passo a passo, benefícios, mitos x verdades, etc.) e quantos itens
// devem aparecer quando há promessa numérica explícita.
//
// É 100% determinístico, sem IA externa.

import type { Tables } from "@/integrations/supabase/types";

export type EditorialType =
  | "numbered_list"
  | "mistakes"
  | "checklist"
  | "process"
  | "benefits"
  | "faq"
  | "myths_truths"
  | "comparison"
  | "story"
  | "problem_solution"
  | "institutional"
  | "commercial"
  | "generic";

export interface EditorialIntent {
  type: EditorialType;
  /** Quantidade de itens prometida. 0 quando não há promessa numérica. */
  expectedItems: number;
  /** "ponto", "erro", "passo", "benefício", "dúvida"… */
  itemNounSingular: string;
  itemNounPlural: string;
  /** Sinal que disparou a detecção (para debugging). */
  source: string;
}

export interface IntentInput {
  internalTitle?: string | null;
  theme?: string | null;
  idea?: string | null;
  promise?: string | null;
  objective?: string | null;
  formats?: string[] | null;
}

// =========== padrões ===========

interface Pattern {
  type: EditorialType;
  singular: string;
  plural: string;
  rx: RegExp;
}

const ITEM_PATTERNS: Pattern[] = [
  { type: "mistakes", singular: "erro", plural: "erros", rx: /\berr[oa]s?\b/i },
  { type: "benefits", singular: "benefício", plural: "benefícios", rx: /\bbenef[ií]cios?\b/i },
  { type: "checklist", singular: "item", plural: "itens", rx: /\bchecklist\b|\bitens?\b/i },
  { type: "process", singular: "passo", plural: "passos", rx: /\bpassos?\b|passo a passo|como funciona|como fazer/i },
  { type: "faq", singular: "dúvida", plural: "dúvidas", rx: /\bd[úu]vidas?\b|\bperguntas?\b|\bfaq\b/i },
  { type: "myths_truths", singular: "mito", plural: "mitos", rx: /\bmitos?\b|verdades?/i },
  { type: "comparison", singular: "diferença", plural: "diferenças", rx: /\bvs\b|\bcomparativ[oa]\b|\bdiferen[çc]as?\b|antes e depois/i },
  { type: "numbered_list", singular: "ponto", plural: "pontos", rx: /\bpontos?\b|raz[õo]es?|motivos?|dicas?|cuidados?|formas?|maneiras?|segredos?/i },
];

const STORY_RX = /hist[óo]ria|jornada|trajet[óo]ria|caso real/i;
const PROBLEM_SOLUTION_RX = /problema|solu[çc][ãa]o|desafio/i;
const INSTITUTIONAL_RX = /comunicado|institucional|nossa empresa|sobre n[óo]s/i;
const COMMERCIAL_RX = /pre[çc]o|promo[çc][ãa]o|oferta|desconto|lan[çc]amento/i;

// =========== detector ===========

function pickNumber(text: string): number {
  // Captura "5 pontos", "3 erros", "Top 5", "5 dicas para"
  const m = text.match(/\b(?:top\s+)?(\d{1,2})\b/i);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  if (n < 2 || n > 12) return 0;
  return n;
}

export function detectEditorialIntent(input: IntentInput): EditorialIntent {
  const fields = [input.internalTitle, input.theme, input.idea, input.promise]
    .map((s) => (s ?? "").trim())
    .filter(Boolean);
  const joined = fields.join(" · ");
  const haystack = joined.toLowerCase();

  // 1. Padrão de item + número
  for (const p of ITEM_PATTERNS) {
    if (p.rx.test(haystack)) {
      const n = pickNumber(joined);
      return {
        type: p.type,
        expectedItems: n,
        itemNounSingular: p.singular,
        itemNounPlural: p.plural,
        source: `pattern:${p.type}`,
      };
    }
  }

  // 2. Outros tipos sem item enumerado
  if (STORY_RX.test(haystack)) {
    return { type: "story", expectedItems: 0, itemNounSingular: "capítulo", itemNounPlural: "capítulos", source: "story" };
  }
  if (PROBLEM_SOLUTION_RX.test(haystack)) {
    return { type: "problem_solution", expectedItems: 0, itemNounSingular: "etapa", itemNounPlural: "etapas", source: "problem_solution" };
  }
  if (INSTITUTIONAL_RX.test(haystack) || (input.objective ?? "").toLowerCase().includes("comunicado")) {
    return { type: "institutional", expectedItems: 0, itemNounSingular: "item", itemNounPlural: "itens", source: "institutional" };
  }
  if (COMMERCIAL_RX.test(haystack) || (input.objective ?? "").toLowerCase().includes("vender")) {
    return { type: "commercial", expectedItems: 0, itemNounSingular: "ponto", itemNounPlural: "pontos", source: "commercial" };
  }

  // 3. Fallback: número solto na promessa → numbered_list
  const onlyNumber = pickNumber(joined);
  if (onlyNumber > 0) {
    return { type: "numbered_list", expectedItems: onlyNumber, itemNounSingular: "ponto", itemNounPlural: "pontos", source: "loose_number" };
  }

  return { type: "generic", expectedItems: 0, itemNounSingular: "ponto", itemNounPlural: "pontos", source: "generic" };
}

// =========== geração de itens estruturais ===========

type Project = Tables<"content_projects">;
type Brand = Tables<"brands">;

export interface EditorialItem {
  /** Título curto da página, sem numeração (ex.: "Pense na experiência que você procura"). */
  title: string;
  /** Texto de apoio (1 frase). */
  support: string;
  /** true quando o item foi preenchido como orientação genérica segura. */
  generic: boolean;
}

const blank = (v: unknown): boolean => v == null || (typeof v === "string" && v.trim() === "");
const txt = (v: string | null | undefined, fallback = ""): string => (blank(v) ? fallback : String(v).trim());

function parseBullets(raw: string | null | undefined): string[] {
  const s = txt(raw);
  if (!s) return [];
  return s
    .split(/\r?\n|;|\s•\s|\s·\s|\s—\s|\s–\s|^\s*[-*]\s+/gm)
    .map((x) => x.trim().replace(/^[-*•·]\s+/, "").replace(/[.;]+$/, ""))
    .filter((x) => x.length >= 3 && x.length <= 180)
    .filter((x, i, a) => a.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i);
}

function cap(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function endWithPeriod(s: string): string {
  const t = s.trim();
  if (!t) return t;
  if (/[.!?]$/.test(t)) return t;
  return t + ".";
}

function shortTitle(raw: string, maxChars = 55): string {
  let t = raw.trim().replace(/[.;]+$/, "");
  // primeira oração
  const m = t.match(/^[^.\n;:]+/);
  if (m) t = m[0].trim();
  if (t.length <= maxChars) return cap(t);
  // resumo: até maxChars na fronteira de palavra
  const cut = t.slice(0, maxChars).replace(/\s+\S*$/, "");
  return cap(cut);
}

function shortSupport(raw: string, maxChars = 180): string {
  const t = raw.trim().replace(/\s+/g, " ");
  if (t.length <= maxChars) return endWithPeriod(cap(t));
  const cut = t.slice(0, maxChars).replace(/[,;:\s]+\S*$/, "");
  return endWithPeriod(cap(cut));
}

// Itens genéricos seguros por tipo. Nunca inventam preço, prazo ou condição.
const GENERIC_ITEMS: Record<EditorialType, EditorialItem[]> = {
  numbered_list: [
    { title: "Defina o que você procura", support: "Ter clareza do objetivo ajuda a filtrar as opções desde o início.", generic: true },
    { title: "Considere o cenário", support: "Período, contexto e expectativa influenciam diretamente na escolha.", generic: true },
    { title: "Olhe além do preço inicial", support: "Compare o conjunto da entrega e confirme as condições antes de decidir.", generic: true },
    { title: "Pesquise com segurança", support: "Use canais confiáveis e confirme as informações antes de avançar.", generic: true },
    { title: "Conte com orientação", support: "Uma conversa próxima ajuda a organizar as opções conforme o seu perfil.", generic: true },
    { title: "Reserve tempo para decidir", support: "Decisões maduras precisam de espaço para comparar com calma.", generic: true },
    { title: "Verifique referências", support: "Buscar opiniões e exemplos reais reduz a chance de surpresa.", generic: true },
  ],
  mistakes: [
    { title: "Não pular o planejamento", support: "Sem um plano básico, as decisões viram improviso.", generic: true },
    { title: "Não decidir apenas pelo preço", support: "O menor preço nem sempre representa o melhor custo-benefício.", generic: true },
    { title: "Não ignorar referências", support: "Buscar opiniões e exemplos reais evita arrependimentos.", generic: true },
    { title: "Não deixar para a última hora", support: "Pressa reduz opções e aumenta o risco de erro.", generic: true },
    { title: "Não confiar em informações soltas", support: "Confirme dados importantes em canais oficiais.", generic: true },
    { title: "Não pular o atendimento", support: "Conversar antes de fechar evita ruídos e dúvidas.", generic: true },
    { title: "Não ignorar a sua necessidade real", support: "Adaptar a escolha ao seu contexto faz toda a diferença.", generic: true },
  ],
  checklist: [
    { title: "Defina o objetivo", support: "Saber onde quer chegar orienta cada próximo passo.", generic: true },
    { title: "Reúna as informações", support: "Tenha em mãos os dados e referências antes de decidir.", generic: true },
    { title: "Compare alternativas", support: "Avalie pelo menos duas ou três opções com critério.", generic: true },
    { title: "Confirme as condições", support: "Cheque o que está incluso e o que não está antes de fechar.", generic: true },
    { title: "Registre a decisão", support: "Anote o combinado para evitar mal-entendidos depois.", generic: true },
    { title: "Acompanhe o resultado", support: "Revisitar a decisão ajuda a aprender para as próximas.", generic: true },
  ],
  process: [
    { title: "Primeiro contato", support: "Entender a necessidade é o ponto de partida.", generic: true },
    { title: "Diagnóstico", support: "Mapeamos o cenário e identificamos prioridades.", generic: true },
    { title: "Proposta", support: "Apresentamos opções alinhadas ao seu perfil.", generic: true },
    { title: "Decisão", support: "Você escolhe com calma, sem pressão.", generic: true },
    { title: "Execução", support: "Acompanhamos cada etapa até a entrega.", generic: true },
    { title: "Pós-atendimento", support: "Continuamos próximos depois do trabalho concluído.", generic: true },
  ],
  benefits: [
    { title: "Mais clareza para decidir", support: "Informações organizadas reduzem dúvidas no caminho.", generic: true },
    { title: "Mais segurança no processo", support: "Cada etapa fica acompanhada e transparente.", generic: true },
    { title: "Mais tempo para o que importa", support: "A organização certa libera você de trabalho repetitivo.", generic: true },
    { title: "Atendimento próximo", support: "Conversar com quem entende faz diferença em cada decisão.", generic: true },
    { title: "Resultado previsível", support: "Combinados claros desde o início evitam surpresas no fim.", generic: true },
    { title: "Acompanhamento contínuo", support: "O apoio continua mesmo depois da entrega principal.", generic: true },
  ],
  faq: [
    { title: "Como começar", support: "O primeiro passo é entender o que você precisa.", generic: true },
    { title: "Quanto tempo leva", support: "O prazo depende do seu cenário; combinamos com você.", generic: true },
    { title: "O que está incluído", support: "Tudo o que combinarmos fica registrado antes de avançar.", generic: true },
    { title: "Como falar com a equipe", support: "Use os canais oficiais para tirar dúvidas com segurança.", generic: true },
    { title: "E depois da entrega", support: "Continuamos disponíveis para acompanhar o resultado.", generic: true },
  ],
  myths_truths: [
    { title: "Mito: é tudo igual", support: "Cada caso tem detalhes que mudam o resultado.", generic: true },
    { title: "Verdade: planejar faz diferença", support: "Organizar antes economiza tempo depois.", generic: true },
    { title: "Mito: o mais barato compensa", support: "Sem critério, o barato pode sair caro.", generic: true },
    { title: "Verdade: informação reduz risco", support: "Quanto mais clara a referência, melhor a escolha.", generic: true },
    { title: "Mito: dá para improvisar", support: "Improviso pode funcionar uma vez, não como regra.", generic: true },
  ],
  comparison: [
    { title: "Antes", support: "O cenário comum de quem não tem apoio próximo.", generic: true },
    { title: "Depois", support: "O cenário com orientação e processo organizado.", generic: true },
    { title: "Diferença prática", support: "Mais clareza, menos retrabalho e mais segurança.", generic: true },
  ],
  story: [
    { title: "O começo", support: "Tudo nasceu de uma necessidade real.", generic: true },
    { title: "O caminho", support: "Cada etapa ajudou a moldar o que somos hoje.", generic: true },
    { title: "Onde estamos", support: "Hoje seguimos com o mesmo cuidado do início.", generic: true },
  ],
  problem_solution: [
    { title: "O problema", support: "O ponto que mais incomoda no dia a dia.", generic: true },
    { title: "A causa", support: "Onde o problema costuma começar.", generic: true },
    { title: "A solução", support: "Um caminho organizado para resolver com calma.", generic: true },
  ],
  institutional: [
    { title: "Quem somos", support: "Uma equipe focada em fazer bem feito.", generic: true },
    { title: "O que entregamos", support: "Atendimento próximo do início ao fim.", generic: true },
    { title: "Por que isso importa", support: "Porque cada cliente merece atenção real.", generic: true },
  ],
  commercial: [
    { title: "O que você ganha", support: "Mais clareza para decidir com segurança.", generic: true },
    { title: "Como funciona", support: "Combinamos os detalhes antes de qualquer passo.", generic: true },
    { title: "Próximo passo", support: "Fale com a equipe e tire as dúvidas iniciais.", generic: true },
  ],
  generic: [
    { title: "Contexto", support: "Por que esse assunto importa agora.", generic: true },
    { title: "Ponto principal", support: "O essencial que você precisa saber.", generic: true },
    { title: "Próximo passo", support: "O que fazer com essa informação.", generic: true },
  ],
};

/**
 * Gera N itens estruturais para o conteúdo, priorizando fatos do briefing
 * (mandatory_information, differentiators) e completando com itens
 * genéricos seguros do banco quando não houver fatos suficientes.
 */
export function buildEditorialItems(
  intent: EditorialIntent,
  brand: Brand,
  project: Project,
  count: number,
): EditorialItem[] {
  const facts = [
    ...parseBullets(project.mandatory_information),
    ...parseBullets(brand.differentiators),
    ...parseBullets(brand.products_services),
  ];

  const factItems: EditorialItem[] = [];
  const seen = new Set<string>();
  for (const f of facts) {
    const title = shortTitle(f, 55);
    const k = title.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    const support = shortSupport(f.length > title.length ? f : `${f}.`, 180);
    factItems.push({ title, support, generic: false });
    if (factItems.length >= count) break;
  }

  const pool = GENERIC_ITEMS[intent.type] ?? GENERIC_ITEMS.generic;
  const items: EditorialItem[] = [...factItems];
  let i = 0;
  while (items.length < count) {
    const candidate = pool[i % pool.length];
    if (!items.some((it) => it.title.toLowerCase() === candidate.title.toLowerCase())) {
      items.push(candidate);
    }
    i += 1;
    if (i > pool.length * 2) break; // segurança
  }
  return items.slice(0, count);
}
