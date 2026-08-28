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
  buildCopyProvenance,
  type CopyState,
  type CopyVersion,
} from "@/lib/creation/copy";
import {
  buildCopyRevisionDraftPlan,
  type CopyRevisionDraftPlan,
} from "@/lib/creation/copy-lifecycle";
import type { ApprovedStrategyContext } from "@/lib/creation/strategy-approval";
import { MAX_HASHTAGS } from "@/lib/hashtags";

/**
 * Post Copy Adapter V2.
 *
 * The adapter does not rewrite the canonical Copy Core. It creates a new Copy
 * Version draft whose core is byte-for-byte equivalent at the semantic object
 * level and whose Post-specific fields live only in format_extension.
 *
 * The current MVP executor remains external_manual through the AI Task Gateway.
 */
export const POST_COPY_ADAPTER_SCHEMA_VERSION = "1.0" as const;
export const POST_COPY_ADAPTER_PROMPT_VERSION = "1.0" as const;
export const POST_COPY_ADAPTER_RESPONSE_SCHEMA_VERSION =
  "post_copy_adapter_v1" as const;

export type PostCopyAdapterResponse = {
  schema_version: typeof POST_COPY_ADAPTER_RESPONSE_SCHEMA_VERSION;
  headline: string;
  support_text: string | null;
  optional_seal: string | null;
  art_cta: string | null;
  caption: string;
  hashtags: string[];
  information_to_confirm: string[];
};

export type PostCopyFormatExtension = {
  schemaVersion: typeof POST_COPY_ADAPTER_SCHEMA_VERSION;
  adapter: "post";
  sourceCopyVersionId: string;
  strategyVersionId: string;
  brandSnapshotId: string;
  headline: string;
  supportText: string | null;
  optionalSeal: string | null;
  artCta: string | null;
  caption: string;
  hashtags: string[];
  informationToConfirm: string[];
  provenance: {
    origin: "external_manual";
    source: string;
    recordedAt: string;
  };
};

export type ApprovedPostCopyContext = {
  sourceCopy: CopyVersion;
  copyState: CopyState;
  approvedStrategy: ApprovedStrategyContext;
};

export type PostCopyAdapterValidationResult =
  | {
      ok: true;
      data: PostCopyAdapterResponse;
      issues: [];
    }
  | {
      ok: false;
      data: null;
      issues: AiTaskValidationIssue[];
    };

export type PostCopyAdapterTaskPlan = {
  taskInsert: TablesInsert<"creation_ai_task_runs">;
  promptText: string;
  expectedSchema: Json;
};

