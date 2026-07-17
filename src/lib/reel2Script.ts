import { z } from "zod";
import type { Tables } from "@/integrations/supabase/types";
import { MAX_HASHTAGS, normalizeHashtags } from "@/lib/hashtags";
import type { Reel2Draft, Reel2HookDraft, Reel2Type } from "@/lib/reel2";
import { REEL2_OBJECTIVES, REEL2_TYPES } from "@/lib/reel2";
import { parseAndValidateReelScript, type ReelScript } from "@/lib/reelScript";

const MAX_RAW_SIZE = 350_000;

const hookTypeSchema = z.enum(["direct", "curious", "alert", "direto", "curioso", "alerta"]);

const reel2HookSchema = z.object({
  type: hookTypeSchema.or(z.string().min(1).max(40)),
  spoken_hook: z.string().min(1).max(600),
  on_screen_text: z.string().min(1).max(240),
  scene_suggestion: z.string().min(1).max(600),
  why_it_works: z.string().min(1).max(800),
});

const reel2SceneSchema = z.object({
  start: z.number().min(0),
  end: z.number().positive(),
  function: z.string().min(1).max(120),
  speech: z.string().min(1).max(1600),
  on_screen_text: z.string().max(320),
  visual_direction: z.string().min(1).max(1200),
});

const reel2ScriptBlockSchema = z.object({
  duration_seconds: z.number().int().positive().max(180),
  scenes: z.array(reel2SceneSchema).min(2).max(40),
});

export const reel2ImportedScriptSchema = z.object({
  schema_version: z.literal("reel_2_0"),
  brand: z.string().max(180).optional().default(""),
  reel_type: z.string().min(1).max(80),
  objective: z.string().min(1).max(120),
  central_idea: z.string().min(1).max(600),
  promise: z.string().min(1).max(700),
  hook_options: z.array(reel2HookSchema).min(1).max(6),
  selected_hook: reel2HookSchema,
  main_script: reel2ScriptBlockSchema,
  short_version: z.object({
    duration_seconds: z.number().int().positive().max(90),
    scenes: z.array(reel2SceneSchema).min(1).max(30),
    full_video_caption: z.string().min(1).max(6000),
  }),
  cover: z.object({
    needs_cover: z.boolean(),
    mode: z.enum(["custom", "frame", "unsure", "none"]).or(z.string().max(40)).default("unsure"),
    title: z.string().max(120).default(""),
    subtitle: z.string().max(180).default(""),
    visual_prompt: z.string().max(3000).default(""),
    safe_area_notes: z.string().max(1000).default(""),
  }),
  publication: z.object({
    caption: z.string().min(1).max(5000),
    cta: z.string().min(1).max(400),
    hashtags: z.array(z.string().min(1).max(80)).max(MAX_HASHTAGS),
  }),
  production_notes: z.object({
    lighting: z.string().max(700).default(""),
    scenario: z.string().max(700).default(""),
    pace: z.string().max(700).default(""),
    editing: z.string().max(700).default(""),
    accessibility: z.string().max(700).default(""),
  }),
  quality_check: z.object({
    has_0_3s_hook: z.boolean(),
    has_clear_promise: z.boolean(),
    has_video_caption: z.boolean(),
    hashtags_limited_to_5: z.boolean(),
    has_scene_functions: z.boolean(),
    respects_brand_niche: z.boolean(),
  }),
});

export type Reel2ImportedScript = z.infer<typeof reel2ImportedScriptSchema>;
export type Reel2ImportedScene = Reel2ImportedScript["main_script"]["scenes"][number];

export interface Reel2ImportResult {
  ok: boolean;
  script?: Reel2ImportedScript;
  errors: string[];
  warnings: string[];
  sourceSchema?: string;
  normalizedFromLegacy?: boolean;
}

