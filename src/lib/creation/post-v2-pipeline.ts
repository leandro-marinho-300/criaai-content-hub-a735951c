import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import {
  buildCreationCoreInsert,
  type CreationAggregate,
} from "@/lib/creation/aggregate";
import {
  buildCopyStateInsert,
  type CopyState,
  type CopyVersion,
} from "@/lib/creation/copy";
import { buildCopyGenerationTaskPlan } from "@/lib/creation/copy-generation";
import {
  deriveClientApprovalReadiness,
  type ClientApprovalReadiness,
} from "@/lib/creation/client-approval";
import {
  buildDesignStateInsert,
  deriveDesignDependencyFreshness,
  type DesignState,
  type DesignVersion,
} from "@/lib/creation/design";
import {
  POST_COPY_ADAPTER_SCHEMA_VERSION,
  buildPostCopyAdapterTaskPlan,
} from "@/lib/creation/post-copy-adapter";
import {
  buildProductionStateInsert,
  deriveProductionFreshness,
  type ProductionAssetVersion,
  type ProductionFreshness,
  type ProductionState,
} from "@/lib/creation/production";
import type { ProductionQaReview } from "@/lib/creation/qa";
import {
  buildRenderPromptPlan,
  type RenderPromptPlan,
} from "@/lib/creation/render-prompt";
import {
  getSpecDecision,
  isSpecComplete,
  type SpecState,
} from "@/lib/creation/spec";
import {
  buildApprovedStrategyContext,
  type ApprovedStrategyContext,
} from "@/lib/creation/strategy-approval";
import { buildStrategyGenerationTaskPlan } from "@/lib/creation/strategy-generation";
import {
  buildStrategyStateInsert,
  type BrandSnapshot,
  type StrategyState,
  type StrategyVersion,
} from "@/lib/creation/strategy";
import { buildVisualDirectorTaskPlan } from "@/lib/creation/visual-director";

/**
 * Pure Post V2 orchestration layer.
 *
 * It intentionally does not persist, fetch or call an AI provider. The module
 * coordinates the canonical V2 contracts already implemented and exposes one
 * deterministic view of what is current, stale, blocked and what should happen
 * next. UI adapters can consume this without reimplementing business rules.
 */
export const POST_V2_PIPELINE_VERSION = "1.0" as const;

export type PostV2PipelineAction =
  | "bootstrap_creation"
  | "complete_spec"
  | "generate_strategy"
  | "approve_strategy"
  | "generate_copy_core"
  | "approve_copy_core"
  | "generate_post_copy"
  | "approve_post_copy"
  | "generate_design"
  | "approve_design"
  | "produce_asset_from_render_prompt"
  | "run_qa"
  | "fix_qa_block"
  | "send_client_approval"
  | "wait_client_approval"
  | "revise_after_client_feedback"
  | "ready_for_operations"
  | "wrong_format"
  | "resolve_inconsistent_state";

export type PostV2StepState =
  | "not_started"
  | "in_progress"
  | "ready"
  | "complete"
  | "review_required"
  | "blocked";

export type PostV2PipelineStep = {
  state: PostV2StepState;
  message: string;
  versionId: string | null;
};

export type PostV2PipelineSteps = {
  creation: PostV2PipelineStep;
  spec: PostV2PipelineStep;
  strategy: PostV2PipelineStep;
  copyCore: PostV2PipelineStep;
  postCopy: PostV2PipelineStep;
  design: PostV2PipelineStep;
  renderPrompt: PostV2PipelineStep;
  production: PostV2PipelineStep;
  qa: PostV2PipelineStep;
  clientApproval: PostV2PipelineStep;
  operations: PostV2PipelineStep;
};

export type PostV2VersionRefs = {
  strategyVersionId: string | null;
  brandSnapshotId: string | null;
  copyVersionId: string | null;
  designVersionId: string | null;
  productionAssetVersionId: string | null;
  productionQaReviewId: string | null;
  clientApprovalId: string | null;
};

export type PostV2PipelineBootstrapPlan = {
  /** Apply first because every downstream state table references creation_core. */
  creationCoreInsert: TablesInsert<"creation_core">;
  strategyStateInsert: TablesInsert<"creation_strategy_state">;
  copyStateInsert: TablesInsert<"creation_copy_state">;
  designStateInsert: TablesInsert<"creation_design_state">;
  productionStateInsert: TablesInsert<"creation_production_state">;
};