export type PostCopyAdapterDraftPlan = CopyRevisionDraftPlan & {
  formatExtension: PostCopyFormatExtension;
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

function normalizeHashtag(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withoutPrefix = trimmed.replace(/^#+/, "");
  if (!withoutPrefix || /\s/.test(withoutPrefix)) return null;

  return `#${withoutPrefix}`;
}

function parseHashtagsStrict(
  value: unknown,
): { hashtags: string[]; issues: AiTaskValidationIssue[] } {
  const issues: AiTaskValidationIssue[] = [];

  if (!Array.isArray(value)) {
    return {
      hashtags: [],
      issues: [
        issue(
          "hashtags_invalid",
          "hashtags precisa ser uma lista de textos.",
          "hashtags",
        ),
      ],
    };
  }

  if (value.length > MAX_HASHTAGS) {
    issues.push(
      issue(
        "hashtags_limit_exceeded",
        `Foram recebidas ${value.length} hashtags. O limite é ${MAX_HASHTAGS}; reduza a lista explicitamente antes de importar.`,
        "hashtags",
      ),
    );
  }

  const hashtags: string[] = [];
  const seen = new Set<string>();

  value.forEach((raw, index) => {
    if (typeof raw !== "string") {
      issues.push(
        issue(
          "hashtag_invalid",
          "Cada hashtag precisa ser texto.",
          `hashtags.${index}`,
        ),
      );
      return;
    }

    const hashtag = normalizeHashtag(raw);
    if (!hashtag) {
      issues.push(
        issue(
          "hashtag_invalid",
          "Hashtag inválida. Use uma única hashtag sem espaços internos.",
          `hashtags.${index}`,
        ),
      );
      return;
    }

    const key = hashtag.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) {
      issues.push(
        issue(
          "hashtag_duplicate",
          `A hashtag ${hashtag} está duplicada.`,
          `hashtags.${index}`,
        ),
      );
      return;
    }

    seen.add(key);
    hashtags.push(hashtag);
  });

  return { hashtags, issues };
}

function stringifyPromptContext(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function assertApprovedPostCopyContext(
  context: ApprovedPostCopyContext,
): void {
  const { sourceCopy, copyState, approvedStrategy } = context;

  if (approvedStrategy.format !== "post") {
    throw new Error(
      'Post Copy Adapter requires an approved Strategy with format "post".',
    );
  }

  if (sourceCopy.approvalStatus !== "approved") {
    throw new Error(
      "Post Copy Adapter must start from the currently approved Copy Version.",
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

  if (copyState.projectId !== sourceCopy.projectId) {
    throw new Error("The Copy State belongs to another Creation.");
  }

  if (copyState.currentApprovedVersionId !== sourceCopy.id) {
    throw new Error(
      "Post Copy Adapter must start from currentApprovedVersionId.",
    );
  }
}

export function getPostCopyAdapterExpectedSchema(): Json {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "schema_version",
      "headline",
      "support_text",
      "optional_seal",
      "art_cta",
      "caption",
      "hashtags",
      "information_to_confirm",
    ],
    properties: {
      schema_version: {
        const: POST_COPY_ADAPTER_RESPONSE_SCHEMA_VERSION,
      },
      headline: { type: "string", minLength: 1 },
      support_text: { type: ["string", "null"] },
      optional_seal: { type: ["string", "null"] },
      art_cta: { type: ["string", "null"] },
      caption: { type: "string", minLength: 1 },
      hashtags: {
        type: "array",
        maxItems: MAX_HASHTAGS,
        items: { type: "string", minLength: 1 },
      },
      information_to_confirm: {
        type: "array",
        items: { type: "string", minLength: 1 },
      },
    },
  } as Json;
}

/**
 * Builds the external/manual prompt that adapts approved Copy Core into Post
 * copy fields. The task remains a "copy" task because this is format-specific
 * copy adaptation, not visual direction or a new creative strategy.
 */
export function buildPostCopyAdapterPrompt(input: {
  context: ApprovedPostCopyContext;
  additionalContext?: string | null;
}): string {
  assertApprovedPostCopyContext(input.context);

  const additionalContext = normalizedString(input.additionalContext);
  const { sourceCopy, approvedStrategy } = input.context;

  const canonicalInput: Record<string, Json> = {
    source_copy_version_id: sourceCopy.id,
    fixed_strategy: {
      strategy_version_id: approvedStrategy.strategyVersionId,
      objective: approvedStrategy.objective ?? null,
      approach: approvedStrategy.approach ?? null,
      format: approvedStrategy.format,
      concept: approvedStrategy.concept,
      audience: approvedStrategy.audience,
      strategy_payload: approvedStrategy.strategyPayload,
    },
    frozen_brand_snapshot: approvedStrategy.brandSnapshot,
    approved_copy_core: {
      primary_message: sourceCopy.core.primaryMessage,
      supporting_points: sourceCopy.core.supportingPoints,
      cta: sourceCopy.core.cta
        ? {
            intent: sourceCopy.core.cta.intent,
            wording: sourceCopy.core.cta.wording,
          }
        : null,
    },
  };

  if (additionalContext) {
    canonicalInput.additional_context = additionalContext;
  }

  const ctaRule = sourceCopy.core.cta
    ? '- A Copy Core possui CTA. "art_cta" pode adaptar essa mesma intenção para a arte, sem criar nova promessa, urgência ou ação diferente.'
    : '- A Copy Core NÃO possui CTA. "art_cta" DEVE ser null e a legenda não pode inventar uma chamada para ação.';

  return `Você está executando o POST COPY ADAPTER do Cria Aí 2.0.

OBJETIVO
Adaptar uma Copy Core JÁ APROVADA para os campos textuais próprios de um Post estático, sem alterar estratégia, fatos da marca ou a mensagem canônica.

REGRAS CRÍTICAS
- A Strategy, o Brand Snapshot e a Copy Core abaixo já estão aprovados. NÃO redefina Objective, Approach, Format, Concept, público, posicionamento ou mensagem central.
- O formato está fixado como Post. Não transforme a peça em carrossel, Reel, Story ou campanha.
- Preserve integralmente o sentido de "primary_message" e "supporting_points". O adapter organiza e redige para o formato; ele não cria uma nova Copy Core.
- "headline" é o texto principal da arte e deve ser claro, específico e coerente com a Copy Core.
- "support_text" é apoio opcional da arte. Use null quando a headline se sustentar sozinha.
- "optional_seal" é um selo/chamada curta opcional. Use null quando não agregar informação real.
${ctaRule}
- "caption" é a legenda final da publicação. Pode desenvolver a mensagem aprovada, mas não inventar fatos, preços, datas, serviços, benefícios, provas, condições ou promessas.
- "hashtags" aceita no máximo ${MAX_HASHTAGS}. Nunca devolva mais que isso e nunca corte uma lista silenciosamente.
- Se não houver hashtags realmente úteis, devolva [].
- Se faltar informação para afirmar algo com segurança, não invente. Registre a pendência em "information_to_confirm".
- NÃO crie direção visual, composição, paleta, tipografia, prompt de imagem, fotografia, ilustração ou layout. Isso pertence ao Visual Director.
- NÃO altere a Copy Core para caber em limite de caracteres. Não trunque texto silenciosamente.
- Devolva SOMENTE JSON válido, sem markdown e sem comentários.

ENTRADA CANÔNICA
${stringifyPromptContext(canonicalInput)}

SCHEMA DE SAÍDA OBRIGATÓRIO
{
  "schema_version": "${POST_COPY_ADAPTER_RESPONSE_SCHEMA_VERSION}",
  "headline": "",
  "support_text": null,
  "optional_seal": null,
  "art_cta": null,
  "caption": "",
  "hashtags": [],
  "information_to_confirm": []
}`.trim();
}

export function buildPostCopyAdapterTaskPlan(input: {
  context: ApprovedPostCopyContext;
  additionalContext?: string | null;
  rulePackVersions?: Record<string, string | null | undefined>;
}): PostCopyAdapterTaskPlan {
  assertApprovedPostCopyContext(input.context);

  const promptText = buildPostCopyAdapterPrompt({
    context: input.context,
    additionalContext: input.additionalContext,
  });
  const expectedSchema = getPostCopyAdapterExpectedSchema();
  const { sourceCopy, approvedStrategy } = input.context;

  return {
    taskInsert: buildExternalManualAiTaskInsert({
      projectId: sourceCopy.projectId,
      taskType: "copy",
      inputVersions: {
        source_copy_version_id: sourceCopy.id,
        strategy_version_id: sourceCopy.strategyVersionId,
        brand_snapshot_id: sourceCopy.brandSnapshotId,
        post_copy_adapter_schema: POST_COPY_ADAPTER_SCHEMA_VERSION,
        post_copy_adapter_response_schema:
          POST_COPY_ADAPTER_RESPONSE_SCHEMA_VERSION,
      },
      brandSnapshotId: approvedStrategy.brandSnapshotId,
      rulePackVersions: input.rulePackVersions,
      promptVersion: POST_COPY_ADAPTER_PROMPT_VERSION,
      promptText,
      expectedSchema: expectedSchema as Record<string, Json>,
    }),
    promptText,
    expectedSchema,
  };
}

export function parsePostCopyAdapterResponse(
  value: unknown,
  sourceCopy?: CopyVersion,
): PostCopyAdapterValidationResult {
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
          "A resposta do Post Copy Adapter precisa ser um objeto JSON.",
          null,
        ),
      ],
    };
  }

  const issues: AiTaskValidationIssue[] = [];
  const allowedKeys = new Set([
    "schema_version",
    "headline",
    "support_text",
    "optional_seal",
    "art_cta",
    "caption",
    "hashtags",
    "information_to_confirm",
  ]);

  for (const key of Object.keys(candidate)) {
    if (!allowedKeys.has(key)) {
      issues.push(
        issue(
          "unexpected_field",
          `O campo "${key}" não faz parte do contrato do Post Copy Adapter.`,
          key,
        ),
      );
    }
  }

  const schemaVersion = normalizedString(candidate.schema_version);
  if (schemaVersion !== POST_COPY_ADAPTER_RESPONSE_SCHEMA_VERSION) {
    issues.push(
      issue(
        "invalid_schema_version",
        `schema_version precisa ser "${POST_COPY_ADAPTER_RESPONSE_SCHEMA_VERSION}".`,
        "schema_version",
      ),
    );
  }

  const headline = normalizedString(candidate.headline);
  if (!headline) {
    issues.push(
      issue(
        "headline_required",
        "headline precisa ser preenchida.",
        "headline",
      ),
    );
  }

  const supportTextResult = normalizedNullableString(candidate.support_text);
  if (!supportTextResult.valid) {
    issues.push(
      issue(
        "support_text_invalid",
        "support_text precisa ser texto preenchido ou null.",
        "support_text",
      ),
    );
  }

  const optionalSealResult = normalizedNullableString(candidate.optional_seal);
  if (!optionalSealResult.valid) {
    issues.push(
      issue(
        "optional_seal_invalid",
        "optional_seal precisa ser texto preenchido ou null.",
        "optional_seal",
      ),
    );
  }

  const artCtaResult = normalizedNullableString(candidate.art_cta);
  if (!artCtaResult.valid) {
    issues.push(
      issue(
        "art_cta_invalid",
        "art_cta precisa ser texto preenchido ou null.",
        "art_cta",
      ),
    );
  }

  if (sourceCopy?.core.cta === null && artCtaResult.value !== null) {
    issues.push(
      issue(
        "art_cta_not_allowed",
        "A Copy Core aprovada não possui CTA; art_cta precisa ser null.",
        "art_cta",
      ),
    );
  }

  const caption = normalizedString(candidate.caption);
  if (!caption) {
    issues.push(
      issue(
        "caption_required",
        "caption precisa ser preenchida.",
        "caption",
      ),
    );
  }

  const hashtagsResult = parseHashtagsStrict(candidate.hashtags);
  issues.push(...hashtagsResult.issues);

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
      schema_version: POST_COPY_ADAPTER_RESPONSE_SCHEMA_VERSION,
      headline: headline!,
      support_text: supportTextResult.value,
      optional_seal: optionalSealResult.value,
      art_cta: artCtaResult.value,
      caption: caption!,
      hashtags: hashtagsResult.hashtags,
      information_to_confirm: informationToConfirm!,
    },
    issues: [],
  };
}

