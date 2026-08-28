import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  toCreationAggregate,
  type CreationAggregate,
} from "@/lib/creation/aggregate";
import {
  toBrandSnapshot,
  toStrategyState,
  toStrategyVersion,
  type BrandSnapshot,
  type StrategyState,
  type StrategyVersion,
} from "@/lib/creation/strategy";
import {
  toCopyState,
  toCopyVersion,
  type CopyState,
  type CopyVersion,
} from "@/lib/creation/copy";
import {
  toDesignState,
  toDesignVersion,
  type DesignState,
  type DesignVersion,
} from "@/lib/creation/design";
import {
  toProductionAssetVersion,
  toProductionState,
  type ProductionAssetVersion,
  type ProductionState,
} from "@/lib/creation/production";
import {
  toProductionQaReview,
  type ProductionQaReview,
} from "@/lib/creation/qa";
import {
  createSpecFromSignals,
  type SpecSeedInput,
  type SpecState,
} from "@/lib/creation/spec";
import {
  derivePostV2PipelineSnapshot,
  type PostV2PipelineClientApproval,
  type PostV2PipelineSnapshot,
} from "@/lib/creation/post-v2-pipeline";
import { isKnownProvenanceOrigin } from "@/lib/creation/provenance";
import { toAiTaskRun, type AiTaskRun } from "@/lib/creation/ai-task-gateway";
import { getPostV2SpecFromCampaignJson } from "@/lib/creation/post-v2-project";
import { VISUAL_DIRECTOR_RESPONSE_SCHEMA_VERSION } from "@/lib/creation/visual-director";

export type PostV2PipelineProjectSummary = Pick<
  Tables<"content_projects">,
  | "id"
  | "display_title"
  | "internal_title"
  | "theme"
  | "objective"
  | "selected_formats"
  | "brand_id"
  | "status"
  | "updated_at"
  | "campaign_content_json"
>;

export type LoadedPostV2Pipeline = {
  project: PostV2PipelineProjectSummary;
  creation: CreationAggregate | null;
  spec: SpecState;
  strategy: Awaited<ReturnType<typeof loadStrategySection>>;
  copy: Awaited<ReturnType<typeof loadCopySection>>;
  design: Awaited<ReturnType<typeof loadDesignSection>>;
  production: Awaited<ReturnType<typeof loadProductionSection>>;
  aiTasks: {
    strategy: AiTaskRun | null;
    copyCore: AiTaskRun | null;
    postCopy: AiTaskRun | null;
    visualDirector: AiTaskRun | null;
  };
  snapshot: PostV2PipelineSnapshot;
};

