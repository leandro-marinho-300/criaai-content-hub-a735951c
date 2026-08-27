import type {
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/integrations/supabase/types";

export const AI_TASK_CONTRACT_VERSION = "1.0" as const;
export const AI_TASK_PROVENANCE_SCHEMA_VERSION = "1.0" as const;

export const AI_TASK_TYPES = [
  "strategy",
  "copy",
  "visual_direction",
  "revision",
  "qualitative_qa",
] as const;

export type AiTaskType = (typeof AI_TASK_TYPES)[number];

export const AI_TASK_EXECUTION_ORIGINS = ["external_manual"] as const;
export type KnownAiTaskExecutionOrigin =
  (typeof AI_TASK_EXECUTION_ORIGINS)[number];
export type AiTaskExecutionOrigin = KnownAiTaskExecutionOrigin | "unknown";

export const AI_TASK_VALIDATION_STATUSES = [
  "pending",
  "valid",
  "invalid",
] as const;

export type AiTaskValidationStatus =
  (typeof AI_TASK_VALIDATION_STATUSES)[number];

export type AiTaskVersionRefs = Record<string, string>;
export type AiTaskRulePackVersions = Record<string, string>;

export type AiTaskRunProvenance = {
  schemaVersion: string;
  executionOrigin: AiTaskExecutionOrigin;
  source: string | null;
  recordedAt: string | null;
};

export type AiTaskValidationIssue = {
  code: string;
  message: string;
  path: string | null;
};

export type AiTaskRun = {
  id: string;
  projectId: string;
  taskType: AiTaskType;
  contractVersion: string;
  executionOrigin: AiTaskExecutionOrigin;
  inputVersions: AiTaskVersionRefs;
  brandSnapshotId: string | null;
  rulePackVersions: AiTaskRulePackVersions;
  promptVersion: string;
  promptText: string;
  expectedSchema: Json;
  responseJson: Json | null;
  responseText: string | null;
  validationStatus: AiTaskValidationStatus;
  validationIssues: AiTaskValidationIssue[];
  provenance: AiTaskRunProvenance;
  responseImportedAt: string | null;
  validatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type JsonObject = { [key: string]: Json | undefined };

const TASK_TYPES = new Set<string>(AI_TASK_TYPES);
const EXECUTION_ORIGINS = new Set<string>(AI_TASK_EXECUTION_ORIGINS);
const VALIDATION_STATUSES = new Set<string>(AI_TASK_VALIDATION_STATUSES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredString(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName} must not be blank.`);
  }
  return normalized;
}

function toStringMap(
  value: Json,
): Record<string, string> {
  if (!isRecord(value)) return {};

  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw !== "string") continue;
    const normalizedKey = key.trim();
    const normalizedValue = raw.trim();
    if (!normalizedKey || !normalizedValue) continue;
    result[normalizedKey] = normalizedValue;
  }
  return result;
}

function stringMapToJson(
  value: Record<string, string | null | undefined> | undefined,
): JsonObject {
  const result: JsonObject = {};

  for (const [key, raw] of Object.entries(value ?? {})) {
    const normalizedKey = key.trim();
    const normalizedValue = raw?.trim();
    if (!normalizedKey || !normalizedValue) continue;
    result[normalizedKey] = normalizedValue;
  }

  return result;
}

export function isAiTaskType(value: unknown): value is AiTaskType {
  return typeof value === "string" && TASK_TYPES.has(value);
}

export function isKnownAiTaskExecutionOrigin(
  value: unknown,
): value is KnownAiTaskExecutionOrigin {
  return typeof value === "string" && EXECUTION_ORIGINS.has(value);
}

export function isAiTaskValidationStatus(
  value: unknown,
): value is AiTaskValidationStatus {
  return typeof value === "string" && VALIDATION_STATUSES.has(value);
}

function normalizeTaskType(value: string): AiTaskType {
  if (!isAiTaskType(value)) {
    throw new Error(`Unknown AI task type: ${value}`);
  }
  return value;
}

function normalizeExecutionOrigin(value: unknown): AiTaskExecutionOrigin {
  return isKnownAiTaskExecutionOrigin(value) ? value : "unknown";
}

function normalizeValidationStatus(value: string): AiTaskValidationStatus {
  return isAiTaskValidationStatus(value) ? value : "pending";
}

export function buildExternalManualTaskProvenance(input?: {
  source?: string | null;
  recordedAt?: string | null;
}): AiTaskRunProvenance {
  return {
    schemaVersion: AI_TASK_PROVENANCE_SCHEMA_VERSION,
    executionOrigin: "external_manual",
    source: input?.source?.trim() || null,
    recordedAt: input?.recordedAt ?? new Date().toISOString(),
  };
}

export function aiTaskProvenanceToJson(
  provenance: AiTaskRunProvenance,
): JsonObject {
  return {
    schemaVersion: provenance.schemaVersion,
    executionOrigin: provenance.executionOrigin,
    source: provenance.source,
    recordedAt: provenance.recordedAt,
  };
}

export function parseAiTaskProvenance(value: Json): AiTaskRunProvenance {
  if (!isRecord(value)) {
    return {
      schemaVersion: AI_TASK_PROVENANCE_SCHEMA_VERSION,
      executionOrigin: "unknown",
      source: null,
      recordedAt: null,
    };
  }

  return {
    schemaVersion:
      nullableString(value.schemaVersion) ?? AI_TASK_PROVENANCE_SCHEMA_VERSION,
    executionOrigin: normalizeExecutionOrigin(value.executionOrigin),
    source: nullableString(value.source),
    recordedAt: nullableString(value.recordedAt),
  };
}

function validationIssuesToJson(
  issues: AiTaskValidationIssue[],
): Json[] {
  return issues.map((issue) => ({
    code: requiredString(issue.code, "validation issue code"),
    message: requiredString(issue.message, "validation issue message"),
    path: issue.path?.trim() || null,
  }));
}

function parseValidationIssues(value: Json): AiTaskValidationIssue[] {
  if (!Array.isArray(value)) return [];

  const issues: AiTaskValidationIssue[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;

    const code = nullableString(raw.code);
    const message = nullableString(raw.message);
    if (!code || !message) continue;

    issues.push({
      code,
      message,
      path: nullableString(raw.path),
    });
  }

  return issues;
}

/**
 * Creates the persisted request envelope for the MVP executor.
 *
 * The Gateway is executor-independent at the contract level, but V2 MVP only
 * prepares external_manual runs. No AI provider/API is called from this module.
 */
export function buildExternalManualAiTaskInsert(input: {
  projectId: string;
  taskType: AiTaskType;
  inputVersions?: Record<string, string | null | undefined>;
  brandSnapshotId?: string | null;
  rulePackVersions?: Record<string, string | null | undefined>;
  promptVersion: string;
  promptText: string;
  expectedSchema?: JsonObject;
  provenance?: AiTaskRunProvenance;
}): TablesInsert<"creation_ai_task_runs"> {
  const provenance =
    input.provenance ?? buildExternalManualTaskProvenance();

  if (provenance.executionOrigin !== "external_manual") {
    throw new Error(
      "The current MVP Gateway only accepts external_manual execution.",
    );
  }

  return {
    project_id: requiredString(input.projectId, "projectId"),
    task_type: normalizeTaskType(input.taskType),
    contract_version: AI_TASK_CONTRACT_VERSION,
    execution_origin: "external_manual",
    input_versions: stringMapToJson(input.inputVersions),
    brand_snapshot_id: input.brandSnapshotId?.trim() || null,
    rule_pack_versions: stringMapToJson(input.rulePackVersions),
    prompt_version: requiredString(input.promptVersion, "promptVersion"),
    prompt_text: requiredString(input.promptText, "promptText"),
    expected_schema: input.expectedSchema ?? {},
    response_json: null,
    response_text: null,
    validation_status: "pending",
    validation_errors: [],
    provenance: aiTaskProvenanceToJson(provenance),
    response_imported_at: null,
    validated_at: null,
  };
}

/**
 * Records a response copied back from an external/manual executor.
 *
 * Importing does not mean the response is valid. Validation remains a separate
 * step so future task contracts can apply their own deterministic validators.
 */
export function buildExternalManualResponseImportUpdate(input: {
  responseJson?: Json | null;
  responseText?: string | null;
  importedAt?: string | null;
}): TablesUpdate<"creation_ai_task_runs"> {
  const responseText = input.responseText?.trim() || null;
  const responseJson = input.responseJson ?? null;

  if (responseJson === null && responseText === null) {
    throw new Error("An external response must include JSON or text.");
  }

  return {
    response_json: responseJson,
    response_text: responseText,
    response_imported_at: input.importedAt ?? new Date().toISOString(),
    validation_status: "pending",
    validation_errors: [],
    validated_at: null,
  };
}

export function buildAiTaskValidationUpdate(input: {
  status: Exclude<AiTaskValidationStatus, "pending">;
  issues?: AiTaskValidationIssue[];
  validatedAt?: string | null;
}): TablesUpdate<"creation_ai_task_runs"> {
  const issues = input.issues ?? [];

  if (input.status === "valid" && issues.length > 0) {
    throw new Error("A valid AI task run cannot contain validation issues.");
  }

  if (input.status === "invalid" && issues.length === 0) {
    throw new Error("An invalid AI task run must contain at least one issue.");
  }

  return {
    validation_status: input.status,
    validation_errors: validationIssuesToJson(issues),
    validated_at: input.validatedAt ?? new Date().toISOString(),
  };
}

export function toAiTaskRun(
  row: Tables<"creation_ai_task_runs">,
): AiTaskRun {
  return {
    id: row.id,
    projectId: row.project_id,
    taskType: normalizeTaskType(row.task_type),
    contractVersion: row.contract_version,
    executionOrigin: normalizeExecutionOrigin(row.execution_origin),
    inputVersions: toStringMap(row.input_versions),
    brandSnapshotId: row.brand_snapshot_id,
    rulePackVersions: toStringMap(row.rule_pack_versions),
    promptVersion: row.prompt_version,
    promptText: row.prompt_text,
    expectedSchema: row.expected_schema,
    responseJson: row.response_json,
    responseText: row.response_text?.trim() || null,
    validationStatus: normalizeValidationStatus(row.validation_status),
    validationIssues: parseValidationIssues(row.validation_errors),
    provenance: parseAiTaskProvenance(row.provenance),
    responseImportedAt: row.response_imported_at,
    validatedAt: row.validated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
