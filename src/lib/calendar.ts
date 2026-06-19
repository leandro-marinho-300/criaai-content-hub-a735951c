// Calendário editorial — tipos, helpers e labels.
import type { Tables } from "@/integrations/supabase/types";

export type ScheduleItem = Tables<"publication_schedule_items">;
export type ScheduleOutput = Tables<"publication_schedule_outputs">;
export type ScheduleHistory = Tables<"publication_schedule_history">;

export type ScheduleStatus =
  | "sem_data"
  | "sugerido"
  | "aguardando_aprovacao"
  | "aprovado"
  | "agendado"
  | "publicado"
  | "cancelado";

export type ApprovalStatus =
  | "nao_enviado"
  | "aguardando_cliente"
  | "aprovado"
  | "aprovado_com_ajustes"
  | "recusado";

export type ChannelKind =
  | "instagram_feed"
  | "instagram_stories"
  | "instagram_reel"
  | "whatsapp_status"
  | "whatsapp_grupo"
  | "facebook"
  | "linkedin"
  | "site"
  | "impresso"
  | "outro";

export const STATUS_LABELS: Record<ScheduleStatus, string> = {
  sem_data: "Sem data",
  sugerido: "Sugerido",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovado: "Aprovado",
  agendado: "Agendado",
  publicado: "Publicado",
  cancelado: "Cancelado",
};

export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  nao_enviado: "Não enviado",
  aguardando_cliente: "Aguardando cliente",
  aprovado: "Aprovado",
  aprovado_com_ajustes: "Aprovado com ajustes",
  recusado: "Recusado",
};

export const CHANNEL_LABELS: Record<ChannelKind, string> = {
  instagram_feed: "Instagram Feed",
  instagram_stories: "Instagram Stories",
  instagram_reel: "Instagram Reel",
  whatsapp_status: "WhatsApp Status",
  whatsapp_grupo: "WhatsApp Grupo",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  site: "Site",
  impresso: "Material impresso",
  outro: "Outro",
};

/** Cores semânticas (classes Tailwind compatíveis com claro/escuro). */
export const STATUS_COLORS: Record<ScheduleStatus, { bg: string; ring: string; dot: string }> = {
  sem_data:              { bg: "bg-muted text-foreground",            ring: "ring-muted-foreground/30",    dot: "bg-muted-foreground" },
  sugerido:              { bg: "bg-sky-500/10 text-sky-700 dark:text-sky-300",         ring: "ring-sky-500/30",     dot: "bg-sky-500" },
  aguardando_aprovacao:  { bg: "bg-amber-500/10 text-amber-700 dark:text-amber-300",   ring: "ring-amber-500/30",   dot: "bg-amber-500" },
  aprovado:              { bg: "bg-violet-500/10 text-violet-700 dark:text-violet-300",ring: "ring-violet-500/30",  dot: "bg-violet-500" },
  agendado:              { bg: "bg-orange-500/10 text-orange-700 dark:text-orange-300",ring: "ring-orange-500/30",  dot: "bg-orange-500" },
  publicado:             { bg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", ring: "ring-emerald-500/30", dot: "bg-emerald-500" },
  cancelado:             { bg: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",      ring: "ring-zinc-500/30",    dot: "bg-zinc-500" },
};

export const SCHEDULE_STATUSES: ScheduleStatus[] = [
  "sem_data", "sugerido", "aguardando_aprovacao", "aprovado", "agendado", "publicado", "cancelado",
];

export const APPROVAL_STATUSES: ApprovalStatus[] = [
  "nao_enviado", "aguardando_cliente", "aprovado", "aprovado_com_ajustes", "recusado",
];

export const CHANNELS: ChannelKind[] = [
  "instagram_feed","instagram_stories","instagram_reel",
  "whatsapp_status","whatsapp_grupo","facebook","linkedin",
  "site","impresso","outro",
];

/** Calcula se o item está atrasado (data passou e ainda não publicado/cancelado). */
export function computeIsOverdue(item: ScheduleItem, now: Date = new Date()): boolean {
  const status = (item.schedule_status ?? "sem_data") as ScheduleStatus;
  if (status === "publicado" || status === "cancelado") return false;
  const d = item.confirmed_date ?? item.suggested_date;
  if (!d) return false;
  const t = item.confirmed_time ?? item.suggested_time ?? "23:59";
  const target = new Date(`${d}T${normalizeTime(t)}:00`);
  return target.getTime() < now.getTime() && status !== "sem_data";
}

export function normalizeTime(t: string | null | undefined): string {
  if (!t) return "00:00";
  const m = t.match(/^(\d{1,2}):?(\d{0,2})/);
  if (!m) return "00:00";
  const hh = String(Math.min(23, parseInt(m[1] || "0", 10))).padStart(2, "0");
  const mm = String(Math.min(59, parseInt(m[2] || "0", 10))).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function effectiveDate(item: ScheduleItem): string | null {
  return item.confirmed_date ?? item.suggested_date ?? null;
}

export function effectiveTime(item: ScheduleItem): string | null {
  const t = item.confirmed_time ?? item.suggested_time;
  return t ? normalizeTime(t) : null;
}

export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
export function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay(); // 0 = sunday
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export const MONTH_NAMES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
export const WEEKDAY_NAMES_SHORT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

/** Preferências de publicação por marca (jsonb). */
export interface BrandPublicationPreferences {
  channels?: ChannelKind[];
  preferred_weekdays?: number[]; // 0..6
  preferred_times?: string[];    // "HH:mm"
  max_per_day?: number;
  min_interval_hours?: number;
  posts_per_week?: number;
}