export type PostV2VersionedSection<TState, TVersion> = {
  state: TState | null;
  currentVersion: TVersion | null;
  approvedVersion: TVersion | null;
};

export type PostV2PipelineClientApproval = Pick<
  Tables<"client_approvals">,
  | "id"
  | "project_id"
  | "status"
  | "production_asset_version_id"
  | "production_qa_review_id"
  | "qa_warn_acknowledged_at"
  | "revoked_at"
  | "title"
  | "decision"
  | "general_comment"
  | "client_name"
  | "client_email"
  | "client_company"
  | "submitted_at"
  | "created_at"
  | "expires_at"
  | "first_viewed_at"
  | "last_viewed_at"
  | "view_count"
>;

export type PostV2PipelineInput = {
  projectId: string;
  creation: CreationAggregate | null;
  spec: SpecState;
  strategy: PostV2VersionedSection<StrategyState, StrategyVersion> & {
    brandSnapshot: BrandSnapshot | null;
  };
  copy: PostV2VersionedSection<CopyState, CopyVersion>;
  design: PostV2VersionedSection<DesignState, DesignVersion>;
  production: {
    state: ProductionState | null;
    currentAsset: ProductionAssetVersion | null;
    latestQaReview: ProductionQaReview | null;
  };
  /** Latest operational approval row for this Creation, when one exists. */
  clientApproval?: PostV2PipelineClientApproval | null;
};

export type PostV2PipelineSnapshot = {
  pipelineVersion: typeof POST_V2_PIPELINE_VERSION;
  projectId: string;
  isV2: boolean;
  isPost: boolean;
  nextAction: PostV2PipelineAction;
  blockingReason: string | null;
  steps: PostV2PipelineSteps;
  versionRefs: PostV2VersionRefs;
  approvedStrategyContext: ApprovedStrategyContext | null;
  renderPromptPlan: RenderPromptPlan | null;
  productionFreshness: ProductionFreshness;
  clientApprovalReadiness: ClientApprovalReadiness;
  readyForOperations: boolean;
};

function emptyStep(message: string): PostV2PipelineStep {
  return { state: "not_started", message, versionId: null };
}

function makeInitialSteps(): PostV2PipelineSteps {
  return {
    creation: emptyStep("Creation V2 ainda não inicializada."),
    spec: emptyStep("$Spec ainda não concluído."),
    strategy: emptyStep("Strategy ainda não iniciada."),
    copyCore: emptyStep("Copy Core ainda não iniciada."),
    postCopy: emptyStep("Post Copy Adapter ainda não iniciado."),
    design: emptyStep("Design Spec ainda não iniciado."),
    renderPrompt: emptyStep("Render Prompt ainda não disponível."),
    production: emptyStep("Production Asset ainda não registrado."),
    qa: emptyStep("QA ainda não executado."),
    clientApproval: emptyStep("Aprovação do cliente ainda não iniciada."),
    operations: emptyStep("Peça ainda não está pronta para operação."),
  };
}

