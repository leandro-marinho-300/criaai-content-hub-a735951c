import type {
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/integrations/supabase/types";

export const STRATEGY_SCHEMA_VERSION = "1.0" as const;
export const BRAND_SNAPSHOT_SCHEMA_VERSION = "1.0" as const;

export type StrategyApprovalStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "rejected"
  | "superseded";

export type StrategyStateStatus =
  | "not_started"
  | "drafting"
  | "in_review"
  | "approved"
  | "needs_revision";

export type StrategyVersionInput = {
  objective?: string | null;
  approach?: string | null;
  format?: string | null;
  concept?: string | null;
  audience?: string | null;
  strategyPayload?: Json;
  provenance?: Json;
};

export type StrategyVersion = {
  id: string;
  projectId: string;
  versionNumber: number;
  schemaVersion: string;
  objective: string | null;
  approach: string | null;
  format: string | null;
  concept: string | null;
  audience: string | null;
  strategyPayload: Json;
  provenance: Json;
  approvalStatus: StrategyApprovalStatus;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StrategyState = {
  projectId: string;
  currentVersionId: string | null;
  currentApprovedVersionId: string | null;
  status: StrategyStateStatus;
  createdAt: string;
  updatedAt: string;
};

export type BrandSnapshot = {
  id: string;
  projectId: string;
  strategyVersionId: string;
  brandId: string | null;
  brandUpdatedAt: string | null;
  snapshotSchemaVersion: string;
  snapshotJson: Json;
  createdAt: string;
};

export function buildStrategyVersionInsert(
  projectId: string,
  versionNumber: number,
  input: StrategyVersionInput,
): TablesInsert<"creation_strategy_versions"> {
  return {
    project_id: projectId,
    version_number: versionNumber,
    schema_version: STRATEGY_SCHEMA_VERSION,
    objective: input.objective ?? null,
    approach: input.approach ?? null,
    format: input.format ?? null,
    concept: input.concept ?? null,
    audience: input.audience ?? null,
    strategy_payload: input.strategyPayload ?? {},
    provenance: input.provenance ?? {},
    approval_status: "draft",
    approved_at: null,
  };
}

export function buildStrategyStateInsert(
  projectId: string,
): TablesInsert<"creation_strategy_state"> {
  return {
    project_id: projectId,
    current_version_id: null,
    current_approved_version_id: null,
    status: "not_started",
  };
}

export function buildBrandSnapshotInsert(input: {
  projectId: string;
  strategyVersionId: string;
  brandId?: string | null;
  brandUpdatedAt?: string | null;
  snapshotJson: Json;
}): TablesInsert<"creation_brand_snapshots"> {
  return {
    project_id: input.projectId,
    strategy_version_id: input.strategyVersionId,
    brand_id: input.brandId ?? null,
    brand_updated_at: input.brandUpdatedAt ?? null,
    snapshot_schema_version: BRAND_SNAPSHOT_SCHEMA_VERSION,
    snapshot_json: input.snapshotJson,
  };
}

export function buildStrategyApprovalUpdate(
  status: StrategyApprovalStatus,
  approvedAt?: string | null,
): TablesUpdate<"creation_strategy_versions"> {
  const requiresApprovedAt = status === "approved" || status === "superseded";

  return {
    approval_status: status,
    approved_at: requiresApprovedAt ? (approvedAt ?? new Date().toISOString()) : null,
  };
}

export function toStrategyVersion(
  row: Tables<"creation_strategy_versions">,
): StrategyVersion {
  return {
    id: row.id,
    projectId: row.project_id,
    versionNumber: row.version_number,
    schemaVersion: row.schema_version,
    objective: row.objective,
    approach: row.approach,
    format: row.format,
    concept: row.concept,
    audience: row.audience,
    strategyPayload: row.strategy_payload,
    provenance: row.provenance,
    approvalStatus: row.approval_status as StrategyApprovalStatus,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toStrategyState(
  row: Tables<"creation_strategy_state">,
): StrategyState {
  return {
    projectId: row.project_id,
    currentVersionId: row.current_version_id,
    currentApprovedVersionId: row.current_approved_version_id,
    status: row.status as StrategyStateStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toBrandSnapshot(
  row: Tables<"creation_brand_snapshots">,
): BrandSnapshot {
  return {
    id: row.id,
    projectId: row.project_id,
    strategyVersionId: row.strategy_version_id,
    brandId: row.brand_id,
    brandUpdatedAt: row.brand_updated_at,
    snapshotSchemaVersion: row.snapshot_schema_version,
    snapshotJson: row.snapshot_json,
    createdAt: row.created_at,
  };
}
