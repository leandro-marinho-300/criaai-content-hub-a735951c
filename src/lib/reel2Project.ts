import type { Tables } from "@/integrations/supabase/types";
import { normalizeHashtags } from "@/lib/hashtags";
import { reel2ImportedScriptSchema, type Reel2ImportedScript } from "@/lib/reel2Script";
import type { ReelScript } from "@/lib/reelScript";

export interface Reel2ProjectData {
  source: "reel_2_0";
  script: Reel2ImportedScript;
  created_at?: string;
  storyboard_prompt?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function getReel2ProjectData(value: unknown): Reel2ProjectData | null {
  const root = asRecord(value);
  if (!root) return null;
  const source = root.source === "reel_2_0" || root.reel2 ? "reel_2_0" : "reel_2_0";
  const maybeScript = root.reel2 ?? root.script ?? root.reel_2_0;
  const parsed = reel2ImportedScriptSchema.safeParse(maybeScript);
  if (!parsed.success) return null;
  return {
    source,
    script: parsed.data,
    created_at: typeof root.created_at === "string" ? root.created_at : undefined,
    storyboard_prompt: typeof root.reel2_storyboard_prompt === "string" ? root.reel2_storyboard_prompt : undefined,
  };
}

export function getReel2ScriptFromProject(project: Pick<Tables<"content_projects">, "campaign_content_json"> | null | undefined): Reel2ImportedScript | null {
  return getReel2ProjectData(project?.campaign_content_json)?.script ?? null;
}

export function reel2CoverModeLabel(script: Reel2ImportedScript): string {
  const mode = String(script.cover.mode || "unsure").toLowerCase();
  if (script.cover.needs_cover || mode === "custom") return "Capa personalizada";
  if (mode === "frame") return "Frame do vídeo";
  if (mode === "none") return "Não precisa de capa personalizada";
  return "Ainda não definido";
}

export function reel2CoverInstruction(script: Reel2ImportedScript): string {
  const mode = String(script.cover.mode || "unsure").toLowerCase();
  if (script.cover.needs_cover || mode === "custom") {
    return [
      script.cover.title ? `Título: ${script.cover.title}` : "Título ainda não definido.",
      script.cover.subtitle ? `Subtítulo: ${script.cover.subtitle}` : "",
      script.cover.safe_area_notes ? `Área segura: ${script.cover.safe_area_notes}` : "",
      script.cover.visual_prompt ? `Prompt visual: ${script.cover.visual_prompt}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (mode === "frame") {
    return [
      "Usar um frame do próprio vídeo como capa, sem criar arte independente.",
      script.cover.title ? `Título sugerido para apoiar a escolha do frame: ${script.cover.title}` : "",
      script.cover.subtitle ? `Subtítulo sugerido: ${script.cover.subtitle}` : "",
      script.cover.safe_area_notes ? `Critério de corte/área segura: ${script.cover.safe_area_notes}` : "Escolher frame com rosto/ação clara e texto dentro da área segura.",
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (mode === "none") return "Este Reel não exige capa personalizada. Validar apenas se o frame de publicação está coerente.";
  return "Decisão de capa em aberto. Validar antes da produção final.";
}

function padAlternatives(script: Reel2ImportedScript): [string, string] {
  const selected = script.selected_hook.spoken_hook.trim();
  const alternatives = script.hook_options
    .map((hook) => hook.spoken_hook.trim())
    .filter((hook) => hook && hook !== selected)
    .slice(0, 2);
  while (alternatives.length < 2) alternatives.push(selected || "Gancho alternativo a definir.");
  return [alternatives[0], alternatives[1]];
}

function sceneTitle(value: string, index: number): string {
  const clean = value.trim();
  if (!clean) return index === 0 ? "Gancho" : `Cena ${index + 1}`;
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function reel2ToLegacyReelScript(script: Reel2ImportedScript, brand?: Tables<"brands"> | null): ReelScript {
  const [alt1, alt2] = padAlternatives(script);
  const normalizedHashtags = normalizeHashtags(script.publication.hashtags);
  const mainScenes = script.main_script.scenes.map((scene, index) => ({
    scene_number: index + 1,
    scene_title: sceneTitle(scene.function, index),
    start_second: scene.start,
    end_second: scene.end,
    purpose: scene.function,
    delivery_type: index === 0 ? "gancho falado + texto na tela" : "fala/narração com apoio visual",
    speech_or_narration: scene.speech,
    on_screen_text: scene.on_screen_text,
    recording_direction: scene.visual_direction,
    framing: index === 0 ? "Plano próximo ou médio, com rosto/ação clara nos primeiros segundos." : "Enquadramento coerente com a cena e leitura do texto.",
    camera_movement: "Cortes dinâmicos e limpos, sem comprometer a leitura.",
    supporting_images: [] as string[],
    transition: "Corte seco ou transição discreta sincronizada com a fala.",
    production_notes: "Convertido do Reel 2.0 para compatibilidade com storyboard e aprovação.",
  }));
  const shortScenes = script.short_version.scenes.map((scene, index) => ({
    scene_number: index + 1,
    start_second: scene.start,
    end_second: scene.end,
    speech_or_narration: scene.speech,
    on_screen_text: scene.on_screen_text,
    recording_direction: scene.visual_direction,
  }));
  const cta = script.publication.cta || script.short_version.scenes.at(-1)?.speech || "CTA a definir.";
  const closingLine = script.main_script.scenes.at(-1)?.speech || cta;
  return {
    schema_version: "reel_script_v1",
    title: script.central_idea,
    assumptions: [
      "Roteiro criado no fluxo Criar Reel 2.0.",
      "A estrutura foi convertida para o schema legado para manter storyboard, upload visual e aprovação funcionando.",
    ],
    overview: {
      central_concept: script.promise,
      objective: script.objective,
      target_audience: brand?.audience || "Público da marca",
      narrative_format: script.reel_type,
      desired_reaction: script.publication.cta || "Assistir até o fim e executar o CTA.",
      duration_seconds: script.main_script.duration_seconds,
    },
    hooks: {
      primary: script.selected_hook.spoken_hook,
      alternatives: [alt1, alt2],
    },
    required_points: [
      script.promise,
      ...script.main_script.scenes.map((scene) => `${scene.function}: ${scene.on_screen_text || scene.speech}`).slice(0, 6),
    ].filter(Boolean).slice(0, 10),
    scenes: mainScenes,
    production: {
      soundtrack_mood: script.production_notes.pace || "Trilha discreta e dinâmica, sem competir com a fala.",
      editing_rhythm: script.production_notes.editing || script.production_notes.pace || "Cortes ágeis, especialmente nos primeiros segundos.",
      general_transitions: ["Cortes limpos entre cenas", "Manter textos com alto contraste"],
      accessibility_notes: [
        script.production_notes.accessibility || "Usar legendas sincronizadas, fonte grande e alto contraste.",
        "Não depender apenas de cor para comunicar a sequência.",
      ],
    },
    closing: {
      memorable_line: closingLine,
      cta,
    },
    publication: {
      caption: script.publication.caption,
      hashtags: normalizedHashtags,
    },
    short_version: {
      duration_seconds: script.short_version.duration_seconds,
      hook: script.short_version.scenes[0]?.speech || script.selected_hook.spoken_hook,
      scenes: shortScenes,
      full_video_caption: script.short_version.full_video_caption,
      closing: script.short_version.scenes.at(-1)?.speech || closingLine,
      cta,
    },
    coverage: [],
    validation: {
      hook_creates_curiosity: script.quality_check.has_0_3s_hook,
      has_beginning_middle_end: script.quality_check.has_scene_functions,
      all_required_points_covered: true,
      cta_preserved: Boolean(cta),
      caption_covers_full_campaign: Boolean(script.publication.caption),
      fits_duration: true,
      recording_is_viable: true,
      contains_no_offensive_language: true,
      invented_information: false,
      estimated_speech_seconds: script.main_script.duration_seconds,
      warnings: script.quality_check.respects_brand_niche ? [] : ["O JSON não confirmou coerência com a marca/nicho. Revisar antes de aprovar."],
    },
  };
}

export function reel2ScriptToApprovalSummary(script: Reel2ImportedScript) {
  return {
    centralIdea: script.central_idea,
    objective: script.objective,
    reelType: script.reel_type,
    promise: script.promise,
    selectedHook: script.selected_hook.spoken_hook,
    selectedHookText: script.selected_hook.on_screen_text,
    coverMode: reel2CoverModeLabel(script),
    coverTitle: script.cover.title,
    coverSubtitle: script.cover.subtitle,
    coverInstruction: reel2CoverInstruction(script),
    publicationCaption: script.publication.caption,
    cta: script.publication.cta,
    hashtags: normalizeHashtags(script.publication.hashtags),
    videoCaption: script.short_version.full_video_caption,
    mainScenes: script.main_script.scenes.map((scene, index) => ({
      index: index + 1,
      time: `${scene.start}-${scene.end}s`,
      function: scene.function,
      speech: scene.speech,
      onScreenText: scene.on_screen_text,
      visualDirection: scene.visual_direction,
    })),
    shortScenes: script.short_version.scenes.map((scene, index) => ({
      index: index + 1,
      time: `${scene.start}-${scene.end}s`,
      function: scene.function,
      speech: scene.speech,
      onScreenText: scene.on_screen_text,
      visualDirection: scene.visual_direction,
    })),
  };
}
