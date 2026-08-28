import type {
  TablesInsert,
  TablesUpdate,
} from "@/integrations/supabase/types";
import {
  buildCopyRevisionFromApproved,
  buildCopyStateAfterDraft,
  type CopyCorePayload,
  type CopyProvenance,
  type CopyState,
  type CopyVersion,
} from "@/lib/creation/copy";
import type { CopyApprovalResult } from "@/lib/creation/copy-approval";

/**
 * Copy lifecycle helpers for revision lineage and downstream freshness.
 *
 * Important: downstream freshness is DERIVED from the Copy Version a future
 * artifact depends on versus the current approved Copy Version. We intentionally
 * do not persist a second mutable "stale" flag before Design/Production versions
 * exist, avoiding contradictory state.
 */

export type CopyDownstreamStatus =
  | "not_started"
  | "current"
  | "review_required";

export type CopyDependencyFreshness = {
  status: CopyDownstreamStatus;
  isStale: boolean;
  currentApprovedCopyVersionId: string | null;
  dependentOnCopyVersionId: string | null;
};

export type CopyRevisionDraftPlan = {
  /**
   * Immutable revision row. based_on_version_id points to the approved source.
   */
  copyVersionInsert: TablesInsert<"creation_copy_versions">;
  /**
   * Apply only after the insert returns its generated id.
   * This moves current_version_id to the draft while preserving
   * current_approved_version_id until a later explicit approval.
   */
  copyStateUpdateAfterInsert: (
    copyVersionId: string,
  ) => TablesUpdate<"creation_copy_state">;
  sourceApprovedVersionId: string;
};

export type CopyApprovalImpact = {
  copyChanged: boolean;
  previousApprovedCopyVersionId: string | null;
  currentApprovedCopyVersionId: string;
  downstream: CopyDependencyFreshness;
};

function normalizedId(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * A revision must branch from the CURRENT approved Copy Version.
 *
 * The old approved row is never updated here. Approval of the new draft later
 * supersedes it atomically through approve_creation_copy(...).
 */
export function buildCopyRevisionDraftPlan(input: {
  source: CopyVersion;
  state: CopyState;
  versionNumber: number;
  core: CopyCorePayload;
  provenance: CopyProvenance;
  formatExtension?: CopyVersion["formatExtension"];
}): CopyRevisionDraftPlan {
  if (input.source.projectId !== input.state.projectId) {
    throw new Error("The Copy Version and Copy State belong to different Creations.");
  }

  if (input.source.approvalStatus !== "approved") {
    throw new Error(
      "A Copy revision must start from the currently approved Copy Version.",
    );
  }

  if (input.state.currentApprovedVersionId !== input.source.id) {
    throw new Error(
      "A Copy revision must start from currentApprovedVersionId.",
    );
  }

  if (
    !Number.isInteger(input.versionNumber) ||
    input.versionNumber <= input.source.versionNumber
  ) {
    throw new Error(
      "A Copy revision versionNumber must be greater than the approved source version.",
    );
  }

  return {
    copyVersionInsert: buildCopyRevisionFromApproved({
      source: input.source,
      versionNumber: input.versionNumber,
      core: input.core,
      formatExtension: input.formatExtension,
      provenance: input.provenance,
    }),
    copyStateUpdateAfterInsert: buildCopyStateAfterDraft,
    sourceApprovedVersionId: input.source.id,
  };
}

/**
 * Derives whether a downstream version/artifact is still aligned with the
 * canonical approved Copy.
 *
 * Future Design/Production records only need to persist the Copy Version they
 * were created from. No extra stale boolean is required:
 *
 * - no dependency yet -> not_started
 * - dependency == current approved Copy -> current
 * - dependency differs (or approval disappeared) -> review_required / stale
 */
export function deriveCopyDependencyFreshness(input: {
  currentApprovedCopyVersionId?: string | null;
  dependentOnCopyVersionId?: string | null;
}): CopyDependencyFreshness {
  const currentApprovedCopyVersionId = normalizedId(
    input.currentApprovedCopyVersionId,
  );
  const dependentOnCopyVersionId = normalizedId(
    input.dependentOnCopyVersionId,
  );

  if (!dependentOnCopyVersionId) {
    return {
      status: "not_started",
      isStale: false,
      currentApprovedCopyVersionId,
      dependentOnCopyVersionId: null,
    };
  }

  if (
    currentApprovedCopyVersionId &&
    dependentOnCopyVersionId === currentApprovedCopyVersionId
  ) {
    return {
      status: "current",
      isStale: false,
      currentApprovedCopyVersionId,
      dependentOnCopyVersionId,
    };
  }

  return {
    status: "review_required",
    isStale: true,
    currentApprovedCopyVersionId,
    dependentOnCopyVersionId,
  };
}

/**
 * Evaluates the impact of an atomic Copy approval on one downstream dependency.
 *
 * This helper does not mutate Design/Production because those versioned domains
 * do not exist yet. Once they do, their stored source Copy Version can be checked
 * with this same contract and surfaced as review_required.
 */
export function evaluateCopyApprovalImpact(input: {
  approval: CopyApprovalResult;
  downstreamDependsOnCopyVersionId?: string | null;
}): CopyApprovalImpact {
  const currentApprovedCopyVersionId = normalizedId(
    input.approval.copyVersionId,
  );

  if (!currentApprovedCopyVersionId) {
    throw new Error("Copy approval result is missing copyVersionId.");
  }

  const previousApprovedCopyVersionId = normalizedId(
    input.approval.previousApprovedVersionId,
  );

  return {
    copyChanged:
      previousApprovedCopyVersionId !== null &&
      previousApprovedCopyVersionId !== currentApprovedCopyVersionId,
    previousApprovedCopyVersionId,
    currentApprovedCopyVersionId,
    downstream: deriveCopyDependencyFreshness({
      currentApprovedCopyVersionId,
      dependentOnCopyVersionId: input.downstreamDependsOnCopyVersionId,
    }),
  };
}
