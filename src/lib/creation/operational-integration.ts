import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { ApprovalStatus, ScheduleStatus } from "@/lib/calendar";


type ApprovalOperationalRow = Pick<
  Tables<"client_approvals">,
  | "id"
  | "project_id"
  | "status"
  | "production_asset_version_id"
  | "production_qa_review_id"
  | "submitted_at"
  | "revoked_at"
  | "created_at"
>;

type LibraryApprovalOperationalRow = Pick<
  Tables<"client_approvals">,
  | "project_id"
  | "status"
  | "production_asset_version_id"
  | "revoked_at"
  | "created_at"
>;

export type CalendarV2ReadinessKind =
  | "legacy"
  | "not_ready"
  | "ready"
  | "review_required";

export type CalendarV2Readiness = {
  kind: CalendarV2ReadinessKind;
  isV2: boolean;
  canBindApprovedAsset: boolean;
  message: string;
  clientApprovalId: string | null;
  productionAssetVersionId: string | null;
  productionQaReviewId: string | null;
  calendarApprovalStatus: ApprovalStatus | null;
};

export type LibraryV2OperationalSummary = {
  isV2: boolean;
  approvedByClient: boolean;
  clientApprovalStatus: "aprovado" | "aprovado_com_ajustes" | null;
  productionAssetVersionId: string | null;
};

export const ACTIONABLE_V2_SCHEDULE_STATUSES: readonly ScheduleStatus[] = [
  "aprovado",
  "agendado",
  "publicado",
] as const;

export function scheduleRequiresCanonicalV2Asset(
  status: ScheduleStatus | string | null | undefined,
): boolean {
  return ACTIONABLE_V2_SCHEDULE_STATUSES.includes(
    (status ?? "") as ScheduleStatus,
  );
}

export function mapClientApprovalToCalendarStatus(
  status: string | null | undefined,
): ApprovalStatus | null {
  if (status === "aprovado") return "aprovado";
  if (status === "aprovado_com_ajustes") return "aprovado_com_ajustes";
  return null;
}

/**
 * Resolves the exact client-approved V2 asset that may enter the operational
 * calendar. V1 projects intentionally bypass this gate.
 *
 * A V2 approval is only ready while its Production Asset is still canonical,
 * its QA is still the latest eligible PASS/WARN review and the asset's Design
 * Version remains the currently approved Design.
 */
