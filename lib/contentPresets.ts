import type { Tables } from "@/integrations/supabase/types";
import type { IdeaApproach, IdeaFocus, IdeaFormat, IdeaObjective, IdeaTone } from "@/lib/ideaTaxonomy";
import { normalizeHashtags } from "@/lib/hashtags";

export type ContentPresetScope = "global" | "brand";

export interface ContentPreset {
  id: string;
  name: string;
  description: string;
  scope: ContentPresetScope;
  brand_id?: string | null;
  objective: IdeaObjective;
  focus: IdeaFocus;
  approach: IdeaApproach;
  tone: IdeaTone;
  /** Formatos finais do wizard. Pode incluir formatos que não existem no Laboratório, como capa_reel. */
  formats: string[];
  /** Preferência de formato para o Laboratório. */
  idea_formats: IdeaFormat[];
  cta: string;
  desired_style: string;
  mandatory_information: string;
  restrictions: string;
  notes: string;
  reel_instructions: string;
  visual_instructions: string;
  caption_instructions: string;
  hashtag_suggestions: string[];
  locked_fields: Array<"objective" | "formats" | "cta" | "tone" | "restrictions">;
  allow_fallback: boolean;
  created_at: string;
  updated_at: string;
  is_system?: boolean;
}

export type PresetDraft = Omit<ContentPreset, "id" | "created_at" | "updated_at"> & {
  id?: string;
};

const STORAGE_KEY = "cria-content-presets-v1";

export const DEFAULT_PRESETS: ContentPreset[] = [
  {
    id: "preset-canine-reel-erro-comum",
    name: "Reel educativo — comportamento canino",
    description:
      "Para vídeos curtos com gancho forte, exemplo prático e orientação cuidadosa para tutores.",
    scope: "global",
    brand_id: null,
    objective: "educar",
    focus: "dor_publico",
    approach: "erro_comum",
    tone: "acolhedor",
    formats: ["reel", "capa_reel"],
    idea_formats: ["reel"],
    cta: "Comente sua dúvida.",
    desired_style:
      "Começar com um erro comum do tutor, explicar o impacto no comportamento do cachorro e fechar com uma orientação simples para aplicar no dia a dia.",
    mandatory_information:
      "Não prometer resultado imediato. Evitar culpabilizar o tutor. Reforçar consistência, paciência e segurança.",
    restrictions:
      "Não usar linguagem agressiva, julgamento moral ou promessa de cura. Não substituir orientação profissional individualizada.",
    notes:
      "Estrutura sugerida: gancho nos 3 primeiros segundos, exemplo cotidiano, explicação curta, ajuste prático e CTA de comentário.",
    reel_instructions:
      "Roteiro falado, natural e curto. Priorizar uma situação real do tutor e uma ação prática observável.",
    visual_instructions:
      "Visual acolhedor, limpo, com cachorro e tutor em situação cotidiana. Evitar dramatização.",
    caption_instructions:
      "Legenda educativa curta, com pergunta final para incentivar comentários de tutores.",
    hashtag_suggestions: ["#ComportamentoCanino", "#EducacaoCanina", "#Cachorro", "#TutorConsciente", "#TreinoPositivo"],
    locked_fields: ["objective", "tone", "restrictions"],
    allow_fallback: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    is_system: true,
  },
  {
    id: "preset-travel-checklist-reel",
    name: "Solidare Travel — checklist prático",
    description:
      "Para transformar temas de viagem em checklist de Reel, carrossel ou Status com orientação prática.",
    scope: "global",
    brand_id: null,
    objective: "educar",
    focus: "servico",
    approach: "checklist",
    tone: "direto",
    formats: ["reel", "capa_reel", "status_whatsapp"],
    idea_formats: ["reel", "status_whatsapp"],
    cta: "Chame a Solidare no WhatsApp.",
    desired_style:
      "Conteúdo prático, direto e responsável. Desenvolver os pontos do checklist com orientações concretas, sem prometer preço, disponibilidade ou resultado.",
    mandatory_information:
      "Validar regras, prazos, valores, documentos e disponibilidade antes da publicação quando aplicável.",
    restrictions:
      "Não inventar valores, datas, disponibilidade, regras de bagagem, vistos, vacinas ou condições comerciais.",
    notes:
      "Estrutura sugerida: gancho, 3 a 5 pontos práticos, benefício de se planejar com antecedência e CTA para contato.",
    reel_instructions:
      "Roteiro com cenas curtas, cada ponto deve virar uma orientação concreta. A legenda deve contemplar todos os pontos.",
    visual_instructions:
      "Usar preto, branco e laranja. Solicitar uso do logo oficial Solidare Travel quando for visual. Visual de viagem organizado e confiável.",
    caption_instructions:
      "Legenda deve sintetizar o checklist completo e preservar o CTA estratégico.",
    hashtag_suggestions: ["#SolidareTravel", "#DicasDeViagem", "#PlanejamentoDeViagem", "#ViagemComSeguranca", "#Turismo"],
    locked_fields: ["cta", "restrictions"],
    allow_fallback: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    is_system: true,
  },
  {
    id: "preset-story-interacao",
    name: "Story de interação",
    description: "Para criar uma tela ou sequência curta com pergunta, enquete ou resposta do público.",
    scope: "global",
    brand_id: null,
    objective: "relacionamento",
    focus: "comunidade",
    approach: "bastidores",
    tone: "acolhedor",
    formats: ["story", "sequencia_stories"],
    idea_formats: ["story", "sequencia_stories"],
    cta: "Responda este Story.",
    desired_style:
      "Conteúdo curto, conversacional e participativo, com uma pergunta clara para o público responder.",
    mandatory_information: "Definir a pergunta principal e o tipo de interação antes de publicar.",
    restrictions: "Não criar enquete falsa dentro da arte quando o sticker será inserido na plataforma.",
    notes:
      "Estrutura sugerida: situação reconhecível, pergunta simples, opção de resposta ou sticker.",
    reel_instructions: "",
    visual_instructions: "Reservar espaço para sticker nativo quando houver enquete, pergunta ou link.",
    caption_instructions: "Stories normalmente não exigem legenda externa.",
    hashtag_suggestions: [],
    locked_fields: [],
    allow_fallback: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    is_system: true,
  },
];

