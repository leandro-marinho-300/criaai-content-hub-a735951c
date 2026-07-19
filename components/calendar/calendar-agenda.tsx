import { useMemo } from "react";
import { effectiveDate, effectiveTime, formatDateBR, MONTH_NAMES } from "@/lib/calendar";
import type { ScheduleItemWithRels } from "@/lib/scheduleQueries";
import { ScheduleCard } from "./schedule-card";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  items: ScheduleItemWithRels[];
  colorBy: "status" | "brand";
  onSelect: (item: ScheduleItemWithRels) => void;
}

export function CalendarAgenda({ items, colorBy, onSelect }: Props) {
  const groups = useMemo(() => {
    const map = new Map<string, ScheduleItemWithRels[]>();
    for (const it of items) {
      const d = effectiveDate(it);
      const key = d ?? "sem-data";
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (effectiveTime(a) ?? "").localeCompare(effectiveTime(b) ?? ""));
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  if (!items.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="grid place-items-center gap-2 p-10 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma publicação encontrada nos filtros.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(([date, list]) => (
        <div key={date} className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {date === "sem-data" ? "Sem data definida" : prettyDate(date)}
          </h3>
          <div className="space-y-1.5">
            {list.map((it) => (
              <ScheduleCard
                key={it.id}
                item={it}
                variant="normal"
                colorBy={colorBy}
                onClick={() => onSelect(it)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MONTH_NAMES[(m || 1) - 1]} de ${y}`;
}
