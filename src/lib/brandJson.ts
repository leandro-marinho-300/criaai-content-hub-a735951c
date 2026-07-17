export type BrandJsonFieldKey =
  | "name"
  | "segment"
  | "description"
  | "products_services"
  | "service_region"
  | "website"
  | "instagram"
  | "whatsapp"
  | "social_goal"
  | "audience"
  | "age_range"
  | "audience_needs"
  | "audience_difficulties"
  | "audience_values"
  | "audience_language"
  | "personality"
  | "tone_of_voice"
  | "recommended_words"
  | "prohibited_words"
  | "primary_color"
  | "secondary_color"
  | "additional_colors"
  | "fonts"
  | "visual_style"
  | "graphic_elements"
  | "visual_references"
  | "differentiators"
  | "allowed_topics"
  | "avoided_topics"
  | "priority_services"
  | "calls_to_action"
  | "frequently_asked_questions"
  | "important_dates"
  | "legal_information"
  | "forbidden_inventions";

export type BrandJsonProfile = Partial<Record<BrandJsonFieldKey, string | string[]>> & {
  assumptions?: string[];
  missing_information?: string[];
  confidence_notes?: string[];
};

type BrandJsonFormLike = Record<string, unknown> & { name: string };

export interface BrandJsonImportResult {
  ok: boolean;
  values?: Partial<BrandJsonProfile>;
  errors: string[];
  warnings: string[];
  filledFields: BrandJsonFieldKey[];
}

export interface BuildBrandJsonPromptInput {
  currentValues?: Partial<Record<BrandJsonFieldKey, unknown>>;
  extraContext?: string;
}

const stringFields: BrandJsonFieldKey[] = [
  "name",
  "segment",
  "description",
  "products_services",
  "service_region",
  "website",
  "instagram",
  "whatsapp",
  "social_goal",
  "audience",
  "age_range",
  "audience_needs",
  "audience_difficulties",
  "audience_values",
  "audience_language",
  "personality",
  "tone_of_voice",
  "primary_color",
  "secondary_color",
  "fonts",
  "visual_style",
  "graphic_elements",
  "visual_references",
  "differentiators",
  "frequently_asked_questions",
  "important_dates",
  "legal_information",
  "forbidden_inventions",
];

const arrayFields: BrandJsonFieldKey[] = [
  "recommended_words",
  "prohibited_words",
  "additional_colors",
  "allowed_topics",
  "avoided_topics",
  "priority_services",
  "calls_to_action",
];

export const brandJsonFieldLabels: Record<BrandJsonFieldKey, string> = {
  name: "Nome",
  segment: "Segmento",
  description: "Descrição",
  products_services: "Produtos e serviços",
  service_region: "Região de atendimento",
  website: "Site",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  social_goal: "Objetivo nas redes sociais",
  audience: "Público principal",
  age_range: "Faixa etária",
  audience_needs: "Necessidades",
  audience_difficulties: "Dificuldades",
  audience_values: "O que o público valoriza",
  audience_language: "Linguagem recomendada",
  personality: "Personalidade da marca",
  tone_of_voice: "Tom de voz",
  recommended_words: "Palavras recomendadas",
  prohibited_words: "Palavras proibidas",
  primary_color: "Cor principal",
  secondary_color: "Cor secundária",
  additional_colors: "Cores adicionais",
  fonts: "Fontes",
  visual_style: "Estilo visual",
  graphic_elements: "Elementos gráficos",
  visual_references: "Referências visuais",
  differentiators: "Diferenciais",
  allowed_topics: "Assuntos permitidos",
  avoided_topics: "Assuntos a evitar",
  priority_services: "Serviços prioritários",
  calls_to_action: "Chamadas para ação",
  frequently_asked_questions: "Dúvidas frequentes",
  important_dates: "Datas importantes",
  legal_information: "Informações legais",
  forbidden_inventions: "Informações que nunca podem ser inventadas",
};

export const allBrandJsonFields: BrandJsonFieldKey[] = [...stringFields, ...arrayFields];