const canUseBrowserStorage = () => typeof window !== "undefined" && !!window.localStorage;

function safeParse(raw: string | null): ContentPreset[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizePreset).filter(Boolean) as ContentPreset[];
  } catch {
    return [];
  }
}

function normalizePreset(value: unknown): ContentPreset | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Partial<ContentPreset>;
  if (!p.name?.trim()) return null;
  const now = new Date().toISOString();
  const formats = normalizeStringArray(p.formats).filter((f) => f !== "auto");
  const ideaFormats = normalizeIdeaFormats(p.idea_formats, formats);
  return {
    id: p.id || cryptoId(),
    name: p.name.trim(),
    description: p.description || "",
    scope: p.scope === "brand" ? "brand" : "global",
    brand_id: p.brand_id || null,
    objective: p.objective || "qualquer",
    focus: p.focus || "qualquer",
    approach: p.approach || "auto",
    tone: p.tone || "marca",
    formats: formats.length ? formats : ["post"],
    idea_formats: ideaFormats.length ? ideaFormats : ["auto"],
    cta: p.cta || "",
    desired_style: p.desired_style || "",
    mandatory_information: p.mandatory_information || "",
    restrictions: p.restrictions || "",
    notes: p.notes || "",
    reel_instructions: p.reel_instructions || "",
    visual_instructions: p.visual_instructions || "",
    caption_instructions: p.caption_instructions || "",
    hashtag_suggestions: normalizeHashtags(p.hashtag_suggestions ?? []),
    locked_fields: Array.isArray(p.locked_fields) ? p.locked_fields : [],
    allow_fallback: p.allow_fallback !== false,
    created_at: p.created_at || now,
    updated_at: p.updated_at || now,
    is_system: Boolean(p.is_system),
  };
}

export function getUserPresets(): ContentPreset[] {
  if (!canUseBrowserStorage()) return [];
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

export function getAllPresets(): ContentPreset[] {
  const userPresets = getUserPresets();
  const ids = new Set(userPresets.map((preset) => preset.id));
  return [...DEFAULT_PRESETS.filter((preset) => !ids.has(preset.id)), ...userPresets].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
}

export function saveUserPreset(draft: PresetDraft): ContentPreset {
  if (!canUseBrowserStorage()) throw new Error("Armazenamento local indisponível.");
  const existing = draft.id ? getUserPresets().find((preset) => preset.id === draft.id) : null;
  const current = getUserPresets().filter((preset) => preset.id !== draft.id);
  const now = new Date().toISOString();
  const preset = normalizePreset({
    ...draft,
    id: draft.id || cryptoId(),
    created_at: existing?.created_at || now,
    updated_at: now,
    is_system: false,
  });
  if (!preset) throw new Error("Preset inválido.");
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, preset]));
  return preset;
}

