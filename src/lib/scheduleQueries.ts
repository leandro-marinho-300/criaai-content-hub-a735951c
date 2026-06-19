// Funções de acesso ao calendário editorial.
import { supabase } from "@/integrations/supabase/client";
import type { ScheduleItem, ScheduleStatus, ApprovalStatus, ChannelKind } from "./calendar";
import { getProjectDisplayTitle } from "./displayTitle";

export interface ScheduleItemWithRels extends ScheduleItem {
  brands?: { id: string; name: string; logo_url: string | null } | null;
  content_projects?: {
    id: string;
    internal_title: string | null;
    display_title?: string | null;
    theme?: string | null;
    main_message?: string | null;
    status: string;
  } | null;
  publication_schedule_outputs?: Array<{
    id: string;
    output_id: string;
    display_order: number;
    content_outputs?: { id: string; title: string; output_type: string } | null;
  }>;
}

/** Resolve o melhor título visível para um item do calendário. */
export function getScheduleItemTitle(item: ScheduleItemWithRels | null | undefined): string {
  if (!item) return "Conteúdo sem título";
  if (item.title_override && item.title && item.title.trim()) return item.title.trim();
  if (item.content_projects) {
    const fromProject = getProjectDisplayTitle(item.content_projects);
    if (fromProject && fromProject !== "Conteúdo sem título") return fromProject;
  }
  if (item.title && item.title.trim()) return item.title.trim();
  return "Publicação sem título";
}

export interface ScheduleFilters {
  brandId?: string;
  channel?: ChannelKind;
  format?: string;
  status?: ScheduleStatus;
  approval?: ApprovalStatus;
  from?: string; // yyyy-mm-dd inclusive
  to?: string;   // yyyy-mm-dd inclusive
}

const REL_SELECT = `
  *,
  brands ( id, name, logo_url ),
  content_projects ( id, internal_title, status ),
  publication_schedule_outputs (
    id, output_id, display_order,
    content_outputs ( id, title, output_type )
  )
`;

