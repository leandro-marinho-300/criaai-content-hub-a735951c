import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { buildCreationCoreInsert } from "@/lib/creation/aggregate";
import {
  applySpecDecision,
  createSpecFromSignals,
  type SpecDecisionKey,
  type SpecState,
} from "@/lib/creation/spec";
import {
  buildStrategyGenerationTaskPlan,
  buildStrategyGenerationResponseImportUpdate,
  buildStrategyGenerationValidationUpdate,
  buildStrategyDraftFromValidatedRun,
} from "@/lib/creation/strategy-generation";
import {
  buildCopyGenerationTaskPlan,
  buildCopyGenerationResponseImportUpdate,
  buildCopyGenerationValidationUpdate,
  buildCopyDraftFromValidatedRun,
} from "@/lib/creation/copy-generation";
import {
  buildPostCopyAdapterTaskPlan,
  buildPostCopyAdapterResponseImportUpdate,
  buildPostCopyAdapterValidationUpdate,
  buildPostCopyAdapterDraftFromValidatedRun,
  type ApprovedPostCopyContext,
} from "@/lib/creation/post-copy-adapter";
import { toAiTaskRun } from "@/lib/creation/ai-task-gateway";
import {
  buildStrategyApprovalRpcArgs,
  buildApprovedStrategyContext,
} from "@/lib/creation/strategy-approval";
import { buildCopyApprovalRpcArgs } from "@/lib/creation/copy-approval";
import { buildDesignApprovalRpcArgs } from "@/lib/creation/design-approval";
import {
  buildVisualDirectorResponseImportUpdate,
  buildVisualDirectorTaskPlan,
  buildVisualDirectorValidationUpdate,
  buildDesignDraftFromValidatedVisualDirectorRun,
} from "@/lib/creation/visual-director";
import { buildStrategyStateInsert, toBrandSnapshot, toStrategyVersion } from "@/lib/creation/strategy";
import { buildCopyStateInsert, toCopyState, toCopyVersion } from "@/lib/creation/copy";
import {
  buildDesignStateInsert,
  toDesignState,
  toDesignVersion,
} from "@/lib/creation/design";
import {
  buildProductionAssetRevisionInsert,
  buildProductionAssetVersionInsert,
  buildProductionProvenance,
  buildProductionStateInsert,
  toProductionAssetVersion,
} from "@/lib/creation/production";
import { buildRenderPromptPlan } from "@/lib/creation/render-prompt";
import {
  buildProductionQaReviewInsert,
  buildQaProvenance,
  deriveQaStatusesWithFindings,
  evaluateDeterministicProductionAssetChecks,
  toProductionQaReview,
  type QaAxisStatuses,
  type QaFinding,
  type QaStatus,
} from "@/lib/creation/qa";
import { deletePieceAsset, uploadPieceAsset } from "@/lib/pieceAssets";
import { mergePostV2SpecIntoCampaignJson } from "@/lib/creation/post-v2-project";

export type PostV2BrandOption = Pick<
  Tables<"brands">,
  "id" | "name" | "description" | "audience" | "tone_of_voice" | "personality" |
  "products_services" | "differentiators" | "prohibited_words" | "forbidden_inventions" |
  "legal_information"
>;

export type PreparedManualTask = {
  runId: string;
  promptText: string;
  taskType: "strategy" | "copy" | "visual_direction";
};

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Sessão expirada. Entre novamente para continuar.");
  return data.user.id;
}