export function deleteUserPreset(id: string) {
  if (!canUseBrowserStorage()) return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(getUserPresets().filter((preset) => preset.id !== id)),
  );
}

export function duplicatePreset(preset: ContentPreset): ContentPreset {
  return saveUserPreset({ ...preset, id: undefined, name: `${preset.name} (cópia)`, is_system: false });
}

export function getPresetById(id: string | null | undefined): ContentPreset | null {
  if (!id) return null;
  return getAllPresets().find((preset) => preset.id === id) ?? null;
}

export function presetsForBrand(brandId?: string | null): ContentPreset[] {
  return getAllPresets().filter(
    (preset) => preset.scope === "global" || !preset.brand_id || preset.brand_id === brandId,
  );
}

export function presetToWizardPrefill(preset: ContentPreset, brandId?: string | null) {
  const notes = [
    `Preset aplicado: ${preset.name}`,
    preset.notes,
    preset.reel_instructions ? `Orientação de roteiro: ${preset.reel_instructions}` : "",
    preset.caption_instructions ? `Orientação de legenda: ${preset.caption_instructions}` : "",
    preset.visual_instructions ? `Orientação visual: ${preset.visual_instructions}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    brand_id: preset.brand_id || brandId || null,
    objective: preset.objective === "qualquer" ? "" : preset.objective,
    selected_formats: preset.formats,
    internal_title: preset.name,
    call_to_action: preset.cta,
    mandatory_information: preset.mandatory_information,
    desired_style: [preset.desired_style, preset.visual_instructions].filter(Boolean).join("\n"),
    restrictions: preset.restrictions,
    notes,
  };
}

export function presetFromProject(args: {
  project: Tables<"content_projects"> & { brands?: Tables<"brands"> | null };
  name?: string;
}): PresetDraft {
  const { project, name } = args;
  const selectedFormats = Array.isArray(project.selected_formats)
    ? (project.selected_formats as string[])
    : [];
  return {
    name: name || `${project.display_title || project.internal_title || "Preset"}`,
    description: `Criado a partir do projeto ${project.display_title || project.internal_title || "sem título"}.`,
    scope: project.brand_id ? "brand" : "global",
    brand_id: project.brand_id,
    objective: normalizeObjective(project.objective),
    focus: "qualquer",
    approach: "auto",
    tone: "marca",
    formats: selectedFormats.length ? selectedFormats : ["post"],
    idea_formats: normalizeIdeaFormats([], selectedFormats),
    cta: project.call_to_action || "",
    desired_style: project.desired_style || "",
    mandatory_information: project.mandatory_information || "",
    restrictions: project.restrictions || "",
    notes: project.notes || "",
    reel_instructions: selectedFormats.includes("reel")
      ? "Preservar estrutura de roteiro com cenas, falas, texto na tela, direção e CTA."
      : "",
    visual_instructions: project.desired_style || "",
    caption_instructions: "Preservar CTA e contemplar a campanha completa.",
    hashtag_suggestions: [],
    locked_fields: [],
    allow_fallback: true,
  };
}

export function summarizePreset(preset: ContentPreset): string {
  const formats = preset.formats.join(", ");
  return `${preset.name} · ${formats}${preset.cta ? ` · CTA: ${preset.cta}` : ""}`;
}

function normalizeObjective(value: string | null | undefined): IdeaObjective {
  const allowed: IdeaObjective[] = [
    "qualquer",
    "informar",
    "educar",
    "vender",
    "gerar_contatos",
    "relacionamento",
    "autoridade",
    "inspirar",
  ];
  return allowed.includes(value as IdeaObjective) ? (value as IdeaObjective) : "qualquer";
}

function normalizeIdeaFormats(values: unknown, finalFormats: string[]): IdeaFormat[] {
  const allowed: IdeaFormat[] = [
    "auto",
    "post",
    "carrossel",
    "story",
    "sequencia_stories",
    "status_whatsapp",
    "reel",
    "comunicado",
  ];
  const raw = Array.isArray(values) ? values : [];
  const fromValues = raw.filter((v): v is IdeaFormat => allowed.includes(v as IdeaFormat));
  if (fromValues.length) return fromValues;
  const fromFinal = normalizeStringArray(finalFormats).filter((v): v is IdeaFormat =>
    allowed.includes(v as IdeaFormat),
  );
  return fromFinal.length ? fromFinal : ["auto"];
}

function normalizeStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[;\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function cryptoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
