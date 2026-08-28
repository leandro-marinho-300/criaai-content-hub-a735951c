import type {
  Json,
  TablesInsert,
  TablesUpdate,
} from "@/integrations/supabase/types";
import {
  buildAiTaskValidationUpdate,
  buildExternalManualAiTaskInsert,
  buildExternalManualResponseImportUpdate,
  type AiTaskRun,
  type AiTaskValidationIssue,
} from "@/lib/creation/ai-task-gateway";
import {
  COPY_SCHEMA_VERSION,
  buildCopyProvenance,
  buildCopyStateAfterDraft,
  buildCopyStateInsert,
  buildCopyVersionInsert,
  type CopyCorePayload,
} from "@/lib/creation/copy";
import type { ApprovedStrategyContext } from "@/lib/creation/strategy-approval";

/**
 * Copy generation bridge:
 * approved Strategy + frozen Brand Snapshot -> external_manual copy task
 * -> validated response -> immutable Copy Version draft.
 *
 * This module deliberately does not call an AI provider and does not write to
 * Supabase by itself. It only builds/validates the persistence payloads already
 * supported by the V2 foundation.
 */
export const COPY_GENERATION_PROMPT_VERSION = "1.0" as const;
export const COPY_GENERATION_RESPONSE_SCHEMA_VERSION =
  "copy_generation_v1" as const;

export type CopyGenerationResponse = {
  schema_version: typeof COPY_GENERATION_RESPONSE_SCHEMA_VERSION;
  primary_message: string;
  supporting_points: string[];
  cta: {
    intent: string | null;
    wording: string | null;
  } | null;
  information_to_confirm: string[];
};

export type CopyGenerationValidationResult =
  | {
      ok: true;
      data: CopyGenerationResponse;
      issues: [];
    }
  | {
      ok: false;
      data: null;
      issues: AiTaskValidationIssue[];
    };

export type CopyGenerationTaskPlan = {
  taskInsert: TablesInsert<"creation_ai_task_runs">;
  promptText: string;
  expectedSchema: Json;
};

export type CopyGenerationDraftPlan = {
  copyVersionInsert: TablesInsert<"creation_copy_versions">;
  copyStateInsertIfMissing: TablesInsert<"creation_copy_state">;
  copyStateUpdateAfterInsert: (
    copyVersionId: string,
  ) => TablesUpdate<"creation_copy_state">;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizedStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  const normalized: string[] = [];
  for (const item of value) {
    const parsed = normalizedString(item);
    if (!parsed) return null;
    normalized.push(parsed);
  }

  return normalized;
}

function issue(
  code: string,
  message: string,
  path: string | null,
): AiTaskValidationIssue {
  return { code, message, path };
}

function stringifyPromptContext(value: Json): string {
  return JSON.stringify(value, null, 2);
}

function assertApprovedStrategyContext(
  context: ApprovedStrategyContext,
): void {
  if (!context.projectId.trim()) {
    throw new Error("Approved Strategy context projectId must not be blank.");
  }

  if (!context.strategyVersionId.trim()) {
    throw new Error(
      "Approved Strategy context strategyVersionId must not be blank.",
    );
  }

  if (!context.brandSnapshotId.trim()) {
    throw new Error(
      "Approved Strategy context brandSnapshotId must not be blank.",
    );
  }

  if (!isRecord(context.brandSnapshot)) {
    throw new Error("Approved Strategy context requires a Brand Snapshot object.");
  }

  if (!isRecord(context.strategyPayload)) {
    throw new Error("Approved Strategy context requires a Strategy payload object.");
  }
}

export function getCopyGenerationExpectedSchema(): Json {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "schema_version",
      "primary_message",
      "supporting_points",
      "cta",
      "information_to_confirm",
    ],
    properties: {
      schema_version: {
        type: "string",
        const: COPY_GENERATION_RESPONSE_SCHEMA_VERSION,
      },
      primary_message: {
        type: "string",
        minLength: 1,
      },
      supporting_points: {
        type: "array",
        items: {
          type: "string",
          minLength: 1,
        },
      },
      cta: {
        anyOf: [
          {
            type: "null",
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["intent", "wording"],
            properties: {
              intent: {
                type: ["string", "null"],
              },
              wording: {
                type: ["string", "null"],
              },
            },
          },
        ],
      },
      information_to_confirm: {
        type: "array",
        items: {
          type: "string",
          minLength: 1,
        },
      },
    },
  };
}

