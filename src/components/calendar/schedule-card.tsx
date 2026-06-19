// Card de publicação no calendário (variantes compacto/normal).
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CHANNEL_LABELS, STATUS_COLORS, STATUS_LABELS, effectiveTime, computeIsOverdue, type ScheduleStatus } from "@/lib/calendar";
import type { ScheduleItemWithRels } from "@/lib/scheduleQueries";
import { FORMAT_LABELS } from "@/lib/promptBuilder";
import { AlertTriangle } from "lucide-react";

interface Props {
  item: ScheduleItemWithRels;
  variant?: "compact" | "normal";
  colorBy?: "status" | "brand";
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}

export function ScheduleCard({ item, variant = "normal", colorBy = "status", onClick, draggable, onDragStart }: Props) {
  const status = (item.schedule_status ?? "sem_data") as ScheduleStatus;
  const colors = STATUS_COLORS[status];
  const time = effectiveTime(item);
  const overdue = computeIsOverdue(item);

  const colorClass = colorBy === "status"
    ? cn(colors.bg, "ring-1", colors.ring)
    : "bg-card ring-1 ring-border";

  const content = (
    <button
      type="button"
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      className={cn(
        "block w-full rounded-md px-2 py-1.5 text-left text-xs transition hover:opacity-90 cursor-pointer",
        colorClass,
        overdue && "ring-red-500/50",
      )}
      aria-label={`Publicação ${item.title ?? "sem título"}, status ${STATUS_LABELS[status]}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", colors.dot)} aria-hidden />
        {time && <span className="font-mono font-medium">{time}</span>}
        {overdue && <AlertTriangle className="h-3 w-3 text-red-500" aria-label="Atrasado" />}
        <span className="truncate font-medium">{item.brands?.name ?? "Sem marca"}</span>
      </div>
      {variant === "normal" && (
        <>
          <p className="mt-0.5 truncate">{item.title ?? "Sem título"}</p>
          <p className="truncate text-[10px] opacity-80">
            {item.format ? FORMAT_LABELS[item.format] ?? item.format : "—"}
            {item.channel ? ` · ${CHANNEL_LABELS[item.channel as keyof typeof CHANNEL_LABELS] ?? item.channel}` : ""}
          </p>
          <Badge variant="outline" className="mt-1 text-[10px] font-normal">
            {STATUS_LABELS[status]}
          </Badge>
        </>
      )}
    </button>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>{content}</PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-1.5 text-sm">
          <p className="font-semibold">{item.title ?? "Sem título"}</p>
          <p className="text-xs text-muted-foreground">{item.brands?.name ?? "Sem marca"}</p>
          <div className="flex flex-wrap gap-1 pt-1">
            <Badge variant="secondary">{STATUS_LABELS[status]}</Badge>
            {item.format && <Badge variant="outline">{FORMAT_LABELS[item.format] ?? item.format}</Badge>}
            {item.channel && <Badge variant="outline">{CHANNEL_LABELS[item.channel as keyof typeof CHANNEL_LABELS] ?? item.channel}</Badge>}
            {overdue && <Badge variant="destructive">Atrasado</Badge>}
          </div>
          {time && <p className="text-xs">Horário: {time}</p>}
          {item.publication_schedule_outputs?.length ? (
            <p className="text-xs text-muted-foreground">{item.publication_schedule_outputs.length} peça(s) vinculada(s)</p>
          ) : null}
          {item.internal_notes && <p className="text-xs italic text-muted-foreground">{item.internal_notes}</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
