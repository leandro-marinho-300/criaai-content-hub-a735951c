// Filtros do calendário.
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { APPROVAL_LABELS, APPROVAL_STATUSES, CHANNEL_LABELS, CHANNELS, SCHEDULE_STATUSES, STATUS_LABELS, type ApprovalStatus, type ChannelKind, type ScheduleStatus } from "@/lib/calendar";
import { FORMAT_LABELS } from "@/lib/promptBuilder";
import { X } from "lucide-react";

export interface FiltersValue {
  brandId: string;
  channel: string;
  format: string;
  status: string;
  approval: string;
}

interface Props {
  value: FiltersValue;
  onChange: (v: FiltersValue) => void;
}

export function CalendarFilters({ value, onChange }: Props) {
  const { data: brands } = useQuery({
    queryKey: ["brands-light-cal-f"],
    queryFn: async () => (await supabase.from("brands").select("id, name").order("name")).data ?? [],
  });
  const hasAny = Object.values(value).some((v) => v && v !== "all");
  const update = (patch: Partial<FiltersValue>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
      <Select value={value.brandId || "all"} onValueChange={(v) => update({ brandId: v === "all" ? "" : v })}>
        <SelectTrigger><SelectValue placeholder="Marca" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas marcas</SelectItem>
          {(brands ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={value.channel || "all"} onValueChange={(v) => update({ channel: v === "all" ? "" : v })}>
        <SelectTrigger><SelectValue placeholder="Canal" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos canais</SelectItem>
          {CHANNELS.map((c) => <SelectItem key={c} value={c}>{CHANNEL_LABELS[c]}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={value.format || "all"} onValueChange={(v) => update({ format: v === "all" ? "" : v })}>
        <SelectTrigger><SelectValue placeholder="Formato" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos formatos</SelectItem>
          {Object.entries(FORMAT_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={value.status || "all"} onValueChange={(v) => update({ status: v === "all" ? "" : v })}>
        <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos status</SelectItem>
          {SCHEDULE_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={value.approval || "all"} onValueChange={(v) => update({ approval: v === "all" ? "" : v })}>
        <SelectTrigger><SelectValue placeholder="Aprovação" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas aprovações</SelectItem>
          {APPROVAL_STATUSES.map((s) => <SelectItem key={s} value={s}>{APPROVAL_LABELS[s]}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        disabled={!hasAny}
        onClick={() => onChange({ brandId: "", channel: "", format: "", status: "", approval: "" })}
        className="gap-1"
      >
        <X className="h-3 w-3" />Limpar filtros
      </Button>
    </div>
  );
}