/**
 * Builds the exact external/manual prompt from the currently approved Strategy
 * and its frozen Brand Snapshot. The executor may write the canonical Copy,
 * but may not silently redefine strategy or brand facts.
 */
export function buildCopyGenerationPrompt(input: {
  approvedStrategy: ApprovedStrategyContext;
  additionalContext?: string | null;
}): string {
  assertApprovedStrategyContext(input.approvedStrategy);

  const additionalContext = normalizedString(input.additionalContext);
  const canonicalInput: Record<string, Json> = {
    strategy_version_id: input.approvedStrategy.strategyVersionId,
    brand_snapshot_id: input.approvedStrategy.brandSnapshotId,
    fixed_strategy: {
      objective: input.approvedStrategy.objective ?? null,
      approach: input.approvedStrategy.approach ?? null,
      format: input.approvedStrategy.format ?? null,
      concept: input.approvedStrategy.concept,
      audience: input.approvedStrategy.audience,
      strategy_payload: input.approvedStrategy.strategyPayload,
    },
    frozen_brand_snapshot: input.approvedStrategy.brandSnapshot,
  };

  if (additionalContext) {
    canonicalInput.additional_context = additionalContext;
  }

  return `Você está executando a tarefa COPY do Cria Aí 2.0.

OBJETIVO
Transformar a Strategy aprovada e o Brand Snapshot congelado em uma Copy Core canônica, clara e reutilizável pelo adapter do formato depois.

REGRAS CRÍTICAS
- A Strategy abaixo já está aprovada. NÃO altere Objective, Approach, Format, Concept, público ou direção estratégica.
- O Brand Snapshot é a fonte de verdade da marca para esta versão. NÃO substitua fatos, regras, tom, preferências ou restrições por conhecimento externo.
- Não invente fatos, preços, datas, serviços, benefícios, resultados, provas, condições comerciais ou informações não confirmadas.
- Se alguma informação seria necessária para afirmar algo com segurança, evite a afirmação e registre a pendência em "information_to_confirm".
- "primary_message" é a mensagem central final da Copy Core. Não é headline de arte, legenda de rede social, roteiro, cena ou layout.
- "supporting_points" são ideias de apoio em ordem de prioridade. Não repita a mensagem principal apenas com outras palavras.
- "cta" é opcional. Use null quando a estratégia não pedir ação. Nunca crie urgência, escassez ou promessa comercial sem base.
- Quando houver CTA, "intent" descreve a intenção semântica e "wording" traz a formulação textual canônica.
- NÃO crie headline específica de Post, legenda, hashtags, roteiro, cenas, direção visual, prompt de imagem ou instruções de layout.
- NÃO corte ou abrevie conteúdo silenciosamente para caber em limite de caracteres.
- Devolva SOMENTE JSON válido, sem markdown e sem comentários.

ENTRADA CANÔNICA
${stringifyPromptContext(canonicalInput)}

SCHEMA DE SAÍDA OBRIGATÓRIO
{
  "schema_version": "${COPY_GENERATION_RESPONSE_SCHEMA_VERSION}",
  "primary_message": "",
  "supporting_points": [],
  "cta": null,
  "information_to_confirm": []
}`.trim();
}

export function buildCopyGenerationTaskPlan(input: {
  approvedStrategy: ApprovedStrategyContext;
  additionalContext?: string | null;
  rulePackVersions?: Record<string, string | null | undefined>;
}): CopyGenerationTaskPlan {
  assertApprovedStrategyContext(input.approvedStrategy);

  const promptText = buildCopyGenerationPrompt({
    approvedStrategy: input.approvedStrategy,
    additionalContext: input.additionalContext,
  });
  const expectedSchema = getCopyGenerationExpectedSchema();

  const taskInsert = buildExternalManualAiTaskInsert({
    projectId: input.approvedStrategy.projectId,
    taskType: "copy",
    inputVersions: {
      strategy_version_id: input.approvedStrategy.strategyVersionId,
      brand_snapshot_id: input.approvedStrategy.brandSnapshotId,
      copy_schema: COPY_SCHEMA_VERSION,
      copy_response_schema: COPY_GENERATION_RESPONSE_SCHEMA_VERSION,
    },
    brandSnapshotId: input.approvedStrategy.brandSnapshotId,
    rulePackVersions: input.rulePackVersions,
    promptVersion: COPY_GENERATION_PROMPT_VERSION,
    promptText,
    expectedSchema: expectedSchema as Record<string, Json>,
  });

  return {
    taskInsert,
    promptText,
    expectedSchema,
  };
}

