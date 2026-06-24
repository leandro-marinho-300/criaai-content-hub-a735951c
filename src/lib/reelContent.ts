import type { Tables } from "@/integrations/supabase/types";

type Brand = Tables<"brands">;
type Project = Tables<"content_projects">;

export interface ReelPublicationContext {
  title: string;
  theme: string;
  centralConcept: string;
  objective: string;
  audience: string;
  promise: string;
  mainPoints: string[];
  closing: string;
  strategicCta: string;
  ctaSource: "project" | "campaign" | "brand" | "fallback";
  mandatoryInformation: string[];
  restrictions: string[];
}

const txt = (value: unknown): string =>
  typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();

const arr = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => txt(item)).filter(Boolean) : [];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items) {
    const clean = normalizePoint(item);
    const key = clean.toLocaleLowerCase("pt-BR");
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    output.push(clean);
  }
  return output;
}

function normalizePoint(value: string): string {
  return value
    .replace(/^\s*(?:[-*•·]|\d+[.)-])\s*/, "")
    .replace(/\s+/g, " ")
    .replace(/[;,.]+$/, "")
    .trim();
}

function parseStructuredList(value: unknown): string[] {
  if (Array.isArray(value)) return unique(arr(value));
  const raw = txt(value);
  if (!raw) return [];

  const inlineNumbered = Array.from(
    raw.matchAll(/(?:^|\s)(\d{1,2})[.)-]\s*([^\n]+?)(?=(?:\s\d{1,2}[.)-]\s)|$)/g),
  )
    .map((match) => normalizePoint(match[2] ?? ""))
    .filter(Boolean);
  if (inlineNumbered.length > 1) return unique(inlineNumbered);

  return unique(
    raw
      .split(/\r?\n|;|\s[•·]\s|\s—\s|\s–\s/)
      .map(normalizePoint)
      .filter(Boolean),
  );
}

function campaignPayload(project: Project): Record<string, unknown> {
  return asRecord(project.campaign_content_json);
}

function campaignFields(project: Project): Record<string, unknown> {
  return asRecord(campaignPayload(project).campaign);
}

function importedPieces(project: Project): Record<string, unknown>[] {
  const raw = campaignPayload(project).pieces;
  return Array.isArray(raw) ? raw.map(asRecord) : [];
}

function isContentPiece(piece: Record<string, unknown>): boolean {
  const role = txt(piece.role).toLowerCase();
  const format = txt(piece.format).toLowerCase();
  const blockedRoles = new Set([
    "capa",
    "cover",
    "roteiro",
    "script",
    "legenda",
    "caption",
    "cta",
    "fechamento",
  ]);
  if (blockedRoles.has(role)) return false;
  if (format && !format.includes("reel") && !role.startsWith("item") && !role.includes("cena")) {
    return false;
  }
  return true;
}

export function extractCampaignMainPoints(project: Project): string[] {
  const campaign = campaignFields(project);
  const fromCampaign = parseStructuredList(campaign.key_points);
  if (fromCampaign.length) return fromCampaign;

  const fromImportedPieces = unique(
    importedPieces(project)
      .filter(isContentPiece)
      .map((piece) => txt(piece.headline) || txt(piece.support_text))
      .filter(Boolean),
  );
  if (fromImportedPieces.length) return fromImportedPieces;

  const fromMandatory = parseStructuredList(project.mandatory_information).filter(
    (item) => !/^(produto|servi[cç]o|contato|data|hor[aá]rio|local|valor)\s*:/i.test(item),
  );
  if (fromMandatory.length > 1) return fromMandatory;

  const fromMessage = parseStructuredList(project.main_message);
  if (fromMessage.length > 1) return fromMessage;

  const fromNotes = parseStructuredList(project.notes);
  if (fromNotes.length > 1) return fromNotes;

  return unique([...fromCampaign, ...fromImportedPieces, ...fromMandatory, ...fromMessage]).slice(
    0,
    8,
  );
}

export function resolveStrategicCta(
  brand: Brand,
  project: Project,
  fallback = "",
): { text: string; source: ReelPublicationContext["ctaSource"] } {
  const campaign = campaignFields(project);

  const projectCta = txt(project.call_to_action);
  if (projectCta) return { text: projectCta, source: "project" };

  const campaignCta = txt(campaign.main_cta);
  if (campaignCta) return { text: campaignCta, source: "campaign" };

  const brandCta = arr(brand.calls_to_action)[0] ?? "";
  if (brandCta) return { text: brandCta, source: "brand" };

  return { text: txt(fallback), source: "fallback" };
}