export function buildPostCopyAdapterResponseImportUpdate(
  response: string | PostCopyAdapterResponse,
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

export function buildPostCopyAdapterValidationUpdate(input: {
  response: unknown;
  sourceCopy: CopyVersion;
}): {
  result: PostCopyAdapterValidationResult;
  update: TablesUpdate<"creation_ai_task_runs">;
} {
  const result = parsePostCopyAdapterResponse(
    input.response,
    input.sourceCopy,
  );

  return {
    result,
    update: buildAiTaskValidationUpdate(
      result.ok
        ? { status: "valid" }
        : { status: "invalid", issues: result.issues },
    ),
  };
}

function responseToFormatExtension(input: {
  response: PostCopyAdapterResponse;
  sourceCopy: CopyVersion;
  run: AiTaskRun;
}): PostCopyFormatExtension {
  const recordedAt =
    input.run.validatedAt ??
    input.run.responseImportedAt ??
    input.run.updatedAt ??
    input.run.createdAt;

  return {
    schemaVersion: POST_COPY_ADAPTER_SCHEMA_VERSION,
    adapter: "post",
    sourceCopyVersionId: input.sourceCopy.id,
    strategyVersionId: input.sourceCopy.strategyVersionId,
    brandSnapshotId: input.sourceCopy.brandSnapshotId,
    headline: input.response.headline,
    supportText: input.response.support_text,
    optionalSeal: input.response.optional_seal,
    artCta: input.response.art_cta,
    caption: input.response.caption,
    hashtags: input.response.hashtags,
    informationToConfirm: input.response.information_to_confirm,
    provenance: {
      origin: "external_manual",
      source: `ai_task_run:${input.run.id}`,
      recordedAt,
    },
  };
}

export function postCopyFormatExtensionToJson(
  extension: PostCopyFormatExtension,
): Json {
  if (extension.hashtags.length > MAX_HASHTAGS) {
    throw new Error(
      `Post Copy extension exceeds the ${MAX_HASHTAGS}-hashtag limit.`,
    );
  }

  return {
    schema_version: extension.schemaVersion,
    adapter: extension.adapter,
    source_copy_version_id: extension.sourceCopyVersionId,
    strategy_version_id: extension.strategyVersionId,
    brand_snapshot_id: extension.brandSnapshotId,
    headline: extension.headline,
    support_text: extension.supportText,
    optional_seal: extension.optionalSeal,
    art_cta: extension.artCta,
    caption: extension.caption,
    hashtags: extension.hashtags,
    information_to_confirm: extension.informationToConfirm,
    provenance: {
      origin: extension.provenance.origin,
      source: extension.provenance.source,
      recorded_at: extension.provenance.recordedAt,
    },
  };
}

/**
 * Converts a validated Post adapter run into a NEW Copy Version draft.
 *
 * The approved source Copy remains immutable. The new version preserves the
 * exact same Copy Core and stores only Post-specific fields in format_extension.
 */
export function buildPostCopyAdapterDraftFromValidatedRun(input: {
  context: ApprovedPostCopyContext;
  run: AiTaskRun;
  versionNumber: number;
}): PostCopyAdapterDraftPlan {
  assertApprovedPostCopyContext(input.context);

  const { sourceCopy, copyState, approvedStrategy } = input.context;

  if (input.run.projectId !== sourceCopy.projectId) {
    throw new Error("The Post adapter task run belongs to another Creation.");
  }

  if (input.run.taskType !== "copy") {
    throw new Error("The AI task run is not a Copy task.");
  }

  if (input.run.executionOrigin !== "external_manual") {
    throw new Error(
      "The current MVP only accepts external_manual Post Copy Adapter executions.",
    );
  }

  if (input.run.brandSnapshotId !== sourceCopy.brandSnapshotId) {
    throw new Error(
      "The Post adapter task run uses a different Brand Snapshot.",
    );
  }

  const expectedInputVersions: Record<string, string> = {
    source_copy_version_id: sourceCopy.id,
    strategy_version_id: sourceCopy.strategyVersionId,
    brand_snapshot_id: sourceCopy.brandSnapshotId,
    post_copy_adapter_schema: POST_COPY_ADAPTER_SCHEMA_VERSION,
    post_copy_adapter_response_schema:
      POST_COPY_ADAPTER_RESPONSE_SCHEMA_VERSION,
  };

  for (const [key, expected] of Object.entries(expectedInputVersions)) {
    if (input.run.inputVersions[key] !== expected) {
      throw new Error(
        `The Post adapter task run has a mismatched input version: ${key}.`,
      );
    }
  }

  if (input.run.validationStatus !== "valid") {
    throw new Error(
      "A Post Copy Adapter draft can only be created from a valid task run.",
    );
  }

  const validation = parsePostCopyAdapterResponse(
    input.run.responseJson ?? input.run.responseText,
    sourceCopy,
  );
  if (!validation.ok) {
    throw new Error(
      "The persisted Post adapter response no longer satisfies the adapter contract.",
    );
  }

  const formatExtension = responseToFormatExtension({
    response: validation.data,
    sourceCopy,
    run: input.run,
  });

  const provenance = buildCopyProvenance({
    origin: "external_manual",
    source: `post_copy_adapter_ai_task_run:${input.run.id}`,
    recordedAt: formatExtension.provenance.recordedAt,
  });

  const revisionPlan = buildCopyRevisionDraftPlan({
    source: sourceCopy,
    state: copyState,
    versionNumber: input.versionNumber,
    core: sourceCopy.core,
    formatExtension: postCopyFormatExtensionToJson(formatExtension),
    provenance,
  });

  if (
    revisionPlan.copyVersionInsert.strategy_version_id !==
      approvedStrategy.strategyVersionId ||
    revisionPlan.copyVersionInsert.brand_snapshot_id !==
      approvedStrategy.brandSnapshotId
  ) {
    throw new Error(
      "Post adapter draft lost its approved Strategy/Brand Snapshot lineage.",
    );
  }

  return {
    ...revisionPlan,
    formatExtension,
  };
}
