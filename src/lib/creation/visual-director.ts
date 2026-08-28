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
  buildDesignProvenance,
  buildDesignStateAfterDraft,
  buildDesignVersionInsert,
  type DesignSpecPayload,
} from "@/lib/creation/design";
import type { CopyState, CopyVersion } from "@/lib/creation/copy";
import type { ApprovedStrategyContext } from "@/lib/creation/strategy-approval";

/**
 * Visual Director V2 core:
 * approved Copy -> external_manual visual_direction task -> validated Design Spec
 * -> immutable Design Version draft.
 *
 * It deliberately stops before Render Prompt or image generation.
 */
export const VISUAL_DIRECTOR_PROMPT_VERSION = "1.0" as const;
export const VISUAL_DIRECTOR_RESPONSE_SCHEMA_VERSION =
  "visual_direction_v1" as const;

export type VisualDirectorAssetRequirementResponse = {
  role: string;
  requirement: string;
  mandatory: boolean;
  source_preference: string | null;
};

export type VisualDirectorResponse = {
  schema_version: typeof VISUAL_DIRECTOR_RESPONSE_SCHEMA_VERSION;
  visual_system: string;
  composition_concept: string;
  visual_gesture: string;
  typography_behavior: string;
  imagery_mode: string;
  intervention_level: string;
  palette: string[];
  asset_requirements: VisualDirectorAssetRequirementResponse[];
  anti_genericity: {
    distinctive_choice: string;
    avoid: string[];
  };
  restrictions: string[];
  dependencies: string[];
  information_to_confirm: string[];
};

export type ApprovedVisualDirectorContext = {
  sourceCopy: CopyVersion;
  copyState: CopyState;
  approvedStrategy: ApprovedStrategyContext;
};

export type VisualDirectorValidationResult =
  | {
      ok: true;
      data: VisualDirectorResponse;
      issues: [];
    }
  | {
      ok: false;
      data: null;
      issues: AiTaskValidationIssue[];
    };

export type VisualDirectorTaskPlan = {
  taskInsert: TablesInsert<"creation_ai_task_runs">;
  promptText: string;
  expectedSchema: Json;
};

export type VisualDirectorDraftPlan = {
  designVersionInsert: TablesInsert<"creation_design_versions">;
  designStateUpdateAfterInsert: (
    designVersionId: string,
  ) => TablesUpdate<"creation_design_state">;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizedNullableString(
  value: unknown,
): { valid: true; value: string | null } | { valid: false; value: null } {
  if (value === null) return { valid: true, value: null };
  const normalized = normalizedString(value);
  return normalized
    ? { valid: true, value: normalized }
    : { valid: false, value: null };
}

function normalizedStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  const result: string[] = [];
  for (const item of value) {
    const normalized = normalizedString(item);
    if (!normalized) return null;
    result.push(normalized);
  }
  return result;
}

function issue(
  code: string,
  message: string,
  path: string | null,
): AiTaskValidationIssue {
  return { code, message, path };
}

function stringifyPromptContext(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function assertApprovedVisualDirectorContext(
  context: ApprovedVisualDirectorContext,
): void {
  const { sourceCopy, copyState, approvedStrategy } = context;

  if (sourceCopy.approvalStatus !== "approved") {
    throw new Error(
      "Visual Director must start from the currently approved Copy Version.",
    );
  }

  if (copyState.projectId !== sourceCopy.projectId) {
    throw new Error("The Copy State belongs to another Creation.");
  }

  if (copyState.currentApprovedVersionId !== sourceCopy.id) {
    throw new Error(
      "Visual Director must start from currentApprovedVersionId.",
    );
  }

  if (sourceCopy.projectId !== approvedStrategy.projectId) {
    throw new Error("The approved Copy belongs to another Creation.");
  }

  if (sourceCopy.strategyVersionId !== approvedStrategy.strategyVersionId) {
    throw new Error(
      "The approved Copy was produced from a different Strategy Version.",
    );
  }

  if (sourceCopy.brandSnapshotId !== approvedStrategy.brandSnapshotId) {
    throw new Error(
      "The approved Copy was produced from a different Brand Snapshot.",
    );
  }
}

export function getVisualDirectorExpectedSchema(): Json {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "schema_version",
      "visual_system",
      "composition_concept",
      "visual_gesture",
      "typography_behavior",
      "imagery_mode",
      "intervention_level",
      "palette",
      "asset_requirements",
      "anti_genericity",
      "restrictions",
      "dependencies",
      "information_to_confirm",
    ],
    properties: {
      schema_version: {
        type: "string",
        const: VISUAL_DIRECTOR_RESPONSE_SCHEMA_VERSION,
      },
      visual_system: { type: "string", minLength: 1 },
      composition_concept: { type: "string", minLength: 1 },
      visual_gesture: { type: "string", minLength: 1 },
      typography_behavior: { type: "string", minLength: 1 },
      imagery_mode: { type: "string", minLength: 1 },
      intervention_level: { type: "string", minLength: 1 },
      palette: {
        type: "array",
        items: { type: "string", minLength: 1 },
      },
      asset_requirements: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "role",
            "requirement",
            "mandatory",
            "source_preference",
          ],
          properties: {
            role: { type: "string", minLength: 1 },
            requirement: { type: "string", minLength: 1 },
            mandatory: { type: "boolean" },
            source_preference: { type: ["string", "null"] },
          },
        },
      },
      anti_genericity: {
        type: "object",
        additionalProperties: false,
        required: ["distinctive_choice", "avoid"],
        properties: {
          distinctive_choice: { type: "string", minLength: 1 },
          avoid: {
            type: "array",
            items: { type: "string", minLength: 1 },
          },
        },
      },
      restrictions: {
        type: "array",
        items: { type: "string", minLength: 1 },
      },
      dependencies: {
        type: "array",
        items: { type: "string", minLength: 1 },
      },
      information_to_confirm: {
        type: "array",
        items: { type: "string", minLength: 1 },
      },
    },
  } as Json;
}

