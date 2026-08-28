import type { Database } from "@/integrations/supabase/types";
import {
  buildDesignRevisionFromApproved,
  buildDesignStateAfterDraft,
  type DesignProvenance,
  type DesignSpecPayload,
  type DesignState,
  type DesignVersion,
} from "@/lib/creation/design";
import type { CopyState } from "@/lib/creation/copy";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

/** Atomic approval keeps Design status and canonical pointers consistent. */
export const DESIGN_APPROVAL_RPC = "approve_creation_design" as const;

export type DesignApprovalRpcArgs =
  Database["public"]["Functions"][typeof DESIGN_APPROVAL_RPC]["Args"];

export type DesignApprovalResult = {
  projectId: string;
  designVersionId: string;
  previousApprovedVersionId: string | null;
  copyVersionId: string;
  approvedAt: string;
};

export type DesignRevisionDraftPlan = {
  designVersionInsert: TablesInsert<"creation_design_versions">;
  designStateUpdateAfterInsert: (
    designVersionId: string,
  ) => TablesUpdate<"creation_design_state">;
  sourceApprovedVersionId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid Design approval result: ${field} is required.`);
  }
  return value.trim();
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Local preflight. The database RPC is still the canonical authority because it
 * validates the current approved Copy and updates approval pointers atomically.
 */
export function assertDesignCanBeApproved(input: {
  projectId: string;
  design: DesignVersion;
  designState?: DesignState | null;
  copyState: CopyState;
}): void {
  const projectId = input.projectId.trim();
  if (!projectId) throw new Error("projectId must not be blank.");

  if (input.design.projectId !== projectId) {
    throw new Error("The Design Version belongs to another Creation.");
  }

  if (input.copyState.projectId !== projectId) {
    throw new Error("The Copy State belongs to another Creation.");
  }

  if (!input.copyState.currentApprovedVersionId) {
    throw new Error("Design approval requires a current approved Copy Version.");
  }

  if (input.design.copyVersionId !== input.copyState.currentApprovedVersionId) {
    throw new Error(
      "This Design is stale because it depends on a Copy Version that is no longer current and approved.",
    );
  }

  if (
    input.design.approvalStatus === "rejected" ||
    input.design.approvalStatus === "superseded"
  ) {
    throw new Error(
      "Rejected or superseded Design Versions cannot be approved. Create a new version instead.",
    );
  }

  if (input.designState) {
    if (input.designState.projectId !== projectId) {
      throw new Error("The Design State belongs to another Creation.");
    }

    if (
      input.designState.currentVersionId &&
      input.designState.currentVersionId !== input.design.id
    ) {
      throw new Error(
        "Only the current Design Version can be approved for this Creation.",
      );
    }
  }
}

export function buildDesignApprovalRpcArgs(input: {
  projectId: string;
  designVersionId: string;
}): DesignApprovalRpcArgs {
  const projectId = input.projectId.trim();
  const designVersionId = input.designVersionId.trim();

  if (!projectId) throw new Error("projectId must not be blank.");
  if (!designVersionId) throw new Error("designVersionId must not be blank.");

  return {
    p_project_id: projectId,
    p_design_version_id: designVersionId,
  };
}

export function parseDesignApprovalResult(value: unknown): DesignApprovalResult {
  if (!isRecord(value)) {
    throw new Error("Invalid Design approval result: object expected.");
  }

  return {
    projectId: requiredString(value.project_id, "project_id"),
    designVersionId: requiredString(value.design_version_id, "design_version_id"),
    previousApprovedVersionId: nullableString(value.previous_approved_version_id),
    copyVersionId: requiredString(value.copy_version_id, "copy_version_id"),
    approvedAt: requiredString(value.approved_at, "approved_at"),
  };
}

/**
 * Editing an approved Design never mutates it. A new draft branches from the
 * currently approved Design, and only while the source Copy is still current.
 * If Copy changed, start a new Design lineage through the Visual Director.
 */
export function buildDesignRevisionDraftPlan(input: {
  source: DesignVersion;
  designState: DesignState;
  copyState: CopyState;
  versionNumber: number;
  design: DesignSpecPayload;
  provenance: DesignProvenance;
}): DesignRevisionDraftPlan {
  if (
    input.source.projectId !== input.designState.projectId ||
    input.source.projectId !== input.copyState.projectId
  ) {
    throw new Error("Design, Design State and Copy State must belong to the same Creation.");
  }

  if (input.source.approvalStatus !== "approved") {
    throw new Error("A Design revision must start from the currently approved Design Version.");
  }

  if (input.designState.currentApprovedVersionId !== input.source.id) {
    throw new Error("A Design revision must start from currentApprovedVersionId.");
  }

  if (input.copyState.currentApprovedVersionId !== input.source.copyVersionId) {
    throw new Error(
      "The approved Design is stale because Copy changed. Start a new Design from the current approved Copy instead of revising the old lineage.",
    );
  }

  if (
    !Number.isInteger(input.versionNumber) ||
    input.versionNumber <= input.source.versionNumber
  ) {
    throw new Error(
      "A Design revision versionNumber must be greater than the approved source version.",
    );
  }

  return {
    designVersionInsert: buildDesignRevisionFromApproved({
      source: input.source,
      versionNumber: input.versionNumber,
      design: input.design,
      provenance: input.provenance,
    }),
    designStateUpdateAfterInsert: buildDesignStateAfterDraft,
    sourceApprovedVersionId: input.source.id,
  };
}
