import type { Tables } from "@/integrations/supabase/types";
import type { ContentPreset } from "@/lib/contentPresets";
import type { Reel2ImportedScript } from "@/lib/reel2Script";

export type Reel2EntryMode =
  | "idea"
  | "no_ideas"
  | "preset"
  | "remix"
  | "trend"
  | "adapt_existing";

export type Reel2Objective =
  | "educar"
  | "alertar"
  | "gerar_contato"
  | "identificacao"
  | "autoridade"
  | "bastidor"
  | "vender_leve"
  | "comentarios";

export type Reel2Type =
  | "educativo"
  | "alerta"
  | "passo_a_passo"
  | "bastidor"
  | "storytelling"
  | "remix_referencia"
  | "curiosidade"
  | "react"
  | "trend_adaptada"
  | "comercial_leve";

export type Reel2CoverMode = "custom" | "frame" | "unsure" | "none";

export interface Reel2HookDraft {
  mode: "direct" | "curious" | "alert";
  spoken_hook: string;
  on_screen_text: string;
  scene_suggestion: string;
  why_it_works: string;
}

export interface Reel2Draft {
  entry_mode: Reel2EntryMode | "";
  brand_id: string;
  brand_snapshot?: {
    name?: string;
    segment?: string | null;
    tone_of_voice?: string | null;
  };
  central_idea: string;
  base_content: string;
  reference_link: string;
  reference_transcript: string;
  reference_notes: string;
  remix_mode: "criador" | "react" | "remix" | "";
  trend_term: string;
  trend_source: string;
  preset_id: string;
  objective: Reel2Objective | "";
  reel_type: Reel2Type | "";
  promise: string;
  hook_options: Reel2HookDraft[];
  selected_hook_index: number | null;
  imported_script?: Reel2ImportedScript | null;
  imported_script_raw?: string;
  imported_script_imported_at?: string;
  imported_script_source_schema?: string;
  imported_script_warnings?: string[];
  cover_mode: Reel2CoverMode;
  extra_notes: string;
  advanced_open: boolean;
}

export const REEL2_DRAFT_KEY = "cria-reel2-draft-v1";
export const REEL2_WIZARD_PREFILL_KEY = "cria-wizard-prefill";

export const REEL2_ENTRY_OPTIONS: Array<{
  id: Reel2EntryMode;
  title: string;
  description: string;
  helper: string;
}> = [
  {
    id: "idea",
    title: "Tenho uma ideia",
    description: "Use quando você já sabe o assunto do Reel.",
    helper: "Você informa o tema e o Cria Aí guia promessa, gancho e estrutura.",
  },
  {
    id: "no_ideas",
    title: "Estou sem ideias",
    description: "Receba temas com base na marca e no histórico.",
    helper: "Nesta fase, o app prepara o rascunho; a sugestão inteligente entra nas próximas fases.",
  },
  {
    id: "preset",
    title: "Usar preset",
    description: "Comece com uma receita pronta de Reel.",
    helper: "Ideal para repetir um padrão que já funciona sem preencher tudo de novo.",
  },
  {
    id: "remix",
    title: "Remixar referência",
    description: "Adapte a lógica de um Reel que já funcionou.",
    helper: "A referência serve para aprender estrutura, não para copiar conteúdo.",
  },
  {
    id: "trend",
    title: "Seguir uma trend",
    description: "Crie a partir de um formato ou assunto em alta.",
    helper: "Use quando encontrou áudio, padrão ou tema em alta e quer adaptar ao nicho.",
  },
  {
    id: "adapt_existing",
    title: "Adaptar conteúdo antigo",
    description: "Transforme texto, post ou material existente em Reel.",
    helper: "Cole o material base para reaproveitar a ideia em vídeo curto.",
  },
];