export function buildVisualDirectorPrompt(input: {
  context: ApprovedVisualDirectorContext;
  additionalContext?: string | null;
}): string {
  assertApprovedVisualDirectorContext(input.context);

  const additionalContext = normalizedString(input.additionalContext);
  const { sourceCopy, approvedStrategy } = input.context;

  const canonicalInput: Record<string, Json> = {
    source_copy_version_id: sourceCopy.id,
    fixed_strategy: {
      strategy_version_id: approvedStrategy.strategyVersionId,
      objective: approvedStrategy.objective ?? null,
      approach: approvedStrategy.approach ?? null,
      format: approvedStrategy.format ?? null,
      concept: approvedStrategy.concept,
      audience: approvedStrategy.audience,
      strategy_payload: approvedStrategy.strategyPayload,
    },
    frozen_brand_snapshot: approvedStrategy.brandSnapshot,
    approved_copy: {
      core: {
        primary_message: sourceCopy.core.primaryMessage,
        supporting_points: sourceCopy.core.supportingPoints,
        cta: sourceCopy.core.cta
          ? {
              intent: sourceCopy.core.cta.intent,
              wording: sourceCopy.core.cta.wording,
            }
          : null,
      },
      format_extension: sourceCopy.formatExtension,
    },
  };

  if (additionalContext) {
    canonicalInput.additional_context = additionalContext;
  }

  return `Você está executando o VISUAL DIRECTOR do Cria Aí 2.0.

OBJETIVO
Transformar Strategy + Brand Snapshot + Copy JÁ APROVADAS em uma direção visual canônica (Design Spec), sem gerar a arte final e sem reescrever o conteúdo.

REGRAS CRÍTICAS
- Strategy, Brand Snapshot e Copy abaixo já estão aprovados. NÃO altere mensagem, CTA, fatos, promessa, público, Objective, Approach, Format ou Concept.
- NÃO escreva nova headline, legenda, roteiro, CTA ou hashtags. Se houver texto específico de formato, ele já está em format_extension.
- "visual_system" descreve a lógica visual que mantém a peça coerente como sistema, não um adjetivo genérico.
- "composition_concept" define a organização conceitual da composição.
- "visual_gesture" define o gesto visual distintivo que dá identidade à peça.
- "typography_behavior" define hierarquia, presença e comportamento tipográfico; não invente fontes oficiais ausentes da marca.
- "imagery_mode" descreve fotografia, ilustração, gráfico, colagem, composição tipográfica ou mistura adequada ao conteúdo.
- "intervention_level" descreve quanto a imagem base deve ser manipulada/intervencionada.
- "palette" deve respeitar o Brand Snapshot quando houver paleta definida. Não invente cor oficial como fato de marca.
- "asset_requirements" deve listar assets realmente necessários. Logo oficial e outros assets de marca devem ser tratados como dependências/referências; NÃO proponha regenerá-los por IA.
- Quando o snapshot trouxer apenas referência legada/signed URL, trate isso como dependência a confirmar, não como asset durável garantido.
- "anti_genericity" deve indicar uma escolha visual distintiva e o que evitar para não cair em layout publicitário genérico. É uma avaliação qualitativa, não uma pontuação automática.
- "restrictions" consolida limitações visuais reais da marca, conteúdo ou formato.
- "dependencies" registra condições/insumos necessários para executar o Design Spec.
- Se faltar informação para decidir com segurança, registre em "information_to_confirm"; não invente.
- NÃO gere Render Prompt, prompt de ImageGen, instruções de ferramenta, imagem final ou layout em pixels. Isso pertence à etapa posterior.
- Devolva SOMENTE JSON válido, sem markdown e sem comentários.

ENTRADA CANÔNICA
${stringifyPromptContext(canonicalInput)}

SCHEMA DE SAÍDA OBRIGATÓRIO
{
  "schema_version": "${VISUAL_DIRECTOR_RESPONSE_SCHEMA_VERSION}",
  "visual_system": "",
  "composition_concept": "",
  "visual_gesture": "",
  "typography_behavior": "",
  "imagery_mode": "",
  "intervention_level": "",
  "palette": [],
  "asset_requirements": [
    {
      "role": "",
      "requirement": "",
      "mandatory": true,
      "source_preference": null
    }
  ],
  "anti_genericity": {
    "distinctive_choice": "",
    "avoid": []
  },
  "restrictions": [],
  "dependencies": [],
  "information_to_confirm": []
}`.trim();
}

