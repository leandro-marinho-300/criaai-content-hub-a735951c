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
import {
  deriveCopyDependencyFreshness,
  type CopyDependencyFreshness,
} from "@/lib/creation/copy-lifecycle";

/**
 * Canonical Design Spec foundation.
 *
 * A Design Version always records the exact approved Copy Version it was
 * created from. Copy freshness is derived from that immutable dependency, so no
 * second mutable "stale" flag is persisted.
 */
export const DESIGN_SPEC_SCHEMA_VERSION = "1.0" as const;

export type DesignApprovalStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "rejected"
  | "superseded";

export type DesignStateStatus =
  | "not_started"
  | "drafting"
  | "in_review"
  | "approved"
  | "needs_revision";

export type DesignAssetRequirement = {
  role: string;
  requirement: string;
  mandatory: boolean;
  sourcePreference: string | null;
};

export type DesignAntiGenericity = {
  distinctiveChoice: string;
  avoid: string[];
};

export type DesignSpecPayload = {
  visualSystem: string;
  compositionConcept: string;
  visualGesture: string;
  typographyBehavior: string;
  imageryMode: string;
  interventionLevel: string;
  palette: string[];
  assetRequirements: DesignAssetRequirement[];
  antiGenericity: DesignAntiGenericity;
  restrictions: string[];
  dependencies: string[];
  informationToConfirm: string[];
};

export type DesignProvenance = {
  schemaVersion: string;
  origin: ProvenanceOrigin;
  source: string | null;
  recordedAt: string | null;
};

export type DesignVersionInput = {
  copyVersionId: string;
  design: DesignSpecPayload;
  provenance: DesignProvenance;
  basedOnVersionId?: string | null;
};