function nonBlank(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasValidPostCopyExtension(copy: CopyVersion): boolean {
  const value = copy.formatExtension;
  if (!isRecord(value)) return false;

  const hashtags = value.hashtags;
  const provenance = value.provenance;

  return (
    value.schema_version === POST_COPY_ADAPTER_SCHEMA_VERSION &&
    value.adapter === "post" &&
    nonBlank(value.source_copy_version_id as string | null) !== null &&
    value.strategy_version_id === copy.strategyVersionId &&
    value.brand_snapshot_id === copy.brandSnapshotId &&
    nonBlank(value.headline as string | null) !== null &&
    nonBlank(value.caption as string | null) !== null &&
    Array.isArray(hashtags) &&
    hashtags.every((item) => typeof item === "string" && item.trim()) &&
    isRecord(provenance) &&
    provenance.origin === "external_manual" &&
    nonBlank(provenance.source as string | null) !== null
  );
}

function assertProjectId(projectId: string): string {
  const id = projectId.trim();
  if (!id) throw new Error("projectId must not be blank.");
  return id;
}

function assertSameProject(
  projectId: string,
  label: string,
  candidateProjectId: string | null | undefined,
): void {
  if (candidateProjectId && candidateProjectId !== projectId) {
    throw new Error(`${label} belongs to another Creation.`);
  }
}

function assertVersionSectionConsistency<TState extends { projectId: string; currentVersionId: string | null; currentApprovedVersionId: string | null }, TVersion extends { id: string; projectId: string }>(
  projectId: string,
  label: string,
  section: PostV2VersionedSection<TState, TVersion>,
): void {
  assertSameProject(projectId, `${label} State`, section.state?.projectId);
  assertSameProject(projectId, `current ${label}`, section.currentVersion?.projectId);
  assertSameProject(projectId, `approved ${label}`, section.approvedVersion?.projectId);

  if (section.state?.currentVersionId && !section.currentVersion) {
    throw new Error(`${label} State references a current version that was not loaded.`);
  }
  if (
    section.state?.currentVersionId &&
    section.currentVersion?.id !== section.state.currentVersionId
  ) {
    throw new Error(`Loaded current ${label} does not match currentVersionId.`);
  }

  if (section.state?.currentApprovedVersionId && !section.approvedVersion) {
    throw new Error(`${label} State references an approved version that was not loaded.`);
  }
  if (
    section.state?.currentApprovedVersionId &&
    section.approvedVersion?.id !== section.state.currentApprovedVersionId
  ) {
    throw new Error(
      `Loaded approved ${label} does not match currentApprovedVersionId.`,
    );
  }
}

function buildVersionRefs(input: PostV2PipelineInput): PostV2VersionRefs {
  return {
    strategyVersionId: input.strategy.approvedVersion?.id ?? null,
    brandSnapshotId: input.strategy.brandSnapshot?.id ?? null,
    copyVersionId: input.copy.approvedVersion?.id ?? null,
    designVersionId: input.design.approvedVersion?.id ?? null,
    productionAssetVersionId: input.production.currentAsset?.id ?? null,
    productionQaReviewId: input.production.latestQaReview?.id ?? null,
    clientApprovalId: input.clientApproval?.id ?? null,
  };
}

function currentStrategyIsReady(input: PostV2PipelineInput): boolean {
  const strategy = input.strategy.approvedVersion;
  const state = input.strategy.state;
  const snapshot = input.strategy.brandSnapshot;

  return !!(
    strategy &&
    state &&
    snapshot &&
    strategy.approvalStatus === "approved" &&
    state.currentApprovedVersionId === strategy.id &&
    snapshot.projectId === strategy.projectId &&
    snapshot.strategyVersionId === strategy.id
  );
}

function copyMatchesCurrentStrategy(input: PostV2PipelineInput, copy: CopyVersion): boolean {
  const strategy = input.strategy.approvedVersion;
  const snapshot = input.strategy.brandSnapshot;
  return !!(
    strategy &&
    snapshot &&
    copy.strategyVersionId === strategy.id &&
    copy.brandSnapshotId === snapshot.id
  );
}

function currentApprovedCopyIsReady(input: PostV2PipelineInput): boolean {
  const copy = input.copy.approvedVersion;
  const state = input.copy.state;
  return !!(
    copy &&
    state &&
    copy.approvalStatus === "approved" &&
    state.currentApprovedVersionId === copy.id &&
    copyMatchesCurrentStrategy(input, copy)
  );
}

function currentApprovedDesignIsReady(input: PostV2PipelineInput): boolean {
  const design = input.design.approvedVersion;
  const state = input.design.state;
  const copy = input.copy.approvedVersion;

  return !!(
    design &&
    state &&
    copy &&
    design.approvalStatus === "approved" &&
    state.currentApprovedVersionId === design.id &&
    design.copyVersionId === copy.id
  );
}

function approvalLinksCurrentProduction(input: PostV2PipelineInput): boolean {
  const approval = input.clientApproval;
  const asset = input.production.currentAsset;
  const qa = input.production.latestQaReview;

  return !!(
    approval &&
    !approval.revoked_at &&
    asset &&
    qa &&
    approval.project_id === input.projectId &&
    approval.production_asset_version_id === asset.id &&
    approval.production_qa_review_id === qa.id &&
    (qa.overallStatus !== "WARN" || !!approval.qa_warn_acknowledged_at)
  );
}

export function buildPostV2PipelineBootstrapPlan(
  projectId: string,
): PostV2PipelineBootstrapPlan {
  const id = assertProjectId(projectId);

  return {
    creationCoreInsert: buildCreationCoreInsert(id),
    strategyStateInsert: buildStrategyStateInsert(id),
    copyStateInsert: buildCopyStateInsert(id),
    designStateInsert: buildDesignStateInsert(id),
    productionStateInsert: buildProductionStateInsert(id),
  };
}

/**
 * One deterministic read model for the Post V2 workflow.
 *
 * Callers must load the exact rows referenced by each state pointer. Missing or
 * contradictory loaded records are treated as programming/data consistency
 * errors rather than guessed around.
 */
export function derivePostV2PipelineSnapshot(
  input: PostV2PipelineInput,
): PostV2PipelineSnapshot {
  const projectId = assertProjectId(input.projectId);
  const steps = makeInitialSteps();

  assertSameProject(projectId, "Creation Core", input.creation?.id);
  assertVersionSectionConsistency(projectId, "Strategy", input.strategy);
  assertVersionSectionConsistency(projectId, "Copy", input.copy);
  assertVersionSectionConsistency(projectId, "Design", input.design);
  assertSameProject(projectId, "Production State", input.production.state?.projectId);
  assertSameProject(projectId, "Production Asset", input.production.currentAsset?.projectId);
  assertSameProject(projectId, "QA Review", input.production.latestQaReview?.projectId);
  assertSameProject(projectId, "Client Approval", input.clientApproval?.project_id);

  const specFormat = getSpecDecision(input.spec, "format")?.value ?? null;
  const isPost = specFormat === "post";
  const versionRefs = buildVersionRefs(input);

  let approvedStrategyContext: ApprovedStrategyContext | null = null;
  let renderPromptPlan: RenderPromptPlan | null = null;
  let productionFreshness: ProductionFreshness = "not_started";
  let clientApprovalReadiness: ClientApprovalReadiness = {
    kind: input.creation ? "not_ready" : "legacy",
    canSend: false,
    requiresWarnAcknowledgement: false,
    message: "Pipeline V2 ainda não chegou à aprovação do cliente.",
    productionAssetVersionId: null,
    productionQaReviewId: null,
    qaStatus: null,
  };

  const finish = (
    nextAction: PostV2PipelineAction,
    blockingReason: string | null = null,
    readyForOperations = false,
  ): PostV2PipelineSnapshot => ({
    pipelineVersion: POST_V2_PIPELINE_VERSION,
    projectId,
    isV2: !!input.creation,
    isPost,
    nextAction,
    blockingReason,
    steps,
    versionRefs,
    approvedStrategyContext,
    renderPromptPlan,
    productionFreshness,
    clientApprovalReadiness,
    readyForOperations,
  });

  if (!input.creation) {
    steps.creation = {
      state: "ready",
      message: "Projeto operacional pode ser inicializado como Creation V2.",
      versionId: projectId,
    };
    return finish("bootstrap_creation");
  }

  steps.creation = {
    state: "complete",
    message: "Creation V2 inicializada.",
    versionId: projectId,
  };

  if (specFormat && specFormat !== "post") {
    steps.spec = {
      state: "blocked",
      message: `O Post V2 Pipeline recebeu Format '${specFormat}', não 'post'.`,
      versionId: null,
    };
    return finish(
      "wrong_format",
      "Este orquestrador é exclusivo para peças com Format = post.",
    );
  }

  if (!isSpecComplete(input.spec)) {
    steps.spec = {
      state: "in_progress",
      message: "$Spec precisa resolver apenas as decisões ainda ausentes.",
      versionId: null,
    };
    return finish("complete_spec");
  }

  steps.spec = {
    state: "complete",
    message: "$Spec completo para Post.",
    versionId: null,
  };

  const currentStrategy = input.strategy.currentVersion;
  const approvedStrategy = input.strategy.approvedVersion;

  if (
    currentStrategy &&
    currentStrategy.id !== approvedStrategy?.id &&
    currentStrategy.approvalStatus !== "approved"
  ) {
    steps.strategy = {
      state: "in_progress",
      message: "Existe uma Strategy Version atual aguardando aprovação.",
      versionId: currentStrategy.id,
    };
    return finish("approve_strategy");
  }

  if (!currentStrategy && !approvedStrategy) {
    steps.strategy = {
      state: "ready",
      message: "$Spec está pronto para gerar a Strategy externa.",
      versionId: null,
    };
    return finish("generate_strategy");
  }

  if (!currentStrategyIsReady(input)) {
    if (currentStrategy && currentStrategy.approvalStatus !== "rejected") {
      steps.strategy = {
        state: "in_progress",
        message: "Strategy atual ainda não está aprovada com Brand Snapshot congelado.",
        versionId: currentStrategy.id,
      };
      return finish("approve_strategy");
    }

    steps.strategy = {
      state: "review_required",
      message: "Strategy canônica não está em um estado aprovado consistente.",
      versionId: approvedStrategy?.id ?? currentStrategy?.id ?? null,
    };
    return finish(
      approvedStrategy ? "resolve_inconsistent_state" : "generate_strategy",
      approvedStrategy
        ? "A Strategy aprovada, seu state e o Brand Snapshot não estão alinhados."
        : null,
    );
  }

  if (approvedStrategy!.format !== "post") {
    steps.strategy = {
      state: "blocked",
      message: `A Strategy aprovada possui Format '${approvedStrategy!.format ?? "null"}'.`,
      versionId: approvedStrategy!.id,
    };
    return finish(
      "wrong_format",
      "A Strategy aprovada precisa ter Format = post para usar este pipeline.",
    );
  }

  approvedStrategyContext = buildApprovedStrategyContext({
    strategy: approvedStrategy!,
    snapshot: input.strategy.brandSnapshot!,
  });
  steps.strategy = {
    state: "complete",
    message: "Strategy aprovada e Brand Snapshot congelado.",
    versionId: approvedStrategy!.id,
  };

  const currentCopy = input.copy.currentVersion;
  const approvedCopy = input.copy.approvedVersion;

  if (currentCopy && currentCopy.id !== approvedCopy?.id) {
    if (!copyMatchesCurrentStrategy(input, currentCopy)) {
      steps.copyCore = {
        state: "review_required",
        message: "A Copy atual depende de uma Strategy/Brand Snapshot antiga.",
        versionId: currentCopy.id,
      };
      return finish("generate_copy_core");
    }

    if (hasValidPostCopyExtension(currentCopy)) {
      steps.copyCore = {
        state: "complete",
        message: "Copy Core preservada na revisão de Post.",
        versionId: currentCopy.id,
      };
      steps.postCopy = {
        state: "in_progress",
        message: "Post Copy Adapter gerou uma nova Copy Version aguardando aprovação.",
        versionId: currentCopy.id,
      };
      return finish("approve_post_copy");
    }

    steps.copyCore = {
      state: "in_progress",
      message: "Existe uma Copy Core atual aguardando aprovação.",
      versionId: currentCopy.id,
    };
    return finish("approve_copy_core");
  }

  if (!currentApprovedCopyIsReady(input)) {
    if (approvedCopy) {
      steps.copyCore = {
        state: "review_required",
        message: "A Copy aprovada ficou stale em relação à Strategy/Brand Snapshot atual.",
        versionId: approvedCopy.id,
      };
    } else {
      steps.copyCore = {
        state: "ready",
        message: "Strategy aprovada está pronta para geração de Copy Core.",
        versionId: null,
      };
    }
    return finish("generate_copy_core");
  }

  steps.copyCore = {
    state: "complete",
    message: "Copy Core aprovada e alinhada à Strategy atual.",
    versionId: approvedCopy!.id,
  };

  if (!hasValidPostCopyExtension(approvedCopy!)) {
    steps.postCopy = {
      state: "ready",
      message: "Copy Core aprovada precisa passar pelo Post Copy Adapter.",
      versionId: approvedCopy!.id,
    };
    return finish("generate_post_copy");
  }

  steps.postCopy = {
    state: "complete",
    message: "Post Copy aprovada com format_extension canônico.",
    versionId: approvedCopy!.id,
  };

  const currentDesign = input.design.currentVersion;
  const approvedDesign = input.design.approvedVersion;

  if (currentDesign && currentDesign.id !== approvedDesign?.id) {
    if (currentDesign.copyVersionId !== approvedCopy!.id) {
      steps.design = {
        state: "review_required",
        message: "O Design draft atual foi criado a partir de uma Copy antiga.",
        versionId: currentDesign.id,
      };
      return finish("generate_design");
    }

    steps.design = {
      state: "in_progress",
      message: "Existe um Design Spec atual aguardando aprovação.",
      versionId: currentDesign.id,
    };
    return finish("approve_design");
  }

  const designFreshness = deriveDesignDependencyFreshness({
    currentApprovedCopyVersionId: approvedCopy!.id,
    design: approvedDesign,
  });

  if (!currentApprovedDesignIsReady(input) || designFreshness.isStale) {
    steps.design = {
      state: approvedDesign ? "review_required" : "ready",
      message: approvedDesign
        ? "O Design aprovado ficou stale em relação à Copy atual."
        : "Post Copy aprovada está pronta para o Visual Director.",
      versionId: approvedDesign?.id ?? null,
    };
    return finish("generate_design");
  }

  steps.design = {
    state: "complete",
    message: "Design Spec aprovado e atual para a Copy aprovada.",
    versionId: approvedDesign!.id,
  };

  renderPromptPlan = buildPostV2RenderPromptPlan({
    design: approvedDesign!,
    designState: input.design.state!,
    copy: approvedCopy!,
    copyState: input.copy.state!,
    approvedStrategy: approvedStrategyContext,
  });
  steps.renderPrompt = {
    state: "ready",
    message: "Render Prompt canônico disponível para produção externa.",
    versionId: approvedDesign!.id,
  };

  const productionState = input.production.state;
  const asset = input.production.currentAsset;
  const qaReview = input.production.latestQaReview;

  if (asset && !productionState) {
    steps.production = {
      state: "blocked",
      message: "Existe Production Asset sem Production State carregado.",
      versionId: asset.id,
    };
    return finish(
      "resolve_inconsistent_state",
      "Production Asset existe, mas o estado canônico de Production está ausente.",
    );
  }

  if (productionState?.currentAssetVersionId && !asset) {
    steps.production = {
      state: "blocked",
      message: "Production State referencia um Asset que não foi carregado.",
      versionId: productionState.currentAssetVersionId,
    };
    return finish(
      "resolve_inconsistent_state",
      "Carregue o Production Asset exato referenciado pelo estado canônico.",
    );
  }

  productionFreshness = deriveProductionFreshness({
    asset,
    designState: input.design.state!,
  });

  if (!asset || productionFreshness === "review_required") {
    steps.production = {
      state: asset ? "review_required" : "ready",
      message: asset
        ? "O Production Asset atual ficou stale porque o Design aprovado mudou."
        : "Render Prompt está pronto para produção e registro do Asset final.",
      versionId: asset?.id ?? null,
    };
    return finish("produce_asset_from_render_prompt");
  }

  if (productionState!.currentAssetVersionId !== asset.id) {
    steps.production = {
      state: "blocked",
      message: "Production State e Production Asset atual não apontam para a mesma versão.",
      versionId: asset.id,
    };
    return finish(
      "resolve_inconsistent_state",
      "O ponteiro current_asset_version_id não corresponde ao Asset carregado.",
    );
  }

  steps.production = {
    state: "complete",
    message: "Production Asset atual está alinhado ao Design aprovado.",
    versionId: asset.id,
  };

  if (!qaReview || productionState!.status === "qa_pending") {
    steps.qa = {
      state: "ready",
      message: "Production Asset atual precisa passar pelo QA.",
      versionId: qaReview?.id ?? null,
    };
    return finish("run_qa");
  }

  if (
    qaReview.productionAssetVersionId !== asset.id ||
    productionState!.latestQaReviewId !== qaReview.id
  ) {
    steps.qa = {
      state: "review_required",
      message: "O QA carregado não corresponde ao Asset atual/último QA canônico.",
      versionId: qaReview.id,
    };
    return finish("run_qa");
  }

  if (qaReview.overallStatus === "BLOCK" || productionState!.status === "qa_blocked") {
    steps.qa = {
      state: "blocked",
      message: "QA atual está BLOCK e exige correção antes do envio ao cliente.",
      versionId: qaReview.id,
    };
    return finish("fix_qa_block", "QA BLOCK impede aprovação do cliente.");
  }

  const qaStateMatches =
    (qaReview.overallStatus === "PASS" && productionState!.status === "qa_pass") ||
    (qaReview.overallStatus === "WARN" && productionState!.status === "qa_warn");

  if (!qaStateMatches) {
    steps.qa = {
      state: "review_required",
      message: "Resultado do QA e Production State não estão sincronizados.",
      versionId: qaReview.id,
    };
    return finish(
      "resolve_inconsistent_state",
      "QA Review e Production State precisam apontar para o mesmo resultado final.",
    );
  }

  steps.qa = {
    state: "complete",
    message: `QA ${qaReview.overallStatus} concluído para o Asset atual.`,
    versionId: qaReview.id,
  };

  clientApprovalReadiness = deriveClientApprovalReadiness({
    isV2: true,
    productionState: productionState!,
    asset,
    qaReview,
  });

  const approval = input.clientApproval ?? null;
  const approvalIsCurrent = approvalLinksCurrentProduction(input);

  if (!approval) {
    steps.clientApproval = {
      state: clientApprovalReadiness.canSend ? "ready" : "blocked",
      message: clientApprovalReadiness.message,
      versionId: null,
    };
    return finish(
      clientApprovalReadiness.canSend
        ? "send_client_approval"
        : "resolve_inconsistent_state",
      clientApprovalReadiness.canSend ? null : clientApprovalReadiness.message,
    );
  }

  if (!approvalIsCurrent) {
    steps.clientApproval = {
      state: "review_required",
      message: "A aprovação existente não está vinculada ao Asset/QA canônico atual.",
      versionId: approval.id,
    };
    return finish("send_client_approval");
  }

  if (approval.status === "aprovado" || approval.status === "aprovado_com_ajustes") {
    steps.clientApproval = {
      state: "complete",
      message:
        approval.status === "aprovado_com_ajustes"
          ? "Cliente aprovou a versão canônica com ajustes."
          : "Cliente aprovou a versão canônica.",
      versionId: approval.id,
    };
    steps.operations = {
      state: "ready",
      message: "Peça V2 está pronta para Library/Calendar usando o Asset congelado na aprovação.",
      versionId: asset.id,
    };
    return finish("ready_for_operations", null, true);
  }

  if (
    approval.status === "ajustes_solicitados" ||
    approval.status === "recusado" ||
    approval.status === "nao_aprovado"
  ) {
    steps.clientApproval = {
      state: "review_required",
      message: "Cliente solicitou revisão da peça antes de uma nova aprovação.",
      versionId: approval.id,
    };
    return finish("revise_after_client_feedback");
  }

  if (
    approval.status === "enviado_para_aprovacao" ||
    approval.status === "visualizado_pelo_cliente" ||
    approval.status === "visualizado"
  ) {
    steps.clientApproval = {
      state: "in_progress",
      message: "A versão canônica está aguardando decisão do cliente.",
      versionId: approval.id,
    };
    return finish("wait_client_approval");
  }

  if (
    approval.status === "link_revogado" ||
    approval.status === "expirado" ||
    approval.status === "rascunho"
  ) {
    steps.clientApproval = {
      state: "ready",
      message: "É necessário emitir/enviar uma nova aprovação para a versão canônica atual.",
      versionId: approval.id,
    };
    return finish("send_client_approval");
  }

  steps.clientApproval = {
    state: "review_required",
    message: `Status de aprovação '${approval.status}' não é reconhecido pelo orquestrador V2.`,
    versionId: approval.id,
  };
  return finish(
    "resolve_inconsistent_state",
    "Status de aprovação do cliente fora do contrato operacional conhecido.",
  );
}

/** Post-specific wrapper: an incomplete/non-Post $Spec cannot start Strategy. */
export function buildPostV2StrategyTaskPlan(
  input: Parameters<typeof buildStrategyGenerationTaskPlan>[0],
): ReturnType<typeof buildStrategyGenerationTaskPlan> {
  const format = getSpecDecision(input.spec, "format")?.value ?? null;
  if (!isSpecComplete(input.spec)) {
    throw new Error("Post V2 Strategy requires a complete $Spec.");
  }
  if (format !== "post") {
    throw new Error("Post V2 Strategy requires Format = post.");
  }
  return buildStrategyGenerationTaskPlan(input);
}

/** Post-specific wrapper: Copy Core can only start from an approved Post Strategy. */
export function buildPostV2CopyCoreTaskPlan(
  input: Parameters<typeof buildCopyGenerationTaskPlan>[0],
): ReturnType<typeof buildCopyGenerationTaskPlan> {
  if (input.approvedStrategy.format !== "post") {
    throw new Error("Post V2 Copy Core requires an approved Strategy with Format = post.");
  }
  return buildCopyGenerationTaskPlan(input);
}

/** Post adapter wrapper used by the future Post V2 UI. */
export function buildPostV2PostCopyTaskPlan(
  input: Parameters<typeof buildPostCopyAdapterTaskPlan>[0],
): ReturnType<typeof buildPostCopyAdapterTaskPlan> {
  if (input.context.approvedStrategy.format !== "post") {
    throw new Error("Post Copy Adapter requires Format = post.");
  }
  return buildPostCopyAdapterTaskPlan(input);
}

/** Visual Director wrapper refuses a core-only Copy; Post extension must be approved first. */
export function buildPostV2VisualDirectorTaskPlan(
  input: Parameters<typeof buildVisualDirectorTaskPlan>[0],
): ReturnType<typeof buildVisualDirectorTaskPlan> {
  if (input.context.approvedStrategy.format !== "post") {
    throw new Error("Post V2 Visual Director requires Format = post.");
  }
  if (!hasValidPostCopyExtension(input.context.sourceCopy)) {
    throw new Error(
      "Post V2 Visual Director requires an approved Copy with the Post format_extension.",
    );
  }
  return buildVisualDirectorTaskPlan(input);
}


/** Post wrapper around the canonical deterministic Render Prompt. */
export function buildPostV2RenderPromptPlan(
  input: Parameters<typeof buildRenderPromptPlan>[0],
): ReturnType<typeof buildRenderPromptPlan> {
  if (input.approvedStrategy.format !== "post") {
    throw new Error("Post V2 Render Prompt requires Format = post.");
  }
  if (!hasValidPostCopyExtension(input.copy)) {
    throw new Error(
      "Post V2 Render Prompt requires the approved Post Copy format_extension.",
    );
  }
  return buildRenderPromptPlan(input);
}

/**
 * Facade exports for the transitions that stay canonical in their own modules.
 * The Post UI can import this orchestration file instead of recreating the
 * pipeline contract or bypassing validation/version lineage.
 */
export {
  buildStrategyGenerationResponseImportUpdate as buildPostV2StrategyResponseImportUpdate,
  buildStrategyGenerationValidationUpdate as buildPostV2StrategyValidationUpdate,
  buildStrategyDraftFromValidatedRun as buildPostV2StrategyDraftFromValidatedRun,
} from "@/lib/creation/strategy-generation";

export {
  buildStrategyApprovalRpcArgs as buildPostV2StrategyApprovalRpcArgs,
  parseStrategyApprovalResult as parsePostV2StrategyApprovalResult,
} from "@/lib/creation/strategy-approval";

export {
  buildCopyGenerationResponseImportUpdate as buildPostV2CopyCoreResponseImportUpdate,
  buildCopyGenerationValidationUpdate as buildPostV2CopyCoreValidationUpdate,
  buildCopyDraftFromValidatedRun as buildPostV2CopyCoreDraftFromValidatedRun,
} from "@/lib/creation/copy-generation";

export {
  buildPostCopyAdapterResponseImportUpdate as buildPostV2PostCopyResponseImportUpdate,
  buildPostCopyAdapterValidationUpdate as buildPostV2PostCopyValidationUpdate,
  buildPostCopyAdapterDraftFromValidatedRun as buildPostV2PostCopyDraftFromValidatedRun,
} from "@/lib/creation/post-copy-adapter";

export {
  buildCopyApprovalRpcArgs as buildPostV2CopyApprovalRpcArgs,
  parseCopyApprovalResult as parsePostV2CopyApprovalResult,
} from "@/lib/creation/copy-approval";

export {
  buildVisualDirectorResponseImportUpdate as buildPostV2VisualDirectorResponseImportUpdate,
  buildVisualDirectorValidationUpdate as buildPostV2VisualDirectorValidationUpdate,
  buildDesignDraftFromValidatedVisualDirectorRun as buildPostV2DesignDraftFromValidatedRun,
} from "@/lib/creation/visual-director";

export {
  buildDesignApprovalRpcArgs as buildPostV2DesignApprovalRpcArgs,
  parseDesignApprovalResult as parsePostV2DesignApprovalResult,
} from "@/lib/creation/design-approval";

export {
  buildProductionProvenance as buildPostV2ProductionProvenance,
  buildProductionAssetVersionInsert as buildPostV2ProductionAssetVersionInsert,
  buildProductionAssetRevisionInsert as buildPostV2ProductionAssetRevisionInsert,
  buildProductionStateAfterAsset as buildPostV2ProductionStateAfterAsset,
} from "@/lib/creation/production";

export {
  buildQaProvenance as buildPostV2QaProvenance,
  buildProductionQaReviewInsert as buildPostV2QaReviewInsert,
  evaluateDeterministicProductionAssetChecks as evaluatePostV2DeterministicQaChecks,
} from "@/lib/creation/qa";

export {
  buildClientApprovalV2Linkage as buildPostV2ClientApprovalLinkage,
} from "@/lib/creation/client-approval";