export async function listPostV2Brands(): Promise<PostV2BrandOption[]> {
  const { data, error } = await supabase
    .from("brands")
    .select("id,name,description,audience,tone_of_voice,personality,products_services,differentiators,prohibited_words,forbidden_inventions,legal_information")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function bootstrapPostV2(input: {
  title: string;
  theme: string;
  brandId: string | null;
}): Promise<string> {
  const userId = await requireUserId();
  const title = input.title.trim() || input.theme.trim() || "Novo Post V2";
  const theme = input.theme.trim();
  if (!theme) throw new Error("Informe o tema/intenção da publicação.");

  const { data: project, error: projectError } = await supabase
    .from("content_projects")
    .insert({
      user_id: userId,
      display_title: title,
      internal_title: title,
      theme,
      brand_id: input.brandId || null,
      selected_formats: ["post"],
      selected_outputs: ["post"],
      content_source: "manual",
      generation_mode: "safe",
      status: "draft",
      content_development_status: "draft",
      campaign_content_json: mergePostV2SpecIntoCampaignJson(null, createSpecFromSignals({ format: { value: "post", origin: "system_recommendation", source: "post_v2_fixed_format" } })),
    })
    .select("id")
    .single();
  if (projectError) throw projectError;

  try {
    const projectId = project.id;
    const { error: coreError } = await supabase
      .from("creation_core")
      .insert(buildCreationCoreInsert(projectId));
    if (coreError) throw coreError;

    const inserts = await Promise.all([
      supabase.from("creation_strategy_state").insert(buildStrategyStateInsert(projectId)),
      supabase.from("creation_copy_state").insert(buildCopyStateInsert(projectId)),
      supabase.from("creation_design_state").insert(buildDesignStateInsert(projectId)),
      supabase.from("creation_production_state").insert(buildProductionStateInsert(projectId)),
    ]);
    const failed = inserts.find((result) => result.error);
    if (failed?.error) throw failed.error;
    return projectId;
  } catch (error) {
    await supabase.from("content_projects").delete().eq("id", project.id);
    throw error;
  }
}


export async function bootstrapExistingPostV2(projectId: string): Promise<void> {
  const { data: existing, error: readError } = await supabase
    .from("creation_core")
    .select("project_id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (readError) throw readError;

  if (!existing) {
    const { error: coreError } = await supabase
      .from("creation_core")
      .insert(buildCreationCoreInsert(projectId));
    if (coreError) throw coreError;
  }

  const inserts = await Promise.all([
    supabase.from("creation_strategy_state").upsert(buildStrategyStateInsert(projectId), { onConflict: "project_id", ignoreDuplicates: true }),
    supabase.from("creation_copy_state").upsert(buildCopyStateInsert(projectId), { onConflict: "project_id", ignoreDuplicates: true }),
    supabase.from("creation_design_state").upsert(buildDesignStateInsert(projectId), { onConflict: "project_id", ignoreDuplicates: true }),
    supabase.from("creation_production_state").upsert(buildProductionStateInsert(projectId), { onConflict: "project_id", ignoreDuplicates: true }),
  ]);
  const failed = inserts.find((result) => result.error);
  if (failed?.error) throw failed.error;
}

export async function savePostV2SpecDecision(input: {
  projectId: string;
  current: SpecState;
  key: SpecDecisionKey;
  value: string;
}): Promise<void> {
  const next = applySpecDecision(input.current, {
    key: input.key,
    value: input.value,
    origin: "human",
    source: "post_v2_studio",
  });
  const { data: project, error: readError } = await supabase
    .from("content_projects")
    .select("campaign_content_json")
    .eq("id", input.projectId)
    .single();
  if (readError) throw readError;
  const { error } = await supabase
    .from("content_projects")
    .update({ campaign_content_json: mergePostV2SpecIntoCampaignJson(project.campaign_content_json, next) })
    .eq("id", input.projectId);
  if (error) throw error;
}

async function nextStrategyVersionNumber(projectId: string) {
  const { data, error } = await supabase.from("creation_strategy_versions").select("version_number").eq("project_id", projectId).order("version_number", { ascending: false }).limit(1);
  if (error) throw error;
  return (data?.[0]?.version_number ?? 0) + 1;
}

async function nextCopyVersionNumber(projectId: string) {
  const { data, error } = await supabase.from("creation_copy_versions").select("version_number").eq("project_id", projectId).order("version_number", { ascending: false }).limit(1);
  if (error) throw error;
  return (data?.[0]?.version_number ?? 0) + 1;
}

async function nextDesignVersionNumber(projectId: string) {
  const { data, error } = await supabase.from("creation_design_versions").select("version_number").eq("project_id", projectId).order("version_number", { ascending: false }).limit(1);
  if (error) throw error;
  return (data?.[0]?.version_number ?? 0) + 1;
}

async function fetchBrandForProject(projectId: string) {
  const { data: project, error } = await supabase.from("content_projects").select("brand_id,theme,notes,mandatory_information,restrictions,specific_audience").eq("id", projectId).single();
  if (error) throw error;
  let brand: PostV2BrandOption | null = null;
  if (project.brand_id) {
    const { data, error: brandError } = await supabase.from("brands").select("id,name,description,audience,tone_of_voice,personality,products_services,differentiators,prohibited_words,forbidden_inventions,legal_information").eq("id", project.brand_id).single();
    if (brandError) throw brandError;
    brand = data;
  }
  return { project, brand };
}

export async function prepareStrategyManualTask(projectId: string, spec: SpecState): Promise<PreparedManualTask> {
  const { project, brand } = await fetchBrandForProject(projectId);
  const plan = buildStrategyGenerationTaskPlan({
    projectId,
    spec,
    context: {
      intent: project.theme,
      additionalContext: [project.notes, project.mandatory_information, project.restrictions].filter(Boolean).join("\n") || null,
      brand: brand ? {
        name: brand.name,
        description: brand.description,
        audience: project.specific_audience || brand.audience,
        toneOfVoice: brand.tone_of_voice,
        personality: brand.personality,
        productsServices: brand.products_services,
        differentiators: brand.differentiators,
        prohibitedWords: brand.prohibited_words,
        forbiddenInventions: brand.forbidden_inventions,
        legalInformation: brand.legal_information,
      } : null,
    },
  });
  const { data, error } = await supabase.from("creation_ai_task_runs").insert(plan.taskInsert).select("id").single();
  if (error) throw error;
  return { runId: data.id, promptText: plan.promptText, taskType: "strategy" };
}

async function getTaskRun(runId: string) {
  const { data, error } = await supabase.from("creation_ai_task_runs").select("*").eq("id", runId).single();
  if (error) throw error;
  return toAiTaskRun(data);
}

export async function importStrategyResponse(input: { projectId: string; spec: SpecState; runId: string; response: string; }) {
  const importUpdate = buildStrategyGenerationResponseImportUpdate(input.response);
  let result = await supabase.from("creation_ai_task_runs").update(importUpdate).eq("id", input.runId);
  if (result.error) throw result.error;

  const validation = buildStrategyGenerationValidationUpdate(input.response);
  result = await supabase.from("creation_ai_task_runs").update(validation.update).eq("id", input.runId);
  if (result.error) throw result.error;
  if (!validation.result.ok) throw new Error(validation.result.issues.map((i) => i.message).join("\n"));

  const run = await getTaskRun(input.runId);
  const versionNumber = await nextStrategyVersionNumber(input.projectId);
  const plan = buildStrategyDraftFromValidatedRun({ projectId: input.projectId, versionNumber, spec: input.spec, run });
  const { data: version, error } = await supabase.from("creation_strategy_versions").insert(plan.strategyVersionInsert).select("id").single();
  if (error) throw error;
  const { error: stateError } = await supabase.from("creation_strategy_state").update(plan.strategyStateUpdateAfterInsert(version.id)).eq("project_id", input.projectId);
  if (stateError) throw stateError;
  return version.id;
}

export async function approveStrategy(projectId: string, strategyVersionId: string) {
  const { error } = await supabase.rpc("approve_creation_strategy", buildStrategyApprovalRpcArgs({ projectId, strategyVersionId }));
  if (error) throw error;
}

async function loadApprovedStrategyContext(projectId: string) {
  const { data: state, error: stateError } = await supabase.from("creation_strategy_state").select("current_approved_version_id").eq("project_id", projectId).single();
  if (stateError) throw stateError;
  if (!state.current_approved_version_id) throw new Error("Aprove a Strategy antes de gerar Copy.");
  const { data: strategyRow, error: strategyError } = await supabase.from("creation_strategy_versions").select("*").eq("id", state.current_approved_version_id).single();
  if (strategyError) throw strategyError;
  const { data: snapshotRow, error: snapshotError } = await supabase.from("creation_brand_snapshots").select("*").eq("strategy_version_id", state.current_approved_version_id).single();
  if (snapshotError) throw snapshotError;
  return buildApprovedStrategyContext({ strategy: toStrategyVersion(strategyRow), snapshot: toBrandSnapshot(snapshotRow) });
}

export async function prepareCopyManualTask(projectId: string): Promise<PreparedManualTask> {
  const approvedStrategy = await loadApprovedStrategyContext(projectId);
  const plan = buildCopyGenerationTaskPlan({ approvedStrategy });
  const { data, error } = await supabase.from("creation_ai_task_runs").insert(plan.taskInsert).select("id").single();
  if (error) throw error;
  return { runId: data.id, promptText: plan.promptText, taskType: "copy" };
}

export async function importCopyResponse(input: { projectId: string; runId: string; response: string; }) {
  const approvedStrategy = await loadApprovedStrategyContext(input.projectId);
  let result = await supabase.from("creation_ai_task_runs").update(buildCopyGenerationResponseImportUpdate(input.response)).eq("id", input.runId);
  if (result.error) throw result.error;
  const validation = buildCopyGenerationValidationUpdate(input.response);
  result = await supabase.from("creation_ai_task_runs").update(validation.update).eq("id", input.runId);
  if (result.error) throw result.error;
  if (!validation.result.ok) throw new Error(validation.result.issues.map((i) => i.message).join("\n"));
  const run = await getTaskRun(input.runId);
  const versionNumber = await nextCopyVersionNumber(input.projectId);
  const plan = buildCopyDraftFromValidatedRun({ versionNumber, approvedStrategy, run });
  await supabase.from("creation_copy_state").upsert(plan.copyStateInsertIfMissing, { onConflict: "project_id", ignoreDuplicates: true });
  const { data: version, error } = await supabase.from("creation_copy_versions").insert(plan.copyVersionInsert).select("id").single();
  if (error) throw error;
  const { error: stateError } = await supabase.from("creation_copy_state").update(plan.copyStateUpdateAfterInsert(version.id)).eq("project_id", input.projectId);
  if (stateError) throw stateError;
  return version.id;
}

export async function approveCopy(projectId: string, copyVersionId: string) {
  const { error } = await supabase.rpc("approve_creation_copy", buildCopyApprovalRpcArgs({ projectId, copyVersionId }));
  if (error) throw error;
}

async function loadApprovedCopyContext(projectId: string): Promise<ApprovedPostCopyContext> {
  const approvedStrategy = await loadApprovedStrategyContext(projectId);
  const { data: stateRow, error: stateError } = await supabase.from("creation_copy_state").select("*").eq("project_id", projectId).single();
  if (stateError) throw stateError;
  const state = toCopyState(stateRow);
  if (!state.currentApprovedVersionId) throw new Error("A Creation precisa de uma Copy aprovada para continuar.");
  const { data: copyRow, error: copyError } = await supabase.from("creation_copy_versions").select("*").eq("id", state.currentApprovedVersionId).single();
  if (copyError) throw copyError;
  return { sourceCopy: toCopyVersion(copyRow), copyState: state, approvedStrategy };
}

export async function preparePostCopyManualTask(projectId: string): Promise<PreparedManualTask> {
  const context = await loadApprovedCopyContext(projectId);
  const plan = buildPostCopyAdapterTaskPlan({ context });
  const { data, error } = await supabase.from("creation_ai_task_runs").insert(plan.taskInsert).select("id").single();
  if (error) throw error;
  return { runId: data.id, promptText: plan.promptText, taskType: "copy" };
}

export async function importPostCopyResponse(input: { projectId: string; runId: string; response: string; }) {
  const context = await loadApprovedCopyContext(input.projectId);
  let result = await supabase.from("creation_ai_task_runs").update(buildPostCopyAdapterResponseImportUpdate(input.response)).eq("id", input.runId);
  if (result.error) throw result.error;
  const validation = buildPostCopyAdapterValidationUpdate({ response: input.response, sourceCopy: context.sourceCopy });
  result = await supabase.from("creation_ai_task_runs").update(validation.update).eq("id", input.runId);
  if (result.error) throw result.error;
  if (!validation.result.ok) throw new Error(validation.result.issues.map((i) => i.message).join("\n"));
  const run = await getTaskRun(input.runId);
  const versionNumber = await nextCopyVersionNumber(input.projectId);
  const plan = buildPostCopyAdapterDraftFromValidatedRun({ context, run, versionNumber });
  const { data: version, error } = await supabase.from("creation_copy_versions").insert(plan.copyVersionInsert).select("id").single();
  if (error) throw error;
  const { error: stateError } = await supabase.from("creation_copy_state").update(plan.copyStateUpdateAfterInsert(version.id)).eq("project_id", input.projectId);
  if (stateError) throw stateError;
  return version.id;
}

export async function prepareVisualDirectorManualTask(projectId: string): Promise<PreparedManualTask> {
  const context = await loadApprovedCopyContext(projectId);
  const plan = buildVisualDirectorTaskPlan({ context });
  const { data, error } = await supabase
    .from("creation_ai_task_runs")
    .insert(plan.taskInsert)
    .select("id")
    .single();
  if (error) throw error;
  return { runId: data.id, promptText: plan.promptText, taskType: "visual_direction" };
}

export async function importVisualDirectorResponse(input: {
  projectId: string;
  runId: string;
  response: string;
}) {
  const context = await loadApprovedCopyContext(input.projectId);

  let result = await supabase
    .from("creation_ai_task_runs")
    .update(buildVisualDirectorResponseImportUpdate(input.response))
    .eq("id", input.runId);
  if (result.error) throw result.error;

  const validation = buildVisualDirectorValidationUpdate(input.response);
  result = await supabase
    .from("creation_ai_task_runs")
    .update(validation.update)
    .eq("id", input.runId);
  if (result.error) throw result.error;
  if (!validation.result.ok) {
    throw new Error(validation.result.issues.map((issue) => issue.message).join("\n"));
  }

  const run = await getTaskRun(input.runId);
  const versionNumber = await nextDesignVersionNumber(input.projectId);
  const plan = buildDesignDraftFromValidatedVisualDirectorRun({
    context,
    run,
    versionNumber,
  });

  await supabase
    .from("creation_design_state")
    .upsert(buildDesignStateInsert(input.projectId), {
      onConflict: "project_id",
      ignoreDuplicates: true,
    });

  const { data: version, error } = await supabase
    .from("creation_design_versions")
    .insert(plan.designVersionInsert)
    .select("id")
    .single();
  if (error) throw error;

  const { error: stateError } = await supabase
    .from("creation_design_state")
    .update(plan.designStateUpdateAfterInsert(version.id))
    .eq("project_id", input.projectId);
  if (stateError) throw stateError;

  return version.id;
}

export async function approveDesign(projectId: string, designVersionId: string) {
  const { error } = await supabase.rpc(
    "approve_creation_design",
    buildDesignApprovalRpcArgs({ projectId, designVersionId }),
  );
  if (error) throw error;
}

async function nextProductionAssetVersionNumber(projectId: string) {
  const { data, error } = await supabase
    .from("creation_production_asset_versions")
    .select("version_number")
    .eq("project_id", projectId)
    .order("version_number", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0]?.version_number ?? 0) + 1;
}

async function loadApprovedDesignContextForProduction(projectId: string) {
  const { data: stateRow, error: stateError } = await supabase
    .from("creation_design_state")
    .select("*")
    .eq("project_id", projectId)
    .single();
  if (stateError) throw stateError;

  const state = toDesignState(stateRow);
  if (!state.currentApprovedVersionId) {
    throw new Error("Aprove o Design Spec antes de registrar o Asset final.");
  }

  const { data: designRow, error: designError } = await supabase
    .from("creation_design_versions")
    .select("*")
    .eq("project_id", projectId)
    .eq("id", state.currentApprovedVersionId)
    .single();
  if (designError) throw designError;

  const design = toDesignVersion(designRow);
  if (design.approvalStatus !== "approved") {
    throw new Error("O Design atual precisa estar aprovado para Production.");
  }

  return { state, design };
}

function postV2PieceSnapshot(input: {
  title: string;
  context: ApprovedPostCopyContext;
  renderPromptText: string;
}) {
  const { sourceCopy, approvedStrategy } = input.context;
  const extension =
    sourceCopy.formatExtension &&
    typeof sourceCopy.formatExtension === "object" &&
    !Array.isArray(sourceCopy.formatExtension)
      ? (sourceCopy.formatExtension as Record<string, unknown>)
      : {};

  const headline =
    typeof extension.headline === "string" && extension.headline.trim()
      ? extension.headline.trim()
      : sourceCopy.core.primaryMessage;
  const supportText =
    typeof extension.supportText === "string" ? extension.supportText.trim() : "";
  const artCta =
    typeof extension.artCta === "string" && extension.artCta.trim()
      ? extension.artCta.trim()
      : sourceCopy.core.cta?.wording ?? "";
  const caption =
    typeof extension.caption === "string" ? extension.caption.trim() : "";
  const hashtags = Array.isArray(extension.hashtags)
    ? extension.hashtags.filter((value): value is string => typeof value === "string")
    : [];

  const approach = approvedStrategy.approach ?? "";
  const communicationAngle =
    approach === "offer"
      ? "comercial"
      : approach === "community"
        ? "acolhedor"
        : approach === "storytelling"
          ? "inspirador"
          : approach === "educational"
            ? "institucional"
            : "direto";

  return {
    index: 1,
    formatKey: "post",
    role: "arte",
    name: input.title,
    formatLabel: "Post para Feed · V2",
    objective: approvedStrategy.objective ?? "post",
    communicationAngle,
    mainPromise: sourceCopy.core.primaryMessage,
    mainProblem: "",
    mainBenefit: sourceCopy.core.supportingPoints[0] ?? sourceCopy.core.primaryMessage,
    mainText: headline,
    supportText,
    bullets: sourceCopy.core.supportingPoints.slice(1),
    cta: artCta,
    caption,
    hashtags,
    productionNotes: [
      "Production Asset registrado pelo pipeline canônico Post V2.",
      "Render Prompt e Design Spec aprovados são a fonte de verdade visual.",
    ],
    readyPrompt: input.renderPromptText,
    qualityStatus: "approved",
    headlineOptions: [headline],
    supportTextOptions: supportText ? [supportText] : [],
    outputKind: "publishable_asset",
    sourceScope: "publication",
    contentStage: "publication_copy",
    copySource: "external_chatgpt",
  };
}

async function ensureProductionOutputForDesign(input: {
  projectId: string;
  userId: string;
  designVersionId: string;
  designVersionNumber: number;
  context: ApprovedPostCopyContext;
  renderPromptText: string;
}): Promise<{ id: string; created: boolean }> {
  const source = `post_v2_production:${input.designVersionId}`;
  const { data: existing, error: existingError } = await supabase
    .from("content_outputs")
    .select("id")
    .eq("project_id", input.projectId)
    .eq("source", source)
    .eq("output_type", "piece")
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { id: existing.id, created: false };

  const { data: project, error: projectError } = await supabase
    .from("content_projects")
    .select("display_title,internal_title,theme")
    .eq("id", input.projectId)
    .single();
  if (projectError) throw projectError;

  const baseTitle =
    project.display_title?.trim() ||
    project.internal_title?.trim() ||
    project.theme?.trim() ||
    "Post V2";
  const title = `Post V2 · Design v${input.designVersionNumber} · ${baseTitle}`;
  const piece = postV2PieceSnapshot({
    title,
    context: input.context,
    renderPromptText: input.renderPromptText,
  });

  const { data, error } = await supabase
    .from("content_outputs")
    .insert({
      project_id: input.projectId,
      user_id: input.userId,
      output_type: "piece",
      title,
      original_content: JSON.stringify(piece),
      source,
      version: 2,
      copy_status: "approved",
      display_order: 0,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, created: true };
}

/**
 * Registers the externally produced final image as the canonical Production
 * Asset for the current approved Design. The image keeps using the existing
 * piece-assets/content_piece_assets flow; this function only adds the V2
 * immutable version/linkage after a successful upload.
 */
export async function registerPostV2ProductionAsset(input: {
  projectId: string;
  file: File;
  source?: string | null;
}) {
  const projectId = input.projectId.trim();
  if (!projectId) throw new Error("projectId must not be blank.");

  const userId = await requireUserId();
  const copyContext = await loadApprovedCopyContext(projectId);
  const { state: designState, design } =
    await loadApprovedDesignContextForProduction(projectId);

  const renderPrompt = buildRenderPromptPlan({
    design,
    designState,
    copy: copyContext.sourceCopy,
    copyState: copyContext.copyState,
    approvedStrategy: copyContext.approvedStrategy,
  });

  const output = await ensureProductionOutputForDesign({
    projectId,
    userId,
    designVersionId: design.id,
    designVersionNumber: design.versionNumber,
    context: copyContext,
    renderPromptText: renderPrompt.promptText,
  });

  const nextVersionNumber = await nextProductionAssetVersionNumber(projectId);
  let pieceAsset: Awaited<ReturnType<typeof uploadPieceAsset>> | null = null;

  try {
    pieceAsset = await uploadPieceAsset({
      userId,
      projectId,
      outputId: output.id,
      file: input.file,
      displayOrder: nextVersionNumber - 1,
      includeInClientPdf: true,
    });

    const { data: productionState, error: stateError } = await supabase
      .from("creation_production_state")
      .select("current_asset_version_id")
      .eq("project_id", projectId)
      .single();
    if (stateError) throw stateError;

    let currentAsset: ReturnType<typeof toProductionAssetVersion> | null = null;
    if (productionState.current_asset_version_id) {
      const { data: currentAssetRow, error: currentAssetError } = await supabase
        .from("creation_production_asset_versions")
        .select("*")
        .eq("project_id", projectId)
        .eq("id", productionState.current_asset_version_id)
        .single();
      if (currentAssetError) throw currentAssetError;
      currentAsset = toProductionAssetVersion(currentAssetRow);
    }

    const provenance = buildProductionProvenance({
      origin: "external_manual",
      source: input.source?.trim() || "post_v2_external_production",
      renderPromptVersion: renderPrompt.promptVersion,
    });

    const insert =
      currentAsset && currentAsset.designVersionId === design.id
        ? buildProductionAssetRevisionInsert({
            source: currentAsset,
            design,
            designState,
            pieceAsset,
            versionNumber: nextVersionNumber,
            provenance,
          })
        : buildProductionAssetVersionInsert({
            projectId,
            design,
            designState,
            pieceAsset,
            versionNumber: nextVersionNumber,
            provenance,
          });

    const { data: version, error: versionError } = await supabase
      .from("creation_production_asset_versions")
      .insert(insert)
      .select("id")
      .single();
    if (versionError) throw versionError;

    return {
      productionAssetVersionId: version.id,
      pieceAssetId: pieceAsset.id,
      outputId: output.id,
    };
  } catch (error) {
    let uploadedAssetRemoved = !pieceAsset;
    if (pieceAsset) {
      try {
        await deletePieceAsset(pieceAsset);
        uploadedAssetRemoved = true;
      } catch {
        // If the canonical version was actually committed, the FK intentionally
        // prevents deleting the binary metadata. Preserve that safer state.
      }
    }
    if (output.created && uploadedAssetRemoved) {
      await supabase.from("content_outputs").delete().eq("id", output.id);
    }
    throw error;
  }
}

export type PostV2QaAxisKey = keyof QaAxisStatuses;

export type PostV2QaManualReviewInput = {
  projectId: string;
  statuses: QaAxisStatuses;
  notes?: Partial<Record<PostV2QaAxisKey, string>>;
};

const QA_AXIS_META: Record<
  PostV2QaAxisKey,
  { axis: QaFinding["axis"]; code: string }
> = {
  factual: { axis: "factual", code: "human_factual_review" },
  strategic: { axis: "strategic", code: "human_strategic_review" },
  brand: { axis: "brand", code: "human_brand_review" },
  visualTechnical: {
    axis: "visual_technical",
    code: "human_visual_technical_review",
  },
};

function isPostV2QaStatus(value: unknown): value is QaStatus {
  return value === "PASS" || value === "WARN" || value === "BLOCK";
}

/**
 * Records the immutable QA Review for the exact current Production Asset.
 * Deterministic findings are recomputed at commit time and may elevate, but
 * never soften, the human axis selections.
 */
export async function runPostV2ProductionQa(
  input: PostV2QaManualReviewInput,
) {
  const projectId = input.projectId.trim();
  if (!projectId) throw new Error("projectId must not be blank.");

  for (const key of Object.keys(QA_AXIS_META) as PostV2QaAxisKey[]) {
    const status = input.statuses[key];
    if (!isPostV2QaStatus(status)) {
      throw new Error("Selecione PASS, WARN ou BLOCK para todos os eixos do QA.");
    }
    if (status !== "PASS" && !input.notes?.[key]?.trim()) {
      throw new Error(
        `Descreva o motivo do ${status} no eixo ${key === "visualTechnical" ? "visual/técnico" : String(key)}.`,
      );
    }
  }

  const { data: productionState, error: stateError } = await supabase
    .from("creation_production_state")
    .select("*")
    .eq("project_id", projectId)
    .single();
  if (stateError) throw stateError;

  if (productionState.status !== "qa_pending") {
    throw new Error(
      "O QA não está pendente para o Asset atual. Recarregue a Creation antes de registrar uma revisão.",
    );
  }
  if (!productionState.current_asset_version_id) {
    throw new Error("Não existe Production Asset atual para executar QA.");
  }
  if (productionState.latest_qa_review_id) {
    throw new Error(
      "O Production State já aponta para um QA concluído. Recarregue a Creation antes de continuar.",
    );
  }

  const { data: assetRow, error: assetError } = await supabase
    .from("creation_production_asset_versions")
    .select("*")
    .eq("project_id", projectId)
    .eq("id", productionState.current_asset_version_id)
    .single();
  if (assetError) throw assetError;
  const asset = toProductionAssetVersion(assetRow);

  const [{ data: pieceAsset, error: pieceAssetError }, { data: designStateRow, error: designStateError }] =
    await Promise.all([
      supabase
        .from("content_piece_assets")
        .select("project_id,file_size,file_type,image_width,image_height")
        .eq("project_id", projectId)
        .eq("id", asset.pieceAssetId)
        .single(),
      supabase
        .from("creation_design_state")
        .select("*")
        .eq("project_id", projectId)
        .single(),
    ]);
  if (pieceAssetError) throw pieceAssetError;
  if (designStateError) throw designStateError;

  const designState = toDesignState(designStateRow);
  const deterministic = evaluateDeterministicProductionAssetChecks({
    asset,
    designState,
    pieceAsset,
  });

  if (deterministic.freshness !== "current") {
    throw new Error(
      "O Production Asset ficou desatualizado em relação ao Design aprovado. Registre um novo Asset antes do QA.",
    );
  }

  const humanFindings: QaFinding[] = [];
  for (const key of Object.keys(QA_AXIS_META) as PostV2QaAxisKey[]) {
    const status = input.statuses[key];
    if (status === "PASS") continue;
    const note = input.notes?.[key]?.trim();
    if (!note) continue;
    humanFindings.push({
      axis: QA_AXIS_META[key].axis,
      status,
      code: QA_AXIS_META[key].code,
      message: note,
      origin: "human",
    });
  }

  const findings = [...deterministic.findings, ...humanFindings];
  const statuses = deriveQaStatusesWithFindings({
    baseStatuses: input.statuses,
    findings,
  });

  const { data: previousReviews, error: reviewNumberError } = await supabase
    .from("creation_production_qa_reviews")
    .select("review_number")
    .eq("project_id", projectId)
    .eq("production_asset_version_id", asset.id)
    .order("review_number", { ascending: false })
    .limit(1);
  if (reviewNumberError) throw reviewNumberError;
  const reviewNumber = (previousReviews?.[0]?.review_number ?? 0) + 1;

  const insert = buildProductionQaReviewInsert({
    projectId,
    asset,
    reviewNumber,
    statuses,
    findings,
    provenance: buildQaProvenance({
      origin: "human",
      source: "post_v2_studio_qa",
    }),
  });

  const { data: reviewRow, error: reviewError } = await supabase
    .from("creation_production_qa_reviews")
    .insert(insert)
    .select("*")
    .single();
  if (reviewError) throw reviewError;

  return toProductionQaReview(reviewRow);
}

