import { Clapperboard, Captions, CheckCircle2, FileText, ImageIcon, MessageSquareText, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Reel2ImportedScript } from "@/lib/reel2Script";
import { reel2CoverInstruction, reel2CoverModeLabel } from "@/lib/reel2Project";

export function Reel2ResultOverview({ script }: { script: Reel2ImportedScript }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold">Resumo estratégico do Reel 2.0</h2>
          <p className="text-sm text-muted-foreground">
            Pacote criado no fluxo guiado: gancho, roteiro, capa, legenda, storyboard e aprovação.
          </p>
        </div>
        <Badge className="bg-orange-500 text-white hover:bg-orange-500">Reel 2.0</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="border-orange-500/25 bg-orange-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clapperboard className="h-4 w-4 text-orange-500" /> Estratégia do vídeo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Info label="Ideia central" value={script.central_idea} />
            <Info label="Objetivo" value={script.objective} />
            <Info label="Tipo de Reel" value={script.reel_type} />
            <Info label="Promessa" value={script.promise} />
            <Info label="Gancho escolhido" value={script.selected_hook.spoken_hook} />
            <Info label="Texto inicial na tela" value={script.selected_hook.on_screen_text} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-violet-500" /> Checklist rápido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <CheckItem ok={script.quality_check.has_0_3s_hook} text="Gancho nos 3 primeiros segundos" />
            <CheckItem ok={script.quality_check.has_clear_promise} text="Promessa clara" />
            <CheckItem ok={script.quality_check.has_video_caption} text="Legenda completa para vídeo" />
            <CheckItem ok={script.quality_check.has_scene_functions} text="Cenas com função" />
            <CheckItem ok={script.quality_check.respects_brand_niche} text="Respeita marca e nicho" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-orange-500" /> Roteiro principal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {script.main_script.scenes.map((scene, index) => (
              <div key={`${scene.start}-${scene.end}-${index}`} className="rounded-xl border bg-muted/20 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cena {index + 1} · {scene.start}-{scene.end}s · {scene.function}
                </p>
                <p className="mt-1 font-medium">{scene.speech}</p>
                {scene.on_screen_text && <p className="mt-1 text-xs text-muted-foreground">Tela: {scene.on_screen_text}</p>}
                {scene.visual_direction && <p className="mt-1 text-xs text-muted-foreground">Visual: {scene.visual_direction}</p>}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Captions className="h-4 w-4 text-violet-500" /> Versão reduzida e legenda do vídeo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Badge variant="secondary">{script.short_version.duration_seconds}s</Badge>
              <pre className="whitespace-pre-wrap break-words rounded-xl bg-muted/30 p-3 text-sm leading-relaxed">
                {script.short_version.full_video_caption}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="h-4 w-4 text-orange-500" /> Capa / frame
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Badge variant="outline">{reel2CoverModeLabel(script)}</Badge>
              <pre className="whitespace-pre-wrap break-words rounded-xl bg-muted/30 p-3 text-xs leading-relaxed">
                {reel2CoverInstruction(script)}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquareText className="h-4 w-4 text-orange-500" /> Publicação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <pre className="whitespace-pre-wrap break-words rounded-xl bg-muted/30 p-3 text-sm leading-relaxed">
                {script.publication.caption}
              </pre>
              {script.publication.cta && <p><b>CTA:</b> {script.publication.cta}</p>}
              {script.publication.hashtags.length > 0 && (
                <p className="break-words text-muted-foreground">{script.publication.hashtags.join(" ")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
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

function CheckItem({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border bg-background p-2">
      <CheckCircle2 className={ok ? "mt-0.5 h-4 w-4 shrink-0 text-emerald-500" : "mt-0.5 h-4 w-4 shrink-0 text-amber-500"} />
      <span>{text}</span>
    </div>
  );
}
