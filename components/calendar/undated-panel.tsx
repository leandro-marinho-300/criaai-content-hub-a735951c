// Painel de conteúdos sem data (drawer/lateral).
import { useQuery } from "@tanstack/react-query";
import { listUndatedProjects } from "@/lib/scheduleQueries";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FORMAT_LABELS } from "@/lib/promptBuilder";
import { CalendarPlus } from "lucide-react";

interface Props {
  onPick: (projectId: string) => void;
}

export function UndatedPanel({ onPick }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["undated-projects"],
    queryFn: () => listUndatedProjects(),
  });

  return (
    <div className="h-full space-y-2">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Conteúdos sem data</h3>
        <p className="text-xs text-muted-foreground">
          Arraste para um dia do calendário ou clique para escolher data.
        </p>
      </div>
      <ScrollArea className="h-[calc(100vh-260px)] pr-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : !data?.length ? (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Todos os conteúdos já estão planejados.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {data.map((p) => (
              <Card
                key={p.id}
                className="cursor-grab border-border/60 transition hover:border-primary/40"
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", `project:${p.id}`)}
              >
                <CardContent className="space-y-1.5 p-3">
                  <p className="text-xs text-muted-foreground">{p.brand_name ?? "Sem marca"}</p>
                  <p className="line-clamp-2 break-words text-sm font-medium" title={p.internal_title ?? ""}>{p.internal_title?.trim() || "Conteúdo sem título"}</p>
                  <div className="flex flex-wrap gap-1">
                    {(p.selected_formats ?? []).slice(0, 3).map((f) => (
                      <Badge key={f} variant="outline" className="text-[10px] font-normal">
                        {FORMAT_LABELS[f] ?? f}
                      </Badge>
                    ))}
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 w-full justify-start gap-1 text-xs" onClick={() => onPick(p.id)}>
                    <CalendarPlus className="h-3 w-3" /> Escolher data
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