export const REEL2_OBJECTIVES: Array<{
  id: Reel2Objective;
  title: string;
  description: string;
  suggestedTypes: Reel2Type[];
}> = [
  { id: "educar", title: "Educar", description: "Ensinar algo útil de forma clara.", suggestedTypes: ["educativo", "passo_a_passo", "curiosidade"] },
  { id: "alertar", title: "Alertar", description: "Mostrar um erro, risco ou cuidado.", suggestedTypes: ["alerta", "educativo", "react"] },
  { id: "gerar_contato", title: "Gerar contato", description: "Incentivar direct, orçamento ou conversa.", suggestedTypes: ["comercial_leve", "passo_a_passo", "educativo"] },
  { id: "identificacao", title: "Criar identificação", description: "Fazer o público se reconhecer na situação.", suggestedTypes: ["storytelling", "bastidor", "curiosidade"] },
  { id: "autoridade", title: "Fortalecer autoridade", description: "Mostrar critério, método ou visão profissional.", suggestedTypes: ["educativo", "react", "bastidor"] },
  { id: "bastidor", title: "Mostrar bastidor", description: "Revelar processo, rotina ou cuidado real.", suggestedTypes: ["bastidor", "storytelling", "passo_a_passo"] },
  { id: "vender_leve", title: "Vender com leveza", description: "Apresentar solução sem parecer anúncio duro.", suggestedTypes: ["comercial_leve", "storytelling", "passo_a_passo"] },
  { id: "comentarios", title: "Gerar comentários", description: "Estimular resposta, opinião ou conversa.", suggestedTypes: ["curiosidade", "alerta", "react"] },
];

export const REEL2_TYPES: Array<{
  id: Reel2Type;
  title: string;
  description: string;
  structure: string;
  advanced?: boolean;
}> = [
  {
    id: "educativo",
    title: "Educativo",
    description: "Para ensinar algo com clareza.",
    structure: "gancho → situação real → explicação → orientação prática → CTA",
  },
  {
    id: "alerta",
    title: "Alerta",
    description: "Para mostrar erro, risco ou cuidado.",
    structure: "alerta → exemplo cotidiano → consequência → correção → CTA",
  },
  {
    id: "passo_a_passo",
    title: "Passo a passo",
    description: "Para explicar método, checklist ou sequência.",
    structure: "promessa → passo 1 → passo 2 → passo 3 → resumo → CTA",
  },
  {
    id: "bastidor",
    title: "Bastidor",
    description: "Para mostrar processo real e gerar confiança.",
    structure: "cena real → contexto → por que importa → aprendizado → CTA",
  },
  {
    id: "storytelling",
    title: "Storytelling",
    description: "Para contar uma situação com começo, conflito e virada.",
    structure: "situação → conflito → virada → aprendizado → CTA",
  },
  {
    id: "remix_referencia",
    title: "Remix de referência",
    description: "Para adaptar uma estrutura que já funcionou.",
    structure: "referência → estrutura extraída → adaptação ao nicho → novo roteiro",
  },
  {
    id: "curiosidade",
    title: "Curiosidade",
    description: "Para revelar algo pouco percebido.",
    structure: "curiosidade → explicação → exemplo → conclusão → CTA",
    advanced: true,
  },
  {
    id: "react",
    title: "React",
    description: "Para comentar uma ideia, fala ou tendência.",
    structure: "referência → reação → explicação → adaptação ao nicho → CTA",
    advanced: true,
  },
  {
    id: "trend_adaptada",
    title: "Trend adaptada",
    description: "Para adaptar um formato em alta ao nicho.",
    structure: "trend → adaptação ao nicho → mensagem central → CTA",
    advanced: true,
  },
  {
    id: "comercial_leve",
    title: "Comercial leve",
    description: "Para gerar desejo e contato sem virar anúncio duro.",
    structure: "situação → problema/desejo → solução → convite → CTA",
    advanced: true,
  },
];

export const DEFAULT_REEL2_DRAFT: Reel2Draft = {
  entry_mode: "",
  brand_id: "",
  central_idea: "",
  base_content: "",
  reference_link: "",
  reference_transcript: "",
  reference_notes: "",
  remix_mode: "",
  trend_term: "",
  trend_source: "",
  preset_id: "",
  objective: "",
  reel_type: "",
  promise: "",
  hook_options: [],
  selected_hook_index: null,
  imported_script: null,
  imported_script_raw: "",
  imported_script_imported_at: "",
  imported_script_source_schema: "",
  imported_script_warnings: [],
  cover_mode: "unsure",
  extra_notes: "",
  advanced_open: false,
};

export function isReelPreset(preset: ContentPreset) {
  return preset.formats.includes("reel") || preset.idea_formats.includes("reel") || Boolean(preset.reel_instructions?.trim());
}

