import type { Json, Tables, TablesInsert } from "@/integrations/supabase/types";
import type { DesignState } from "@/lib/creation/design";
import {
  PROVENANCE_SCHEMA_VERSION,
  isKnownProvenanceOrigin,
  type KnownProvenanceOrigin,
  type ProvenanceOrigin,
} from "@/lib/creation/provenance";
import type {
  ProductionAssetVersion,
  ProductionFreshness,
} from "@/lib/creation/production";
import { deriveProductionFreshness } from "@/lib/creation/production";

export const PRODUCTION_QA_SCHEMA_VERSION = "1.0" as const;

export const QA_STATUSES = ["PASS", "WARN", "BLOCK"] as const;
export type QaStatus = (typeof QA_STATUSES)[number];

export const QA_AXES = [
  "factual",
  "strategic",
  "brand",
  "visual_technical",
] as const;
export type QaAxis = (typeof QA_AXES)[number];

export type QaFindingOrigin = "deterministic" | "human" | "external_manual";

export type QaFinding = {
  axis: QaAxis;
  status: QaStatus;
  code: string;
  message: string;
  origin: QaFindingOrigin;
};

export type QaAxisStatuses = {
  factual: QaStatus;
  strategic: QaStatus;
  brand: QaStatus;
  visualTechnical: QaStatus;
};

export type QaProvenance = {
  schemaVersion: string;
  origin: ProvenanceOrigin;
  source: string | null;
  reviewedAt: string | null;
};

