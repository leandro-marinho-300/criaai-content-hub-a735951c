import type { Json } from "@/integrations/supabase/types";
import type { CopyState, CopyVersion } from "@/lib/creation/copy";
import type { DesignState, DesignVersion } from "@/lib/creation/design";
import type { ApprovedStrategyContext } from "@/lib/creation/strategy-approval";

/**
 * Canonical production prompt derived from already-approved creative inputs.
 * This is intentionally NOT an AI Task Run: it is the deterministic handoff
 * from approved Design Spec to an external production tool/operator.
 */
export const RENDER_PROMPT_VERSION = "1.0" as const;
export const RENDER_PROMPT_PROVENANCE_SCHEMA_VERSION = "1.0" as const;

export type RenderPromptProvenance = {
  schemaVersion: typeof RENDER_PROMPT_PROVENANCE_SCHEMA_VERSION;
  origin: "system_recommendation";
  source: "approved_design_spec";
  generatedAt: string;
};

export type RenderPromptVersionRefs = {
  projectId: string;
  strategyVersionId: string;
  brandSnapshotId: string;
  copyVersionId: string;
  designVersionId: string;
};

export type RenderPromptPlan = {
  promptVersion: typeof RENDER_PROMPT_VERSION;
  promptText: string;
  versionRefs: RenderPromptVersionRefs;
  provenance: RenderPromptProvenance;
};

function safeJson(value: Json): string {
  return JSON.stringify(value, null, 2);
}

function normalizeGeneratedAt(value?: string | null): string {
  const normalized = value?.trim();
  return normalized || new Date().toISOString();
}

/**
 * Builds the final external-production handoff without rewriting approved copy
 * or inventing brand assets. Official assets referenced by the Brand Snapshot
 * must be supplied separately to the production tool when required.
 */
export function buildRenderPromptPlan(input: {
  design: DesignVersion;
  designState: DesignState;
  copy: CopyVersion;
  copyState: CopyState;
  approvedStrategy: ApprovedStrategyContext;
  generatedAt?: string | null;
}): RenderPromptPlan {
  const { design, designState, copy, copyState, approvedStrategy } = input;

  if (design.approvalStatus !== "approved") {
    throw new Error("Render Prompt requires an approved Design Version.");
  }

  if (designState.projectId !== design.projectId) {
    throw new Error("Design State belongs to another Creation.");
  }

  if (designState.currentApprovedVersionId !== design.id) {
    throw new Error("Render Prompt must use the current approved Design Version.");
  }

  if (copy.projectId !== design.projectId || copyState.projectId !== design.projectId) {
    throw new Error("Copy, Copy State and Design must belong to the same Creation.");
  }

  if (copy.approvalStatus !== "approved") {
    throw new Error("Render Prompt requires an approved Copy Version.");
  }

  if (copyState.currentApprovedVersionId !== copy.id) {
    throw new Error("Render Prompt must use the current approved Copy Version.");
  }

  if (design.copyVersionId !== copy.id) {
    throw new Error(
      "The approved Design is stale because it was created from another Copy Version.",
    );
  }

  if (approvedStrategy.projectId !== design.projectId) {
    throw new Error("Approved Strategy belongs to another Creation.");
  }

  if (copy.strategyVersionId !== approvedStrategy.strategyVersionId) {
    throw new Error("Copy and approved Strategy Version do not match.");
  }

  if (copy.brandSnapshotId !== approvedStrategy.brandSnapshotId) {
    throw new Error("Copy and approved Brand Snapshot do not match.");
  }

  const generatedAt = normalizeGeneratedAt(input.generatedAt);
  const designJson: Json = {
    visual_system: design.design.visualSystem,
    composition_concept: design.design.compositionConcept,
    visual_gesture: design.design.visualGesture,
    typography_behavior: design.design.typographyBehavior,
    imagery_mode: design.design.imageryMode,
    intervention_level: design.design.interventionLevel,
    palette: design.design.palette,
    asset_requirements: design.design.assetRequirements.map((item) => ({
      role: item.role,
      requirement: item.requirement,
      mandatory: item.mandatory,
      source_preference: item.sourcePreference,
    })),
    anti_genericity: {
      distinctive_choice: design.design.antiGenericity.distinctiveChoice,
      avoid: design.design.antiGenericity.avoid,
    },
    restrictions: design.design.restrictions,
    dependencies: design.design.dependencies,
    information_to_confirm: design.design.informationToConfirm,
  };

  const copyJson: Json = {
    primary_message: copy.core.primaryMessage,
    supporting_points: copy.core.supportingPoints,
    cta: copy.core.cta
      ? {
          intent: copy.core.cta.intent,
          wording: copy.core.cta.wording,
        }
      : null,
    format_extension: copy.formatExtension,
  };

  const promptText = [
    "CRIA AÍ — RENDER PROMPT V2",
    "",
    "Produza a peça visual final a partir das decisões APROVADAS abaixo.",
    "Não reescreva, resuma, complete ou invente a copy aprovada.",
    "Não invente fatos, números, benefícios, preços, datas ou condições.",
    "Não redesenhe nem regenere logos/ativos oficiais. Quando um asset oficial for obrigatório, use somente o arquivo fornecido separadamente.",
    "Se alguma dependência obrigatória estiver ausente, sinalize a ausência em vez de substituí-la por conteúdo inventado.",
    "Respeite integralmente as restrições e escolhas anti-genéricas do Design Spec.",
    "",
    `FORMATO CANÔNICO: ${approvedStrategy.format ?? "não informado"}`,
    `OBJETIVO: ${approvedStrategy.objective ?? "não informado"}`,
    `ABORDAGEM: ${approvedStrategy.approach ?? "não informado"}`,
    `CONCEITO: ${approvedStrategy.concept ?? "não informado"}`,
    "",
    "COPY APROVADA — FONTE DE VERDADE TEXTUAL:",
    safeJson(copyJson),
    "",
    "DESIGN SPEC APROVADO — FONTE DE VERDADE VISUAL:",
    safeJson(designJson),
    "",
    "BRAND SNAPSHOT CONGELADO — REFERÊNCIA DA MARCA:",
    safeJson(approvedStrategy.brandSnapshot),
    "",
    "REGRAS DE SAÍDA:",
    "1. Preserve exatamente a intenção e o texto aprovado para a peça.",
    "2. Aplique o Design Spec sem introduzir uma segunda direção visual concorrente.",
    "3. Não use placeholders como se fossem conteúdo final.",
    "4. Não trate signed URLs legadas como ativos permanentes; assets oficiais devem ser fornecidos pelo fluxo de produção.",
    "5. Quando houver informação a confirmar, não a transforme em afirmação factual.",
  ].join("\n");

  return {
    promptVersion: RENDER_PROMPT_VERSION,
    promptText,
    versionRefs: {
      projectId: design.projectId,
      strategyVersionId: approvedStrategy.strategyVersionId,
      brandSnapshotId: approvedStrategy.brandSnapshotId,
      copyVersionId: copy.id,
      designVersionId: design.id,
    },
    provenance: {
      schemaVersion: RENDER_PROMPT_PROVENANCE_SCHEMA_VERSION,
      origin: "system_recommendation",
      source: "approved_design_spec",
      generatedAt,
    },
  };
}
