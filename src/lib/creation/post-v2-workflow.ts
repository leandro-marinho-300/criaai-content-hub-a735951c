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
import { buildStrategyStateInsert, toBrandSnapshot, toStrategyVersion } from "@/lib/creation/strategy";
import { buildCopyStateInsert, toCopyState, toCopyVersion } from "@/lib/creation/copy";
import { buildDesignStateInsert } from "@/lib/creation/design";
import { buildProductionStateInsert } from "@/lib/creation/production";
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
  taskType: "strategy" | "copy";
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

async function loadApprovedPostCopyContext(projectId: string): Promise<ApprovedPostCopyContext> {
  const approvedStrategy = await loadApprovedStrategyContext(projectId);
  const { data: stateRow, error: stateError } = await supabase.from("creation_copy_state").select("*").eq("project_id", projectId).single();
  if (stateError) throw stateError;
  const state = toCopyState(stateRow);
  if (!state.currentApprovedVersionId) throw new Error("Aprove a Copy Core antes de adaptar para Post.");
  const { data: copyRow, error: copyError } = await supabase.from("creation_copy_versions").select("*").eq("id", state.currentApprovedVersionId).single();
  if (copyError) throw copyError;
  return { sourceCopy: toCopyVersion(copyRow), copyState: state, approvedStrategy };
}

export async function preparePostCopyManualTask(projectId: string): Promise<PreparedManualTask> {
  const context = await loadApprovedPostCopyContext(projectId);
  const plan = buildPostCopyAdapterTaskPlan({ context });
  const { data, error } = await supabase.from("creation_ai_task_runs").insert(plan.taskInsert).select("id").single();
  if (error) throw error;
  return { runId: data.id, promptText: plan.promptText, taskType: "copy" };
}

export async function importPostCopyResponse(input: { projectId: string; runId: string; response: string; }) {
  const context = await loadApprovedPostCopyContext(input.projectId);
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