export function buildVisualDirectorTaskPlan(input: {
  context: ApprovedVisualDirectorContext;
  additionalContext?: string | null;
  rulePackVersions?: Record<string, string | null | undefined>;
}): VisualDirectorTaskPlan {
  assertApprovedVisualDirectorContext(input.context);

  const promptText = buildVisualDirectorPrompt({
    context: input.context,
    additionalContext: input.additionalContext,
  });
  const expectedSchema = getVisualDirectorExpectedSchema();
  const { sourceCopy, approvedStrategy } = input.context;

  return {
    taskInsert: buildExternalManualAiTaskInsert({
      projectId: sourceCopy.projectId,
      taskType: "visual_direction",
      inputVersions: {
        copy_version_id: sourceCopy.id,
        strategy_version_id: sourceCopy.strategyVersionId,
        brand_snapshot_id: sourceCopy.brandSnapshotId,
        visual_direction_response_schema:
          VISUAL_DIRECTOR_RESPONSE_SCHEMA_VERSION,
      },
      brandSnapshotId: approvedStrategy.brandSnapshotId,
      rulePackVersions: input.rulePackVersions,
      promptVersion: VISUAL_DIRECTOR_PROMPT_VERSION,
      promptText,
      expectedSchema: expectedSchema as Record<string, Json>,
    }),
    promptText,
    expectedSchema,
  };
}

function parseAssetRequirements(
  value: unknown,
  issues: AiTaskValidationIssue[],
): VisualDirectorAssetRequirementResponse[] {
  if (!Array.isArray(value)) {
    issues.push(
      issue(
        "asset_requirements_invalid",
        "asset_requirements precisa ser uma lista.",
        "asset_requirements",
      ),
    );
    return [];
  }

  const result: VisualDirectorAssetRequirementResponse[] = [];
  const allowedKeys = new Set([
    "role",
    "requirement",
    "mandatory",
    "source_preference",
  ]);

  value.forEach((item, index) => {
    const path = `asset_requirements.${index}`;
    if (!isRecord(item)) {
      issues.push(
        issue(
          "asset_requirement_invalid",
          "Cada asset requirement precisa ser um objeto.",
          path,
        ),
      );
      return;
    }

    for (const key of Object.keys(item)) {
      if (!allowedKeys.has(key)) {
        issues.push(
          issue(
            "unexpected_field",
            `O campo "${key}" não faz parte do contrato de asset requirement.`,
            `${path}.${key}`,
          ),
        );
      }
    }

    const role = normalizedString(item.role);
    if (!role) {
      issues.push(
        issue(
          "asset_role_required",
          "asset_requirements.role precisa ser preenchido.",
          `${path}.role`,
        ),
      );
    }

    const requirement = normalizedString(item.requirement);
    if (!requirement) {
      issues.push(
        issue(
          "asset_requirement_required",
          "asset_requirements.requirement precisa ser preenchido.",
          `${path}.requirement`,
        ),
      );
    }

    if (typeof item.mandatory !== "boolean") {
      issues.push(
        issue(
          "asset_mandatory_invalid",
          "asset_requirements.mandatory precisa ser boolean.",
          `${path}.mandatory`,
        ),
      );
    }

    const sourcePreference = normalizedNullableString(item.source_preference);
    if (!sourcePreference.valid) {
      issues.push(
        issue(
          "asset_source_preference_invalid",
          "asset_requirements.source_preference precisa ser texto preenchido ou null.",
          `${path}.source_preference`,
        ),
      );
    }

    if (role && requirement && typeof item.mandatory === "boolean") {
      result.push({
        role,
        requirement,
        mandatory: item.mandatory,
        source_preference: sourcePreference.value,
      });
    }
  });

  return result;
}