export function parseCopyGenerationResponse(
  value: unknown,
): CopyGenerationValidationResult {
  let candidate = value;

  if (typeof value === "string") {
    try {
      candidate = JSON.parse(value);
    } catch {
      return {
        ok: false,
        data: null,
        issues: [
          issue(
            "invalid_json",
            "A resposta externa precisa ser um JSON válido.",
            null,
          ),
        ],
      };
    }
  }

  if (!isRecord(candidate)) {
    return {
      ok: false,
      data: null,
      issues: [
        issue(
          "invalid_root",
          "A resposta de Copy precisa ser um objeto JSON.",
          null,
        ),
      ],
    };
  }

  const issues: AiTaskValidationIssue[] = [];
  const allowedKeys = new Set([
    "schema_version",
    "primary_message",
    "supporting_points",
    "cta",
    "information_to_confirm",
  ]);

  for (const key of Object.keys(candidate)) {
    if (!allowedKeys.has(key)) {
      issues.push(
        issue(
          "unexpected_field",
          `O campo "${key}" não faz parte do contrato de Copy.`,
          key,
        ),
      );
    }
  }

  const schemaVersion = normalizedString(candidate.schema_version);
  if (schemaVersion !== COPY_GENERATION_RESPONSE_SCHEMA_VERSION) {
    issues.push(
      issue(
        "invalid_schema_version",
        `schema_version precisa ser "${COPY_GENERATION_RESPONSE_SCHEMA_VERSION}".`,
        "schema_version",
      ),
    );
  }

  const primaryMessage = normalizedString(candidate.primary_message);
  if (!primaryMessage) {
    issues.push(
      issue(
        "primary_message_required",
        "A mensagem principal precisa ser preenchida.",
        "primary_message",
      ),
    );
  }

  const supportingPoints = normalizedStringArray(candidate.supporting_points);
  if (supportingPoints === null) {
    issues.push(
      issue(
        "supporting_points_invalid",
        "supporting_points precisa ser uma lista de textos preenchidos.",
        "supporting_points",
      ),
    );
  }

  let cta: CopyGenerationResponse["cta"] = null;
  if (candidate.cta !== null) {
    if (!isRecord(candidate.cta)) {
      issues.push(
        issue(
          "cta_invalid",
          "cta precisa ser um objeto ou null.",
          "cta",
        ),
      );
    } else {
      const ctaAllowedKeys = new Set(["intent", "wording"]);
      for (const key of Object.keys(candidate.cta)) {
        if (!ctaAllowedKeys.has(key)) {
          issues.push(
            issue(
              "cta_unexpected_field",
              `O campo "cta.${key}" não faz parte do contrato.`,
              `cta.${key}`,
            ),
          );
        }
      }

      if (!Object.prototype.hasOwnProperty.call(candidate.cta, "intent")) {
        issues.push(
          issue(
            "cta_intent_required",
            "cta.intent precisa existir, mesmo quando for null.",
            "cta.intent",
          ),
        );
      }

      if (!Object.prototype.hasOwnProperty.call(candidate.cta, "wording")) {
        issues.push(
          issue(
            "cta_wording_required",
            "cta.wording precisa existir, mesmo quando for null.",
            "cta.wording",
          ),
        );
      }

      let intent: string | null = null;
      if (candidate.cta.intent !== null) {
        intent = normalizedString(candidate.cta.intent);
        if (!intent) {
          issues.push(
            issue(
              "cta_intent_invalid",
              "cta.intent precisa ser texto preenchido ou null.",
              "cta.intent",
            ),
          );
        }
      }

      let wording: string | null = null;
      if (candidate.cta.wording !== null) {
        wording = normalizedString(candidate.cta.wording);
        if (!wording) {
          issues.push(
            issue(
              "cta_wording_invalid",
              "cta.wording precisa ser texto preenchido ou null.",
              "cta.wording",
            ),
          );
        }
      }

      cta = intent || wording ? { intent, wording } : null;
    }
  }

  const informationToConfirm = normalizedStringArray(
    candidate.information_to_confirm,
  );
  if (informationToConfirm === null) {
    issues.push(
      issue(
        "information_to_confirm_invalid",
        "information_to_confirm precisa ser uma lista de textos preenchidos.",
        "information_to_confirm",
      ),
    );
  }

  if (issues.length > 0) {
    return { ok: false, data: null, issues };
  }

  return {
    ok: true,
    data: {
      schema_version: COPY_GENERATION_RESPONSE_SCHEMA_VERSION,
      primary_message: primaryMessage!,
      supporting_points: supportingPoints!,
      cta,
      information_to_confirm: informationToConfirm!,
    },
    issues: [],
  };
}