function stripMarkdownFence(raw: string): string {
  let value = raw.trim();
  value = value
    .replace(/^```(?:json|JSON)?\s*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
  if (!value.startsWith("{")) {
    const first = value.indexOf("{");
    const last = value.lastIndexOf("}");
    if (first >= 0 && last > first) value = value.slice(first, last + 1);
  }
  return value;
}

function zodIssueMessage(issue: z.ZodIssue): string {
  const path = issue.path.length ? issue.path.join(".") : "resposta";
  return `${path}: ${issue.message}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeHookType(value: unknown): "direct" | "curious" | "alert" {
  const raw = asString(value).toLowerCase();
  if (["curious", "curioso", "curiosidade"].includes(raw)) return "curious";
  if (["alert", "alerta", "warning"].includes(raw)) return "alert";
  return "direct";
}

function normalizeScene(input: unknown, index: number): Reel2ImportedScene {
  const scene = asRecord(input);
  const start = typeof scene.start === "number" ? scene.start : typeof scene.start_second === "number" ? scene.start_second : index * 5;
  const end = typeof scene.end === "number" ? scene.end : typeof scene.end_second === "number" ? scene.end_second : start + 5;
  return {
    start,
    end: Math.max(end, start + 1),
    function: asString(scene.function) || asString(scene.purpose) || (index === 0 ? "gancho" : "desenvolvimento"),
    speech: asString(scene.speech) || asString(scene.speech_or_narration) || asString(scene.narration) || "",
    on_screen_text: asString(scene.on_screen_text),
    visual_direction: asString(scene.visual_direction) || asString(scene.recording_direction) || asString(scene.visual) || "Cena simples e coerente com a marca.",
  };
}

function normalizeReel2Input(parsed: unknown): { value: unknown; warnings: string[]; sourceSchema?: string; normalizedFromLegacy?: boolean } {
  const root = asRecord(parsed);
  const sourceSchema = asString(root.schema_version);
  if (sourceSchema === "reel_script_v1") {
    const legacy = parseAndValidateReelScript(JSON.stringify(parsed));
    if (!legacy.script) return { value: parsed, warnings: legacy.errors, sourceSchema };
    return {
      value: convertLegacyScriptToReel2(legacy.script),
      warnings: [
        "JSON antigo reel_script_v1 convertido para reel_2_0. Revise capa, promessa e selected_hook.",
        ...legacy.warnings,
      ],
      sourceSchema,
      normalizedFromLegacy: true,
    };
  }

  const value = { ...root };
  value.schema_version = "reel_2_0";

  const warnings: string[] = [];
  const publication = asRecord(value.publication);
  const originalHashtags = Array.isArray(publication.hashtags) ? publication.hashtags.length : 0;
  publication.hashtags = normalizeHashtags(publication.hashtags);
  if (originalHashtags > MAX_HASHTAGS) warnings.push(`Foram mantidas apenas ${MAX_HASHTAGS} hashtags.`);
  value.publication = publication;

  const mainScript = asRecord(value.main_script);
  mainScript.scenes = Array.isArray(mainScript.scenes) ? mainScript.scenes.map(normalizeScene) : [];
  if (typeof mainScript.duration_seconds !== "number") {
    const scenes = mainScript.scenes as Reel2ImportedScene[];
    mainScript.duration_seconds = scenes.length ? Math.max(...scenes.map((scene) => scene.end)) : 30;
  }
  value.main_script = mainScript;

  const shortVersion = asRecord(value.short_version);
  shortVersion.scenes = Array.isArray(shortVersion.scenes) ? shortVersion.scenes.map(normalizeScene) : [];
  if (typeof shortVersion.duration_seconds !== "number") {
    const scenes = shortVersion.scenes as Reel2ImportedScene[];
    shortVersion.duration_seconds = scenes.length ? Math.max(...scenes.map((scene) => scene.end)) : 15;
  }
  if (!asString(shortVersion.full_video_caption)) {
    shortVersion.full_video_caption = [
      ...(shortVersion.scenes as Reel2ImportedScene[]).map((scene) => scene.speech),
      asString(asRecord(value.publication).cta),
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
    warnings.push("A legenda completa para inserir no vídeo foi montada automaticamente a partir da versão reduzida.");
  }
  value.short_version = shortVersion;

  const hookOptions = Array.isArray(value.hook_options) ? value.hook_options : [];
  value.hook_options = hookOptions.map((hook) => {
    const item = asRecord(hook);
    return {
      type: normalizeHookType(item.type),
      spoken_hook: asString(item.spoken_hook) || asString(item.fala) || asString(item.hook),
      on_screen_text: asString(item.on_screen_text) || asString(item.texto_na_tela),
      scene_suggestion: asString(item.scene_suggestion) || asString(item.cena_sugerida) || "Cena de abertura com rosto, ação ou elemento visual forte.",
      why_it_works: asString(item.why_it_works) || asString(item.por_que_funciona) || "Cria curiosidade e conecta com uma dor real.",
    };
  });

  if (!asRecord(value.selected_hook).spoken_hook && Array.isArray(value.hook_options) && value.hook_options.length) {
    value.selected_hook = value.hook_options[0];
    warnings.push("Nenhum gancho escolhido foi informado; o primeiro gancho foi usado como selected_hook.");
  }

  const cover = asRecord(value.cover);
  value.cover = {
    needs_cover: typeof cover.needs_cover === "boolean" ? cover.needs_cover : cover.mode === "custom",
    mode: asString(cover.mode) || (cover.needs_cover ? "custom" : "unsure"),
    title: asString(cover.title),
    subtitle: asString(cover.subtitle),
    visual_prompt: asString(cover.visual_prompt),
    safe_area_notes: asString(cover.safe_area_notes),
  };

  value.production_notes = {
    lighting: asString(asRecord(value.production_notes).lighting),
    scenario: asString(asRecord(value.production_notes).scenario),
    pace: asString(asRecord(value.production_notes).pace),
    editing: asString(asRecord(value.production_notes).editing),
    accessibility: asString(asRecord(value.production_notes).accessibility),
  };

  value.quality_check = {
    has_0_3s_hook: Boolean(asRecord(value.quality_check).has_0_3s_hook),
    has_clear_promise: Boolean(asRecord(value.quality_check).has_clear_promise),
    has_video_caption: Boolean(asRecord(value.quality_check).has_video_caption || asString(shortVersion.full_video_caption)),
    hashtags_limited_to_5: Boolean(asRecord(value.quality_check).hashtags_limited_to_5 || (publication.hashtags as string[]).length <= MAX_HASHTAGS),
    has_scene_functions: Boolean(asRecord(value.quality_check).has_scene_functions || (mainScript.scenes as Reel2ImportedScene[]).every((scene) => scene.function)),
    respects_brand_niche: Boolean(asRecord(value.quality_check).respects_brand_niche),
  };

  return { value, warnings, sourceSchema };
}

function convertLegacyScriptToReel2(script: ReelScript): Reel2ImportedScript {
  const primaryHook: Reel2ImportedScript["selected_hook"] = {
    type: "direct",
    spoken_hook: script.hooks.primary,
    on_screen_text: script.hooks.primary.slice(0, 120),
    scene_suggestion: script.scenes[0]?.recording_direction || "Abertura com cena real e texto forte na tela.",
    why_it_works: "É o gancho principal do roteiro importado anteriormente.",
  };
  const alternativeHooks = script.hooks.alternatives.map((hook, index) => ({
    type: index === 0 ? "curious" : "alert",
    spoken_hook: hook,
    on_screen_text: hook.slice(0, 120),
    scene_suggestion: "Cena curta com reforço visual do gancho.",
    why_it_works: "Variação reaproveitada do roteiro antigo.",
  }));
  return {
    schema_version: "reel_2_0",
    brand: "",
    reel_type: script.overview.narrative_format || "educativo",
    objective: script.overview.objective || "Educar",
    central_idea: script.overview.central_concept,
    promise: script.overview.desired_reaction || script.overview.central_concept,
    hook_options: [primaryHook, ...alternativeHooks].slice(0, 3),
    selected_hook: primaryHook,
    main_script: {
      duration_seconds: script.overview.duration_seconds,
      scenes: script.scenes.map((scene, index) => normalizeScene({
        start: scene.start_second,
        end: scene.end_second,
        function: scene.purpose,
        speech: scene.speech_or_narration,
        on_screen_text: scene.on_screen_text,
        visual_direction: scene.recording_direction,
      }, index)),
    },
    short_version: {
      duration_seconds: script.short_version.duration_seconds,
      scenes: script.short_version.scenes.map((scene, index) => normalizeScene({
        start: scene.start_second,
        end: scene.end_second,
        function: index === 0 ? "gancho" : "síntese",
        speech: scene.speech_or_narration,
        on_screen_text: scene.on_screen_text,
        visual_direction: scene.recording_direction,
      }, index)),
      full_video_caption: script.short_version.full_video_caption || [
        ...script.short_version.scenes.map((scene) => scene.speech_or_narration),
        script.short_version.closing,
        script.short_version.cta,
      ].filter(Boolean).join(" "),
    },
    cover: {
      needs_cover: true,
      mode: "unsure",
      title: script.title.slice(0, 80),
      subtitle: "",
      visual_prompt: "Criar capa coerente com o gancho e a identidade da marca.",
      safe_area_notes: "Manter título legível em 9:16 e seguro para corte 1:1 na grade.",
    },
    publication: {
      caption: script.publication.caption,
      cta: script.closing.cta,
      hashtags: normalizeHashtags(script.publication.hashtags),
    },
    production_notes: {
      lighting: "Boa iluminação frontal.",
      scenario: "Cenário limpo e coerente com a marca.",
      pace: script.production.editing_rhythm,
      editing: script.production.general_transitions.join("; "),
      accessibility: script.production.accessibility_notes.join("; "),
    },
    quality_check: {
      has_0_3s_hook: true,
      has_clear_promise: Boolean(script.overview.desired_reaction),
      has_video_caption: Boolean(script.short_version.full_video_caption),
      hashtags_limited_to_5: true,
      has_scene_functions: true,
      respects_brand_niche: true,
    },
  };
}

export function parseAndValidateReel2Script(raw: string): Reel2ImportResult {
  if (!raw.trim()) return { ok: false, errors: ["Cole o JSON antes de validar."], warnings: [] };
  if (raw.length > MAX_RAW_SIZE) {
    return { ok: false, errors: ["A resposta ultrapassa o limite de 350 KB. Cole apenas o JSON do Reel 2.0."], warnings: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdownFence(raw));
  } catch (error) {
    return { ok: false, errors: [`JSON inválido: ${(error as Error).message}`], warnings: [] };
  }

  const normalized = normalizeReel2Input(parsed);
  const schema = reel2ImportedScriptSchema.safeParse(normalized.value);
  if (!schema.success) {
    return {
      ok: false,
      errors: schema.error.issues.map(zodIssueMessage),
      warnings: normalized.warnings,
      sourceSchema: normalized.sourceSchema,
      normalizedFromLegacy: normalized.normalizedFromLegacy,
    };
  }

  const warnings = [...normalized.warnings, ...qualityWarnings(schema.data)];
  return {
    ok: warnings.some((warning) => warning.startsWith("ERRO:")) ? false : true,
    script: schema.data,
    errors: warnings.filter((warning) => warning.startsWith("ERRO:")).map((warning) => warning.replace(/^ERRO:\s*/, "")),
    warnings: warnings.filter((warning) => !warning.startsWith("ERRO:")),
    sourceSchema: normalized.sourceSchema || schema.data.schema_version,
    normalizedFromLegacy: normalized.normalizedFromLegacy,
  };
}

function qualityWarnings(script: Reel2ImportedScript): string[] {
  const warnings: string[] = [];
  if (script.hook_options.length < 3) warnings.push("O JSON trouxe menos de 3 opções de gancho.");
  if (script.main_script.scenes[0]?.start !== 0 || script.main_script.scenes[0]?.end > 3.5) {
    warnings.push("ERRO: O primeiro bloco do roteiro precisa começar em 0s e cobrir os primeiros 3 segundos.");
  }
  if (!script.quality_check.has_0_3s_hook) warnings.push("ERRO: O quality_check informa que não há gancho nos primeiros 3 segundos.");
  if (!script.quality_check.has_clear_promise) warnings.push("O quality_check informa que a promessa pode não estar clara.");
  if (!script.quality_check.has_video_caption || !script.short_version.full_video_caption.trim()) {
    warnings.push("ERRO: A versão reduzida precisa ter legenda completa para inserir no vídeo.");
  }
  if (!script.quality_check.has_scene_functions) warnings.push("ERRO: Todas as cenas precisam ter função.");
  if (!script.quality_check.respects_brand_niche) warnings.push("O quality_check não confirmou respeito ao nicho da marca. Revise antes de usar.");
  if (script.publication.hashtags.length > MAX_HASHTAGS) warnings.push(`ERRO: O JSON deve ter no máximo ${MAX_HASHTAGS} hashtags.`);
  const invalidTimes = script.main_script.scenes.some((scene) => scene.end <= scene.start);
  if (invalidTimes) warnings.push("ERRO: Existem cenas com tempo final menor ou igual ao início.");
  return warnings;
}

export function convertImportedScriptHooks(script: Reel2ImportedScript): Reel2HookDraft[] {
  return script.hook_options.map((hook) => ({
    mode: normalizeHookType(hook.type),
    spoken_hook: hook.spoken_hook,
    on_screen_text: hook.on_screen_text,
    scene_suggestion: hook.scene_suggestion,
    why_it_works: hook.why_it_works,
  }));
}

export function findSelectedHookIndex(script: Reel2ImportedScript): number {
  const selected = script.selected_hook.spoken_hook.trim().toLowerCase();
  const index = script.hook_options.findIndex((hook) => hook.spoken_hook.trim().toLowerCase() === selected);
  return index >= 0 ? index : 0;
}

export function buildReel2ExternalPrompt(draft: Reel2Draft, brand?: Tables<"brands"> | null): string {
  const objective = REEL2_OBJECTIVES.find((item) => item.id === draft.objective);
  const reelType = REEL2_TYPES.find((item) => item.id === draft.reel_type);
  const selectedHook = draft.selected_hook_index !== null ? draft.hook_options[draft.selected_hook_index] : null;
  const idea = draft.central_idea || draft.base_content || draft.trend_term || draft.reference_notes || "";
  const ctas = brand?.calls_to_action?.length ? brand.calls_to_action.join(", ") : "";
  const lines: string[] = [];

  lines.push("Crie um roteiro completo de Reel no padrão Cria Aí 2.0 e devolva SOMENTE JSON válido.");
  lines.push("");
  lines.push("IMPORTANTE:");
  lines.push("- Não use markdown.");
  lines.push("- Não escreva comentários antes ou depois do JSON.");
  lines.push("- Não use IA interna do app; este JSON será importado manualmente.");
  lines.push("- Use referências apenas para aprender estrutura, nunca para copiar falas, imagens, identidade visual ou conteúdo autoral.");
  lines.push(`- Use no máximo ${MAX_HASHTAGS} hashtags.`);
  lines.push("- A versão reduzida deve conter full_video_caption com a legenda completa para inserir no vídeo.");
  lines.push("- O primeiro bloco do roteiro deve começar em 0s e funcionar como gancho dos primeiros 3 segundos.");
  lines.push("- Separe: texto na tela, legenda completa do vídeo, legenda da publicação e título da capa.");
  lines.push("");
  lines.push("=== CONTEXTO DA MARCA ===");
  lines.push(`Marca: ${brand?.name || draft.brand_snapshot?.name || ""}`);
  lines.push(`Segmento/nicho: ${brand?.segment || draft.brand_snapshot?.segment || ""}`);
  lines.push(`Descrição: ${brand?.description || ""}`);
  lines.push(`Público: ${brand?.audience || ""}`);
  lines.push(`Dores do público: ${brand?.audience_difficulties || ""}`);
  lines.push(`Tom da marca: ${brand?.tone_of_voice || draft.brand_snapshot?.tone_of_voice || ""}`);
  lines.push(`Palavras recomendadas: ${(brand?.recommended_words || []).join(", ")}`);
  lines.push(`Palavras proibidas: ${(brand?.prohibited_words || []).join(", ")}`);
  lines.push(`Assuntos permitidos: ${(brand?.allowed_topics || []).join(", ")}`);
  lines.push(`Assuntos evitados: ${(brand?.avoided_topics || []).join(", ")}`);
  lines.push(`CTAs da marca: ${ctas}`);
  lines.push(`Restrições/segurança: ${brand?.forbidden_inventions || "Não invente promessas, certificações, preços, resultados ou dados que não foram informados."}`);
  lines.push(`Estilo visual: ${brand?.visual_style || ""}`);
  lines.push(`Cores: ${[brand?.primary_color, brand?.secondary_color, ...(brand?.additional_colors || [])].filter(Boolean).join(", ")}`);
  lines.push("");
  lines.push("=== DECISÕES DO REEL ===");
  lines.push(`Entrada escolhida: ${draft.entry_mode || ""}`);
  lines.push(`Ideia central/tema: ${idea}`);
  lines.push(`Objetivo: ${objective?.title || draft.objective || ""}`);
  lines.push(`Tipo de Reel: ${reelType?.title || draft.reel_type || ""}`);
  lines.push(`Estrutura esperada: ${reelType?.structure || ""}`);
  lines.push(`Promessa do vídeo: ${draft.promise || "crie uma promessa específica e coerente com o nicho"}`);
  lines.push(`Gancho escolhido pelo usuário: ${selectedHook?.spoken_hook || selectedHook?.on_screen_text || "selecione o gancho mais forte entre as opções"}`);
  lines.push(`Texto na tela do gancho escolhido: ${selectedHook?.on_screen_text || ""}`);
  lines.push(`Cena sugerida do gancho escolhido: ${selectedHook?.scene_suggestion || ""}`);
  lines.push(`Capa desejada: ${draft.cover_mode}`);
  lines.push(`Observações extras: ${draft.extra_notes || ""}`);
  lines.push("");

  if (draft.entry_mode === "remix") {
    lines.push("=== REFERÊNCIA PARA REMIX ===");
    lines.push(`Link: ${draft.reference_link}`);
    lines.push(`Tipo de adaptação: ${draft.remix_mode}`);
    lines.push(`Transcrição/descrição: ${draft.reference_transcript}`);
    lines.push(`Observações: ${draft.reference_notes}`);
    lines.push("Reforce: extraia a estrutura e reescreva tudo para a marca/nicho. Não copie frases do original.");
    lines.push("");
  }

  if (draft.entry_mode === "trend") {
    lines.push("=== TREND ===");
    lines.push(`Termo/formato/áudio: ${draft.trend_term}`);
    lines.push(`Fonte: ${draft.trend_source}`);
    lines.push("Adapte a trend ao nicho sem forçar linguagem incoerente.");
    lines.push("");
  }

  if (draft.entry_mode === "adapt_existing") {
    lines.push("=== CONTEÚDO BASE PARA ADAPTAR ===");
    lines.push(draft.base_content);
    lines.push("");
  }

  lines.push("=== REGRAS DE QUALIDADE ===");
  lines.push("- O roteiro deve entregar valor antes de vender.");
  lines.push("- Cada cena precisa ter função clara.");
  lines.push("- Textos na tela devem ser curtos e legíveis.");
  lines.push("- O CTA deve combinar com o objetivo.");
  lines.push("- Evite título genérico ou incoerente com o nicho.");
  lines.push("- Exemplo de erro proibido para comportamento canino: 'o que está incluído e como garantir'.");
  lines.push("- Para viagem, termos como roteiro, orçamento, pacote e planejamento podem fazer sentido quando forem coerentes.");
  lines.push("");
  lines.push("=== FORMATO OBRIGATÓRIO DA RESPOSTA ===");
  lines.push(JSON.stringify(reel2PromptExample, null, 2));
  return lines.join("\n");
}

const reel2PromptExample = {
  schema_version: "reel_2_0",
  brand: "",
  reel_type: "educativo",
  objective: "Educar",
  central_idea: "",
  promise: "",
  hook_options: [
    {
      type: "direct",
      spoken_hook: "",
      on_screen_text: "",
      scene_suggestion: "",
      why_it_works: "",
    },
    {
      type: "curious",
      spoken_hook: "",
      on_screen_text: "",
      scene_suggestion: "",
      why_it_works: "",
    },
    {
      type: "alert",
      spoken_hook: "",
      on_screen_text: "",
      scene_suggestion: "",
      why_it_works: "",
    },
  ],
  selected_hook: {
    type: "direct",
    spoken_hook: "",
    on_screen_text: "",
    scene_suggestion: "",
    why_it_works: "",
  },
  main_script: {
    duration_seconds: 30,
    scenes: [
      {
        start: 0,
        end: 3,
        function: "gancho",
        speech: "",
        on_screen_text: "",
        visual_direction: "",
      },
      {
        start: 3,
        end: 8,
        function: "contexto",
        speech: "",
        on_screen_text: "",
        visual_direction: "",
      },
    ],
  },
  short_version: {
    duration_seconds: 15,
    scenes: [
      {
        start: 0,
        end: 3,
        function: "gancho",
        speech: "",
        on_screen_text: "",
        visual_direction: "",
      },
    ],
    full_video_caption: "",
  },
  cover: {
    needs_cover: true,
    mode: "custom",
    title: "",
    subtitle: "",
    visual_prompt: "",
    safe_area_notes: "",
  },
  publication: {
    caption: "",
    cta: "",
    hashtags: ["#exemplo"],
  },
  production_notes: {
    lighting: "",
    scenario: "",
    pace: "",
    editing: "",
    accessibility: "",
  },
  quality_check: {
    has_0_3s_hook: true,
    has_clear_promise: true,
    has_video_caption: true,
    hashtags_limited_to_5: true,
    has_scene_functions: true,
    respects_brand_niche: true,
  },
};
