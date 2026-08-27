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
  PROVENANCE_SCHEMA_VERSION,
  type StrategyProvenance,
} from "@/lib/creation/provenance";
import {
  buildStrategySeedFromSpec,
  isSpecComplete,
  type SpecState,
} from "@/lib/creation/spec";
import {
  buildStrategyVersionInsert,
  type StrategyVersionInput,
} from "@/lib/creation/strategy";
import { CREATION_TAXONOMY_VERSION } from "@/lib/creation/taxonomy";

/**
 * Strategy generation bridge:
 * resolved $Spec -> external_manual strategy task -> validated response
 * -> immutable Strategy Version draft.
 *
 * This module deliberately does not call an AI provider and does not write to
 * Supabase by itself. It only builds/validates the canonical persistence
 * payloads already supported by the V2 foundation.
 */
export const STRATEGY_GENERATION_PROMPT_VERSION = "1.0" as const;
export const STRATEGY_GENERATION_RESPONSE_SCHEMA_VERSION =
  "strategy_generation_v1" as const;

export type StrategyGenerationBrandContext = {
  name?: string | null;
  segment?: string | null;
  description?: string | null;
  audience?: string | null;
  toneOfVoice?: string | null;
  personality?: string | null;
  productsServices?: string | null;
  differentiators?: string | null;
  prohibitedWords?: string[];
  forbiddenInventions?: string | null;
  legalInformation?: string | null;
};

export type StrategyGenerationContext = {
  intent?: string | null;
  brand?: StrategyGenerationBrandContext | null;
  additionalContext?: string | null;
};

export type StrategyGenerationResponse = {
  schema_version: typeof STRATEGY_GENERATION_RESPONSE_SCHEMA_VERSION;
  central_idea: string;
  promise: string;
  audience: string | null;
  strategy_summary: string;
  information_to_confirm: string[];
};

export type StrategyGenerationValidationResult =
  | {
      ok: true;
      data: StrategyGenerationResponse;
      issues: [];
    }
  | {
      ok: false;
      data: null;
      issues: AiTaskValidationIssue[];
    };

export type StrategyGenerationTaskPlan = {
  taskInsert: TablesInsert<"creation_ai_task_runs">;
  promptText: string;
  expectedSchema: Json;
};

