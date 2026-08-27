/**
 * Canonical V2 creative taxonomy.
 *
 * This module is intentionally independent from the legacy wizards. V1/Reel2/Post2
 * may continue using their existing taxonomies until each studio receives a V2 adapter.
 *
 * Core flow: Objective -> Approach -> Format -> Concept.
 * "Campaign" is not a format. Editorial type is an execution attribute, not a core decision.
 */

export const CREATION_TAXONOMY_VERSION = "1.0" as const;

export const CREATION_OBJECTIVES = [
  {
    id: "engage",
    label: "Engajar",
    description: "Gerar identificação, conversa, relacionamento ou reconhecimento.",
  },
  {
    id: "convert",
    label: "Converter",
    description: "Levar a uma ação comercial, contato ou decisão.",
  },
  {
    id: "inform_position",
    label: "Informar & Posicionar",
    description: "Explicar, orientar, alertar ou fortalecer posicionamento e autoridade.",
  },
] as const;

export type CreationObjective = (typeof CREATION_OBJECTIVES)[number]["id"];

export const CREATION_APPROACHES = [
  {
    id: "viral",
    label: "Viral",
    description: "Usa tensão, curiosidade, contraste ou comportamento de consumo rápido.",
  },
  {
    id: "educational",
    label: "Educativo",
    description: "Ensina, explica, orienta ou organiza uma decisão.",
  },
  {
    id: "community",
    label: "Comunidade",
    description: "Aproxima a marca de pessoas, rotina, causa ou relacionamento.",
  },
  {
    id: "offer",
    label: "Oferta",
    description: "Apresenta valor, benefício ou oportunidade com intenção comercial.",
  },
  {
    id: "storytelling",
    label: "Storytelling",
    description: "Desenvolve a mensagem por situação, conflito, processo ou transformação.",
  },
  {
    id: "social_proof",
    label: "Prova Social",
    description: "Usa evidência real, experiência, resultado ou validação externa.",
  },
] as const;

export type CreationApproach = (typeof CREATION_APPROACHES)[number]["id"];

export type CreationFormatFamily = "static" | "video" | "ephemeral" | "utility";

export const CREATION_FORMATS = [
  { id: "post", label: "Post", family: "static" },
  { id: "carousel", label: "Carrossel", family: "static" },
  { id: "reel", label: "Reel", family: "video" },
  { id: "story", label: "Story", family: "ephemeral" },
  { id: "story_sequence", label: "Sequência de Stories", family: "ephemeral" },
  { id: "whatsapp_status", label: "Status do WhatsApp", family: "ephemeral" },
  { id: "banner", label: "Banner", family: "utility" },
  { id: "announcement", label: "Comunicado", family: "utility" },
  { id: "group_text", label: "Texto para grupo", family: "utility" },
  { id: "print", label: "Material impresso", family: "utility" },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  family: CreationFormatFamily;
}>;

export type CreationFormat = (typeof CREATION_FORMATS)[number]["id"];

export type CreationStrategyTaxonomy = {
  objective: CreationObjective | null;
  approach: CreationApproach | null;
  format: CreationFormat | null;
  concept: string | null;
};

const OBJECTIVE_IDS = new Set<string>(CREATION_OBJECTIVES.map((item) => item.id));
const APPROACH_IDS = new Set<string>(CREATION_APPROACHES.map((item) => item.id));
const FORMAT_IDS = new Set<string>(CREATION_FORMATS.map((item) => item.id));

export function isCreationObjective(value: unknown): value is CreationObjective {
  return typeof value === "string" && OBJECTIVE_IDS.has(value);
}

export function isCreationApproach(value: unknown): value is CreationApproach {
  return typeof value === "string" && APPROACH_IDS.has(value);
}

export function isCreationFormat(value: unknown): value is CreationFormat {
  return typeof value === "string" && FORMAT_IDS.has(value);
}

export function normalizeCreationObjective(
  value: string | null | undefined,
): CreationObjective | null {
  return isCreationObjective(value) ? value : null;
}

export function normalizeCreationApproach(
  value: string | null | undefined,
): CreationApproach | null {
  return isCreationApproach(value) ? value : null;
}

export function normalizeCreationFormat(
  value: string | null | undefined,
): CreationFormat | null {
  return isCreationFormat(value) ? value : null;
}

export function normalizeCreationConcept(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

/**
 * Compatibility helpers only.
 *
 * They do not mutate V1 data and are not automatically applied by the current
 * studios. They exist so future V2 adapters can translate known legacy values
 * without duplicating mapping rules.
 */
export function mapLegacyObjectiveToCanonical(
  value: string | null | undefined,
): CreationObjective | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (isCreationObjective(normalized)) return normalized;

  switch (normalized) {
    case "relacionamento":
    case "aumentar_reconhecimento":
    case "inspirar":
    case "identificacao":
    case "identify":
    case "comentarios":
    case "bastidor":
    case "bastidores":
      return "engage";

    case "vender":
    case "sell":
    case "vender_leve":
    case "gerar_contato":
    case "gerar_contatos":
    case "contact":
    case "divulgar_servico":
    case "divulgar_produto":
    case "promote":
      return "convert";

    case "informar":
    case "inform":
    case "educar":
    case "educate":
    case "alertar":
    case "autoridade":
    case "comunicado":
      return "inform_position";

    // Legacy values that are context or too ambiguous to infer safely.
    case "campanha":
    case "data_comemorativa":
    case "outro":
    case "qualquer":
      return null;

    default:
      return null;
  }
}

export function mapLegacyApproachToCanonical(
  value: string | null | undefined,
): CreationApproach | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (isCreationApproach(normalized)) return normalized;

  switch (normalized) {
    case "trend_adaptada":
    case "remix_referencia":
    case "react":
    case "curiosidade":
      return "viral";

    case "educativo":
    case "alerta":
    case "passo_a_passo":
    case "orientacao_pratica":
    case "erro_comum":
    case "checklist":
    case "comparacao":
    case "mito_verdade":
    case "lista":
    case "antes_de_contratar":
    case "duvida":
      return "educational";

    case "comunidade":
    case "prestacao_contas":
      return "community";

    case "beneficio":
    case "apresentacao_comercial":
    case "comercial_leve":
      return "offer";

    case "storytelling":
    case "bastidores":
    case "bastidor":
    case "historia_marca":
      return "storytelling";

    case "prova_social":
      return "social_proof";

    case "auto":
      return null;

    default:
      return null;
  }
}

export function mapLegacyFormatToCanonical(
  value: string | null | undefined,
): CreationFormat | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (isCreationFormat(normalized)) return normalized;

  switch (normalized) {
    case "carrossel":
      return "carousel";
    case "sequencia_stories":
      return "story_sequence";
    case "status_whatsapp":
      return "whatsapp_status";
    case "comunicado":
      return "announcement";
    case "texto_grupo":
      return "group_text";
    case "impresso":
      return "print";

    // A cover is a Reel-specific extension, not a separate canonical format.
    case "capa_reel":
      return "reel";

    case "outro":
    case "auto":
      return null;

    default:
      return null;
  }
}

export function getCreationFormatFamily(
  format: CreationFormat,
): CreationFormatFamily {
  return CREATION_FORMATS.find((item) => item.id === format)?.family ?? "utility";
}
