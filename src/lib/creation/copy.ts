import type {
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/integrations/supabase/types";
import {
  PROVENANCE_SCHEMA_VERSION,
  isKnownProvenanceOrigin,
  type KnownProvenanceOrigin,
  type ProvenanceOrigin,
} from "@/lib/creation/provenance";

/**
 * Canonical, format-agnostic Copy foundation.
 *
 * A Copy Version is always tied to the exact approved Strategy Version and
 * frozen Brand Snapshot that produced it. Post/Reel/etc. adapters may later
 * populate format_extension without turning content_outputs into source of truth.
 */
export const COPY_SCHEMA_VERSION = "1.0" as const;

export type CopyApprovalStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "rejected"
  | "superseded";

export type CopyStateStatus =
  | "not_started"
  | "drafting"
  | "in_review"
  | "approved"
  | "needs_revision";

export type CopyCta = {
  /** Semantic intent is deliberately open until a canonical CTA taxonomy exists. */
  intent: string | null;
  /** Final wording may be null: a valid piece can intentionally have no CTA. */
  wording: string | null;
};

export type CopyCorePayload = {
  /** Main message the format-specific adapter must preserve. */
  primaryMessage: string;
  /** Supporting ideas/facts in priority order. */
  supportingPoints: string[];
  /** Null means the approved copy intentionally has no CTA. */
  cta: CopyCta | null;
};

export type CopyProvenance = {
  schemaVersion: string;
  origin: ProvenanceOrigin;
  source: string | null;
  recordedAt: string | null;
};

export type CopyVersionInput = {
  strategyVersionId: string;
  brandSnapshotId: string;
  core: CopyCorePayload;
  /** Reserved for the future format adapter (Post, Reel, Carousel...). */
  formatExtension?: Json;
  provenance: CopyProvenance;
  basedOnVersionId?: string | null;
};

export type CopyVersion = {
  id: string;
  projectId: string;
  strategyVersionId: string;
  brandSnapshotId: string;
  basedOnVersionId: string | null;
  versionNumber: number;
  schemaVersion: string;
  core: CopyCorePayload;
  formatExtension: Json;
  provenance: CopyProvenance;
  approvalStatus: CopyApprovalStatus;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CopyState = {
  projectId: string;
  currentVersionId: string | null;
  currentApprovedVersionId: string | null;
  status: CopyStateStatus;
  createdAt: string;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeSupportingPoints(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeCopyCorePayload(input: CopyCorePayload): CopyCorePayload {
  const primaryMessage = input.primaryMessage.trim();
  if (!primaryMessage) throw new Error("Copy primaryMessage must not be blank.");

  const supportingPoints = input.supportingPoints
    .map((point) => point.trim())
    .filter(Boolean);

  let cta: CopyCta | null = null;
  if (input.cta) {
    const intent = input.cta.intent?.trim() || null;
    const wording = input.cta.wording?.trim() || null;
    cta = intent || wording ? { intent, wording } : null;
  }

  return { primaryMessage, supportingPoints, cta };
}

export function copyCorePayloadToJson(input: CopyCorePayload): Json {
  const core = normalizeCopyCorePayload(input);
  return {
    primary_message: core.primaryMessage,
    supporting_points: core.supportingPoints,
    cta: core.cta
      ? {
          intent: core.cta.intent,
          wording: core.cta.wording,
        }
      : null,
  };
}

export function parseCopyCorePayload(value: Json): CopyCorePayload {
  if (!isRecord(value)) {
    throw new Error("Invalid Copy Core payload: object expected.");
  }

  const primaryMessage = nullableString(value.primary_message);
  if (!primaryMessage) {
    throw new Error("Invalid Copy Core payload: primary_message is required.");
  }

  const supportingPoints = normalizeSupportingPoints(value.supporting_points);

  let cta: CopyCta | null = null;
  if (value.cta !== null && value.cta !== undefined) {
    if (!isRecord(value.cta)) {
      throw new Error("Invalid Copy Core payload: cta must be an object or null.");
    }

    const intent = nullableString(value.cta.intent);
    const wording = nullableString(value.cta.wording);
    cta = intent || wording ? { intent, wording } : null;
  }

  return { primaryMessage, supportingPoints, cta };
}

export function buildCopyProvenance(input: {
  origin: KnownProvenanceOrigin;
  source?: string | null;
  recordedAt?: string | null;
}): CopyProvenance {
  return {
    schemaVersion: PROVENANCE_SCHEMA_VERSION,
    origin: input.origin,
    source: input.source?.trim() || null,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
  };
}

export function copyProvenanceToJson(provenance: CopyProvenance): Json {
  return {
    schemaVersion: provenance.schemaVersion,
    origin: provenance.origin,
    source: provenance.source,
    recordedAt: provenance.recordedAt,
  };
}

export function parseCopyProvenance(value: Json): CopyProvenance {
  if (!isRecord(value)) {
    return {
      schemaVersion: PROVENANCE_SCHEMA_VERSION,
      origin: "unknown",
      source: null,
      recordedAt: null,
    };
  }

  return {
    schemaVersion:
      nullableString(value.schemaVersion) ?? PROVENANCE_SCHEMA_VERSION,
    origin: isKnownProvenanceOrigin(value.origin) ? value.origin : "unknown",
    source: nullableString(value.source),
    recordedAt: nullableString(value.recordedAt),
  };
}

function normalizeObjectJson(value: Json | undefined): Json {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    throw new Error("Copy formatExtension must be a JSON object.");
  }
  return value;
}

export function buildCopyVersionInsert(
  projectId: string,
  versionNumber: number,
  input: CopyVersionInput,
): TablesInsert<"creation_copy_versions"> {
  const id = projectId.trim();
  const strategyVersionId = input.strategyVersionId.trim();
  const brandSnapshotId = input.brandSnapshotId.trim();

  if (!id) throw new Error("projectId must not be blank.");
  if (!strategyVersionId) throw new Error("strategyVersionId must not be blank.");
  if (!brandSnapshotId) throw new Error("brandSnapshotId must not be blank.");
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    throw new Error("Copy versionNumber must be a positive integer.");
  }

  return {
    project_id: id,
    strategy_version_id: strategyVersionId,
    brand_snapshot_id: brandSnapshotId,
    based_on_version_id: input.basedOnVersionId?.trim() || null,
    version_number: versionNumber,
    schema_version: COPY_SCHEMA_VERSION,
    core_payload: copyCorePayloadToJson(input.core),
    format_extension: normalizeObjectJson(input.formatExtension),
    provenance: copyProvenanceToJson(input.provenance),
    approval_status: "draft",
    approved_at: null,
  };
}

/**
 * Editing an approved canonical copy creates a new immutable version.
 * The source version remains untouched and becomes lineage only.
 */
export function buildCopyRevisionFromApproved(input: {
  source: CopyVersion;
  versionNumber: number;
  core: CopyCorePayload;
  formatExtension?: Json;
  provenance: CopyProvenance;
}): TablesInsert<"creation_copy_versions"> {
  if (
    input.source.approvalStatus !== "approved" &&
    input.source.approvalStatus !== "superseded"
  ) {
    throw new Error(
      "Copy revision source must be an approved or previously approved version.",
    );
  }

  return buildCopyVersionInsert(input.source.projectId, input.versionNumber, {
    strategyVersionId: input.source.strategyVersionId,
    brandSnapshotId: input.source.brandSnapshotId,
    basedOnVersionId: input.source.id,
    core: input.core,
    formatExtension: input.formatExtension ?? input.source.formatExtension,
    provenance: input.provenance,
  });
}

export function buildCopyStateInsert(
  projectId: string,
): TablesInsert<"creation_copy_state"> {
  return {
    project_id: projectId,
    current_version_id: null,
    current_approved_version_id: null,
    status: "not_started",
  };
}

export function buildCopyStateAfterDraft(
  copyVersionId: string,
): TablesUpdate<"creation_copy_state"> {
  const id = copyVersionId.trim();
  if (!id) throw new Error("copyVersionId must not be blank.");

  return {
    current_version_id: id,
    status: "drafting",
  };
}

export function toCopyVersion(
  row: Tables<"creation_copy_versions">,
): CopyVersion {
  return {
    id: row.id,
    projectId: row.project_id,
    strategyVersionId: row.strategy_version_id,
    brandSnapshotId: row.brand_snapshot_id,
    basedOnVersionId: row.based_on_version_id,
    versionNumber: row.version_number,
    schemaVersion: row.schema_version,
    core: parseCopyCorePayload(row.core_payload),
    formatExtension: row.format_extension,
    provenance: parseCopyProvenance(row.provenance),
    approvalStatus: row.approval_status as CopyApprovalStatus,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCopyState(row: Tables<"creation_copy_state">): CopyState {
  return {
    projectId: row.project_id,
    currentVersionId: row.current_version_id,
    currentApprovedVersionId: row.current_approved_version_id,
    status: row.status as CopyStateStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