export type StrategyGenerationDraftPlan = {
  strategyVersionInsert: TablesInsert<"creation_strategy_versions">;
  strategyStateUpdateAfterInsert: (
    strategyVersionId: string,
  ) => TablesUpdate<"creation_strategy_state">;
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

function compactBrandContext(
  brand: StrategyGenerationBrandContext | null | undefined,
): Record<string, Json> | null {
  if (!brand) return null;

  const context: Record<string, Json> = {};

  const stringFields: Array<
    [
      keyof Omit<StrategyGenerationBrandContext, "prohibitedWords">,
      string,
    ]
  > = [
    ["name", "name"],
    ["segment", "segment"],
    ["description", "description"],
    ["audience", "audience"],
    ["toneOfVoice", "tone_of_voice"],
    ["personality", "personality"],
    ["productsServices", "products_services"],
    ["differentiators", "differentiators"],
    ["forbiddenInventions", "forbidden_inventions"],
    ["legalInformation", "legal_information"],
  ];

  for (const [key, outputKey] of stringFields) {
    const value = normalizedString(brand[key]);
    if (value) context[outputKey] = value;
  }

  const prohibitedWords = (brand.prohibitedWords ?? [])
    .map((word) => word.trim())
    .filter(Boolean);
  if (prohibitedWords.length > 0) {
    context.prohibited_words = prohibitedWords;
  }

  return Object.keys(context).length > 0 ? context : null;
}

function stringifyPromptContext(value: Json): string {
  return JSON.stringify(value, null, 2);
}

export function getStrategyGenerationExpectedSchema(): Json {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "schema_version",
      "central_idea",
      "promise",
      "audience",
      "strategy_summary",
      "information_to_confirm",
    ],
    properties: {
      schema_version: {
        type: "string",
        const: STRATEGY_GENERATION_RESPONSE_SCHEMA_VERSION,
      },
      central_idea: {
        type: "string",
        minLength: 1,
      },
      promise: {
        type: "string",
        minLength: 1,
      },
      audience: {
        type: ["string", "null"],
      },
      strategy_summary: {
        type: "string",
        minLength: 1,
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
 * Builds the exact external/manual prompt from a complete $Spec.
 *
 * Core decisions are treated as fixed inputs. The external executor may
 * elaborate the strategy, but must not silently change Objective, Approach,
 * Format or Concept.
 */
export function buildStrategyGenerationPrompt(input: {
  spec: SpecState;
  context?: StrategyGenerationContext;
}): string {
  const seed = buildStrategySeedFromSpec(input.spec);
  const brand = compactBrandContext(input.context?.brand);
  const intent = normalizedString(input.context?.intent);
  const additionalContext = normalizedString(input.context?.additionalContext);

  const canonicalInput: Record<string, Json> = {
    spec_schema_version: input.spec.schemaVersion,
    taxonomy_version: CREATION_TAXONOMY_VERSION,
    fixed_decisions: {
      objective: seed.objective ?? null,
      approach: seed.approach ?? null,
      format: seed.format ?? null,
      concept: seed.concept ?? null,
    },
  };

  if (intent) canonicalInput.intent = intent;
  if (brand) canonicalInput.brand = brand;
  if (additionalContext) canonicalInput.additional_context = additionalContext;

  return `Você está executando a tarefa STRATEGY do Cria Aí 2.0.

OBJETIVO
Transformar as decisões criativas já resolvidas pelo $Spec em uma estratégia clara para a criação, sem escrever a copy final e sem definir direção visual.

REGRAS CRÍTICAS
- Objective, Approach, Format e Concept abaixo já estão resolvidos. NÃO altere essas decisões.
- Não invente fatos, preços, datas, serviços, benefícios, resultados, provas, restrições ou informações da marca.
- Quando alguma informação necessária não estiver confirmada, registre em "information_to_confirm".
- "central_idea" deve tornar o Concept executável e específico, sem mudar seu sentido.
- "promise" deve explicar com clareza o que o público entenderá, perceberá ou poderá fazer após consumir o conteúdo.
- "strategy_summary" deve resumir como a ideia será conduzida estrategicamente; não é legenda, roteiro, título de arte nem direção visual.
- "audience" deve usar o público informado quando houver. Se não houver base suficiente para refiná-lo com segurança, use null.
- Não crie CTA, hashtags, headline, roteiro, cenas, layout ou prompt de imagem.
- Devolva SOMENTE JSON válido, sem markdown e sem comentários.

ENTRADA CANÔNICA
${stringifyPromptContext(canonicalInput)}

SCHEMA DE SAÍDA OBRIGATÓRIO
{
  "schema_version": "${STRATEGY_GENERATION_RESPONSE_SCHEMA_VERSION}",
  "central_idea": "",
  "promise": "",
  "audience": null,
  "strategy_summary": "",
  "information_to_confirm": []
}`.trim();
}

/**
 * Prepares the persistent AI Task Gateway request. A Brand Snapshot is not
 * attached here because the approved lifecycle freezes it only after Strategy
 * approval. Current brand context may still be included in the exact prompt.
 */
export function buildStrategyGenerationTaskPlan(input: {
  projectId: string;
  spec: SpecState;
  context?: StrategyGenerationContext;
  rulePackVersions?: Record<string, string | null | undefined>;
}): StrategyGenerationTaskPlan {
  if (!isSpecComplete(input.spec)) {
    throw new Error(
      "Cannot prepare a strategy task from an incomplete $Spec.",
    );
  }

  const promptText = buildStrategyGenerationPrompt({
    spec: input.spec,
    context: input.context,
  });
  const expectedSchema = getStrategyGenerationExpectedSchema();

  const taskInsert = buildExternalManualAiTaskInsert({
    projectId: input.projectId,
    taskType: "strategy",
    inputVersions: {
      spec_schema: input.spec.schemaVersion,
      taxonomy: CREATION_TAXONOMY_VERSION,
      strategy_response_schema: STRATEGY_GENERATION_RESPONSE_SCHEMA_VERSION,
    },
    brandSnapshotId: null,
    rulePackVersions: input.rulePackVersions,
    promptVersion: STRATEGY_GENERATION_PROMPT_VERSION,
    promptText,
    expectedSchema: expectedSchema as Record<string, Json>,
  });

  return {
    taskInsert,
    promptText,
    expectedSchema,
  };
}

export function parseStrategyGenerationResponse(
  value: unknown,
): StrategyGenerationValidationResult {
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
          "A resposta de estratégia precisa ser um objeto JSON.",
          null,
        ),
      ],
    };
  }

  const issues: AiTaskValidationIssue[] = [];
  const allowedKeys = new Set([
    "schema_version",
    "central_idea",
    "promise",
    "audience",
    "strategy_summary",
    "information_to_confirm",
  ]);

  for (const key of Object.keys(candidate)) {
    if (!allowedKeys.has(key)) {
      issues.push(
        issue(
          "unexpected_field",
          `O campo "${key}" não faz parte do contrato de Strategy.`,
          key,
        ),
      );
    }
  }

  const schemaVersion = normalizedString(candidate.schema_version);
  if (schemaVersion !== STRATEGY_GENERATION_RESPONSE_SCHEMA_VERSION) {
    issues.push(
      issue(
        "invalid_schema_version",
        `schema_version precisa ser "${STRATEGY_GENERATION_RESPONSE_SCHEMA_VERSION}".`,
        "schema_version",
      ),
    );
  }

  const centralIdea = normalizedString(candidate.central_idea);
  if (!centralIdea) {
    issues.push(
      issue(
        "central_idea_required",
        "A ideia central precisa ser preenchida.",
        "central_idea",
      ),
    );
  }

  const promise = normalizedString(candidate.promise);
  if (!promise) {
    issues.push(
      issue(
        "promise_required",
        "A promessa precisa ser preenchida.",
        "promise",
      ),
    );
  }

  let audience: string | null = null;
  if (candidate.audience !== null) {
    audience = normalizedString(candidate.audience);
    if (!audience) {
      issues.push(
        issue(
          "audience_invalid",
          "audience precisa ser texto preenchido ou null.",
          "audience",
        ),
      );
    }
  }

  const strategySummary = normalizedString(candidate.strategy_summary);
  if (!strategySummary) {
    issues.push(
      issue(
        "strategy_summary_required",
        "O resumo estratégico precisa ser preenchido.",
        "strategy_summary",
      ),
    );
  }

  const informationToConfirm = normalizedStringArray(
    candidate.information_to_confirm,
  );
  if (informationToConfirm === null) {
    issues.push(
      issue(
        "information_to_confirm_invalid",
        "information_to_confirm precisa ser uma lista de textos.",
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
      schema_version: STRATEGY_GENERATION_RESPONSE_SCHEMA_VERSION,
      central_idea: centralIdea!,
      promise: promise!,
      audience,
      strategy_summary: strategySummary!,
      information_to_confirm: informationToConfirm!,
    },
    issues: [],
  };
}