export type ProductionQaReview = {
  id: string;
  projectId: string;
  productionAssetVersionId: string;
  reviewNumber: number;
  schemaVersion: string;
  statuses: QaAxisStatuses;
  overallStatus: QaStatus;
  findings: QaFinding[];
  provenance: QaProvenance;
  createdAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isQaStatus(value: unknown): value is QaStatus {
  return typeof value === "string" && QA_STATUSES.includes(value as QaStatus);
}

function isQaAxis(value: unknown): value is QaAxis {
  return typeof value === "string" && QA_AXES.includes(value as QaAxis);
}

function qaWeight(status: QaStatus): number {
  if (status === "BLOCK") return 3;
  if (status === "WARN") return 2;
  return 1;
}

export function deriveOverallQaStatus(statuses: QaAxisStatuses): QaStatus {
  const ordered = [
    statuses.factual,
    statuses.strategic,
    statuses.brand,
    statuses.visualTechnical,
  ];

  return ordered.reduce<QaStatus>((strongest, status) =>
    qaWeight(status) > qaWeight(strongest) ? status : strongest,
  "PASS");
}

function strongestQaStatus(a: QaStatus, b: QaStatus): QaStatus {
  return qaWeight(b) > qaWeight(a) ? b : a;
}

/**
 * Applies findings as non-downgradable evidence over a base human review.
 * A deterministic WARN/BLOCK can elevate an axis, but never be masked by a
 * softer manual selection.
 */
export function deriveQaStatusesWithFindings(input: {
  baseStatuses: QaAxisStatuses;
  findings: QaFinding[];
}): QaAxisStatuses {
  const statuses: QaAxisStatuses = { ...input.baseStatuses };

  for (const finding of input.findings) {
    if (finding.axis === "factual") {
      statuses.factual = strongestQaStatus(statuses.factual, finding.status);
      continue;
    }
    if (finding.axis === "strategic") {
      statuses.strategic = strongestQaStatus(statuses.strategic, finding.status);
      continue;
    }
    if (finding.axis === "brand") {
      statuses.brand = strongestQaStatus(statuses.brand, finding.status);
      continue;
    }
    statuses.visualTechnical = strongestQaStatus(
      statuses.visualTechnical,
      finding.status,
    );
  }

  return statuses;
}

export function buildQaProvenance(input: {
  origin: KnownProvenanceOrigin;
  source?: string | null;
  reviewedAt?: string | null;
}): QaProvenance {
  return {
    schemaVersion: PROVENANCE_SCHEMA_VERSION,
    origin: input.origin,
    source: input.source?.trim() || null,
    reviewedAt: input.reviewedAt ?? new Date().toISOString(),
  };
}

export function qaProvenanceToJson(provenance: QaProvenance): Json {
  return {
    schemaVersion: provenance.schemaVersion,
    origin: provenance.origin,
    source: provenance.source,
    reviewedAt: provenance.reviewedAt,
  };
}

export function parseQaProvenance(value: Json): QaProvenance {
  if (!isRecord(value)) {
    return {
      schemaVersion: PROVENANCE_SCHEMA_VERSION,
      origin: "unknown",
      source: null,
      reviewedAt: null,
    };
  }

  return {
    schemaVersion:
      nullableString(value.schemaVersion) ?? PROVENANCE_SCHEMA_VERSION,
    origin: isKnownProvenanceOrigin(value.origin) ? value.origin : "unknown",
    source: nullableString(value.source),
    reviewedAt: nullableString(value.reviewedAt),
  };
}

export function qaFindingsToJson(findings: QaFinding[]): Json {
  return findings.map((finding) => ({
    axis: finding.axis,
    status: finding.status,
    code: finding.code,
    message: finding.message,
    origin: finding.origin,
  }));
}

export function parseQaFindings(value: Json): QaFinding[] {
  if (!Array.isArray(value)) return [];

  const findings: QaFinding[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    if (!isQaAxis(item.axis) || !isQaStatus(item.status)) continue;

    const code = nullableString(item.code);
    const message = nullableString(item.message);
    const origin = nullableString(item.origin);
    if (!code || !message) continue;
    if (origin !== "deterministic" && origin !== "human" && origin !== "external_manual") {
      continue;
    }

    findings.push({
      axis: item.axis,
      status: item.status,
      code,
      message,
      origin,
    });
  }

  return findings;
}

export function buildProductionQaReviewInsert(input: {
  projectId: string;
  asset: ProductionAssetVersion;
  reviewNumber: number;
  statuses: QaAxisStatuses;
  findings?: QaFinding[];
  provenance: QaProvenance;
}): TablesInsert<"creation_production_qa_reviews"> {
  const projectId = input.projectId.trim();
  if (!projectId) throw new Error("projectId must not be blank.");
  if (input.asset.projectId !== projectId) {
    throw new Error("QA Review and Production Asset must belong to the same Creation.");
  }
  if (!Number.isInteger(input.reviewNumber) || input.reviewNumber < 1) {
    throw new Error("QA reviewNumber must be a positive integer.");
  }

  const statuses = input.statuses;
  for (const status of [
    statuses.factual,
    statuses.strategic,
    statuses.brand,
    statuses.visualTechnical,
  ]) {
    if (!isQaStatus(status)) throw new Error("Invalid QA status.");
  }

  const findings = input.findings ?? [];
  const overallStatus = deriveOverallQaStatus(statuses);

  return {
    project_id: projectId,
    production_asset_version_id: input.asset.id,
    review_number: input.reviewNumber,
    schema_version: PRODUCTION_QA_SCHEMA_VERSION,
    factual_status: statuses.factual,
    strategic_status: statuses.strategic,
    brand_status: statuses.brand,
    visual_technical_status: statuses.visualTechnical,
    overall_status: overallStatus,
    findings: qaFindingsToJson(findings),
    provenance: qaProvenanceToJson(input.provenance),
  };
}

/**
 * Basic deterministic checks only. No OCR/CV is performed here.
 * Qualitative factual/strategic/brand review remains human/external in MVP.
 */
export function evaluateDeterministicProductionAssetChecks(input: {
  asset: ProductionAssetVersion;
  designState: DesignState;
  pieceAsset: Pick<
    Tables<"content_piece_assets">,
    "project_id" | "file_size" | "file_type" | "image_width" | "image_height"
  >;
}): {
  freshness: ProductionFreshness;
  findings: QaFinding[];
} {
  if (input.pieceAsset.project_id !== input.asset.projectId) {
    throw new Error("Uploaded Piece Asset belongs to another Creation.");
  }

  const freshness = deriveProductionFreshness({
    asset: input.asset,
    designState: input.designState,
  });
  const findings: QaFinding[] = [];

  if (freshness === "review_required") {
    findings.push({
      axis: "strategic",
      status: "BLOCK",
      code: "asset_design_stale",
      message:
        "O asset foi produzido a partir de uma Design Version que não é mais a aprovada atual.",
      origin: "deterministic",
    });
  }

  if (input.pieceAsset.file_size <= 0) {
    findings.push({
      axis: "visual_technical",
      status: "BLOCK",
      code: "asset_empty_file",
      message: "O arquivo do asset está vazio ou possui tamanho inválido.",
      origin: "deterministic",
    });
  }

  if (input.pieceAsset.file_type.startsWith("image/")) {
    const width = input.pieceAsset.image_width ?? 0;
    const height = input.pieceAsset.image_height ?? 0;
    if (width <= 0 || height <= 0) {
      findings.push({
        axis: "visual_technical",
        status: "WARN",
        code: "image_dimensions_unavailable",
        message:
          "As dimensões da imagem não estão disponíveis; valide resolução e proporção manualmente.",
        origin: "deterministic",
      });
    }
  } else if (
    !input.pieceAsset.file_type.startsWith("video/") &&
    input.pieceAsset.file_type !== "application/pdf"
  ) {
    findings.push({
      axis: "visual_technical",
      status: "WARN",
      code: "uncommon_asset_mime",
      message:
        "O tipo de arquivo não é imagem, vídeo ou PDF e exige validação técnica manual.",
      origin: "deterministic",
    });
  }

  return { freshness, findings };
}

export function toProductionQaReview(
  row: Tables<"creation_production_qa_reviews">,
): ProductionQaReview {
  const statuses: QaAxisStatuses = {
    factual: row.factual_status as QaStatus,
    strategic: row.strategic_status as QaStatus,
    brand: row.brand_status as QaStatus,
    visualTechnical: row.visual_technical_status as QaStatus,
  };

  return {
    id: row.id,
    projectId: row.project_id,
    productionAssetVersionId: row.production_asset_version_id,
    reviewNumber: row.review_number,
    schemaVersion: row.schema_version,
    statuses,
    overallStatus: row.overall_status as QaStatus,
    findings: parseQaFindings(row.findings),
    provenance: parseQaProvenance(row.provenance),
    createdAt: row.created_at,
  };
}
