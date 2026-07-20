import { BadgeCheck, CalendarDays, FileImage, MessageSquareText, Pencil, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Post2ProjectSnapshot } from "@/lib/post2Project";
import { cn } from "@/lib/utils";

interface Post2ResultOverviewProps {
  projectId: string;
  snapshot: Post2ProjectSnapshot;
  hasFinalArt: boolean;
  approvalStatus?: string | null;
  hasSchedule: boolean;
}

export function Post2ResultOverview({
  projectId,
  snapshot,
  hasFinalArt,
  approvalStatus,
  hasSchedule,
}: Post2ResultOverviewProps) {
  const content = snapshot.generated_content ?? snapshot.post2.imported_content;
  const approved = approvalStatus === "approved" || approvalStatus === "aprovado";
  const editHref = `/app/create/post?projectId=${encodeURIComponent(projectId)}`;

  const stages = [
    {
      label: "Conteúdo",
      done: Boolean(content),
      icon: MessageSquareText,
      text: content ? "Copy importada e revisável" : "Conteúdo pendente",
    },
    {
      label: "Arte final",
      done: hasFinalArt,
      icon: FileImage,
      text: hasFinalArt ? "Arquivo anexado" : "Aguardando anexo",
    },
    {
      label: "Aprovação",
      done: approved,
      icon: ShieldCheck,
      text: approved ? "Aprovado" : "Aguardando aprovação",
    },
    {
      label: "Calendário",
      done: hasSchedule,
      icon: CalendarDays,
      text: hasSchedule ? "Agendado" : "Ainda não agendado",
    },
  ];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Jornada do Post 2.0</h2>
          <p className="text-sm text-muted-foreground">
            Conteúdo, arte, aprovação e calendário permanecem ligados ao mesmo projeto.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={editHref}>
            <Pencil className="mr-2 h-4 w-4" /> Ajustar conteúdo no Post 2.0
          </a>
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map((stage) => {
          const Icon = stage.icon;
          return (
            <Card
              key={stage.label}
              className={cn(
                "border-border/60",
                stage.done && "border-emerald-500/30 bg-emerald-500/5",
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <Icon className={cn("h-4 w-4", stage.done ? "text-emerald-500" : "text-muted-foreground")} />
                  <Badge variant={stage.done ? "default" : "outline"} className="text-[10px]">
                    {stage.done ? "Pronto" : "Pendente"}
                  </Badge>
                </div>
                <p className="mt-3 font-semibold">{stage.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stage.text}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {content && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BadgeCheck className="h-4 w-4 text-emerald-500" /> Conteúdo editorial importado
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Título da arte</p>
              <p className="mt-1 font-semibold">{content.art.title}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Formato</p>
              <p className="mt-1">Feed {snapshot.post2.ratio}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Legenda</p>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{content.publication.caption}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