function ensureSentence(value: string): string {
  const clean = value.trim();
  if (!clean) return "";
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function lowerFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toLocaleLowerCase("pt-BR") + value.slice(1);
}

function titleFromProject(project: Project): string {
  return (
    txt(project.display_title) ||
    txt(project.internal_title) ||
    txt(project.theme) ||
    "Reel sem título"
  );
}

export function buildPublicationContext(
  brand: Brand,
  project: Project,
  fallbackCta = "",
): ReelPublicationContext {
  const campaign = campaignFields(project);
  const cta = resolveStrategicCta(brand, project, fallbackCta);
  const mandatoryInformation = parseStructuredList(project.mandatory_information);
  const restrictions = unique([
    ...parseStructuredList(project.restrictions),
    ...parseStructuredList(brand.forbidden_inventions),
    ...arr(brand.prohibited_words),
    ...arr(project.avoid_terms),
  ]);

  return {
    title: titleFromProject(project),
    theme: txt(project.theme),
    centralConcept: txt(campaign.central_message) || txt(project.main_message),
    objective: txt(project.objective),
    audience: txt(project.specific_audience) || txt(brand.audience),
    promise: txt(campaign.main_promise) || txt(project.main_message),
    mainPoints: extractCampaignMainPoints(project),
    closing: txt(campaign.narrative_structure),
    strategicCta: cta.text,
    ctaSource: cta.source,
    mandatoryInformation,
    restrictions,
  };
}

export function buildReelCaption(
  brand: Brand,
  project: Project,
  fallbackCta = "",
): { text: string; points: string[]; cta: string; ctaSource: ReelPublicationContext["ctaSource"] } {
  const context = buildPublicationContext(brand, project, fallbackCta);
  const lines: string[] = [];

  if (context.centralConcept) {
    lines.push(ensureSentence(context.centralConcept));
  } else if (context.theme) {
    lines.push(ensureSentence(`Confira os principais pontos sobre ${lowerFirst(context.theme)}`));
  } else {
    lines.push("Confira os principais pontos desta publicação.");
  }

  if (context.mainPoints.length) {
    lines.push("");
    context.mainPoints.forEach((point, index) => {
      lines.push(`${index + 1}. ${ensureSentence(point)}`);
    });
  }

  if (context.strategicCta) {
    lines.push("", context.strategicCta);
  }

  return {
    text: lines.join("\n").trim(),
    points: context.mainPoints,
    cta: context.strategicCta,
    ctaSource: context.ctaSource,
  };
}

function inferDuration(project: Project): string {
  const haystack = [project.notes, project.mandatory_information, project.main_message]
    .map(txt)
    .join(" ");
  const match = haystack.match(/\b(15|30|45|60)\s*(?:s|seg|segundos?)\b/i);
  return match ? `${match[1]} segundos` : "30 segundos";
}

function listOrFallback(items: string[], fallback: string): string {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : fallback;
}