export async function listScheduleItems(filters: ScheduleFilters = {}): Promise<ScheduleItemWithRels[]> {
  let q = supabase.from("publication_schedule_items").select(REL_SELECT);
  if (filters.brandId) q = q.eq("brand_id", filters.brandId);
  if (filters.channel) q = q.eq("channel", filters.channel);
  if (filters.format) q = q.eq("format", filters.format);
  if (filters.status) q = q.eq("schedule_status", filters.status);
  if (filters.approval) q = q.eq("approval_status", filters.approval);
  // Filtragem por intervalo de datas é feita no cliente (datas podem estar em
  // confirmed_date OU suggested_date OU nulas — Postgrest fica complicado).
  const { data, error } = await q.order("confirmed_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as ScheduleItemWithRels[];
}

export async function getScheduleItem(id: string): Promise<ScheduleItemWithRels | null> {
  const { data, error } = await supabase
    .from("publication_schedule_items")
    .select(REL_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as ScheduleItemWithRels | null) ?? null;
}

export interface UpsertScheduleInput {
  id?: string;
  user_id: string;
  project_id?: string | null;
  brand_id?: string | null;
  publication_unit: string;
  channel?: ChannelKind | null;
  format?: string | null;
  title?: string | null;
  description?: string | null;
  suggested_date?: string | null;
  suggested_time?: string | null;
  confirmed_date?: string | null;
  confirmed_time?: string | null;
  timezone?: string | null;
  schedule_status?: ScheduleStatus;
  approval_status?: ApprovalStatus | null;
  client_notes?: string | null;
  internal_notes?: string | null;
  assigned_to?: string | null;
  outputs?: string[]; // ids de content_outputs vinculados
  checklist?: Record<string, boolean>;
}

export async function upsertScheduleItem(input: UpsertScheduleInput): Promise<ScheduleItem> {
  const { outputs, ...patch } = input;
  // Project_id é obrigatório no schema atual — para publicações avulsas exigimos
  // que o chamador passe um projeto fantasma ou um real. Validamos aqui.
  if (!patch.project_id) {
    throw new Error("Publicações avulsas exigem um projeto vinculado. Crie o conteúdo primeiro.");
  }
  let saved: ScheduleItem;
  if (patch.id) {
    const { id, ...updatePatch } = patch;
    const { data, error } = await supabase
      .from("publication_schedule_items")
      .update(updatePatch as never)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    saved = data as ScheduleItem;
  } else {
    const insert = { ...patch, project_id: patch.project_id as string };
    const { data, error } = await supabase
      .from("publication_schedule_items")
      .insert(insert as never)
      .select()
      .single();
    if (error) throw error;
    saved = data as ScheduleItem;
  }
  if (outputs) {
    await replaceScheduleOutputs(saved.id, saved.user_id, outputs);
  }
  return saved;
}

export async function replaceScheduleOutputs(scheduleItemId: string, userId: string, outputIds: string[]) {
  await supabase.from("publication_schedule_outputs").delete().eq("schedule_item_id", scheduleItemId);
  if (!outputIds.length) return;
  const rows = outputIds.map((output_id, i) => ({
    user_id: userId,
    schedule_item_id: scheduleItemId,
    output_id,
    display_order: i,
  }));
  const { error } = await supabase.from("publication_schedule_outputs").insert(rows);
  if (error) throw error;
}

export async function rescheduleItem(
  item: ScheduleItem,
  newDate: string,
  newTime: string | null,
): Promise<ScheduleItem> {
  const oldDate = item.confirmed_date ?? item.suggested_date;
  const oldTime = item.confirmed_time ?? item.suggested_time;
  const { data, error } = await supabase
    .from("publication_schedule_items")
    .update({
      confirmed_date: newDate,
      confirmed_time: newTime,
      schedule_status:
        item.schedule_status === "sem_data" || !item.schedule_status
          ? "agendado"
          : item.schedule_status,
    })
    .eq("id", item.id)
    .select()
    .single();
  if (error) throw error;
  await recordHistory({
    user_id: item.user_id,
    schedule_item_id: item.id,
    action_type: "rescheduled",
    old_date: oldDate ?? null,
    old_time: oldTime ?? null,
    new_date: newDate,
    new_time: newTime ?? null,
  });
  return data as ScheduleItem;
}

export async function changeStatus(item: ScheduleItem, status: ScheduleStatus, notes?: string) {
  const update: Partial<ScheduleItem> = { schedule_status: status };
  if (status === "publicado") update.published_at = new Date().toISOString();
  if (status === "cancelado") update.cancelled_at = new Date().toISOString();
  const { data, error } = await supabase
    .from("publication_schedule_items")
    .update(update)
    .eq("id", item.id)
    .select()
    .single();
  if (error) throw error;
  await recordHistory({
    user_id: item.user_id,
    schedule_item_id: item.id,
    action_type: "status_changed",
    old_status: item.schedule_status ?? null,
    new_status: status,
    notes: notes ?? null,
  });
  return data as ScheduleItem;
}

export async function markPublished(
  item: ScheduleItem,
  payload: { publishedAt: string; url?: string | null; notes?: string | null },
) {
  const { data, error } = await supabase
    .from("publication_schedule_items")
    .update({
      schedule_status: "publicado",
      published_at: payload.publishedAt,
      publication_url: payload.url ?? null,
      publication_notes: payload.notes ?? null,
    })
    .eq("id", item.id)
    .select()
    .single();
  if (error) throw error;
  await recordHistory({
    user_id: item.user_id,
    schedule_item_id: item.id,
    action_type: "published",
    old_status: item.schedule_status ?? null,
    new_status: "publicado",
    notes: payload.notes ?? null,
  });
  return data as ScheduleItem;
}

export async function undoPublished(item: ScheduleItem) {
  const { data, error } = await supabase
    .from("publication_schedule_items")
    .update({
      schedule_status: "agendado",
      published_at: null,
    })
    .eq("id", item.id)
    .select()
    .single();
  if (error) throw error;
  await recordHistory({
    user_id: item.user_id,
    schedule_item_id: item.id,
    action_type: "restored",
    old_status: "publicado",
    new_status: "agendado",
  });
  return data as ScheduleItem;
}

export async function deleteScheduleItem(id: string) {
  const { error } = await supabase.from("publication_schedule_items").delete().eq("id", id);
  if (error) throw error;
}

export async function recordHistory(payload: {
  user_id: string;
  schedule_item_id: string;
  action_type: string;
  old_date?: string | null;
  old_time?: string | null;
  new_date?: string | null;
  new_time?: string | null;
  old_status?: string | null;
  new_status?: string | null;
  notes?: string | null;
}) {
  const { error } = await supabase.from("publication_schedule_history").insert(payload);
  if (error) console.warn("Falha ao gravar histórico do calendário:", error.message);
}

export async function listHistory(scheduleItemId: string) {
  const { data, error } = await supabase
    .from("publication_schedule_history")
    .select("*")
    .eq("schedule_item_id", scheduleItemId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Conteúdos sem data: projetos com pelo menos uma peça e sem item agendado. */
export interface UndatedProject {
  id: string;
  internal_title: string | null;
  brand_id: string | null;
  brand_name: string | null;
  selected_formats: string[] | null;
  updated_at: string;
  output_count: number;
}

export async function listUndatedProjects(): Promise<UndatedProject[]> {
  // Pega projetos com outputs; exclui os que já estão no calendário com schedule_status != sem_data/cancelado.
  const { data: projects, error } = await supabase
    .from("content_projects")
    .select("id, internal_title, brand_id, selected_formats, updated_at, status, brands(name), content_outputs(id)")
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(80);
  if (error) throw error;

  const { data: scheduled } = await supabase
    .from("publication_schedule_items")
    .select("project_id, schedule_status");
  const scheduledMap = new Map<string, Set<string>>();
  for (const s of scheduled ?? []) {
    if (!s.project_id) continue;
    const set = scheduledMap.get(s.project_id) ?? new Set<string>();
    set.add(s.schedule_status ?? "sem_data");
    scheduledMap.set(s.project_id, set);
  }

  const result: UndatedProject[] = [];
  for (const p of projects ?? []) {
    const outs = (p.content_outputs as Array<{ id: string }> | null) ?? [];
    if (!outs.length) continue;
    const sched = scheduledMap.get(p.id);
    if (sched && [...sched].some((s) => s !== "sem_data" && s !== "cancelado")) continue;
    result.push({
      id: p.id,
      internal_title: p.internal_title,
      brand_id: p.brand_id,
      brand_name: (p.brands as { name: string } | null)?.name ?? null,
      selected_formats: p.selected_formats as string[] | null,
      updated_at: p.updated_at,
      output_count: outs.length,
    });
  }
  return result;
}