/**
 * Builds the response import payload without marking the run valid. Validation
 * remains a separate Gateway step for auditability.
 */
export function buildCopyGenerationResponseImportUpdate(
  response: string | CopyGenerationResponse,
): TablesUpdate<"creation_ai_task_runs"> {
  if (typeof response === "string") {
    return buildExternalManualResponseImportUpdate({
      responseText: response,
    });
  }

  return buildExternalManualResponseImportUpdate({
    responseJson: response as unknown as Json,
  });
}

export function buildCopyGenerationValidationUpdate(
  response: unknown,
): {
  result: CopyGenerationValidationResult;
  update: TablesUpdate<"creation_ai_task_runs">;
} {
  const result = parseCopyGenerationResponse(response);

  return {
    result,
    update: buildAiTaskValidationUpdate(
      result.ok
        ? { status: "valid" }
        : { status: "invalid", issues: result.issues },
    ),
  };
}

function responseToCopyCore(
  response: CopyGenerationResponse,
): CopyCorePayload {
  return {
    primaryMessage: response.primary_message,
    supportingPoints: response.supporting_points,
    cta: response.cta
      ? {
          intent: response.cta.intent,
          wording: response.cta.wording,
        }
      : null,
  };
}

/**
 * Converts a VALID copy task run into a new immutable Copy Version draft.
 * The task must refer to the same approved Strategy Version and frozen Brand
 * Snapshot supplied when its exact prompt was created.
 */
export function buildCopyDraftFromValidatedRun(input: {
  versionNumber: number;
  approvedStrategy: ApprovedStrategyContext;
  run: AiTaskRun;
}): CopyGenerationDraftPlan {
  assertApprovedStrategyContext(input.approvedStrategy);

  if (input.run.projectId !== input.approvedStrategy.projectId) {
    throw new Error("The Copy task run belongs to another Creation.");
  }

  if (input.run.taskType !== "copy") {
    throw new Error("The AI task run is not a Copy task.");
  }

  if (input.run.executionOrigin !== "external_manual") {
    throw new Error(
      "The current MVP only accepts external_manual Copy executions.",
    );
  }

  if (input.run.brandSnapshotId !== input.approvedStrategy.brandSnapshotId) {
    throw new Error(
      "The Copy task run uses a different Brand Snapshot than the approved Strategy context.",
    );
  }

  if (
    input.run.inputVersions.strategy_version_id !==
    input.approvedStrategy.strategyVersionId
  ) {
    throw new Error(
      "The Copy task run uses a different Strategy Version than the approved Strategy context.",
    );
  }

  if (
    input.run.inputVersions.brand_snapshot_id !==
    input.approvedStrategy.brandSnapshotId
  ) {
    throw new Error(
      "The Copy task run input Brand Snapshot does not match the approved Strategy context.",
    );
  }

  if (input.run.validationStatus !== "valid") {
    throw new Error(
      "A Copy Version can only be created from a valid Copy task run.",
    );
  }

  const validation = parseCopyGenerationResponse(
    input.run.responseJson ?? input.run.responseText,
  );
  if (!validation.ok) {
    throw new Error(
      "The persisted Copy response no longer satisfies the Copy contract.",
    );
  }

  const provenance = buildCopyProvenance({
    origin: "external_manual",
    source: `ai_task_run:${input.run.id}`,
    recordedAt:
      input.run.validatedAt ??
      input.run.responseImportedAt ??
      input.run.updatedAt ??
      input.run.createdAt,
  });

  return {
    copyVersionInsert: buildCopyVersionInsert(
      input.approvedStrategy.projectId,
      input.versionNumber,
      {
        strategyVersionId: input.approvedStrategy.strategyVersionId,
        brandSnapshotId: input.approvedStrategy.brandSnapshotId,
        core: responseToCopyCore(validation.data),
        formatExtension: {},
        provenance,
        basedOnVersionId: null,
      },
    ),
    copyStateInsertIfMissing: buildCopyStateInsert(
      input.approvedStrategy.projectId,
    ),
    copyStateUpdateAfterInsert: buildCopyStateAfterDraft,
  };
}
