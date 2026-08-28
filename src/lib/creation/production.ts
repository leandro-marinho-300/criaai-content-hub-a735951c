import type {
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/integrations/supabase/types";
import type { DesignState, DesignVersion } from "@/lib/creation/design";
import {
  PROVENANCE_SCHEMA_VERSION,
  isKnownProvenanceOrigin,
  type KnownProvenanceOrigin,
  type ProvenanceOrigin,
} from "@/lib/creation/provenance";

/**
 * Canonical metadata for externally produced assets.
 *
 * The binary itself continues to live in the existing content_piece_assets /
 * piece-assets Storage flow. This layer only records which uploaded asset is
 * the canonical production result for an approved Design Version.
 */
export const PRODUCTION_ASSET_SCHEMA_VERSION = "1.0" as const;

export type ProductionStateStatus =
  | "not_started"
  | "qa_pending"
  | "qa_pass"
  | "qa_warn"
  | "qa_blocked";

export type ProductionFreshness =
  | "not_started"
  | "current"
  | "review_required";

export type ProductionProvenance = {
  schemaVersion: string;
  origin: ProvenanceOrigin;
  source: string | null;
  renderPromptVersion: string | null;
  producedAt: string | null;
};

export type ProductionAssetVersion = {
  id: string;
  projectId: string;
  designVersionId: string;
  pieceAssetId: string;
  basedOnVersionId: string | null;
  versionNumber: number;
  schemaVersion: string;
  provenance: ProductionProvenance;
  createdAt: string;
};

export type ProductionState = {
  projectId: string;
  currentAssetVersionId: string | null;
  latestQaReviewId: string | null;
  status: ProductionStateStatus;
  createdAt: string;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function buildProductionProvenance(input: {
  origin: KnownProvenanceOrigin;
  source?: string | null;
  renderPromptVersion?: string | null;
  producedAt?: string | null;
}): ProductionProvenance {
  return {
    schemaVersion: PROVENANCE_SCHEMA_VERSION,
    origin: input.origin,
    source: input.source?.trim() || null,
    renderPromptVersion: input.renderPromptVersion?.trim() || null,
    producedAt: input.producedAt ?? new Date().toISOString(),
  };
}

export function productionProvenanceToJson(
  provenance: ProductionProvenance,
): Json {
  return {
    schemaVersion: provenance.schemaVersion,
    origin: provenance.origin,
    source: provenance.source,
    renderPromptVersion: provenance.renderPromptVersion,
    producedAt: provenance.producedAt,
  };
}

export function parseProductionProvenance(value: Json): ProductionProvenance {
  if (!isRecord(value)) {
    return {
      schemaVersion: PROVENANCE_SCHEMA_VERSION,
      origin: "unknown",
      source: null,
      renderPromptVersion: null,
      producedAt: null,
    };
  }

  return {
    schemaVersion:
      nullableString(value.schemaVersion) ?? PROVENANCE_SCHEMA_VERSION,
    origin: isKnownProvenanceOrigin(value.origin) ? value.origin : "unknown",
    source: nullableString(value.source),
    renderPromptVersion: nullableString(value.renderPromptVersion),
    producedAt: nullableString(value.producedAt),
  };
}

export function buildProductionAssetVersionInsert(input: {
  projectId: string;
  design: DesignVersion;
  designState: DesignState;
  pieceAsset: Pick<Tables<"content_piece_assets">, "id" | "project_id">;
  versionNumber: number;
  basedOnVersionId?: string | null;
  provenance: ProductionProvenance;
}): TablesInsert<"creation_production_asset_versions"> {
  const projectId = input.projectId.trim();
  const pieceAssetId = input.pieceAsset.id.trim();

  if (!projectId) throw new Error("projectId must not be blank.");
  if (!pieceAssetId) throw new Error("pieceAsset.id must not be blank.");
  if (!Number.isInteger(input.versionNumber) || input.versionNumber < 1) {
    throw new Error("Production asset versionNumber must be a positive integer.");
  }

  if (
    input.design.projectId !== projectId ||
    input.designState.projectId !== projectId ||
    input.pieceAsset.project_id !== projectId
  ) {
    throw new Error(
      "Production asset, Design and uploaded Piece Asset must belong to the same Creation.",
    );
  }

  if (input.design.approvalStatus !== "approved") {
    throw new Error("Production requires an approved Design Version.");
  }

  if (input.designState.currentApprovedVersionId !== input.design.id) {
    throw new Error(
      "Production must use the current approved Design Version for the Creation.",
    );
  }

  return {
    project_id: projectId,
    design_version_id: input.design.id,
    piece_asset_id: pieceAssetId,
    based_on_version_id: input.basedOnVersionId?.trim() || null,
    version_number: input.versionNumber,
    schema_version: PRODUCTION_ASSET_SCHEMA_VERSION,
    provenance: productionProvenanceToJson(input.provenance),
  };
}

/**
 * Asset revisions preserve lineage only while the approved Design is unchanged.
 * A new Design Version starts a new production lineage.
 */
export function buildProductionAssetRevisionInsert(input: {
  source: ProductionAssetVersion;
  design: DesignVersion;
  designState: DesignState;
  pieceAsset: Pick<Tables<"content_piece_assets">, "id" | "project_id">;
  versionNumber: number;
  provenance: ProductionProvenance;
}): TablesInsert<"creation_production_asset_versions"> {
  if (input.source.designVersionId !== input.design.id) {
    throw new Error(
      "A production revision can only preserve lineage while the approved Design Version is unchanged.",
    );
  }

  if (input.versionNumber <= input.source.versionNumber) {
    throw new Error(
      "A production revision versionNumber must be greater than the source version.",
    );
  }

  return buildProductionAssetVersionInsert({
    projectId: input.source.projectId,
    design: input.design,
    designState: input.designState,
    pieceAsset: input.pieceAsset,
    versionNumber: input.versionNumber,
    basedOnVersionId: input.source.id,
    provenance: input.provenance,
  });
}

export function buildProductionStateInsert(
  projectId: string,
): TablesInsert<"creation_production_state"> {
  const id = projectId.trim();
  if (!id) throw new Error("projectId must not be blank.");

  return {
    project_id: id,
    current_asset_version_id: null,
    latest_qa_review_id: null,
    status: "not_started",
  };
}

export function buildProductionStateAfterAsset(
  assetVersionId: string,
): TablesUpdate<"creation_production_state"> {
  const id = assetVersionId.trim();
  if (!id) throw new Error("assetVersionId must not be blank.");

  return {
    current_asset_version_id: id,
    latest_qa_review_id: null,
    status: "qa_pending",
  };
}

export function deriveProductionFreshness(input: {
  asset: ProductionAssetVersion | null;
  designState: DesignState;
}): ProductionFreshness {
  if (!input.asset) return "not_started";

  if (input.asset.projectId !== input.designState.projectId) {
    throw new Error("Production Asset and Design State belong to different Creations.");
  }

  return input.designState.currentApprovedVersionId === input.asset.designVersionId
    ? "current"
    : "review_required";
}

export function toProductionAssetVersion(
  row: Tables<"creation_production_asset_versions">,
): ProductionAssetVersion {
  return {
    id: row.id,
    projectId: row.project_id,
    designVersionId: row.design_version_id,
    pieceAssetId: row.piece_asset_id,
    basedOnVersionId: row.based_on_version_id,
    versionNumber: row.version_number,
    schemaVersion: row.schema_version,
    provenance: parseProductionProvenance(row.provenance),
    createdAt: row.created_at,
  };
}

export function toProductionState(
  row: Tables<"creation_production_state">,
): ProductionState {
  return {
    projectId: row.project_id,
    currentAssetVersionId: row.current_asset_version_id,
    latestQaReviewId: row.latest_qa_review_id,
    status: row.status as ProductionStateStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
