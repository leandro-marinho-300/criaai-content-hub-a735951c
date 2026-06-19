// Cria Aí — Camada de SÍNTESE DE COPY.
// Transforma insumos crus do briefing + marca em uma estrutura semântica
// pronta para virar peças de comunicação. NÃO usa IA externa: aplica
// regras determinísticas + templates que reescrevem listas cruas em
// frases fluidas.
//
// O resto do sistema (promptBuilder) consome esta saída em vez de
// concatenar trechos brutos.

import type { Tables } from "@/integrations/supabase/types";

export type Brand = Tables<"brands">;
export type Project = Tables<"content_projects">;

export type CopyAngle = "comercial" | "acolhedor" | "institucional" | "direto" | "inspirador";

export interface ComposedCopy {
  /** Dor central reescrita em frase comunicável. */
  main_problem: string;
  /** Benefício central reescrito. */
  main_benefit: string;
  /** Promessa-chave curta. */
  key_promise: string;
  /** Ângulo emocional sugerido (ex.: "confiança", "leveza"). */
  emotional_angle: string;
  /** Ângulo de credibilidade. */
  trust_angle: string;
  /** Pontos de apoio: 1-3 frases curtas. */
  support_points: string[];
  /** CTA final pronto. */
  cta_line: string;
  /** Opções de headline (3-5), já polidas. */
  headline_options: string[];
  /** Opções de texto de apoio (2-3), parágrafos curtos. */
  support_text_options: string[];
  /** Opções de bullets (3-5), substantivas e curtas. */
  bullet_options: string[];
  /** Lista de campos que estavam vazios e foram preenchidos com [PREENCHER]. */
  placeholders: string[];
}

// =================== utils ===================

const PLACEHOLDER = "[PREENCHER]";

const blank = (v: unknown): v is null | undefined | "" =>
  v == null || (typeof v === "string" && v.trim() === "");

const txt = (v: string | null | undefined, fallback = ""): string =>
  blank(v) ? fallback : String(v).trim();

const arr = (v: string[] | null | undefined): string[] =>
  Array.isArray(v) ? v.filter((s) => typeof s === "string" && s.trim()) : [];

/** Quebra um bloco em itens. Aceita ;, novas linhas, marcadores. NÃO quebra em vírgulas para preservar frases. */
function parseBullets(raw: string | null | undefined): string[] {
  const s = txt(raw);
  if (!s) return [];
  return s
    .split(/\r?\n|;|\s•\s|\s·\s|\s—\s|\s–\s|^\s*[-*]\s+/gm)
    .map((x) => x.trim())
    .filter(Boolean)
    .map(normalizeBullet)
    .filter((x, i, a) => a.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i);
}

function normalizeBullet(s: string): string {
  let out = s.trim().replace(/^[-*•·]\s+/, "");
  out = out.replace(/[.,;]+$/, "");
  return out;
}

function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
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

function joinNatural(items: string[]): string {
  const xs = items.map((x) => lower(x.trim())).filter(Boolean);
  if (xs.length === 0) return "";
  if (xs.length === 1) return xs[0];
  if (xs.length === 2) return `${xs[0]} e ${xs[1]}`;
  return `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`;
}

function pick<T>(arr: T[], i: number, fallback: T | null = null): T | null {
  if (!arr.length) return fallback;
  return arr[i % arr.length];
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const k = it.toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it.trim());
  }
  return out;
}

function shortNoun(s: string, maxWords = 6): string {
  const words = s.split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(" ");
}

// =================== ângulos / tom ===================

const ANGLE_TONE: Record<CopyAngle, { promise: string; opener: string }> = {
  comercial: { promise: "Mais resultado, com clareza", opener: "Decida com mais segurança" },
  acolhedor: { promise: "Mais leveza no caminho", opener: "Você não precisa decidir sozinho" },
  institucional: { promise: "Compromisso com o que importa", opener: "Uma jornada feita com responsabilidade" },
  direto: { promise: "Sem rodeios, com resultado", opener: "Vá direto ao ponto" },
  inspirador: { promise: "Comece sua próxima conquista", opener: "Sua próxima escolha pode mudar tudo" },
};

// =================== síntese ===================

/**
 * Reduz a descrição extensa do público a uma frase curta (≤ 8 palavras),
 * para não copiar a lista completa de personas em cada peça.
 */
export function summarizeAudience(raw: string | null | undefined, fallback = "o público"): string {
  const s = txt(raw, "");
  if (!s) return fallback;
  const firstChunk = s.split(/incluindo|,|\.|;|—|–|:/i)[0] ?? s;
  const words = firstChunk.trim().split(/\s+/).slice(0, 8);
  const out = words.join(" ").replace(/[.,;:]+$/, "");
  return out || fallback;
}

export interface ComposeInput {
  brand: Brand;
  project: Project;
  angle?: CopyAngle;
}

