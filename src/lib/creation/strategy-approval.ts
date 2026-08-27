import type { Database, Json } from "@/integrations/supabase/types";
import type { BrandSnapshot, StrategyState, StrategyVersion } from "@/lib/creation/strategy";

/**
 * Strategy approval bridge:
 * immutable Strategy Version -> atomic approval -> frozen Brand Snapshot.
 *
 * The actual write is intentionally delegated to the database RPC so approval,
 * snapshot freezing and approved-version pointers happen in a single transaction.
 */
export const STRATEGY_APPROVAL_RPC = "approve_creation_strategy" as const;

export type StrategyApprovalRpcArgs =
  Database["public"]["Functions"][typeof STRATEGY_APPROVAL_RPC]["Args"];

export type StrategyApprovalResult = {
  projectId: string;
  strategyVersionId: string;
  previousApprovedVersionId: string | null;
  brandSnapshotId: string;
  approvedAt: string;
  brandId: string | null;
  brandUpdatedAt: string | null;
  snapshotSchemaVersion: string;
};

export type ApprovedStrategyContext = {
  projectId: string;
  strategyVersionId: string;
  brandSnapshotId: string;
  objective: StrategyVersion["objective"];
  approach: StrategyVersion["approach"];
  format: StrategyVersion["format"];
  concept: string | null;
  audience: string | null;
  strategyPayload: Json;
  provenance: StrategyVersion["provenance"];
  brandSnapshot: Json;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid strategy approval result: ${field} is required.`);
  }
  return value.trim();
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Local preflight only. The RPC repeats the invariants in Postgres and is the
 * canonical authority because it can enforce them atomically.
 */
export function assertStrategyCanBeApproved(input: {
  projectId: string;
  strategy: StrategyVersion;
  state?: StrategyState | null;
}): void {
  const projectId = input.projectId.trim();
  if (!projectId) throw new Error("projectId must not be blank.");

  if (input.strategy.projectId !== projectId) {
    throw new Error("The Strategy Version belongs to another Creation.");
  }

  if (
    input.strategy.approvalStatus === "rejected" ||
    input.strategy.approvalStatus === "superseded"
  ) {
    throw new Error(
      "Rejected or superseded Strategy Versions cannot be approved. Create a new version instead.",
    );
  }

  if (input.state) {
    if (input.state.projectId !== projectId) {
      throw new Error("The Strategy State belongs to another Creation.");
    }

    if (
      input.state.currentVersionId &&
      input.state.currentVersionId !== input.strategy.id
    ) {
      throw new Error(
        "Only the current Strategy Version can be approved for this Creation.",
      );
    }
  }
}

export function buildStrategyApprovalRpcArgs(input: {
  projectId: string;
  strategyVersionId: string;
}): StrategyApprovalRpcArgs {
  const projectId = input.projectId.trim();
  const strategyVersionId = input.strategyVersionId.trim();

  if (!projectId) throw new Error("projectId must not be blank.");
  if (!strategyVersionId) {
    throw new Error("strategyVersionId must not be blank.");
  }

  return {
    p_project_id: projectId,
    p_strategy_version_id: strategyVersionId,
  };
}

export function parseStrategyApprovalResult(value: Json): StrategyApprovalResult {
  if (!isRecord(value)) {
    throw new Error("Invalid strategy approval result: expected an object.");
  }

  return {
    projectId: requiredString(value.project_id, "project_id"),
    strategyVersionId: requiredString(
      value.strategy_version_id,
      "strategy_version_id",
    ),
    previousApprovedVersionId: nullableString(
      value.previous_approved_version_id,
    ),
    brandSnapshotId: requiredString(value.brand_snapshot_id, "brand_snapshot_id"),
    approvedAt: requiredString(value.approved_at, "approved_at"),
    brandId: nullableString(value.brand_id),
    brandUpdatedAt: nullableString(value.brand_updated_at),
    snapshotSchemaVersion: requiredString(
      value.snapshot_schema_version,
      "snapshot_schema_version",
    ),
  };
}

/**
 * Produces the stable upstream context that the future Copy Engine will receive.
 * It refuses mismatches instead of silently pairing Strategy and Brand Snapshot
 * from different versions/Creations.
 */
export function buildApprovedStrategyContext(input: {
  strategy: StrategyVersion;
  snapshot: BrandSnapshot;
}): ApprovedStrategyContext {
  if (input.strategy.approvalStatus !== "approved") {
    throw new Error("Copy can only start from an approved Strategy Version.");
  }

  if (input.snapshot.projectId !== input.strategy.projectId) {
    throw new Error("The Brand Snapshot belongs to another Creation.");
  }

  if (input.snapshot.strategyVersionId !== input.strategy.id) {
    throw new Error("The Brand Snapshot belongs to another Strategy Version.");
  }

  return {
    projectId: input.strategy.projectId,
    strategyVersionId: input.strategy.id,
    brandSnapshotId: input.snapshot.id,
    objective: input.strategy.objective,
    approach: input.strategy.approach,
    format: input.strategy.format,
    concept: input.strategy.concept,
    audience: input.strategy.audience,
    strategyPayload: input.strategy.strategyPayload,
    provenance: input.strategy.provenance,
    brandSnapshot: input.snapshot.snapshotJson,
  };
}
