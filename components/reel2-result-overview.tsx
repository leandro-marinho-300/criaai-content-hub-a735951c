import {
  Captions,
  CheckCircle2,
  Clapperboard,
  FileText,
  ImageIcon,
  MessageSquareText,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Reel2ImportedScript } from "@/lib/reel2Script";
import { reel2CoverInstruction, reel2CoverModeLabel } from "@/lib/reel2Project";

interface Reel2ResultOverviewProps {
  script: Reel2ImportedScript;
  projectStatus?: string | null;
  approvalStatus?: string | null;
  hasSchedule?: boolean;
  hasFinalVideo?: boolean;
}

export function Reel2ResultOverview({
  script,
  projectStatus,
  approvalStatus,
  hasSchedule,
  hasFinalVideo,
}: Reel2ResultOverviewProps) {
  const coverInstruction = formatBlockText(reel2CoverInstruction(script));
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold">Pacote do Reel 2.0</h2>
          <p className="text-sm text-muted-foreground">
            Visão única do Reel: conteúdo, criação, aprovação, agendamento e publicação.
          </p>
        </div>
        <Badge className="bg-orange-500 text-white hover:bg-orange-500">Reel 2.0</Badge>
      </div>

      <Reel2PackageJourney
        script={script}
        projectStatus={projectStatus}
        approvalStatus={approvalStatus}
        hasSchedule={hasSchedule}
        hasFinalVideo={hasFinalVideo}
      />

      <Tabs defaultValue="estrategia" className="w-full">
        <TabsList className="flex w-full flex-wrap gap-1 overflow-x-auto">
          <TabsTrigger value="estrategia">Conteúdo</TabsTrigger>
          <TabsTrigger value="roteiro">Roteiro</TabsTrigger>
          <TabsTrigger value="curta">Versão curta</TabsTrigger>
          <TabsTrigger value="capa">Capa/frame</TabsTrigger>
          <TabsTrigger value="publicacao">Publicação</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
        </TabsList>

        <TabsContent value="estrategia" className="mt-4 space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <StatusPill label="Roteiro principal" ok />
            <StatusPill label="Versão reduzida" ok={Boolean(script.short_version.full_video_caption)} />
            <StatusPill label="Capa / frame" ok={Boolean(script.cover.title || script.cover.mode)} />
            <StatusPill label="Publicação" ok={Boolean(script.publication.caption)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="border-orange-500/25 bg-orange-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clapperboard className="h-4 w-4 text-orange-500" /> Conteúdo do Reel
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <Info label="Ideia central" value={script.central_idea} />
                <Info label="Objetivo" value={script.objective} />
                <Info label="Tipo de Reel" value={script.reel_type} />
                <Info label="Gancho inicial" value={script.selected_hook.spoken_hook} />
                <div className="sm:col-span-2">
                  <Info label="Promessa" value={script.promise} />
                </div>
                <div className="sm:col-span-2">
                  <Info label="Texto inicial na tela" value={script.selected_hook.on_screen_text} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4 text-violet-500" /> Construção do vídeo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {script.main_script.scenes.slice(0, 7).map((scene, index) => (
                  <div key={`${scene.start}-${scene.end}-${index}`} className="rounded-xl border bg-background p-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {index + 1}. {scene.function}
                    </p>
                    <p className="mt-1 leading-snug">{scene.on_screen_text || scene.speech}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="roteiro" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-orange-500" /> Roteiro principal por cenas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {script.main_script.scenes.map((scene, index) => (
                <div key={`${scene.start}-${scene.end}-${index}`} className="rounded-xl border bg-muted/20 p-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cena {index + 1} · {scene.start}-{scene.end}s · {scene.function}
                  </p>
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <DetailBlock label="Fala / narração" value={scene.speech} />
                    <DetailBlock label="Texto na tela" value={scene.on_screen_text || "—"} />
                    <DetailBlock label="Cena / ação" value={scene.visual_direction || "—"} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="curta" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Captions className="h-4 w-4 text-violet-500" /> Versão reduzida
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Badge variant="secondary">{script.short_version.duration_seconds}s</Badge>
              <div className="space-y-2">
                {script.short_version.scenes.map((scene, index) => (
                  <div key={`${scene.start}-${scene.end}-${index}`} className="rounded-xl border bg-muted/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Cena {index + 1} · {scene.start}-{scene.end}s · {scene.function}
                    </p>
                    <p className="mt-1"><b>Fala:</b> {scene.speech}</p>
                    {scene.on_screen_text && <p className="text-muted-foreground"><b>Texto na tela:</b> {scene.on_screen_text}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Captions className="h-4 w-4 text-violet-500" /> Legenda completa para inserir no vídeo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-xs text-muted-foreground">
                Texto usado na edição/acessibilidade. Não é a legenda da publicação.
              </p>
              <div className="whitespace-pre-wrap break-words rounded-xl bg-muted/30 p-3 leading-relaxed">
                {script.short_version.full_video_caption}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="capa" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="h-4 w-4 text-orange-500" /> Capa / frame
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Badge variant="outline">{reel2CoverModeLabel(script)}</Badge>
              <div className="whitespace-pre-wrap break-words rounded-xl bg-muted/30 p-3 text-sm leading-relaxed">
                {coverInstruction}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="publicacao" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquareText className="h-4 w-4 text-orange-500" /> Publicação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="whitespace-pre-wrap break-words rounded-xl bg-muted/30 p-3 leading-relaxed">
                {script.publication.caption}
              </div>
              {script.publication.cta && <p><b>CTA:</b> {script.publication.cta}</p>}
              {script.publication.hashtags.length > 0 && (
                <p className="break-words text-muted-foreground">{script.publication.hashtags.join(" ")}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checklist" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-violet-500" /> Checklist rápido
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
              <CheckItem ok={script.quality_check.has_0_3s_hook} text="Gancho nos 3 primeiros segundos" />
              <CheckItem ok={script.quality_check.has_clear_promise} text="Promessa clara" />
              <CheckItem ok={script.quality_check.has_video_caption} text="Legenda completa para vídeo" />
              <CheckItem ok={script.quality_check.has_scene_functions} text="Cenas com função" />
              <CheckItem ok={script.quality_check.hashtags_limited_to_5} text="Hashtags limitadas a 5" />
              <CheckItem ok={script.quality_check.respects_brand_niche} text="Respeita marca e nicho" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}

function Reel2PackageJourney({
  script,
  projectStatus,
  approvalStatus,
  hasSchedule,
  hasFinalVideo,
}: Reel2ResultOverviewProps) {
  const approvalDone =
    isApprovedStatus(approvalStatus) || projectStatus === "approved" || projectStatus === "published";
  const scheduleDone = Boolean(hasSchedule || projectStatus === "scheduled" || projectStatus === "published");
  const publishDone = projectStatus === "published";
  const creationDone = Boolean(
    script.main_script?.scenes?.length &&
      script.short_version?.full_video_caption &&
      script.publication?.caption,
  );

  const steps = [
    {
      title: "1. Conteúdo",
      text: script.promise ? "Promessa, gancho e ideia central definidos." : "Definir promessa e gancho.",
      done: Boolean(script.promise && script.selected_hook?.spoken_hook),
    },
    {
      title: "2. Criação",
      text: creationDone ? "Roteiro, versão curta e legenda organizados." : "Gerar roteiro, versão curta e legenda.",
      done: creationDone,
    },
    {
      title: "3. Aprovação",
      text: approvalDone ? "Pacote aprovado ou aprovado com ajustes." : "Enviar o pacote para revisão do cliente.",
      done: approvalDone,
    },
    {
      title: "4. Agendamento",
      text: scheduleDone ? "Publicação já encaminhada para agenda." : "Definir data e canal depois da aprovação.",
      done: scheduleDone,
    },
    {
      title: "5. Publicação",
      text: publishDone
        ? "Reel marcado como publicado."
        : hasFinalVideo
          ? "Vídeo final anexado. Falta publicar ou marcar como publicado."
          : "Publicar com vídeo final, capa/frame e legenda.",
      done: publishDone,
    },
  ];
  const currentIndex = Math.max(0, steps.findIndex((step) => !step.done));

  return (
    <Card className="border-violet-500/20 bg-violet-500/5">
      <CardHeader>
        <CardTitle className="text-base">Jornada do Reel</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 md:grid-cols-5">
        {steps.map((step, index) => {
          const current = index === currentIndex && !step.done;
          return (
            <div
              key={step.title}
              className={[
                "rounded-xl border bg-background p-3 text-sm",
                step.done ? "border-emerald-500/30 bg-emerald-500/5" : current ? "border-orange-500/50 bg-orange-500/5" : "",
              ].filter(Boolean).join(" ")}
            >
              <p className="font-semibold">{step.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{step.text}</p>
              <Badge variant={step.done ? "default" : current ? "secondary" : "outline"} className="mt-3 text-[10px]">
                {step.done ? "Concluído" : current ? "Agora" : "Pendente"}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function isApprovedStatus(value?: string | null): boolean {
  if (!value) return false;
  return ["approved", "approved_with_changes", "aprovado", "aprovado_com_ajustes"].includes(value);
}

function StatusPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border bg-card p-3 text-sm">
      <CheckCircle2 className={ok ? "h-4 w-4 text-emerald-500" : "h-4 w-4 text-amber-500"} />
      <span>{label}</span>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words">{value || "—"}</p>
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm leading-relaxed">{value}</p>
    </div>
  );
}

function CheckItem({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border bg-background p-2">
      <CheckCircle2 className={ok ? "mt-0.5 h-4 w-4 shrink-0 text-emerald-500" : "mt-0.5 h-4 w-4 shrink-0 text-amber-500"} />
      <span>{text}</span>
    </div>
  );
}

function formatBlockText(value: string) {
  return value.replace(/\\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
