import { useMemo } from "react";
import { addDays, isoDay, sameDay, startOfWeek, WEEKDAY_NAMES_SHORT, effectiveDate, effectiveTime } from "@/lib/calendar";
import type { ScheduleItemWithRels } from "@/lib/scheduleQueries";
import { ScheduleCard } from "./schedule-card";
import { cn } from "@/lib/utils";

interface Props {
  cursor: Date;
  items: ScheduleItemWithRels[];
  colorBy: "status" | "brand";
  onSelect: (item: ScheduleItemWithRels) => void;
  onDropOnSlot?: (isoDate: string, hour: number, payload: string) => void;
}

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6h..23h

export function CalendarWeek({ cursor, items, colorBy, onSelect, onDropOnSlot }: Props) {
  const today = new Date();
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const map = useMemo(() => {
    const m = new Map<string, ScheduleItemWithRels[]>();
    for (const it of items) {
      const d = effectiveDate(it);
      if (!d) continue;
      const t = effectiveTime(it) ?? "00:00";
      const hour = parseInt(t.split(":")[0] || "0", 10);
      const key = `${d}|${hour}`;
      const arr = m.get(key) ?? [];
      arr.push(it);
      m.set(key, arr);
    }
    return m;
  }, [items]);

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
      <div className="grid min-w-[720px]" style={{ gridTemplateColumns: "60px repeat(7, minmax(0,1fr))" }}>
        <div className="border-b border-r border-border/60 bg-muted/40 px-2 py-2 text-xs" />
        {days.map((d) => {
          const isToday = sameDay(d, today);
          return (
            <div key={d.toISOString()} className={cn("border-b border-r border-border/60 bg-muted/40 px-2 py-2 text-center text-xs", isToday && "bg-primary/5")}>
              <p className="font-medium">{WEEKDAY_NAMES_SHORT[d.getDay()]}</p>
              <p className="text-muted-foreground">{d.getDate()}/{d.getMonth() + 1}</p>
            </div>
          );
        })}
        {HOURS.map((hour) => (
          <div key={hour} className="contents">
            <div className="border-b border-r border-border/60 px-2 py-2 text-right text-[10px] font-mono text-muted-foreground">
              {String(hour).padStart(2, "0")}h
            </div>
            {days.map((d) => {
              const iso = isoDay(d);
              const slotItems = map.get(`${iso}|${hour}`) ?? [];
              return (
                <div
                  key={`${iso}|${hour}`}
                  className="min-h-[60px] border-b border-r border-border/60 p-1"
                  onDragOver={(e) => { if (onDropOnSlot) e.preventDefault(); }}
                  onDrop={(e) => {
                    if (!onDropOnSlot) return;
                    e.preventDefault();
                    const payload = e.dataTransfer.getData("text/plain");
                    if (payload) onDropOnSlot(iso, hour, payload);
                  }}
                >
                  <div className="space-y-1">
                    {slotItems.map((it) => (
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
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
