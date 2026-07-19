import { z } from "zod";
import { MAX_HASHTAGS, normalizeHashtags } from "@/lib/hashtags";

const MAX_RAW_SIZE = 300_000;

const sceneSchema = z.object({
  scene_number: z.number().int().positive(),
  scene_title: z.string().min(1).max(160),
  start_second: z.number().min(0),
  end_second: z.number().positive(),
  purpose: z.string().min(1).max(120),
  delivery_type: z.string().min(1).max(80),
  speech_or_narration: z.string().max(1200),
  on_screen_text: z.string().max(320),
  recording_direction: z.string().min(1).max(1200),
  framing: z.string().min(1).max(240),
  camera_movement: z.string().min(1).max(240),
  supporting_images: z.array(z.string().min(1).max(320)).max(12),
  transition: z.string().min(1).max(240),
  production_notes: z.string().max(800),
});

const shortSceneSchema = z.object({
  scene_number: z.number().int().positive(),
  start_second: z.number().min(0),
  end_second: z.number().positive(),
  speech_or_narration: z.string().max(900),
  on_screen_text: z.string().max(260),
  recording_direction: z.string().min(1).max(800),
});

const coverageSchema = z.object({
  point: z.string().min(1).max(320),
  covered: z.boolean(),
  scene_numbers: z.array(z.number().int().positive()).max(30),
  covered_in_caption: z.boolean(),
});

export const reelScriptSchema = z.object({
  schema_version: z.literal("reel_script_v1"),
  title: z.string().min(1).max(240),
  assumptions: z.array(z.string().min(1).max(320)).max(20),
  overview: z.object({
    central_concept: z.string().min(1).max(600),
    objective: z.string().min(1).max(240),
    target_audience: z.string().min(1).max(500),
    narrative_format: z.string().min(1).max(240),
    desired_reaction: z.string().min(1).max(300),
    duration_seconds: z.number().int().positive().max(180),
  }),
  hooks: z.object({
    primary: z.string().min(1).max(500),
    alternatives: z.array(z.string().min(1).max(500)).length(2),
  }),
  required_points: z.array(z.string().min(1).max(320)).max(20),
  scenes: z.array(sceneSchema).min(2).max(40),
  production: z.object({
    soundtrack_mood: z.string().min(1).max(400),
    editing_rhythm: z.string().min(1).max(400),
    general_transitions: z.array(z.string().min(1).max(240)).max(20),
    accessibility_notes: z.array(z.string().min(1).max(320)).max(20),
  }),
  closing: z.object({
    memorable_line: z.string().min(1).max(500),
    cta: z.string().min(1).max(320),
  }),
  publication: z.object({
    caption: z.string().min(1).max(4000),
    hashtags: z.array(z.string().min(1).max(80)).max(MAX_HASHTAGS),
  }),
  short_version: z.object({
    duration_seconds: z.number().int().positive().max(90),
    hook: z.string().min(1).max(500),
    scenes: z.array(shortSceneSchema).min(2).max(30),
    full_video_caption: z.string().max(5000).optional().default(""),
    closing: z.string().min(1).max(500),
    cta: z.string().min(1).max(320),
  }),
  coverage: z.array(coverageSchema).max(30),
  validation: z.object({
    hook_creates_curiosity: z.boolean(),
    has_beginning_middle_end: z.boolean(),
    all_required_points_covered: z.boolean(),
    cta_preserved: z.boolean(),
    caption_covers_full_campaign: z.boolean(),
    fits_duration: z.boolean(),
    recording_is_viable: z.boolean(),
    contains_no_offensive_language: z.boolean(),
    invented_information: z.boolean(),
    estimated_speech_seconds: z.number().min(0).max(300),
    warnings: z.array(z.string().min(1).max(500)).max(30),
  }),
});

export type ReelScript = z.infer<typeof reelScriptSchema>;
export type ReelScriptScene = ReelScript["scenes"][number];

export interface ReelScriptExpectations {
  durationSeconds?: number;
  requiredPoints?: string[];
  strategicCta?: string;
}

