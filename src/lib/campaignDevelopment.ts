// Tipos e helpers para a etapa "Desenvolver conteúdo com ChatGPT".
// Não faz chamadas a IA — só estrutura dados e prioridades de fontes.

export type DevelopmentStatus =
  | "draft_auto"
  | "awaiting_development"
  | "imported"
  | "manually_reviewed"
  | "approved";

export type ContentSource = "auto" | "manual" | "external_chatgpt";

export type CommercialIntensity = "none" | "light" | "moderate" | "direct";

export interface CampaignFields {
  angle?: string;
  central_message?: string;
  main_promise?: string;
  main_pain?: string;
  main_benefit?: string;
  audience_desires?: string[];
  key_points?: string[];
  selected_differentiators?: string[];
  terms_to_avoid?: string[];
  commercial_intensity?: CommercialIntensity;
  cta_strategy?: string;
  main_cta?: string;
  narrative_structure?: string;
  visual_focus?: string;
}

export interface ImportedPiece {
  id?: string;
  format?: string;
  role?: string;
  objective?: string;
  angle?: string;
  headline?: string;
  support_text?: string;
  bullets?: string[];
  cta?: string;
  visual_focus?: string;
  continuity_note?: string;
  warnings?: string[];
}

export interface ImportedCampaignContent {
  campaign?: CampaignFields;
  pieces?: ImportedPiece[];
  caption?: { text?: string; hashtags?: string[] };
  warnings?: string[];
  /** Marcador de origem para auditoria interna. */
  source?: ContentSource;
  imported_at?: string;
}

export const STATUS_LABELS: Record<DevelopmentStatus, string> = {
  draft_auto: "Rascunho automático",
  awaiting_development: "Aguardando desenvolvimento",
  imported: "Conteúdo importado",
  manually_reviewed: "Revisado manualmente",
  approved: "Aprovado",
};

export const SOURCE_LABELS: Record<ContentSource, string> = {
  auto: "Gerador automático",
  manual: "Edição manual",
  external_chatgpt: "ChatGPT externo",
};

/** Remove caracteres perigosos / HTML / scripts de uma string vinda de fora. */
export function sanitizeString(input: unknown, maxLen = 2000): string {
  if (typeof input !== "string") return "";
  // remove HTML tags simples e caracteres de controle
  const noHtml = input.replace(/<[^>]*>/g, " ");
  const noCtrl = noHtml.replace(/[\u0000-\u001f\u007f]/g, " ");
  return noCtrl.replace(/\s+/g, " ").trim().slice(0, maxLen);
}

export function sanitizeStringArray(input: unknown, maxItems = 30, maxLen = 400): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((v) => sanitizeString(v, maxLen))
    .filter((s) => s.length > 0)
    .slice(0, maxItems);
}

/** Merge prioritário: importado > manual > inicial. Mantém arrays únicos. */
export function mergeCampaignFields(
  base: CampaignFields | undefined,
  override: CampaignFields | undefined,
): CampaignFields {
  const a = base ?? {};
  const b = override ?? {};
  const pick = <K extends keyof CampaignFields>(k: K): CampaignFields[K] =>
    (b[k] != null && b[k] !== "" ? b[k] : a[k]) as CampaignFields[K];
  return {
    angle: pick("angle"),
    central_message: pick("central_message"),
    main_promise: pick("main_promise"),
    main_pain: pick("main_pain"),
    main_benefit: pick("main_benefit"),
    audience_desires: (b.audience_desires?.length ? b.audience_desires : a.audience_desires) ?? [],
    key_points: (b.key_points?.length ? b.key_points : a.key_points) ?? [],
    selected_differentiators:
      (b.selected_differentiators?.length ? b.selected_differentiators : a.selected_differentiators) ?? [],
    terms_to_avoid: Array.from(
      new Set([...(a.terms_to_avoid ?? []), ...(b.terms_to_avoid ?? [])]),
    ),
    commercial_intensity: pick("commercial_intensity"),
    cta_strategy: pick("cta_strategy"),
    main_cta: pick("main_cta"),
    narrative_structure: pick("narrative_structure"),
    visual_focus: pick("visual_focus"),
  };
}