export function loadReel2Draft(): Reel2Draft {
  if (typeof window === "undefined") return DEFAULT_REEL2_DRAFT;
  try {
    const raw = localStorage.getItem(REEL2_DRAFT_KEY);
    if (!raw) return DEFAULT_REEL2_DRAFT;
    return normalizeReel2Draft(JSON.parse(raw));
  } catch {
    return DEFAULT_REEL2_DRAFT;
  }
}

export function saveReel2Draft(draft: Reel2Draft) {
  if (typeof window === "undefined") return;
  localStorage.setItem(REEL2_DRAFT_KEY, JSON.stringify(draft));
}

export function clearReel2Draft() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(REEL2_DRAFT_KEY);
}

export function normalizeReel2Draft(value: unknown): Reel2Draft {
  const v = typeof value === "object" && value ? (value as Partial<Reel2Draft>) : {};
  return {
    ...DEFAULT_REEL2_DRAFT,
    ...v,
    hook_options: Array.isArray(v.hook_options) ? v.hook_options : [],
    selected_hook_index: typeof v.selected_hook_index === "number" ? v.selected_hook_index : null,
    imported_script: v.imported_script && typeof v.imported_script === "object" ? (v.imported_script as Reel2ImportedScript) : null,
    imported_script_raw: typeof v.imported_script_raw === "string" ? v.imported_script_raw : "",
    imported_script_imported_at: typeof v.imported_script_imported_at === "string" ? v.imported_script_imported_at : "",
    imported_script_source_schema: typeof v.imported_script_source_schema === "string" ? v.imported_script_source_schema : "",
    imported_script_warnings: Array.isArray(v.imported_script_warnings) ? v.imported_script_warnings.filter((item): item is string => typeof item === "string") : [],
  };
}

export function snapshotBrand(brand?: Pick<Tables<"brands">, "name" | "segment" | "tone_of_voice"> | null) {
  if (!brand) return undefined;
  return {
    name: brand.name,
    segment: brand.segment,
    tone_of_voice: brand.tone_of_voice,
  };
}

export function applyPresetToReelDraft(draft: Reel2Draft, preset: ContentPreset): Reel2Draft {
  const objective = preset.objective === "qualquer" ? draft.objective : mapPresetObjectiveToReel(preset.objective);
  return {
    ...draft,
    preset_id: preset.id,
    objective: objective || draft.objective,
    reel_type: inferReelTypeFromPreset(preset, draft.reel_type),
    cover_mode: preset.formats.includes("capa_reel") ? "custom" : draft.cover_mode,
    extra_notes: [draft.extra_notes, preset.reel_instructions, preset.restrictions]
      .filter(Boolean)
      .join("\n\n"),
  };
}

export function mapPresetObjectiveToReel(objective?: string | null): Reel2Objective | "" {
  const map: Record<string, Reel2Objective> = {
    educar: "educar",
    informar: "educar",
    divulgar_servico: "gerar_contato",
    divulgar_produto: "vender_leve",
    vender: "vender_leve",
    gerar_contatos: "gerar_contato",
    relacionamento: "comentarios",
    bastidores: "bastidor",
    campanha: "vender_leve",
    aumentar_reconhecimento: "autoridade",
  };
  return objective ? map[objective] ?? "" : "";
}

export function inferReelTypeFromPreset(preset: ContentPreset, fallback: Reel2Type | "" = ""): Reel2Type | "" {
  const text = `${preset.name} ${preset.description} ${preset.approach} ${preset.reel_instructions} ${preset.desired_style}`.toLowerCase();
  if (text.includes("alerta") || text.includes("erro")) return "alerta";
  if (text.includes("checklist") || text.includes("passo")) return "passo_a_passo";
  if (text.includes("bastidor")) return "bastidor";
  if (text.includes("história") || text.includes("story")) return "storytelling";
  if (text.includes("referência") || text.includes("remix")) return "remix_referencia";
  if (text.includes("comercial") || text.includes("venda")) return "comercial_leve";
  return fallback || "educativo";
}