export interface ReelScriptValidationResult {
  ok: boolean;
  script?: ReelScript;
  errors: string[];
  warnings: string[];
  coveredPoints: string[];
  missingPoints: string[];
  durationCoverage: number;
  estimatedSpeechSeconds: number;
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

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pointKeywords(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((word) => word.length >= 4)
    .slice(0, 8);
}

function relatedPoint(a: string, b: string): boolean {
  const aKeywords = pointKeywords(a);
  const bNormalized = normalizeText(b);
  if (!aKeywords.length || !bNormalized) return false;
  return aKeywords.some((keyword) => bNormalized.includes(keyword));
}

function calculateSpeechSecondsFromScenes(
  scenes: Array<{ speech_or_narration: string }>,
  wordsPerMinute = 130,
): number {
  const words = scenes
    .map((scene) => scene.speech_or_narration.trim())
    .filter(Boolean)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.round((words / wordsPerMinute) * 60);
}

function zodIssueMessage(issue: z.ZodIssue): string {
  const path = issue.path.length ? issue.path.join(".") : "resposta";
  return `${path}: ${issue.message}`;
}

function normalizeForComparison(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function appendIfMissing(parts: string[], value: unknown): void {
  if (typeof value !== "string" || !value.trim()) return;
  const normalized = normalizeForComparison(value);
  const combined = normalizeForComparison(parts.join(" "));
  if (!normalized || combined.includes(normalized)) return;
  parts.push(value.trim());
}

function normalizeReelScriptInput(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const root = { ...(value as Record<string, unknown>) };

  const publication =
    root.publication && typeof root.publication === "object" && !Array.isArray(root.publication)
      ? { ...(root.publication as Record<string, unknown>) }
      : {};
  publication.hashtags = normalizeHashtags(publication.hashtags);
  root.publication = publication;

  const shortVersion =
    root.short_version &&
    typeof root.short_version === "object" &&
    !Array.isArray(root.short_version)
      ? { ...(root.short_version as Record<string, unknown>) }
      : null;
  if (shortVersion) {
    const existingCaption =
      typeof shortVersion.full_video_caption === "string"
        ? shortVersion.full_video_caption.trim()
        : "";
    if (!existingCaption) {
      const parts: string[] = [];
      const scenes = Array.isArray(shortVersion.scenes) ? shortVersion.scenes : [];
      for (const scene of scenes) {
        if (!scene || typeof scene !== "object" || Array.isArray(scene)) continue;
        appendIfMissing(parts, (scene as Record<string, unknown>).speech_or_narration);
      }
      appendIfMissing(parts, shortVersion.closing);
      appendIfMissing(parts, shortVersion.cta);
      shortVersion.full_video_caption = parts.join(" ").trim();
    }
    root.short_version = shortVersion;
  }

  return root;
}

export function parseAndValidateReelScript(
  raw: string,
  expectations: ReelScriptExpectations = {},
): ReelScriptValidationResult {
  const empty: ReelScriptValidationResult = {
    ok: false,
    errors: [],
    warnings: [],
    coveredPoints: [],
    missingPoints: [],
    durationCoverage: 0,
    estimatedSpeechSeconds: 0,
  };

  if (!raw.trim()) return { ...empty, errors: ["A resposta está vazia."] };
  if (raw.length > MAX_RAW_SIZE) {
    return { ...empty, errors: ["A resposta ultrapassa o limite de 300 KB."] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdownFence(raw));
  } catch (error) {
    return { ...empty, errors: [`JSON inválido: ${(error as Error).message}`] };
  }

  const originalHashtagCount =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? Array.isArray((parsed as Record<string, any>).publication?.hashtags)
        ? (parsed as Record<string, any>).publication.hashtags.length
        : 0
      : 0;
  const schemaResult = reelScriptSchema.safeParse(normalizeReelScriptInput(parsed));
  if (!schemaResult.success) {
    return {
      ...empty,
      errors: schemaResult.error.issues.map(zodIssueMessage),
    };
  }

  const script = schemaResult.data;
  const errors: string[] = [];
  const warnings = [...script.validation.warnings];
  if (originalHashtagCount > MAX_HASHTAGS) {
    warnings.push(`As hashtags foram limitadas às ${MAX_HASHTAGS} primeiras.`);
  }
  const scenes = [...script.scenes].sort((a, b) => a.start_second - b.start_second);

  scenes.forEach((scene, index) => {
    if (scene.end_second <= scene.start_second) {
      errors.push(`Cena ${scene.scene_number}: o tempo final deve ser maior que o inicial.`);
    }
    if (!scene.speech_or_narration.trim() && !scene.on_screen_text.trim()) {
      errors.push(`Cena ${scene.scene_number}: informe fala, narração ou texto na tela.`);
    }
    if (index === 0 && scene.start_second > 0.5) {
      warnings.push(
        `O roteiro começa em ${scene.start_second}s; revise o início da linha do tempo.`,
      );
    }
    if (index > 0) {
      const previous = scenes[index - 1];
      if (scene.start_second < previous.end_second) {
        errors.push(
          `As cenas ${previous.scene_number} e ${scene.scene_number} possuem tempos sobrepostos.`,
        );
      } else if (scene.start_second - previous.end_second > 1) {
        warnings.push(
          `Existe uma lacuna de ${Math.round((scene.start_second - previous.end_second) * 10) / 10}s entre as cenas ${previous.scene_number} e ${scene.scene_number}.`,
        );
      }
    }
  });

  const actualEnd = Math.max(...scenes.map((scene) => scene.end_second), 0);
  const targetDuration = expectations.durationSeconds || script.overview.duration_seconds;
  const durationCoverage = targetDuration > 0 ? Math.round((actualEnd / targetDuration) * 100) : 0;

  if (actualEnd > targetDuration + 1) {
    errors.push(
      `A linha do tempo termina em ${actualEnd}s, acima da duração prevista de ${targetDuration}s.`,
    );
  } else if (actualEnd < targetDuration - 3) {
    warnings.push(
      `A linha do tempo termina em ${actualEnd}s, abaixo da duração prevista de ${targetDuration}s.`,
    );
  }

  if (
    expectations.durationSeconds &&
    script.overview.duration_seconds !== expectations.durationSeconds
  ) {
    warnings.push(
      `O JSON informa ${script.overview.duration_seconds}s, enquanto o pedido original previa ${expectations.durationSeconds}s.`,
    );
  }

  const estimatedSpeechSeconds = calculateSpeechSecondsFromScenes(scenes);
  if (estimatedSpeechSeconds > targetDuration + 3) {
    warnings.push(
      `A fala foi estimada em aproximadamente ${estimatedSpeechSeconds}s para um Reel de ${targetDuration}s.`,
    );
  }

  const expectedCta = expectations.strategicCta?.trim();
  if (expectedCta && script.closing.cta.trim() !== expectedCta) {
    errors.push(
      `O CTA foi alterado. Esperado: “${expectedCta}”. Recebido: “${script.closing.cta.trim()}”.`,
    );
  }
  if (expectedCta && script.short_version.cta.trim() !== expectedCta) {
    errors.push("A versão curta não preservou exatamente o CTA estratégico.");
  }

  const expectedPoints = (expectations.requiredPoints ?? []).filter(Boolean);
  const coveredPoints: string[] = [];
  const missingPoints: string[] = [];
  const sceneText = scenes
    .map((scene) => `${scene.scene_title} ${scene.speech_or_narration} ${scene.on_screen_text}`)
    .join(" ");

  expectedPoints.forEach((point) => {
    const coverage = script.coverage.find((entry) => relatedPoint(point, entry.point));
    const coveredInScenes = coverage?.covered === true && coverage.scene_numbers.length > 0;
    const coveredInCaption = coverage?.covered_in_caption === true;
    const fallbackSceneMatch = relatedPoint(point, sceneText);
    const fallbackCaptionMatch = relatedPoint(point, script.publication.caption);

    if ((coveredInScenes || fallbackSceneMatch) && (coveredInCaption || fallbackCaptionMatch)) {
      coveredPoints.push(point);
    } else {
      missingPoints.push(point);
    }
  });

  if (missingPoints.length) {
    errors.push(
      `Pontos obrigatórios não contemplados no roteiro e na legenda: ${missingPoints.join("; ")}.`,
    );
  }

  if (!script.validation.all_required_points_covered) {
    errors.push("O próprio JSON informa que nem todos os pontos obrigatórios foram contemplados.");
  }
  if (!script.validation.cta_preserved) {
    errors.push("O próprio JSON informa que o CTA estratégico não foi preservado.");
  }
  if (!script.validation.caption_covers_full_campaign) {
    errors.push("O próprio JSON informa que a legenda não representa a campanha completa.");
  }
  if (!script.validation.fits_duration) {
    warnings.push("O próprio JSON alerta que o roteiro pode não caber na duração solicitada.");
  }
  if (!script.validation.recording_is_viable) {
    warnings.push(
      "O próprio JSON alerta que a gravação pode não ser viável com os recursos informados.",
    );
  }
  if (script.validation.invented_information) {
    errors.push("O próprio JSON informa que existem informações inventadas.");
  }

  return {
    ok: errors.length === 0,
    script,
    errors,
    warnings: Array.from(new Set(warnings)),
    coveredPoints,
    missingPoints,
    durationCoverage,
    estimatedSpeechSeconds,
  };
}

export function getStoredReelScript(value: unknown): ReelScript | null {
  const result = reelScriptSchema.safeParse(normalizeReelScriptInput(value));
  return result.success ? result.data : null;
}

export function reelScriptToPlainText(script: ReelScript): string {
  const lines: string[] = [];
  lines.push(`# ${script.title}`);
  lines.push(`Duração: ${script.overview.duration_seconds}s`);
  lines.push(`Objetivo: ${script.overview.objective}`);
  lines.push(`Público: ${script.overview.target_audience}`);
  lines.push(`Formato narrativo: ${script.overview.narrative_format}`);
  lines.push("");
  lines.push(`Conceito central: ${script.overview.central_concept}`);
  lines.push(`Reação desejada: ${script.overview.desired_reaction}`);
  lines.push("");
  lines.push(`Gancho principal: ${script.hooks.primary}`);
  script.hooks.alternatives.forEach((hook, index) =>
    lines.push(`Gancho alternativo ${index + 1}: ${hook}`),
  );
  lines.push("");

  script.scenes.forEach((scene) => {
    lines.push(
      `## Cena ${scene.scene_number} — ${scene.scene_title} (${scene.start_second}-${scene.end_second}s)`,
    );
    lines.push(`Função: ${scene.purpose}`);
    lines.push(`Fala/Narração: ${scene.speech_or_narration || "—"}`);
    lines.push(`Texto na tela: ${scene.on_screen_text || "—"}`);
    lines.push(`Gravação: ${scene.recording_direction}`);
    lines.push(`Enquadramento: ${scene.framing}`);
    lines.push(`Movimento: ${scene.camera_movement}`);
    if (scene.supporting_images.length)
      lines.push(`Imagens de apoio: ${scene.supporting_images.join("; ")}`);
    lines.push(`Transição: ${scene.transition}`);
    if (scene.production_notes) lines.push(`Observações: ${scene.production_notes}`);
    lines.push("");
  });

  lines.push("# Produção");
  lines.push(`Trilha: ${script.production.soundtrack_mood}`);
  lines.push(`Ritmo: ${script.production.editing_rhythm}`);
  if (script.production.general_transitions.length) {
    lines.push(`Transições gerais: ${script.production.general_transitions.join("; ")}`);
  }
  if (script.production.accessibility_notes.length) {
    lines.push(`Acessibilidade: ${script.production.accessibility_notes.join("; ")}`);
  }
  lines.push("");
  lines.push(`# Fechamento`);
  lines.push(script.closing.memorable_line);
  lines.push(`CTA: ${script.closing.cta}`);
  lines.push("");
  lines.push("# Legenda");
  lines.push(script.publication.caption);
  if (script.publication.hashtags.length) lines.push(script.publication.hashtags.join(" "));
  lines.push("");
  lines.push(`# Versão curta (${script.short_version.duration_seconds}s)`);
  lines.push(`Gancho: ${script.short_version.hook}`);
  script.short_version.scenes.forEach((scene) => {
    lines.push(
      `${scene.start_second}-${scene.end_second}s — ${scene.speech_or_narration} | Tela: ${scene.on_screen_text} | ${scene.recording_direction}`,
    );
  });
  lines.push(`Legenda completa para o vídeo: ${script.short_version.full_video_caption}`);
  lines.push(`Fechamento: ${script.short_version.closing}`);
  lines.push(`CTA: ${script.short_version.cta}`);
  return lines.join("\n");
}