export function buildReelScriptRequest(brand: Brand, project: Project, fallbackCta = ""): string {
  const context = buildPublicationContext(brand, project, fallbackCta);
  const duration = inferDuration(project);
  const tone = unique([
    txt(brand.tone_of_voice),
    txt(brand.personality),
    txt(project.desired_style),
  ]).join("; ");

  const lines: string[] = [];
  lines.push(`Crie um roteiro completo para um Reel do Instagram da ${brand.name}.`);
  lines.push("");
  lines.push("TEMA:");
  lines.push(context.theme || context.title || "[INSERIR TEMA OU IDEIA]");
  lines.push("");
  lines.push("CONTEXTO OPCIONAL:");
  lines.push(
    [context.centralConcept, txt(project.notes), txt(project.audience_problem)]
      .filter(Boolean)
      .join("\n") || "Não informado.",
  );
  lines.push("");
  lines.push("OBJETIVO:");
  lines.push(context.objective || "Definir a partir do tema.");
  lines.push("");
  lines.push("PÚBLICO:");
  lines.push(context.audience || "Definir a partir do tema e da marca.");
  lines.push("");
  lines.push("DURAÇÃO:");
  lines.push(duration);
  lines.push("");
  lines.push("CTA:");
  lines.push(context.strategicCta || "Criar um CTA adequado ao objetivo.");
  lines.push("");
  lines.push("PONTOS QUE O ROTEIRO PRECISA DESENVOLVER:");
  lines.push(listOrFallback(context.mainPoints, "- Definir a partir do tema."));
  lines.push("");
  lines.push("INFORMAÇÕES OBRIGATÓRIAS:");
  lines.push(
    listOrFallback(
      context.mandatoryInformation,
      "- Nenhuma informação obrigatória adicional foi informada.",
    ),
  );
  lines.push("");
  lines.push("IDENTIDADE E TOM DA MARCA:");
  lines.push(tone || "Próxima, humana, responsável e direta.");
  lines.push("");
  lines.push("RESTRIÇÕES:");
  lines.push(
    listOrFallback(
      context.restrictions,
      "- Não inventar dados, preços, datas, condições ou benefícios.",
    ),
  );
  lines.push("");
  lines.push(
    "O conteúdo pode utilizar storytelling emocional quando isso combinar com o tema, mas não deve forçar emoção, dramatizar excessivamente ou explorar sofrimento.",
  );
  lines.push("");
  lines.push(
    "Não use palavras, comparações, piadas, expressões ou construções que humilhem, diminuam, estigmatizem ou denigram pessoas, grupos, destinos, condições financeiras, culturas ou formas diferentes de viajar.",
  );
  lines.push("");
  lines.push("O roteiro precisa conter:");
  lines.push("1. Conceito central.");
  lines.push("2. Objetivo do Reel.");
  lines.push("3. Emoção ou reação que o conteúdo deve despertar.");
  lines.push("4. Gancho para os primeiros três segundos.");
  lines.push("5. Roteiro dividido por cenas e tempo.");
  lines.push("6. Fala, diálogo ou narração de cada cena.");
  lines.push("7. Texto curto que aparecerá na tela.");
  lines.push("8. Orientação de gravação, enquadramento, movimentos e imagens de apoio.");
  lines.push("9. Sugestão de transições.");
  lines.push("10. Clima de trilha sonora.");
  lines.push("11. Fechamento memorável.");
  lines.push("12. CTA natural e coerente.");
  lines.push(
    "13. Legenda completa para a publicação, baseada na campanha inteira e em todos os pontos acima.",
  );
  lines.push("14. Duas alternativas de gancho.");
  lines.push("15. Uma versão mais curta do roteiro.");
  lines.push("");
  lines.push(
    "O roteiro deve soar humano e natural quando falado. Evite frases genéricas, excesso de palavras motivacionais, clichês, textos publicitários artificiais e explicações longas.",
  );
  lines.push("");
  lines.push("Antes de entregar, verifique:");
  lines.push("- se o gancho gera curiosidade;");
  lines.push("- se a história tem começo, desenvolvimento e conclusão;");
  lines.push("- se todos os pontos da campanha foram desenvolvidos;");
  lines.push("- se a marca aparece de forma natural;");
  lines.push("- se o CTA definido foi preservado;");
  lines.push("- se o texto cabe na duração;");
  lines.push("- se a gravação é viável;");
  lines.push("- se nenhuma expressão pode ser interpretada como ofensiva ou depreciativa;");
  lines.push("- se nenhuma informação foi inventada.");
  lines.push("");
  lines.push("Entregue o roteiro completo em texto estruturado, pronto para produção.");

  return lines.join("\n");
}

export function validateCaptionCoverage(
  caption: string,
  points: string[],
): {
  coveredPoints: string[];
  missingPoints: string[];
  coveragePercentage: number;
} {
  const normalizedCaption = caption.toLocaleLowerCase("pt-BR");
  const coveredPoints = points.filter((point) => {
    const keywords = normalizePoint(point)
      .toLocaleLowerCase("pt-BR")
      .split(/\s+/)
      .filter((word) => word.length >= 4)
      .slice(0, 4);
    return keywords.length > 0 && keywords.some((keyword) => normalizedCaption.includes(keyword));
  });
  const missingPoints = points.filter((point) => !coveredPoints.includes(point));
  const coveragePercentage = points.length
    ? Math.round((coveredPoints.length / points.length) * 100)
    : 100;

  return { coveredPoints, missingPoints, coveragePercentage };
}
