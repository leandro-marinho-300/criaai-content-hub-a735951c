import type { TablesInsert } from "@/integrations/supabase/types";
import type { ProductionAssetVersion, ProductionState } from "@/lib/creation/production";
import type { ProductionQaReview } from "@/lib/creation/qa";

export type ClientApprovalReadinessKind =
  | "legacy"
  | "not_ready"
  | "ready"
  | "warn"
  | "blocked";

export type ClientApprovalReadiness = {
  kind: ClientApprovalReadinessKind;
  canSend: boolean;
  requiresWarnAcknowledgement: boolean;
  message: string;
  productionAssetVersionId: string | null;
  productionQaReviewId: string | null;
  qaStatus: "PASS" | "WARN" | "BLOCK" | null;
};

/**
 * Resolves whether the currently canonical V2 production asset can be sent
 * through the existing client approval flow.
 *
 * Legacy projects intentionally bypass the V2 gate.
 */
export function deriveClientApprovalReadiness(input: {
  isV2: boolean;
  productionState: ProductionState | null;
  asset: ProductionAssetVersion | null;
  qaReview: ProductionQaReview | null;
}): ClientApprovalReadiness {
  if (!input.isV2) {
    return {
      kind: "legacy",
      canSend: true,
      requiresWarnAcknowledgement: false,
      message: "Fluxo legado de aprovação.",
      productionAssetVersionId: null,
      productionQaReviewId: null,
      qaStatus: null,
    };
  }

  const { productionState, asset, qaReview } = input;

  if (!productionState || !asset || !qaReview) {
    return {
      kind: "not_ready",
      canSend: false,
      requiresWarnAcknowledgement: false,
      message:
        "A Creation V2 ainda não possui Asset atual com QA concluído para envio ao cliente.",
      productionAssetVersionId: asset?.id ?? null,
      productionQaReviewId: qaReview?.id ?? null,
      qaStatus: qaReview?.overallStatus ?? null,
    };
  }

  const sameProject =
    productionState.projectId === asset.projectId &&
    qaReview.projectId === asset.projectId;
  const sameCurrentAsset = productionState.currentAssetVersionId === asset.id;
  const sameQa =
    productionState.latestQaReviewId === qaReview.id &&
    qaReview.productionAssetVersionId === asset.id;

  if (!sameProject || !sameCurrentAsset || !sameQa) {
    return {
      kind: "not_ready",
      canSend: false,
      requiresWarnAcknowledgement: false,
      message:
        "O Asset/QA carregado não corresponde ao estado canônico atual da Creation. Atualize a produção antes de enviar.",
      productionAssetVersionId: asset.id,
      productionQaReviewId: qaReview.id,
      qaStatus: qaReview.overallStatus,
    };
  }

  if (
    productionState.status === "qa_blocked" ||
    qaReview.overallStatus === "BLOCK"
  ) {
    return {
      kind: "blocked",
      canSend: false,
      requiresWarnAcknowledgement: false,
      message:
        "O QA atual está BLOCK. Corrija a produção e registre um novo QA antes de enviar ao cliente.",
      productionAssetVersionId: asset.id,
      productionQaReviewId: qaReview.id,
      qaStatus: "BLOCK",
    };
  }

  if (
    productionState.status === "qa_warn" &&
    qaReview.overallStatus === "WARN"
  ) {
    return {
      kind: "warn",
      canSend: true,
      requiresWarnAcknowledgement: true,
      message:
        "O QA atual possui WARN. O envio é permitido somente após confirmação explícita.",
      productionAssetVersionId: asset.id,
      productionQaReviewId: qaReview.id,
      qaStatus: "WARN",
    };
  }

  if (
    productionState.status === "qa_pass" &&
    qaReview.overallStatus === "PASS"
  ) {
    return {
      kind: "ready",
      canSend: true,
      requiresWarnAcknowledgement: false,
      message: "Asset V2 validado com QA PASS e pronto para aprovação do cliente.",
      productionAssetVersionId: asset.id,
      productionQaReviewId: qaReview.id,
      qaStatus: "PASS",
    };
  }

  return {
    kind: "not_ready",
    canSend: false,
    requiresWarnAcknowledgement: false,
    message:
      "O QA da Creation V2 ainda não está em um estado final válido para aprovação do cliente.",
    productionAssetVersionId: asset.id,
    productionQaReviewId: qaReview.id,
    qaStatus: qaReview.overallStatus,
  };
}

export function buildClientApprovalV2Linkage(
  readiness: ClientApprovalReadiness,
  warnAcknowledgedAt?: string | null,
): Pick<
  TablesInsert<"client_approvals">,
  | "production_asset_version_id"
  | "production_qa_review_id"
  | "qa_warn_acknowledged_at"
> {
  if (readiness.kind === "legacy") {
    return {
      production_asset_version_id: null,
      production_qa_review_id: null,
      qa_warn_acknowledged_at: null,
    };
  }

  if (
    !readiness.canSend ||
    !readiness.productionAssetVersionId ||
    !readiness.productionQaReviewId
  ) {
    throw new Error(
      "A Creation V2 não possui Asset/QA elegível para aprovação do cliente.",
    );
  }

  if (
    readiness.requiresWarnAcknowledgement &&
    !warnAcknowledgedAt?.trim()
  ) {
    throw new Error("QA WARN requires explicit acknowledgement.");
  }

  return {
    production_asset_version_id: readiness.productionAssetVersionId,
    production_qa_review_id: readiness.productionQaReviewId,
    qa_warn_acknowledged_at:
      readiness.kind === "warn" ? warnAcknowledgedAt!.trim() : null,
  };
}
