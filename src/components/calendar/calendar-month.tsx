import { useMemo } from "react";
import { addDays, endOfMonth, isoDay, MONTH_NAMES, sameDay, startOfMonth, WEEKDAY_NAMES_SHORT, effectiveDate } from "@/lib/calendar";
import type { ScheduleItemWithRels } from "@/lib/scheduleQueries";
import { ScheduleCard } from "./schedule-card";
import { cn } from "@/lib/utils";

interface Props {
  cursor: Date;
  items: ScheduleItemWithRels[];
  colorBy: "status" | "brand";
  onSelect: (item: ScheduleItemWithRels) => void;
  onDropOnDay?: (isoDate: string, payload: string) => void;
}

export function CalendarMonth({ cursor, items, colorBy, onSelect, onDropOnDay }: Props) {
  const today = new Date();
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const startWeekday = monthStart.getDay();
  const totalCells = Math.ceil((startWeekday + monthEnd.getDate()) / 7) * 7;

  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleItemWithRels[]>();
    for (const it of items) {
      const d = effectiveDate(it);
      if (!d) continue;
      const arr = map.get(d) ?? [];
      arr.push(it);
      map.set(d, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.confirmed_time ?? a.suggested_time ?? "").localeCompare(b.confirmed_time ?? b.suggested_time ?? ""));
    }
    return map;
  }, [items]);

  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border/60 bg-muted/40 text-xs font-medium">
        {WEEKDAY_NAMES_SHORT.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: totalCells }).map((_, i) => {
          const dayNum = i - startWeekday + 1;
          const inMonth = dayNum >= 1 && dayNum <= monthEnd.getDate();
          const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), dayNum);
          const dayIso = isoDay(date);
          const dayItems = inMonth ? (byDay.get(dayIso) ?? []) : [];
          const isToday = inMonth && sameDay(date, today);
          return (
            <div
              key={i}
              className={cn(
                "min-h-[110px] border-b border-r border-border/60 p-1.5 text-xs",
                !inMonth && "bg-muted/20 text-muted-foreground",
              )}
              onDragOver={(e) => { if (inMonth && onDropOnDay) e.preventDefault(); }}
              onDrop={(e) => {
                if (!inMonth || !onDropOnDay) return;
                e.preventDefault();
                const payload = e.dataTransfer.getData("text/plain");
                if (payload) onDropOnDay(dayIso, payload);
              }}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className={cn("text-xs font-medium", isToday && "rounded bg-primary px-1.5 py-0.5 text-primary-foreground")}>
                  {inMonth ? dayNum : ""}
                </span>
              </div>
              <div className="space-y-1">
                {dayItems.slice(0, 4).map((it) => (
                  <ScheduleCard
                    key={it.id}
                    item={it}
                    variant="compact"
                    colorBy={colorBy}
                    onClick={() => onSelect(it)}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", `item:${it.id}`)}
                  />
                ))}
                {dayItems.length > 4 && (
                  <p className="text-[10px] text-muted-foreground">+{dayItems.length - 4} mais</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="border-t border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        {MONTH_NAMES[cursor.getMonth()]} de {cursor.getFullYear()}
      </p>
    </div>
  );
}