export function buildBrandJsonPrompt({ currentValues, extraContext }: BuildBrandJsonPromptInput) {
  const knownBrandName = cleanString(currentValues?.name);
  const knownSegment = cleanString(currentValues?.segment);
  const knownDescription = cleanString(currentValues?.description);

  return `Analise o logo anexado e, se houver contexto adicional, use também essas informações para preencher uma ficha de marca/cliente para o Cria Aí.

IMPORTANTE
- Eu vou anexar o logo nesta conversa.
- Se o logo não estiver anexado ou não for legível, declare isso em "missing_information".
- Não invente telefone, site, Instagram, região de atendimento, dados legais, promessas, serviços, preços, certificações ou diferenciais que não estejam visíveis ou informados.
- Você pode inferir somente elementos visuais do logo, como cores, estilo, sensação, tipografia aproximada e personalidade visual.
- Quando uma informação não puder ser determinada com segurança, use string vazia "" ou array vazio [].
- Seja objetivo, útil e seguro para cadastro de uma marca.

DADOS JÁ INFORMADOS NO CRIA AÍ
Nome: ${knownBrandName || "Não informado"}
Segmento: ${knownSegment || "Não informado"}
Descrição: ${knownDescription || "Não informado"}

CONTEXTO ADICIONAL DO USUÁRIO
${cleanString(extraContext) || "Não informado"}

Retorne SOMENTE JSON válido, sem markdown, sem comentários e sem texto antes ou depois.

SCHEMA OBRIGATÓRIO:
{
  "name": "",
  "segment": "",
  "description": "",
  "products_services": "",
  "service_region": "",
  "website": "",
  "instagram": "",
  "whatsapp": "",
  "social_goal": "",
  "audience": "",
  "age_range": "",
  "audience_needs": "",
  "audience_difficulties": "",
  "audience_values": "",
  "audience_language": "",
  "personality": "",
  "tone_of_voice": "",
  "recommended_words": [],
  "prohibited_words": [],
  "primary_color": "",
  "secondary_color": "",
  "additional_colors": [],
  "fonts": "",
  "visual_style": "",
  "graphic_elements": "",
  "visual_references": "",
  "differentiators": "",
  "allowed_topics": [],
  "avoided_topics": [],
  "priority_services": [],
  "calls_to_action": [],
  "frequently_asked_questions": "",
  "important_dates": "",
  "legal_information": "",
  "forbidden_inventions": "",
  "assumptions": [],
  "missing_information": [],
  "confidence_notes": []
}

ORIENTAÇÕES DE PREENCHIMENTO
- name: nome exato visível no logo ou informado pelo usuário.
- segment: segmento provável somente se o logo/contexto indicar com segurança.
- description: resumo curto da marca, separando fato observado de hipótese.
- personality e tone_of_voice: descreva a sensação visual e comunicacional provável.
- primary_color, secondary_color e additional_colors: use HEX quando conseguir estimar; se não conseguir, descreva com segurança ou deixe vazio.
- fonts: descreva a tipografia aproximada, sem afirmar o nome exato se não tiver certeza.
- visual_style: descreva o estilo visual do logo.
- graphic_elements: liste símbolos, ícones, formas, linhas ou elementos presentes no logo.
- recommended_words: palavras coerentes com a identidade percebida.
- prohibited_words: inclua apenas termos claramente inadequados ao posicionamento ou informados pelo usuário.
- allowed_topics, avoided_topics, priority_services, calls_to_action e FAQs: só preencha se houver contexto suficiente.
- forbidden_inventions: liste dados que precisam ser confirmados antes de aparecer em conteúdo.
- assumptions: liste inferências feitas.
- missing_information: liste informações que o usuário precisa confirmar depois.
- confidence_notes: explique brevemente quais campos são mais confiáveis e quais são apenas aproximações.`;
}

export function parseBrandJsonImport(raw: string): BrandJsonImportResult {
  const cleaned = stripCodeFence(raw).trim();
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!cleaned) {
    return { ok: false, errors: ["Cole o JSON antes de validar."], warnings: [], filledFields: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    return {
      ok: false,
      errors: [`JSON inválido: ${error instanceof Error ? error.message : String(error)}`],
      warnings: [],
      filledFields: [],
    };
  }

  const source = unwrapBrandPayload(parsed);
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return { ok: false, errors: ["O JSON precisa ser um objeto com os campos da marca."], warnings: [], filledFields: [] };
  }

  const record = source as Record<string, unknown>;
  const values: Partial<BrandJsonProfile> = {};
  const filledFields: BrandJsonFieldKey[] = [];

  for (const field of stringFields) {
    const value = normalizeStringValue(record[field]);
    if (value) {
      values[field] = value;
      filledFields.push(field);
    } else if (record[field] !== undefined && record[field] !== null && record[field] !== "") {
      warnings.push(`${brandJsonFieldLabels[field]} veio em formato inesperado e foi ignorado.`);
    }
  }

  for (const field of arrayFields) {
    const value = normalizeArrayValue(record[field]);
    values[field] = value;
    if (value.length > 0) filledFields.push(field);
    if (record[field] !== undefined && !Array.isArray(record[field]) && typeof record[field] !== "string") {
      warnings.push(`${brandJsonFieldLabels[field]} deveria ser lista ou texto e foi normalizado como lista vazia.`);
    }
  }

  values.assumptions = normalizeArrayValue(record.assumptions);
  values.missing_information = normalizeArrayValue(record.missing_information);
  values.confidence_notes = normalizeArrayValue(record.confidence_notes);

  if (!values.name) warnings.push("Nome da marca não foi identificado com segurança.");
  if (!values.primary_color && !values.secondary_color) warnings.push("Cores principais não foram identificadas com segurança.");
  if (filledFields.length === 0) errors.push("Nenhum campo útil foi encontrado no JSON.");

  return { ok: errors.length === 0, values, errors, warnings, filledFields };
}

export function mergeBrandJsonValues<T extends BrandJsonFormLike>(
  current: T,
  imported: Partial<BrandJsonProfile>,
  options: { overwriteFilled: boolean },
): T {
  const next = { ...current } as Record<string, unknown>;

  for (const field of allBrandJsonFields) {
    const incoming = imported[field];
    if (!hasUsefulValue(incoming)) continue;
    const existing = next[field];
    if (!options.overwriteFilled && hasUsefulValue(existing)) continue;
    next[field] = incoming;
  }

  return next as T;
}

function unwrapBrandPayload(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return parsed;
  const record = parsed as Record<string, unknown>;
  return record.brand ?? record.brand_profile ?? record.profile ?? record.cliente ?? record.marca ?? parsed;
}

function stripCodeFence(value: string) {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (Array.isArray(value)) return value.map((item) => cleanString(item)).filter(Boolean).join("; ");
  return "";
}

function normalizeArrayValue(value: unknown) {
  const pieces = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[;\n,]/g)
      : [];

  const seen = new Set<string>();
  const result: string[] = [];
  for (const piece of pieces) {
    const normalized = cleanString(piece).replace(/^[-•\d.)\s]+/, "").trim();
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result.slice(0, 30);
}

function hasUsefulValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== undefined && value !== null;
}
