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

export function inferReelDurationSeconds(project: Project): number {
  const haystack = [project.notes, project.mandatory_information, project.main_message]
    .map(txt)
    .join(" ");
  const match = haystack.match(/\b(15|30|45|60)\s*(?:s|seg|segundos?)\b/i);
  return match ? Number(match[1]) : 30;
}

function listOrFallback(items: string[], fallback: string): string {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : fallback;
}

export function buildReelScriptRequest(brand: Brand, project: Project, fallbackCta = ""): string {
  const context = buildPublicationContext(brand, project, fallbackCta);
  const durationSeconds = inferReelDurationSeconds(project);
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
  lines.push("CONTEXTO:");
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
  lines.push(`${durationSeconds} segundos`);
  lines.push("");
  lines.push("CONCEITO OU PROMESSA DA CAMPANHA:");
  lines.push(context.promise || context.centralConcept || "Definir a partir do tema.");
  lines.push("");
  lines.push("PONTOS OBRIGATÓRIOS A DESENVOLVER:");
  lines.push(listOrFallback(context.mainPoints, "- Definir a partir do tema."));
  lines.push("");
  lines.push("CTA ESTRATÉGICO:");
  lines.push(context.strategicCta || "Criar um CTA adequado ao objetivo.");
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
  lines.push("Crie um roteiro realmente desenvolvido e pronto para orientar a gravação.");
  lines.push("");
  lines.push("Não entregue apenas uma estrutura genérica como:");
  lines.push("- “criar gancho”;");
  lines.push("- “desenvolver em dois ou três cortes”;");
  lines.push("- “apresentar benefício”;");
  lines.push("- “inserir CTA”.");
  lines.push("");
  lines.push(
    "Escreva efetivamente as falas, narrações, textos na tela, ações, cenas, orientações de gravação e transições.",
  );
  lines.push("Não repita o texto de apoio durante todo o desenvolvimento.");
  lines.push(
    "Transforme cada ponto obrigatório em uma orientação concreta dentro de uma ou mais cenas.",
  );
  lines.push(
    "A legenda da publicação deve representar o conteúdo completo do Reel e contemplar todos os pontos obrigatórios.",
  );
  lines.push(
    "A versão reduzida também deve trazer uma legenda completa para inserir no vídeo, reunindo todas as falas em ordem e sem omitir o fechamento ou o CTA.",
  );
  lines.push("Use no máximo 5 hashtags relevantes e específicas.");
  lines.push("O CTA deve ser preservado exatamente como foi informado, inclusive na versão curta.");
  lines.push("Não invente fatos, datas, condições, preços ou benefícios.");
  lines.push("");
  lines.push(
    "RETORNE SOMENTE JSON VÁLIDO, SEM MARKDOWN E SEM TEXTO ANTES OU DEPOIS, NESTE FORMATO:",
  );
  lines.push("{");
  lines.push('  "schema_version": "reel_script_v1",');
  lines.push('  "title": "Título interno do Reel",');
  lines.push('  "assumptions": [],');
  lines.push('  "overview": {');
  lines.push('    "central_concept": "",');
  lines.push('    "objective": "",');
  lines.push('    "target_audience": "",');
  lines.push('    "narrative_format": "",');
  lines.push('    "desired_reaction": "",');
  lines.push(`    "duration_seconds": ${durationSeconds}`);
  lines.push("  },");
  lines.push('  "hooks": {');
  lines.push('    "primary": "",');
  lines.push('    "alternatives": ["", ""]');
  lines.push("  },");
  lines.push('  "required_points": [');
  if (context.mainPoints.length) {
    context.mainPoints.forEach((point, index) => {
      const comma = index < context.mainPoints.length - 1 ? "," : "";
      lines.push(`    ${JSON.stringify(point)}${comma}`);
    });
  }
  lines.push("  ],");
  lines.push('  "scenes": [');
  lines.push("    {");
  lines.push('      "scene_number": 1,');
  lines.push('      "scene_title": "Abertura",');
  lines.push('      "start_second": 0,');
  lines.push('      "end_second": 3,');
  lines.push('      "purpose": "hook",');
  lines.push('      "delivery_type": "speech | narration | on_screen_text | mixed",');
  lines.push('      "speech_or_narration": "Fala ou narração completa",');
  lines.push('      "on_screen_text": "Texto curto na tela",');
  lines.push('      "recording_direction": "Orientação específica de gravação",');
  lines.push('      "framing": "Enquadramento",');
  lines.push('      "camera_movement": "Movimento ou câmera fixa",');
  lines.push('      "supporting_images": ["Imagem de apoio"],');
  lines.push('      "transition": "Transição",');
  lines.push('      "production_notes": "Observações adicionais"');
  lines.push("    }");
  lines.push("  ],");
  lines.push('  "production": {');
  lines.push('    "soundtrack_mood": "",');
  lines.push('    "editing_rhythm": "",');
  lines.push('    "general_transitions": [],');
  lines.push('    "accessibility_notes": []');
  lines.push("  },");
  lines.push('  "closing": {');
  lines.push('    "memorable_line": "",');
  lines.push(`    "cta": ${JSON.stringify(context.strategicCta || "")}`);
  lines.push("  },");
  lines.push('  "publication": {');
  lines.push('    "caption": "Legenda completa baseada em toda a campanha",');
  lines.push('    "hashtags": ["#Hashtag1", "#Hashtag2"]');
  lines.push("  },");
  lines.push('  "short_version": {');
  lines.push('    "duration_seconds": 15,');
  lines.push('    "hook": "",');
  lines.push('    "scenes": [');
  lines.push("      {");
  lines.push('        "scene_number": 1,');
  lines.push('        "start_second": 0,');
  lines.push('        "end_second": 3,');
  lines.push('        "speech_or_narration": "",');
  lines.push('        "on_screen_text": "",');
  lines.push('        "recording_direction": ""');
  lines.push("      }");
  lines.push("    ],");
  lines.push(
    '    "full_video_caption": "Texto integral das falas da versão reduzida, em ordem, para inserir como legenda no vídeo",',
  );
  lines.push('    "closing": "",');
  lines.push(`    "cta": ${JSON.stringify(context.strategicCta || "")}`);
  lines.push("  },");
  lines.push('  "coverage": [');
  lines.push("    {");
  lines.push('      "point": "Ponto obrigatório",');
  lines.push('      "covered": true,');
  lines.push('      "scene_numbers": [2],');
  lines.push('      "covered_in_caption": true');
  lines.push("    }");
  lines.push("  ],");
  lines.push('  "validation": {');
  lines.push('    "hook_creates_curiosity": true,');
  lines.push('    "has_beginning_middle_end": true,');
  lines.push('    "all_required_points_covered": true,');
  lines.push('    "cta_preserved": true,');
  lines.push('    "caption_covers_full_campaign": true,');
  lines.push('    "fits_duration": true,');
  lines.push('    "recording_is_viable": true,');
  lines.push('    "contains_no_offensive_language": true,');
  lines.push('    "invented_information": false,');
  lines.push(`    "estimated_speech_seconds": ${Math.max(1, durationSeconds - 3)},`);
  lines.push('    "warnings": []');
  lines.push("  }");
  lines.push("}");
  lines.push("");
  lines.push("Antes de responder, confirme internamente que:");
  lines.push("- todos os pontos obrigatórios aparecem em cenas concretas;");
  lines.push("- todos os pontos também aparecem ou são sintetizados na legenda;");
  lines.push("- o CTA foi preservado literalmente;");
  lines.push("- as cenas não possuem lacunas ou sobreposições;");
  lines.push("- as falas cabem na duração;");
  lines.push("- a gravação é viável;");
  lines.push("- nenhuma informação foi inventada.");

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
