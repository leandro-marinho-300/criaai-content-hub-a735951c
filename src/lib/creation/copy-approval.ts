import type { Database } from "@/integrations/supabase/types";
import type { CopyState, CopyVersion } from "@/lib/creation/copy";

/** Atomic approval keeps version status and canonical pointers consistent. */
export const COPY_APPROVAL_RPC = "approve_creation_copy" as const;

export type CopyApprovalRpcArgs =
  Database["public"]["Functions"][typeof COPY_APPROVAL_RPC]["Args"];

export type CopyApprovalResult = {
  projectId: string;
  copyVersionId: string;
  previousApprovedVersionId: string | null;
  strategyVersionId: string;
  brandSnapshotId: string;
  approvedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid Copy approval result: ${field} is required.`);
  }
  return value.trim();
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function assertCopyCanBeApproved(input: {
  projectId: string;
  copy: CopyVersion;
  state?: CopyState | null;
}): void {
  const projectId = input.projectId.trim();
  if (!projectId) throw new Error("projectId must not be blank.");

  if (input.copy.projectId !== projectId) {
    throw new Error("The Copy Version belongs to another Creation.");
  }

  if (
    input.copy.approvalStatus === "rejected" ||
    input.copy.approvalStatus === "superseded"
  ) {
    throw new Error(
      "Rejected or superseded Copy Versions cannot be approved. Create a new version instead.",
    );
  }

  if (input.state) {
    if (input.state.projectId !== projectId) {
      throw new Error("The Copy State belongs to another Creation.");
    }

    if (
      input.state.currentVersionId &&
      input.state.currentVersionId !== input.copy.id
    ) {
      throw new Error(
        "Only the current Copy Version can be approved for this Creation.",
      );
    }
  }
}

export function buildCopyApprovalRpcArgs(input: {
  projectId: string;
  copyVersionId: string;
}): CopyApprovalRpcArgs {
  const projectId = input.projectId.trim();
  const copyVersionId = input.copyVersionId.trim();

  if (!projectId) throw new Error("projectId must not be blank.");
  if (!copyVersionId) throw new Error("copyVersionId must not be blank.");

  return {
    p_project_id: projectId,
    p_copy_version_id: copyVersionId,
  };
}

export function parseCopyApprovalResult(value: unknown): CopyApprovalResult {
  if (!isRecord(value)) {
    throw new Error("Invalid Copy approval result: object expected.");
  }

  return {
    projectId: requiredString(value.project_id, "project_id"),
    copyVersionId: requiredString(value.copy_version_id, "copy_version_id"),
    previousApprovedVersionId: nullableString(value.previous_approved_version_id),
    strategyVersionId: requiredString(value.strategy_version_id, "strategy_version_id"),
    brandSnapshotId: requiredString(value.brand_snapshot_id, "brand_snapshot_id"),
    approvedAt: requiredString(value.approved_at, "approved_at"),
  };
}