/**
 * Builds the response import payload without marking the run valid. Validation
 * remains an explicit second step in the Gateway audit trail.
 */
export function buildStrategyGenerationResponseImportUpdate(
  response: string | StrategyGenerationResponse,
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

export function buildStrategyGenerationValidationUpdate(
  response: unknown,
): {
  result: StrategyGenerationValidationResult;
  update: TablesUpdate<"creation_ai_task_runs">;
} {
  const result = parseStrategyGenerationResponse(response);

  return {
    result,
    update: buildAiTaskValidationUpdate(
      result.ok
        ? { status: "valid" }
        : { status: "invalid", issues: result.issues },
    ),
  };
}

function buildGeneratedStrategyProvenance(input: {
  spec: SpecState;
  run: AiTaskRun;
}): StrategyProvenance {
  const seed = buildStrategySeedFromSpec(input.spec);

  return {
    schemaVersion: PROVENANCE_SCHEMA_VERSION,
    origin: "external_manual",
    source: `ai_task_run:${input.run.id}`,
    recordedAt:
      input.run.validatedAt ??
      input.run.responseImportedAt ??
      input.run.updatedAt ??
      input.run.createdAt,
    decisions: seed.provenance.decisions,
  };
}

function strategyResponseToPayload(response: StrategyGenerationResponse): Json {
  return {
    schema_version: response.schema_version,
    central_idea: response.central_idea,
    promise: response.promise,
    strategy_summary: response.strategy_summary,
    information_to_confirm: response.information_to_confirm,
  };
}

/**
 * Converts a VALID strategy task run into the insert for a new immutable
 * Strategy Version. It refuses task/project mismatches and re-validates the
 * persisted response instead of trusting validation_status alone.
 */
export function buildStrategyDraftFromValidatedRun(input: {
  projectId: string;
  versionNumber: number;
  spec: SpecState;
  run: AiTaskRun;
}): StrategyGenerationDraftPlan {
  if (input.run.projectId !== input.projectId) {
    throw new Error("The strategy task run belongs to another Creation.");
  }

  if (input.run.taskType !== "strategy") {
    throw new Error("The AI task run is not a strategy task.");
  }

  if (input.run.executionOrigin !== "external_manual") {
    throw new Error(
      "The current MVP only accepts external_manual strategy executions.",
    );
  }

  if (input.run.validationStatus !== "valid") {
    throw new Error(
      "A Strategy Version can only be created from a valid strategy task run.",
    );
  }

  const validation = parseStrategyGenerationResponse(
    input.run.responseJson ?? input.run.responseText,
  );
  if (!validation.ok) {
    throw new Error(
      "The persisted strategy response no longer satisfies the Strategy contract.",
    );
  }

  const specSeed = buildStrategySeedFromSpec(input.spec);
  const provenance = buildGeneratedStrategyProvenance({
    spec: input.spec,
    run: input.run,
  });

  const strategyInput: StrategyVersionInput = {
    objective: specSeed.objective,
    approach: specSeed.approach,
    format: specSeed.format,
    concept: specSeed.concept,
    audience: validation.data.audience,
    strategyPayload: strategyResponseToPayload(validation.data),
    provenance,
  };

  return {
    strategyVersionInsert: buildStrategyVersionInsert(
      input.projectId,
      input.versionNumber,
      strategyInput,
    ),
    strategyStateUpdateAfterInsert: (strategyVersionId: string) => {
      const id = strategyVersionId.trim();
      if (!id) throw new Error("strategyVersionId must not be blank.");

      return {
        current_version_id: id,
        status: "drafting",
      };
    },
  };
}