async function maybeOne<T>(
  promise: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  label: string,
): Promise<T | null> {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

function buildSpecForReadModel(input: {
  project: PostV2PipelineProjectSummary;
  strategy: StrategyVersion | null;
}): SpecState {
  const { project, strategy } = input;

  if (strategy) {
    const provenanceFor = (
      key: "objective" | "approach" | "format" | "concept",
    ) => {
      const decision = strategy.provenance.decisions[key];
      const candidate = decision?.origin ?? strategy.provenance.origin;
      return {
        origin: isKnownProvenanceOrigin(candidate)
          ? candidate
          : ("legacy_import" as const),
        source:
          decision?.source ??
          strategy.provenance.source ??
          `strategy_version:${strategy.id}`,
        recordedAt:
          decision?.recordedAt ??
          strategy.provenance.recordedAt ??
          strategy.updatedAt,
      };
    };

    return createSpecFromSignals({
      objective: strategy.objective
        ? { value: strategy.objective, ...provenanceFor("objective") }
        : undefined,
      approach: strategy.approach
        ? { value: strategy.approach, ...provenanceFor("approach") }
        : undefined,
      format: strategy.format
        ? { value: strategy.format, ...provenanceFor("format") }
        : undefined,
      concept: strategy.concept
        ? { value: strategy.concept, ...provenanceFor("concept") }
        : undefined,
    });
  }

  const persisted = getPostV2SpecFromCampaignJson(project.campaign_content_json);
  if (persisted) return persisted;

  const seed: SpecSeedInput = {};

  if (project.objective) {
    seed.objective = {
      value: project.objective,
      origin: "legacy_import",
      source: "content_projects.objective",
      recordedAt: project.updated_at,
    };
  }

  if (project.selected_formats?.includes("post")) {
    seed.format = {
      value: "post",
      origin: "legacy_import",
      source: "content_projects.selected_formats",
      recordedAt: project.updated_at,
    };
  }

  return createSpecFromSignals(seed);
}

async function loadStrategySection(
  projectId: string,
): Promise<{
  state: StrategyState | null;
  currentVersion: StrategyVersion | null;
  approvedVersion: StrategyVersion | null;
  brandSnapshot: BrandSnapshot | null;
}> {
  const row = await maybeOne<Tables<"creation_strategy_state">>(
    supabase
      .from("creation_strategy_state")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle(),
    "Não foi possível carregar Strategy State",
  );
  const state = row ? toStrategyState(row) : null;
  if (!state) {
    return {
      state: null,
      currentVersion: null,
      approvedVersion: null,
      brandSnapshot: null,
    };
  }

  const ids = Array.from(
    new Set(
      [state.currentVersionId, state.currentApprovedVersionId].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  );

  const versionsById = new Map<string, StrategyVersion>();
  if (ids.length) {
    const { data, error } = await supabase
      .from("creation_strategy_versions")
      .select("*")
      .eq("project_id", projectId)
      .in("id", ids);
    if (error) {
      throw new Error(`Não foi possível carregar Strategy Versions: ${error.message}`);
    }
    for (const versionRow of data ?? []) {
      const version = toStrategyVersion(versionRow);
      versionsById.set(version.id, version);
    }
  }

  const currentVersion = state.currentVersionId
    ? versionsById.get(state.currentVersionId) ?? null
    : null;
  const approvedVersion = state.currentApprovedVersionId
    ? versionsById.get(state.currentApprovedVersionId) ?? null
    : null;

  const snapshotRow = approvedVersion
    ? await maybeOne<Tables<"creation_brand_snapshots">>(
        supabase
          .from("creation_brand_snapshots")
          .select("*")
          .eq("project_id", projectId)
          .eq("strategy_version_id", approvedVersion.id)
          .maybeSingle(),
        "Não foi possível carregar Brand Snapshot",
      )
    : null;

  return {
    state,
    currentVersion,
    approvedVersion,
    brandSnapshot: snapshotRow ? toBrandSnapshot(snapshotRow) : null,
  };
}

async function loadCopySection(
  projectId: string,
): Promise<{
  state: CopyState | null;
  currentVersion: CopyVersion | null;
  approvedVersion: CopyVersion | null;
}> {
  const row = await maybeOne<Tables<"creation_copy_state">>(
    supabase
      .from("creation_copy_state")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle(),
    "Não foi possível carregar Copy State",
  );
  const state = row ? toCopyState(row) : null;
  if (!state) {
    return { state: null, currentVersion: null, approvedVersion: null };
  }

  const ids = Array.from(
    new Set(
      [state.currentVersionId, state.currentApprovedVersionId].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  );

  const versionsById = new Map<string, CopyVersion>();
  if (ids.length) {
    const { data, error } = await supabase
      .from("creation_copy_versions")
      .select("*")
      .eq("project_id", projectId)
      .in("id", ids);
    if (error) {
      throw new Error(`Não foi possível carregar Copy Versions: ${error.message}`);
    }
    for (const versionRow of data ?? []) {
      const version = toCopyVersion(versionRow);
      versionsById.set(version.id, version);
    }
  }

  return {
    state,
    currentVersion: state.currentVersionId
      ? versionsById.get(state.currentVersionId) ?? null
      : null,
    approvedVersion: state.currentApprovedVersionId
      ? versionsById.get(state.currentApprovedVersionId) ?? null
      : null,
  };
}

async function loadDesignSection(
  projectId: string,
): Promise<{
  state: DesignState | null;
  currentVersion: DesignVersion | null;
  approvedVersion: DesignVersion | null;
}> {
  const row = await maybeOne<Tables<"creation_design_state">>(
    supabase
      .from("creation_design_state")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle(),
    "Não foi possível carregar Design State",
  );
  const state = row ? toDesignState(row) : null;
  if (!state) {
    return { state: null, currentVersion: null, approvedVersion: null };
  }

  const ids = Array.from(
    new Set(
      [state.currentVersionId, state.currentApprovedVersionId].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  );

  const versionsById = new Map<string, DesignVersion>();
  if (ids.length) {
    const { data, error } = await supabase
      .from("creation_design_versions")
      .select("*")
      .eq("project_id", projectId)
      .in("id", ids);
    if (error) {
      throw new Error(`Não foi possível carregar Design Versions: ${error.message}`);
    }
    for (const versionRow of data ?? []) {
      const version = toDesignVersion(versionRow);
      versionsById.set(version.id, version);
    }
  }

  return {
    state,
    currentVersion: state.currentVersionId
      ? versionsById.get(state.currentVersionId) ?? null
      : null,
    approvedVersion: state.currentApprovedVersionId
      ? versionsById.get(state.currentApprovedVersionId) ?? null
      : null,
  };
}

async function loadProductionSection(
  projectId: string,
): Promise<{
  state: ProductionState | null;
  currentAsset: ProductionAssetVersion | null;
  currentPieceAsset: Tables<"content_piece_assets"> | null;
  latestQaReview: ProductionQaReview | null;
}> {
  const row = await maybeOne<Tables<"creation_production_state">>(
    supabase
      .from("creation_production_state")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle(),
    "Não foi possível carregar Production State",
  );
  const state = row ? toProductionState(row) : null;
  if (!state) {
    return {
      state: null,
      currentAsset: null,
      currentPieceAsset: null,
      latestQaReview: null,
    };
  }

  const [assetRow, qaRow] = await Promise.all([
    state.currentAssetVersionId
      ? maybeOne<Tables<"creation_production_asset_versions">>(
          supabase
            .from("creation_production_asset_versions")
            .select("*")
            .eq("project_id", projectId)
            .eq("id", state.currentAssetVersionId)
            .maybeSingle(),
          "Não foi possível carregar Production Asset",
        )
      : Promise.resolve(null),
    state.latestQaReviewId
      ? maybeOne<Tables<"creation_production_qa_reviews">>(
          supabase
            .from("creation_production_qa_reviews")
            .select("*")
            .eq("project_id", projectId)
            .eq("id", state.latestQaReviewId)
            .maybeSingle(),
          "Não foi possível carregar QA Review",
        )
      : Promise.resolve(null),
  ]);

  const currentAsset = assetRow ? toProductionAssetVersion(assetRow) : null;
  const pieceAssetRow = currentAsset
    ? await maybeOne<Tables<"content_piece_assets">>(
        supabase
          .from("content_piece_assets")
          .select("*")
          .eq("project_id", projectId)
          .eq("id", currentAsset.pieceAssetId)
          .maybeSingle(),
        "Não foi possível carregar o arquivo do Production Asset",
      )
    : null;

  return {
    state,
    currentAsset,
    currentPieceAsset: pieceAssetRow,
    latestQaReview: qaRow ? toProductionQaReview(qaRow) : null,
  };
}

async function loadLatestClientApproval(
  projectId: string,
): Promise<PostV2PipelineClientApproval | null> {
  const row = await maybeOne<PostV2PipelineClientApproval>(
    supabase
      .from("client_approvals")
      .select(
        "id, project_id, status, production_asset_version_id, production_qa_review_id, qa_warn_acknowledged_at, revoked_at",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "Não foi possível carregar a aprovação do cliente",
  );

  return row as PostV2PipelineClientApproval | null;
}

async function loadLatestAiTasks(projectId: string): Promise<LoadedPostV2Pipeline["aiTasks"]> {
  const { data, error } = await supabase
    .from("creation_ai_task_runs")
    .select("*")
    .eq("project_id", projectId)
    .in("task_type", ["strategy", "copy", "visual_direction"])
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    throw new Error(`Não foi possível carregar AI Tasks: ${error.message}`);
  }

  let strategy: AiTaskRun | null = null;
  let copyCore: AiTaskRun | null = null;
  let postCopy: AiTaskRun | null = null;
  let visualDirector: AiTaskRun | null = null;

  for (const row of data ?? []) {
    const run = toAiTaskRun(row);
    if (!strategy && run.taskType === "strategy") {
      strategy = run;
      continue;
    }
    if (!visualDirector && run.taskType === "visual_direction") {
      visualDirector = run;
      continue;
    }
    if (run.taskType !== "copy") continue;

    if (!postCopy && run.inputVersions.post_copy_adapter_schema) {
      postCopy = run;
      continue;
    }
    if (!copyCore && run.inputVersions.copy_response_schema) {
      copyCore = run;
    }
  }

  return { strategy, copyCore, postCopy, visualDirector };
}

export async function loadPostV2Pipeline(
  projectIdInput: string,
): Promise<LoadedPostV2Pipeline> {
  const projectId = projectIdInput.trim();
  if (!projectId) throw new Error("projectId must not be blank.");

  const [
    projectRow,
    creationRow,
    strategy,
    copy,
    design,
    production,
    clientApproval,
    aiTasks,
  ] = await Promise.all([
    maybeOne<PostV2PipelineProjectSummary>(
      supabase
        .from("content_projects")
        .select(
          "id, display_title, internal_title, theme, objective, selected_formats, brand_id, status, updated_at, campaign_content_json",
        )
        .eq("id", projectId)
        .maybeSingle(),
      "Não foi possível carregar o projeto",
    ),
    maybeOne<Tables<"creation_core">>(
      supabase
        .from("creation_core")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle(),
      "Não foi possível carregar Creation Core",
    ),
    loadStrategySection(projectId),
    loadCopySection(projectId),
    loadDesignSection(projectId),
    loadProductionSection(projectId),
    loadLatestClientApproval(projectId),
    loadLatestAiTasks(projectId),
  ]);

  if (!projectRow) throw new Error("Projeto não encontrado ou sem acesso.");

  const project = projectRow as PostV2PipelineProjectSummary;
  const creation = creationRow ? toCreationAggregate(creationRow) : null;
  const spec = buildSpecForReadModel({
    project,
    strategy: strategy.currentVersion ?? strategy.approvedVersion,
  });

  const snapshot = derivePostV2PipelineSnapshot({
    projectId,
    creation,
    spec,
    strategy,
    copy,
    design,
    production,
    clientApproval,
  });

  const isResumableTask = (run: AiTaskRun | null) =>
    !!run && (run.validationStatus === "pending" || run.validationStatus === "invalid");

  const resumableAiTasks: LoadedPostV2Pipeline["aiTasks"] = {
    strategy: isResumableTask(aiTasks.strategy) ? aiTasks.strategy : null,
    copyCore:
      isResumableTask(aiTasks.copyCore) &&
      aiTasks.copyCore?.inputVersions.strategy_version_id === strategy.approvedVersion?.id &&
      aiTasks.copyCore?.inputVersions.brand_snapshot_id === strategy.brandSnapshot?.id
        ? aiTasks.copyCore
        : null,
    postCopy:
      isResumableTask(aiTasks.postCopy) &&
      aiTasks.postCopy?.inputVersions.source_copy_version_id === copy.approvedVersion?.id
        ? aiTasks.postCopy
        : null,
    visualDirector:
      isResumableTask(aiTasks.visualDirector) &&
      aiTasks.visualDirector?.inputVersions.copy_version_id === copy.approvedVersion?.id &&
      aiTasks.visualDirector?.inputVersions.strategy_version_id === strategy.approvedVersion?.id &&
      aiTasks.visualDirector?.inputVersions.brand_snapshot_id === strategy.brandSnapshot?.id &&
      aiTasks.visualDirector?.inputVersions.visual_direction_response_schema === VISUAL_DIRECTOR_RESPONSE_SCHEMA_VERSION
        ? aiTasks.visualDirector
        : null,
  };

  return {
    project,
    creation,
    spec,
    strategy,
    copy,
    design,
    production,
    aiTasks: resumableAiTasks,
    snapshot,
  };
}