export type DesignVersion = {
  id: string;
  projectId: string;
  copyVersionId: string;
  basedOnVersionId: string | null;
  versionNumber: number;
  schemaVersion: string;
  design: DesignSpecPayload;
  provenance: DesignProvenance;
  approvalStatus: DesignApprovalStatus;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DesignState = {
  projectId: string;
  currentVersionId: string | null;
  currentApprovedVersionId: string | null;
  status: DesignStateStatus;
  createdAt: string;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Design Spec ${field} must not be blank.`);
  }
  return value.trim();
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`Design Spec ${field} must be an array.`);
  }

  return value.map((item, index) =>
    requiredString(item, `${field}[${index}]`),
  );
}

function normalizeAssetRequirements(value: unknown): DesignAssetRequirement[] {
  if (!Array.isArray(value)) {
    throw new Error("Design Spec assetRequirements must be an array.");
  }

  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(
        `Design Spec assetRequirements[${index}] must be an object.`,
      );
    }

    if (typeof item.mandatory !== "boolean") {
      throw new Error(
        `Design Spec assetRequirements[${index}].mandatory must be boolean.`,
      );
    }

    if (
      item.source_preference !== null &&
      item.source_preference !== undefined &&
      nullableString(item.source_preference) === null
    ) {
      throw new Error(
        `Design Spec assetRequirements[${index}].source_preference must be text or null.`,
      );
    }

    return {
      role: requiredString(item.role, `assetRequirements[${index}].role`),
      requirement: requiredString(
        item.requirement,
        `assetRequirements[${index}].requirement`,
      ),
      mandatory: item.mandatory,
      sourcePreference: nullableString(item.source_preference),
    };
  });
}

export function normalizeDesignSpecPayload(
  input: DesignSpecPayload,
): DesignSpecPayload {
  const assetRequirements = input.assetRequirements.map((item, index) => ({
    role: requiredString(item.role, `assetRequirements[${index}].role`),
    requirement: requiredString(
      item.requirement,
      `assetRequirements[${index}].requirement`,
    ),
    mandatory: Boolean(item.mandatory),
    sourcePreference: item.sourcePreference?.trim() || null,
  }));

  return {
    visualSystem: requiredString(input.visualSystem, "visualSystem"),
    compositionConcept: requiredString(
      input.compositionConcept,
      "compositionConcept",
    ),
    visualGesture: requiredString(input.visualGesture, "visualGesture"),
    typographyBehavior: requiredString(
      input.typographyBehavior,
      "typographyBehavior",
    ),
    imageryMode: requiredString(input.imageryMode, "imageryMode"),
    interventionLevel: requiredString(
      input.interventionLevel,
      "interventionLevel",
    ),
    palette: input.palette.map((item, index) =>
      requiredString(item, `palette[${index}]`),
    ),
    assetRequirements,
    antiGenericity: {
      distinctiveChoice: requiredString(
        input.antiGenericity.distinctiveChoice,
        "antiGenericity.distinctiveChoice",
      ),
      avoid: input.antiGenericity.avoid.map((item, index) =>
        requiredString(item, `antiGenericity.avoid[${index}]`),
      ),
    },
    restrictions: input.restrictions.map((item, index) =>
      requiredString(item, `restrictions[${index}]`),
    ),
    dependencies: input.dependencies.map((item, index) =>
      requiredString(item, `dependencies[${index}]`),
    ),
    informationToConfirm: input.informationToConfirm.map((item, index) =>
      requiredString(item, `informationToConfirm[${index}]`),
    ),
  };
}

export function designSpecPayloadToJson(input: DesignSpecPayload): Json {
  const design = normalizeDesignSpecPayload(input);

  return {
    visual_system: design.visualSystem,
    composition_concept: design.compositionConcept,
    visual_gesture: design.visualGesture,
    typography_behavior: design.typographyBehavior,
    imagery_mode: design.imageryMode,
    intervention_level: design.interventionLevel,
    palette: design.palette,
    asset_requirements: design.assetRequirements.map((item) => ({
      role: item.role,
      requirement: item.requirement,
      mandatory: item.mandatory,
      source_preference: item.sourcePreference,
    })),
    anti_genericity: {
      distinctive_choice: design.antiGenericity.distinctiveChoice,
      avoid: design.antiGenericity.avoid,
    },
    restrictions: design.restrictions,
    dependencies: design.dependencies,
    information_to_confirm: design.informationToConfirm,
  };
}

export function parseDesignSpecPayload(value: Json): DesignSpecPayload {
  if (!isRecord(value)) {
    throw new Error("Invalid Design Spec payload: object expected.");
  }

  if (!isRecord(value.anti_genericity)) {
    throw new Error(
      "Invalid Design Spec payload: anti_genericity must be an object.",
    );
  }

  return {
    visualSystem: requiredString(value.visual_system, "visual_system"),
    compositionConcept: requiredString(
      value.composition_concept,
      "composition_concept",
    ),
    visualGesture: requiredString(value.visual_gesture, "visual_gesture"),
    typographyBehavior: requiredString(
      value.typography_behavior,
      "typography_behavior",
    ),
    imageryMode: requiredString(value.imagery_mode, "imagery_mode"),
    interventionLevel: requiredString(
      value.intervention_level,
      "intervention_level",
    ),
    palette: normalizeStringArray(value.palette, "palette"),
    assetRequirements: normalizeAssetRequirements(value.asset_requirements),
    antiGenericity: {
      distinctiveChoice: requiredString(
        value.anti_genericity.distinctive_choice,
        "anti_genericity.distinctive_choice",
      ),
      avoid: normalizeStringArray(
        value.anti_genericity.avoid,
        "anti_genericity.avoid",
      ),
    },
    restrictions: normalizeStringArray(value.restrictions, "restrictions"),
    dependencies: normalizeStringArray(value.dependencies, "dependencies"),
    informationToConfirm: normalizeStringArray(
      value.information_to_confirm,
      "information_to_confirm",
    ),
  };
}

export function buildDesignProvenance(input: {
  origin: KnownProvenanceOrigin;
  source?: string | null;
  recordedAt?: string | null;
}): DesignProvenance {
  return {
    schemaVersion: PROVENANCE_SCHEMA_VERSION,
    origin: input.origin,
    source: input.source?.trim() || null,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
  };
}

export function designProvenanceToJson(provenance: DesignProvenance): Json {
  return {
    schemaVersion: provenance.schemaVersion,
    origin: provenance.origin,
    source: provenance.source,
    recordedAt: provenance.recordedAt,
  };
}

export function parseDesignProvenance(value: Json): DesignProvenance {
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

export function buildDesignVersionInsert(
  projectId: string,
  versionNumber: number,
  input: DesignVersionInput,
): TablesInsert<"creation_design_versions"> {
  const id = projectId.trim();
  const copyVersionId = input.copyVersionId.trim();

  if (!id) throw new Error("projectId must not be blank.");
  if (!copyVersionId) throw new Error("copyVersionId must not be blank.");
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    throw new Error("Design versionNumber must be a positive integer.");
  }

  return {
    project_id: id,
    copy_version_id: copyVersionId,
    based_on_version_id: input.basedOnVersionId?.trim() || null,
    version_number: versionNumber,
    schema_version: DESIGN_SPEC_SCHEMA_VERSION,
    design_payload: designSpecPayloadToJson(input.design),
    provenance: designProvenanceToJson(input.provenance),
    approval_status: "draft",
    approved_at: null,
  };
}

export function buildDesignRevisionFromApproved(input: {
  source: DesignVersion;
  versionNumber: number;
  design: DesignSpecPayload;
  provenance: DesignProvenance;
}): TablesInsert<"creation_design_versions"> {
  if (
    input.source.approvalStatus !== "approved" &&
    input.source.approvalStatus !== "superseded"
  ) {
    throw new Error(
      "Design revision source must be an approved or previously approved version.",
    );
  }

  return buildDesignVersionInsert(input.source.projectId, input.versionNumber, {
    copyVersionId: input.source.copyVersionId,
    basedOnVersionId: input.source.id,
    design: input.design,
    provenance: input.provenance,
  });
}

export function buildDesignStateInsert(
  projectId: string,
): TablesInsert<"creation_design_state"> {
  return {
    project_id: projectId,
    current_version_id: null,
    current_approved_version_id: null,
    status: "not_started",
  };
}

export function buildDesignStateAfterDraft(
  designVersionId: string,
): TablesUpdate<"creation_design_state"> {
  const id = designVersionId.trim();
  if (!id) throw new Error("designVersionId must not be blank.");

  return {
    current_version_id: id,
    status: "drafting",
  };
}

export function toDesignVersion(
  row: Tables<"creation_design_versions">,
): DesignVersion {
  return {
    id: row.id,
    projectId: row.project_id,
    copyVersionId: row.copy_version_id,
    basedOnVersionId: row.based_on_version_id,
    versionNumber: row.version_number,
    schemaVersion: row.schema_version,
    design: parseDesignSpecPayload(row.design_payload),
    provenance: parseDesignProvenance(row.provenance),
    approvalStatus: row.approval_status as DesignApprovalStatus,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toDesignState(
  row: Tables<"creation_design_state">,
): DesignState {
  return {
    projectId: row.project_id,
    currentVersionId: row.current_version_id,
    currentApprovedVersionId: row.current_approved_version_id,
    status: row.status as DesignStateStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Design freshness is derived from its immutable source Copy Version.
 */
export function deriveDesignDependencyFreshness(input: {
  currentApprovedCopyVersionId?: string | null;
  design?: Pick<DesignVersion, "copyVersionId"> | null;
}): CopyDependencyFreshness {
  return deriveCopyDependencyFreshness({
    currentApprovedCopyVersionId: input.currentApprovedCopyVersionId,
    dependentOnCopyVersionId: input.design?.copyVersionId ?? null,
  });
}
