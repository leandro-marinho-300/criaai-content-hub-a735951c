import type { Tables } from "@/integrations/supabase/types";
import type { Reel2ImportedScript } from "@/lib/reel2Script";

export type Reel2ProductionStatus =
  | "script_ready"
  | "storyboard_ready"
  | "approved"
  | "recording"
  | "editing"
  | "final_video_attached"
  | "ready_to_publish";

export interface Reel2ProductionMeta {
  status: Reel2ProductionStatus;
  recording_checked: string[];
  review_checked: string[];
  updated_at?: string | null;
}

export const REEL2_PRODUCTION_STATUS_LABEL: Record<Reel2ProductionStatus, string> = {
  script_ready: "Roteiro criado",
  storyboard_ready: "Storyboard criado",
  approved: "Aprovado",
  recording: "Gravação",
  editing: "Edição",
  final_video_attached: "Vídeo final anexado",
  ready_to_publish: "Pronto para publicar",
};

export const REEL2_PRODUCTION_FLOW: Reel2ProductionStatus[] = [
  "script_ready",
  "storyboard_ready",
  "approved",
  "recording",
  "editing",
  "final_video_attached",
  "ready_to_publish",
];

const DEFAULT_META: Reel2ProductionMeta = {
  status: "script_ready",
  recording_checked: [],
  review_checked: [],
  updated_at: null,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function getReel2ProductionMeta(value: unknown): Reel2ProductionMeta {
  const root = asRecord(value);
  const meta = asRecord(root?.reel2_production_meta);
  if (!meta) return DEFAULT_META;
  const status = REEL2_PRODUCTION_FLOW.includes(meta.status as Reel2ProductionStatus)
    ? (meta.status as Reel2ProductionStatus)
    : "script_ready";
  return {
    status,
    recording_checked: asStringArray(meta.recording_checked),
    review_checked: asStringArray(meta.review_checked),
    updated_at: typeof meta.updated_at === "string" ? meta.updated_at : null,
  };
}

export function attachReel2ProductionMeta<T>(value: T, meta: Reel2ProductionMeta): T & { reel2_production_meta: Reel2ProductionMeta } {
  const root = asRecord(value) ?? {};
  return {
    ...(root as object),
    reel2_production_meta: {
      status: meta.status,
      recording_checked: meta.recording_checked,
      review_checked: meta.review_checked,
      updated_at: new Date().toISOString(),
    },
  } as T & { reel2_production_meta: Reel2ProductionMeta };
}

export function buildReel2RecordingChecklist(script: Reel2ImportedScript): Array<{ id: string; label: string; helper?: string }> {
  const scenes = script.main_script.scenes.map((scene, index) => ({
    id: `scene-${index + 1}`,
    label: `Gravar cena ${index + 1}: ${scene.function || "sem função definida"}`,
    helper: `${scene.start}-${scene.end}s · ${scene.visual_direction || scene.speech}`,
  }));

  return [
    { id: "scenario", label: "Separar cenário", helper: script.production_notes.scenario || "Ambiente coerente com a marca e sem distrações." },
    { id: "lighting", label: "Conferir iluminação", helper: script.production_notes.lighting || "Rosto/objeto principal bem iluminado e texto legível." },
    { id: "audio", label: "Conferir áudio", helper: "Gravar em local silencioso ou usar microfone externo quando possível." },
    { id: "hook", label: "Gravar o gancho primeiro", helper: script.selected_hook.spoken_hook },
    ...scenes,
    { id: "support", label: "Separar cenas/imagens de apoio", helper: "B-roll, detalhes, prints autorizados ou imagens de apoio citadas no roteiro." },
    { id: "cta", label: "Gravar CTA final", helper: script.publication.cta || "CTA a definir." },
    { id: "brand-assets", label: "Separar logo e identidade visual", helper: "Logo oficial, cores, fontes e elementos da marca." },
  ];
}

export function buildReel2ReviewChecklist(script: Reel2ImportedScript): Array<{ id: string; label: string; helper?: string }> {
  return [
    { id: "hook", label: "O vídeo começa com o gancho aprovado?", helper: script.selected_hook.spoken_hook },
    { id: "promise", label: "A promessa foi entregue no vídeo?", helper: script.promise },
    { id: "captions", label: "A legenda do vídeo está completa e sincronizada?", helper: script.short_version.full_video_caption },
    { id: "screen-text", label: "Os textos na tela estão curtos e legíveis?" },
    { id: "cta", label: "O CTA aparece no final?", helper: script.publication.cta },
    { id: "cover", label: "A capa ou frame está legível?", helper: script.cover.title || script.cover.mode },
    { id: "caption", label: "A legenda da publicação está pronta?" },
    { id: "hashtags", label: "As hashtags estão dentro do limite de 5?", helper: script.publication.hashtags.join(" ") },
    { id: "approved-script", label: "O vídeo respeita o roteiro aprovado?" },
  ];
}

export function buildReel2EditorKit(script: Reel2ImportedScript, brand?: Tables<"brands"> | null): string {
  const sceneLines = script.main_script.scenes
    .map(
      (scene, index) =>
        `CENA ${index + 1} — ${scene.start}-${scene.end}s\nFunção: ${scene.function}\nFala/Narração: ${scene.speech}\nTexto na tela: ${scene.on_screen_text}\nImagem/Ação: ${scene.visual_direction}`,
    )
    .join("\n\n");

  const shortLines = script.short_version.scenes
    .map(
      (scene, index) =>
        `CENA ${index + 1} — ${scene.start}-${scene.end}s\nFunção: ${scene.function}\nFala/Narração: ${scene.speech}\nTexto na tela: ${scene.on_screen_text}\nImagem/Ação: ${scene.visual_direction}`,
    )
    .join("\n\n");

  const coverText = script.cover.mode === "frame" && !script.cover.needs_cover
    ? [
        "Modo: usar frame do próprio vídeo",
        `Frame sugerido: ${script.selected_hook.scene_suggestion || "escolher frame com rosto/ação clara"}`,
        script.cover.title ? `Título de apoio: ${script.cover.title}` : "",
        script.cover.safe_area_notes ? `Área segura: ${script.cover.safe_area_notes}` : "Manter texto/rosto dentro da área segura.",
      ].filter(Boolean).join("\n")
    : [
        `Modo: ${script.cover.needs_cover || script.cover.mode === "custom" ? "capa personalizada" : script.cover.mode}`,
        script.cover.title ? `Título: ${script.cover.title}` : "",
        script.cover.subtitle ? `Subtítulo: ${script.cover.subtitle}` : "",
        script.cover.visual_prompt ? `Prompt visual: ${script.cover.visual_prompt}` : "",
        script.cover.safe_area_notes ? `Área segura: ${script.cover.safe_area_notes}` : "",
      ].filter(Boolean).join("\n");

  return [
    "KIT DO EDITOR — REEL 2.0",
    "",
    `Marca: ${brand?.name || script.brand || "—"}`,
    `Ideia central: ${script.central_idea}`,
    `Objetivo: ${script.objective}`,
    `Tipo de Reel: ${script.reel_type}`,
    `Promessa: ${script.promise}`,
    "",
    "GANCHO APROVADO",
    `Fala inicial: ${script.selected_hook.spoken_hook}`,
    `Texto na tela: ${script.selected_hook.on_screen_text}`,
    `Cena sugerida: ${script.selected_hook.scene_suggestion}`,
    "",
    "ROTEIRO PRINCIPAL",
    sceneLines,
    "",
    "VERSÃO REDUZIDA",
    `Duração: ${script.short_version.duration_seconds}s`,
    shortLines,
    "",
    "LEGENDA COMPLETA PARA INSERIR NO VÍDEO",
    script.short_version.full_video_caption,
    "",
    "TEXTOS NA TELA POR CENA",
    script.main_script.scenes.map((scene, index) => `${index + 1}. ${scene.on_screen_text}`).join("\n"),
    "",
    "CAPA / FRAME",
    coverText,
    "",
    "PUBLICAÇÃO",
    script.publication.caption,
    "",
    `CTA: ${script.publication.cta}`,
    `Hashtags: ${script.publication.hashtags.join(" ")}`,
    "",
    "NOTAS DE EDIÇÃO",
    `Ritmo: ${script.production_notes.pace || "Cortes dinâmicos e limpos."}`,
    `Edição: ${script.production_notes.editing || "Sincronizar cortes com a fala e preservar leitura."}`,
    `Acessibilidade: ${script.production_notes.accessibility || "Legendas sincronizadas, fonte grande e alto contraste."}`,
  ].join("\n").trim();
}