export function composeCopy(input: ComposeInput): ComposedCopy {
  const { brand, project } = input;
  const angle: CopyAngle = input.angle ?? inferAngle(project);
  const placeholders: string[] = [];

  const theme = txt(project.theme);
  const mainMsg = txt(project.main_message);
  // ⚠ versão CURTA do público
  const audienceShort = summarizeAudience(project.specific_audience ?? brand.audience, "o público");
  const product = txt(project.mandatory_information) || txt(brand.products_services);
  const ctaRaw = txt(project.call_to_action);

  const pains = dedupe([
    ...parseBullets(project.audience_problem),
    ...parseBullets(brand.audience_difficulties),
    ...parseBullets(brand.audience_needs),
  ]);
  const diffs = dedupe([
    ...parseBullets(brand.differentiators),
    ...parseBullets(project.mandatory_information).filter((s) => s.length < 80),
  ]);

  // --- main_problem ---
  let main_problem: string;
  if (pains.length === 0) {
    main_problem = "";
  } else if (pains.length === 1) {
    main_problem = endWithPeriod(`Muitos enfrentam ${lower(pains[0])} na hora de decidir`);
  } else {
    const top = pains.slice(0, 2).map(lower);
    main_problem = endWithPeriod(
      `Hoje, ${audienceShort} enfrenta desafios como ${top[0]} e ${top[1]}, o que pode gerar insegurança na hora de decidir`,
    );
  }

  // --- main_benefit ---
  let main_benefit: string;
  if (diffs.length > 0) {
    const top = joinNatural(diffs.slice(0, 2));
    main_benefit = endWithPeriod(
      `Com ${top}, você recebe apoio para escolher com mais clareza e segurança`,
    );
  } else if (product) {
    main_benefit = endWithPeriod(`A ${brand.name} ajuda você a ${lower(actionFromObjective(project))} com mais confiança`);
  } else {
    main_benefit = "";
  }

  // --- key_promise ---
  const promiseSeed = mainMsg ? firstClause(mainMsg) : ANGLE_TONE[angle].promise;
  const key_promise = endWithPeriod(promiseSeed);

  const emotional_angle = inferEmotional(pains, angle);
  // ✅ sempre com sujeito (evita "Construído com ...")
  const trust_angle = diffs.length
    ? endWithPeriod(`A ${brand.name} apoia você com ${joinNatural(diffs.slice(0, 2))}`)
    : endWithPeriod(`A experiência da ${brand.name} como referência`);

  const support_points = diffs.slice(0, 3).map((d) => endWithPeriod(cap(d)));

  const bullet_options = dedupe([
    ...diffs,
    ...parseBullets(brand.products_services).slice(0, 3),
  ])
    .map((s) => lower(shortNoun(s.replace(/[.;]+$/, ""), 6)))
    .filter((s) => s.length >= 3 && s.length <= 60)
    .slice(0, 5);

  const cta_line = ctaRaw
    ? endWithPeriod(stripTrailingPunctNotKeep(ctaRaw))
    : defaultCTA(project, brand);
  if (!ctaRaw) placeholders.push("call_to_action");

  const themeNoun = lower(theme || product || "sua próxima decisão");
  const benefitNoun = lower(diffs[0] ?? "apoio próximo");
  const painNoun = lower(pains[0] ?? "dúvida");

  const rawHeadlines: string[] = [];
  rawHeadlines.push(cap(`${cap(themeNoun.split(" ").slice(0, 4).join(" "))} começa com ${benefitNoun}`));
  rawHeadlines.push(cap(`Menos ${painNoun}, mais ${benefitNoun}`));
  if (mainMsg) rawHeadlines.push(cap(firstClause(mainMsg)));
  rawHeadlines.push(cap(`${brand.name}: ${lower(stripTrailingPunctNotKeep(key_promise))}`));
  rawHeadlines.push(cap(`${ANGLE_TONE[angle].opener} com ${benefitNoun}`));

  const headline_options = dedupe(
    rawHeadlines
      .map((h) => stripTrailingPunctNotKeep(h))
      .map((h) => h.replace(/\s+/g, " ").trim())
      .filter((h) => h.length >= 12 && h.length <= 90),
  ).slice(0, 5);

  const diffPhrase = diffs.length ? joinNatural(diffs.slice(0, 2)) : "apoio próximo e responsável";
  const rawSupports: string[] = [];
  rawSupports.push(
    endWithPeriod(
      `A ${brand.name} ajuda você a ${lower(actionFromObjective(project))} com ${diffPhrase}, para decidir com mais tranquilidade`,
    ),
  );
  rawSupports.push(
    endWithPeriod(
      `Do primeiro contato ao acompanhamento, você conta com ${diffPhrase}${pains.length ? ", reduzindo " + lower(pains[0]) : ""}`,
    ),
  );
  if (mainMsg) {
    rawSupports.push(endWithPeriod(cap(firstClause(mainMsg)) + (diffs.length ? ` Com ${diffPhrase}.` : "")));
  }

  const support_text_options = dedupe(
    rawSupports.map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length >= 30 && s.length <= 320),
  ).slice(0, 3);

  if (!main_problem) placeholders.push("audience_problem");
  if (!main_benefit) placeholders.push("differentiators/products_services");
  if (headline_options.length === 0) placeholders.push("main_message/theme");

  return {
    main_problem,
    main_benefit,
    key_promise,
    emotional_angle,
    trust_angle,
    support_points,
    cta_line,
    headline_options,
    support_text_options,
    bullet_options,
    placeholders,
  };
}