export function parseVisualDirectorResponse(
  value: unknown,
): VisualDirectorValidationResult {
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
          "A resposta do Visual Director precisa ser um objeto JSON.",
          null,
        ),
      ],
    };
  }

  const issues: AiTaskValidationIssue[] = [];
  const allowedKeys = new Set([
    "schema_version",
    "visual_system",
    "composition_concept",
    "visual_gesture",
    "typography_behavior",
    "imagery_mode",
    "intervention_level",
    "palette",
    "asset_requirements",
    "anti_genericity",
    "restrictions",
    "dependencies",
    "information_to_confirm",
  ]);

  for (const key of Object.keys(candidate)) {
    if (!allowedKeys.has(key)) {
      issues.push(
        issue(
          "unexpected_field",
          `O campo "${key}" não faz parte do contrato do Visual Director.`,
          key,
        ),
      );
    }
  }

  const schemaVersion = normalizedString(candidate.schema_version);
  if (schemaVersion !== VISUAL_DIRECTOR_RESPONSE_SCHEMA_VERSION) {
    issues.push(
      issue(
        "invalid_schema_version",
        `schema_version precisa ser "${VISUAL_DIRECTOR_RESPONSE_SCHEMA_VERSION}".`,
        "schema_version",
      ),
    );
  }

  const requiredFields = [
    ["visual_system", "visual_system"],
    ["composition_concept", "composition_concept"],
    ["visual_gesture", "visual_gesture"],
    ["typography_behavior", "typography_behavior"],
    ["imagery_mode", "imagery_mode"],
    ["intervention_level", "intervention_level"],
  ] as const;

  const parsedStrings: Record<string, string> = {};
  for (const [key, path] of requiredFields) {
    const parsed = normalizedString(candidate[key]);
    if (!parsed) {
      issues.push(
        issue(
          `${key}_required`,
          `${key} precisa ser preenchido.`,
          path,
        ),
      );
    } else {
      parsedStrings[key] = parsed;
    }
  }

  const palette = normalizedStringArray(candidate.palette);
  if (palette === null) {
    issues.push(
      issue(
        "palette_invalid",
        "palette precisa ser uma lista de textos preenchidos.",
        "palette",
      ),
    );
  }

  const assetRequirements = parseAssetRequirements(
    candidate.asset_requirements,
    issues,
  );

  let distinctiveChoice: string | null = null;
  let avoid: string[] | null = null;
  if (!isRecord(candidate.anti_genericity)) {
    issues.push(
      issue(
        "anti_genericity_invalid",
        "anti_genericity precisa ser um objeto.",
        "anti_genericity",
      ),
    );
  } else {
    const antiAllowedKeys = new Set(["distinctive_choice", "avoid"]);
    for (const key of Object.keys(candidate.anti_genericity)) {
      if (!antiAllowedKeys.has(key)) {
        issues.push(
          issue(
            "unexpected_field",
            `O campo "${key}" não faz parte de anti_genericity.`,
            `anti_genericity.${key}`,
          ),
        );
      }
    }

    distinctiveChoice = normalizedString(
      candidate.anti_genericity.distinctive_choice,
    );
    if (!distinctiveChoice) {
      issues.push(
        issue(
          "distinctive_choice_required",
          "anti_genericity.distinctive_choice precisa ser preenchido.",
          "anti_genericity.distinctive_choice",
        ),
      );
    }

    avoid = normalizedStringArray(candidate.anti_genericity.avoid);
    if (avoid === null) {
      issues.push(
        issue(
          "anti_genericity_avoid_invalid",
          "anti_genericity.avoid precisa ser uma lista de textos preenchidos.",
          "anti_genericity.avoid",
        ),
      );
    }
  }

  const restrictions = normalizedStringArray(candidate.restrictions);
  if (restrictions === null) {
    issues.push(
      issue(
        "restrictions_invalid",
        "restrictions precisa ser uma lista de textos preenchidos.",
        "restrictions",
      ),
    );
  }

  const dependencies = normalizedStringArray(candidate.dependencies);
  if (dependencies === null) {
    issues.push(
      issue(
        "dependencies_invalid",
        "dependencies precisa ser uma lista de textos preenchidos.",
        "dependencies",
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
      schema_version: VISUAL_DIRECTOR_RESPONSE_SCHEMA_VERSION,
      visual_system: parsedStrings.visual_system,
      composition_concept: parsedStrings.composition_concept,
      visual_gesture: parsedStrings.visual_gesture,
      typography_behavior: parsedStrings.typography_behavior,
      imagery_mode: parsedStrings.imagery_mode,
      intervention_level: parsedStrings.intervention_level,
      palette: palette!,
      asset_requirements: assetRequirements,
      anti_genericity: {
        distinctive_choice: distinctiveChoice!,
        avoid: avoid!,
      },
      restrictions: restrictions!,
      dependencies: dependencies!,
      information_to_confirm: informationToConfirm!,
    },
    issues: [],
  };
}