export function buildReel2WizardPrefill(draft: Reel2Draft, brand?: Tables<"brands"> | null) {
  const selectedType = REEL2_TYPES.find((type) => type.id === draft.reel_type);
  const selectedObjective = REEL2_OBJECTIVES.find((objective) => objective.id === draft.objective);
  const selectedHook = draft.selected_hook_index !== null ? draft.hook_options[draft.selected_hook_index] : null;
  const imported = draft.imported_script;
  const idea = imported?.central_idea || draft.central_idea || draft.base_content || draft.trend_term || draft.reference_notes || "Reel 2.0";
  const importedScenes = imported?.main_script?.scenes
    ?.map((scene) => `${scene.start}-${scene.end}s · ${scene.function}: ${scene.speech}`)
    .slice(0, 12)
    .join("\n");
  const notes = [
    imported ? "Origem: Criar Reel 2.0 — Fase 2 com JSON importado." : "Origem: Criar Reel 2.0 — Fase 1.",
    draft.entry_mode ? `Entrada escolhida: ${entryLabel(draft.entry_mode as Reel2EntryMode)}.` : "",
    selectedObjective ? `Objetivo do Reel: ${selectedObjective.title}.` : imported?.objective ? `Objetivo do Reel: ${imported.objective}.` : "",
    selectedType ? `Tipo de Reel: ${selectedType.title}. Estrutura: ${selectedType.structure}.` : imported?.reel_type ? `Tipo de Reel: ${imported.reel_type}.` : "",
    imported?.promise ? `Promessa do vídeo: ${imported.promise}.` : draft.promise ? `Promessa do vídeo: ${draft.promise}.` : "",
    imported?.selected_hook?.spoken_hook ? `Gancho escolhido: ${imported.selected_hook.spoken_hook}.` : selectedHook ? `Gancho escolhido: ${selectedHook.spoken_hook || selectedHook.on_screen_text}.` : "",
    imported?.short_version?.full_video_caption ? `Legenda completa para inserir no vídeo: ${imported.short_version.full_video_caption}` : "",
    imported?.cover?.title ? `Capa sugerida: ${imported.cover.title}${imported.cover.subtitle ? ` — ${imported.cover.subtitle}` : ""}.` : "",
    importedScenes ? `Roteiro por cenas:\n${importedScenes}` : "",
    draft.reference_link ? `Referência: ${draft.reference_link}.` : "",
    draft.reference_transcript ? `Transcrição/descrição da referência: ${draft.reference_transcript}.` : "",
    draft.extra_notes,
  ].filter(Boolean).join("\n");

  return {
    brand_id: draft.brand_id || null,
    internal_title: `Reel 2.0 — ${idea}`.slice(0, 140),
    objective: mapReelObjectiveToWizard(draft.objective),
    selected_formats: imported?.cover?.needs_cover || draft.cover_mode === "custom" ? ["reel", "capa_reel"] : ["reel"],
    theme: idea,
    specific_audience: brand?.audience ?? "",
    audience_problem: brand?.audience_difficulties ?? "",
    main_message: imported?.promise || draft.promise || draft.central_idea || "Reel com gancho forte, promessa clara e roteiro por cenas.",
    mandatory_information: imported
      ? "Usar o roteiro Reel 2.0 importado como base. Preservar gancho, promessa, cenas, legenda completa para vídeo, capa, CTA e até 5 hashtags."
      : draft.promise ? `Promessa obrigatória: ${draft.promise}` : "Criar roteiro com gancho nos primeiros 3 segundos, cenas com função e CTA coerente.",
    call_to_action: imported?.publication?.cta || brand?.calls_to_action?.[0] || "",
    desired_style: selectedType ? `${selectedType.title}: ${selectedType.structure}` : imported?.reel_type || "Reel curto, dinâmico e didático.",
    restrictions: brand?.forbidden_inventions ?? "Não copiar referências externas. Adaptar apenas estrutura e lógica criativa.",
    notes,
  };
}

export function mapReelObjectiveToWizard(objective: Reel2Objective | "") {
  const map: Record<Reel2Objective, string> = {
    educar: "educar",
    alertar: "educar",
    gerar_contato: "gerar_contatos",
    identificacao: "relacionamento",
    autoridade: "aumentar_reconhecimento",
    bastidor: "bastidores",
    vender_leve: "vender",
    comentarios: "relacionamento",
  };
  return objective ? map[objective] : "educar";
}

function entryLabel(entry: Reel2EntryMode) {
  return REEL2_ENTRY_OPTIONS.find((option) => option.id === entry)?.title ?? entry;
}