// =================== variação por ângulo ===================

export function variationByAngle(
  base: ComposedCopy,
  angle: CopyAngle,
  brand: Brand,
): { mainText: string; supportText: string; angle: CopyAngle } {
  const tone = ANGLE_TONE[angle];
  const benefit = lower(base.bullet_options[0] ?? "apoio próximo");
  const promise = lower(stripTrailingPunctNotKeep(base.key_promise));

  let mainText = "";
  let supportText = base.support_text_options[0] ?? "";

  switch (angle) {
    case "comercial":
      mainText = cap(`${tone.opener} com ${benefit}`);
      supportText = base.support_text_options[0] ?? supportText;
      break;
    case "acolhedor":
      mainText = cap(`${tone.opener.replace(/decidir.*/, "decidir")} — ${promise}`);
      supportText = base.support_text_options[1] ?? base.support_text_options[0] ?? supportText;
      break;
    case "institucional":
      mainText = cap(`${brand.name}: ${promise}`);
      supportText = endWithPeriod(
        `Há tempo, a ${brand.name} acompanha pessoas com responsabilidade, foco em ${benefit} e compromisso com a sua escolha`,
      );
      break;
    case "direto":
      mainText = cap(`${promise}.`).replace(/\.+$/, ".");
      supportText = endWithPeriod(`Atendimento direto, sem rodeios, focado em ${benefit}`);
      break;
    case "inspirador":
      mainText = cap(`${tone.opener}`);
      supportText = endWithPeriod(`Comece com ${benefit} e siga com mais segurança rumo ao próximo passo`);
      break;
  }

  return { mainText, supportText, angle };
}

export const ALL_ANGLES: CopyAngle[] = [
  "comercial",
  "acolhedor",
  "institucional",
  "direto",
  "inspirador",
];

// =================== helpers internos ===================

function firstClause(s: string): string {
  const t = s.trim();
  const m = t.match(/^[^.!?\n;]+/);
  return (m ? m[0] : t).trim();
}

function stripTrailingPunctNotKeep(s: string): string {
  return s.trim().replace(/[.!?]+$/, "");
}

function inferAngle(project: Project): CopyAngle {
  const obj = (project.objective ?? "").toLowerCase();
  if (obj.includes("vender") || obj.includes("contato")) return "comercial";
  if (obj.includes("relacionamento") || obj.includes("bastidores")) return "acolhedor";
  if (obj.includes("comunicado") || obj.includes("informar")) return "institucional";
  if (obj.includes("data") || obj.includes("campanha")) return "inspirador";
  return "acolhedor";
}

function inferEmotional(pains: string[], angle: CopyAngle): string {
  if (pains.some((p) => /medo|inseg|golpe|risco/i.test(p))) return "segurança e tranquilidade";
  if (pains.some((p) => /tempo|atraso|pressa|demora/i.test(p))) return "agilidade e clareza";
  if (pains.some((p) => /caro|preço|custo|valor/i.test(p))) return "confiança e justiça no preço";
  switch (angle) {
    case "comercial": return "decisão segura";
    case "acolhedor": return "leveza e acolhimento";
    case "institucional": return "respeito e responsabilidade";
    case "direto": return "objetividade e foco";
    case "inspirador": return "entusiasmo e conquista";
  }
}

function actionFromObjective(project: Project): string {
  const obj = (project.objective ?? "").toLowerCase();
  if (obj.includes("vender")) return "fechar com mais segurança";
  if (obj.includes("contato")) return "dar o próximo passo";
  if (obj.includes("reconhecimento")) return "conhecer a marca de perto";
  if (obj.includes("educar")) return "entender o que importa";
  if (obj.includes("comunicado")) return "ficar por dentro";
  if (obj.includes("relacionamento")) return "se sentir próximo da marca";
  return "decidir com mais clareza";
}

function defaultCTA(project: Project, brand: Brand): string {
  const obj = (project.objective ?? "").toLowerCase();
  if (obj.includes("vender")) return "Peça seu orçamento.";
  if (obj.includes("contato")) return `Fale com a ${brand.name}.`;
  if (obj.includes("educar") || obj.includes("informar")) return "Saiba mais.";
  if (obj.includes("relacionamento")) return "Acompanhe a gente.";
  return "Entre em contato.";
}