export function buildVisualDirectorResponseImportUpdate(
  response: string | VisualDirectorResponse,
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

export function buildVisualDirectorValidationUpdate(
  response: unknown,
): {
  result: VisualDirectorValidationResult;
  update: TablesUpdate<"creation_ai_task_runs">;
} {
  const result = parseVisualDirectorResponse(response);

  return {
    result,
    update: buildAiTaskValidationUpdate(
      result.ok
        ? { status: "valid" }
        : { status: "invalid", issues: result.issues },
    ),
  };
}

function responseToDesignSpec(
  response: VisualDirectorResponse,
): DesignSpecPayload {
  return {
    visualSystem: response.visual_system,
    compositionConcept: response.composition_concept,
    visualGesture: response.visual_gesture,
    typographyBehavior: response.typography_behavior,
    imageryMode: response.imagery_mode,
    interventionLevel: response.intervention_level,
    palette: response.palette,
    assetRequirements: response.asset_requirements.map((item) => ({
      role: item.role,
      requirement: item.requirement,
      mandatory: item.mandatory,
      sourcePreference: item.source_preference,
    })),
    antiGenericity: {
      distinctiveChoice: response.anti_genericity.distinctive_choice,
      avoid: response.anti_genericity.avoid,
    },
    restrictions: response.restrictions,
    dependencies: response.dependencies,
    informationToConfirm: response.information_to_confirm,
  };
}

export function buildDesignDraftFromValidatedVisualDirectorRun(input: {
  context: ApprovedVisualDirectorContext;
  run: AiTaskRun;
  versionNumber: number;
}): VisualDirectorDraftPlan {
  assertApprovedVisualDirectorContext(input.context);

  const { sourceCopy } = input.context;

  if (input.run.projectId !== sourceCopy.projectId) {
    throw new Error("The Visual Director task run belongs to another Creation.");
  }

  if (input.run.taskType !== "visual_direction") {
    throw new Error("The AI task run is not a visual_direction task.");
  }

  if (input.run.executionOrigin !== "external_manual") {
    throw new Error(
      "The current MVP only accepts external_manual Visual Director executions.",
    );
  }

  if (input.run.brandSnapshotId !== sourceCopy.brandSnapshotId) {
    throw new Error(
      "The Visual Director task run uses a different Brand Snapshot.",
    );
  }

  const expectedInputVersions: Record<string, string> = {
    copy_version_id: sourceCopy.id,
    strategy_version_id: sourceCopy.strategyVersionId,
    brand_snapshot_id: sourceCopy.brandSnapshotId,
    visual_direction_response_schema:
      VISUAL_DIRECTOR_RESPONSE_SCHEMA_VERSION,
  };

  for (const [key, expected] of Object.entries(expectedInputVersions)) {
    if (input.run.inputVersions[key] !== expected) {
      throw new Error(
        `The Visual Director task run has a mismatched input version: ${key}.`,
      );
    }
  }

  if (input.run.validationStatus !== "valid") {
    throw new Error(
      "A Design Version can only be created from a valid Visual Director task run.",
    );
  }

  const validation = parseVisualDirectorResponse(
    input.run.responseJson ?? input.run.responseText,
  );
  if (!validation.ok) {
    throw new Error(
      "The persisted Visual Director response no longer satisfies the Design Spec contract.",
    );
  }

  const recordedAt =
    input.run.validatedAt ??
    input.run.responseImportedAt ??
    input.run.updatedAt ??
    input.run.createdAt;

  return {
    designVersionInsert: buildDesignVersionInsert(
      sourceCopy.projectId,
      input.versionNumber,
      {
        copyVersionId: sourceCopy.id,
        design: responseToDesignSpec(validation.data),
        provenance: buildDesignProvenance({
          origin: "external_manual",
          source: `visual_director_ai_task_run:${input.run.id}`,
          recordedAt,
        }),
      },
    ),
    designStateUpdateAfterInsert: buildDesignStateAfterDraft,
  };
}