export async function resolveCalendarV2Readiness(
  projectId: string,
): Promise<CalendarV2Readiness> {
  const id = projectId.trim();
  if (!id) throw new Error("projectId must not be blank.");

  const { data: core, error: coreError } = await supabase
    .from("creation_core")
    .select("project_id")
    .eq("project_id", id)
    .maybeSingle();
  if (coreError) throw coreError;

  if (!core) {
    return {
      kind: "legacy",
      isV2: false,
      canBindApprovedAsset: true,
      message: "Fluxo legado do calendário.",
      clientApprovalId: null,
      productionAssetVersionId: null,
      productionQaReviewId: null,
      calendarApprovalStatus: null,
    };
  }

  const { data: approvals, error: approvalsError } = await supabase
    .from("client_approvals")
    .select(
      "id, status, production_asset_version_id, production_qa_review_id, submitted_at, revoked_at, created_at",
    )
    .eq("project_id", id)
    .in("status", ["aprovado", "aprovado_com_ajustes"])
    .is("revoked_at", null)
    .not("production_asset_version_id", "is", null)
    .not("production_qa_review_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (approvalsError) throw approvalsError;

  const approval =
    ((approvals ?? []) as ApprovalOperationalRow[])[0] ?? null;
  if (
    !approval?.production_asset_version_id ||
    !approval.production_qa_review_id
  ) {
    return {
      kind: "not_ready",
      isV2: true,
      canBindApprovedAsset: false,
      message:
        "A Creation V2 ainda não possui uma versão de produção aprovada pelo cliente para agendamento.",
      clientApprovalId: null,
      productionAssetVersionId: null,
      productionQaReviewId: null,
      calendarApprovalStatus: null,
    };
  }

  const [stateResult, assetResult, qaResult, designStateResult] =
    await Promise.all([
      supabase
        .from("creation_production_state")
        .select("current_asset_version_id, latest_qa_review_id, status")
        .eq("project_id", id)
        .maybeSingle(),
      supabase
        .from("creation_production_asset_versions")
        .select("id, design_version_id")
        .eq("project_id", id)
        .eq("id", approval.production_asset_version_id)
        .maybeSingle(),
      supabase
        .from("creation_production_qa_reviews")
        .select("id, production_asset_version_id, overall_status")
        .eq("project_id", id)
        .eq("id", approval.production_qa_review_id)
        .maybeSingle(),
      supabase
        .from("creation_design_state")
        .select("current_approved_version_id")
        .eq("project_id", id)
        .maybeSingle(),
    ]);

  if (stateResult.error) throw stateResult.error;
  if (assetResult.error) throw assetResult.error;
  if (qaResult.error) throw qaResult.error;
  if (designStateResult.error) throw designStateResult.error;

  const state = stateResult.data;
  const asset = assetResult.data;
  const qa = qaResult.data;
  const designState = designStateResult.data;
  const calendarApprovalStatus = mapClientApprovalToCalendarStatus(
    approval.status,
  );

  const qaEligible =
    !!qa &&
    (qa.overall_status === "PASS" || qa.overall_status === "WARN") &&
    ((qa.overall_status === "PASS" && state?.status === "qa_pass") ||
      (qa.overall_status === "WARN" && state?.status === "qa_warn"));

  const currentProduction =
    !!state &&
    state.current_asset_version_id === approval.production_asset_version_id &&
    state.latest_qa_review_id === approval.production_qa_review_id &&
    qa?.production_asset_version_id === approval.production_asset_version_id;

  const currentDesign =
    !!asset &&
    !!designState?.current_approved_version_id &&
    asset.design_version_id === designState.current_approved_version_id;

  if (!currentProduction || !qaEligible || !currentDesign) {
    return {
      kind: "review_required",
      isV2: true,
      canBindApprovedAsset: false,
      message:
        "A versão aprovada pelo cliente ficou desatualizada em relação ao Production/QA/Design atual. Gere e aprove a versão atual antes de agendar.",
      clientApprovalId: approval.id,
      productionAssetVersionId: approval.production_asset_version_id,
      productionQaReviewId: approval.production_qa_review_id,
      calendarApprovalStatus,
    };
  }

  return {
    kind: "ready",
    isV2: true,
    canBindApprovedAsset: true,
    message:
      approval.status === "aprovado_com_ajustes"
        ? "Asset V2 aprovado pelo cliente com ajustes e elegível para vínculo no calendário."
        : "Asset V2 aprovado pelo cliente e elegível para vínculo no calendário.",
    clientApprovalId: approval.id,
    productionAssetVersionId: approval.production_asset_version_id,
    productionQaReviewId: approval.production_qa_review_id,
    calendarApprovalStatus,
  };
}

/**
 * Lightweight metadata for Library badges. content_projects remains the
 * operational envelope; this helper only surfaces whether that envelope is V2
 * and whether it already has a client-approved canonical Production Asset.
 */
export async function listLibraryV2OperationalSummary(
  projectIds: string[],
): Promise<Map<string, LibraryV2OperationalSummary>> {
  const ids = Array.from(new Set(projectIds.map((id) => id.trim()).filter(Boolean)));
  const result = new Map<string, LibraryV2OperationalSummary>();
  if (!ids.length) return result;

  const { data: cores, error: coreError } = await supabase
    .from("creation_core")
    .select("project_id")
    .in("project_id", ids);
  if (coreError) throw coreError;

  const v2Ids = ((cores ?? []) as Array<Pick<Tables<"creation_core">, "project_id">>)
    .map((row) => row.project_id);
  for (const projectId of v2Ids) {
    result.set(projectId, {
      isV2: true,
      approvedByClient: false,
      clientApprovalStatus: null,
      productionAssetVersionId: null,
    });
  }
  if (!v2Ids.length) return result;

  const { data: approvals, error: approvalsError } = await supabase
    .from("client_approvals")
    .select(
      "project_id, status, production_asset_version_id, revoked_at, created_at",
    )
    .in("project_id", v2Ids)
    .in("status", ["aprovado", "aprovado_com_ajustes"])
    .is("revoked_at", null)
    .not("production_asset_version_id", "is", null)
    .order("created_at", { ascending: false });
  if (approvalsError) throw approvalsError;

  const seen = new Set<string>();
  for (const approval of (approvals ?? []) as LibraryApprovalOperationalRow[]) {
    if (seen.has(approval.project_id)) continue;
    seen.add(approval.project_id);
    const status =
      approval.status === "aprovado" ||
      approval.status === "aprovado_com_ajustes"
        ? approval.status
        : null;
    result.set(approval.project_id, {
      isV2: true,
      approvedByClient: !!status && !!approval.production_asset_version_id,
      clientApprovalStatus: status,
      productionAssetVersionId: approval.production_asset_version_id,
    });
  }

  return result;
}
