import { Download, FileJson2, Film, Music2, Quote, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CopyButton } from "@/components/copy-button";
import { reelScriptToPlainText, type ReelScript } from "@/lib/reelScript";

interface ReelScriptViewProps {
  script: ReelScript;
  onImportNewVersion: () => void;
}

function downloadText(filename: string, content: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ReelScriptView({ script, onImportNewVersion }: ReelScriptViewProps) {
  const plainText = reelScriptToPlainText(script);
  const safeName =
    script.title.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "roteiro-reel";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-emerald-600 text-white">ROTEIRO COMPLETO</Badge>
          <Badge variant="outline">{script.scenes.length} cenas</Badge>
          <Badge variant="outline">{script.overview.duration_seconds}s</Badge>
          <Badge variant="outline">Material interno</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={plainText} label="Copiar roteiro" variant="outline" size="sm" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadText(`${safeName}.txt`, plainText)}
          >
            <Download className="mr-2 h-4 w-4" /> TXT
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadText(
                `${safeName}.json`,
                JSON.stringify(script, null, 2),
                "application/json;charset=utf-8",
              )
            }
          >
            <FileJson2 className="mr-2 h-4 w-4" /> JSON
          </Button>
          <Button size="sm" onClick={onImportNewVersion}>
            Importar nova versão
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Conceito central
            </p>
            <h3 className="mt-1 text-lg font-semibold">{script.overview.central_concept}</h3>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Objetivo</p>
              <p>{script.overview.objective}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Público</p>
              <p>{script.overview.target_audience}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Formato narrativo</p>
              <p>{script.overview.narrative_format}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reação desejada</p>
              <p>{script.overview.desired_reaction}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <Quote className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Ganchos</h3>
          </div>
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm font-medium">
            {script.hooks.primary}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {script.hooks.alternatives.map((hook, index) => (
              <div
                key={`${hook}-${index}`}
                className="rounded-md border border-border/60 p-3 text-sm"
              >
                <span className="mr-2 text-xs text-muted-foreground">Alternativa {index + 1}</span>
                {hook}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Film className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Cenas</h3>
        </div>
        {script.scenes.map((scene) => (
          <Card key={`${scene.scene_number}-${scene.start_second}`}>
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>Cena {scene.scene_number}</Badge>
                    <Badge variant="outline">
                      {scene.start_second}s–{scene.end_second}s
                    </Badge>
                    <Badge variant="secondary">{scene.purpose}</Badge>
                  </div>
                  <h4 className="mt-2 text-lg font-semibold">{scene.scene_title}</h4>
                </div>
                <Badge variant="outline">{scene.delivery_type}</Badge>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Fala ou narração
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                      {scene.speech_or_narration || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Texto na tela
                    </p>
                    <p className="mt-1 text-sm font-medium">{scene.on_screen_text || "—"}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Gravação
                    </p>
                    <p className="mt-1 text-sm">{scene.recording_direction}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Enquadramento</p>
                      <p className="text-sm">{scene.framing}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Movimento</p>
                      <p className="text-sm">{scene.camera_movement}</p>
                    </div>
                  </div>
                </div>
              </div>

              {scene.supporting_images.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Imagens de apoio
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                    {scene.supporting_images.map((image) => (
                      <li key={image}>{image}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid gap-3 rounded-md bg-muted/40 p-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Transição</p>
                  <p>{scene.transition}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Observações</p>
                  <p>{scene.production_notes || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Music2 className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Guia de produção</h3>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Trilha</p>
              <p>{script.production.soundtrack_mood}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ritmo da edição</p>
              <p>{script.production.editing_rhythm}</p>
            </div>
          </div>
          {script.production.general_transitions.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">Transições gerais</p>
              <p className="text-sm">{script.production.general_transitions.join("; ")}</p>
            </div>
          )}
          {script.production.accessibility_notes.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">Acessibilidade</p>
              <p className="text-sm">{script.production.accessibility_notes.join("; ")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h3 className="font-semibold">Fechamento</h3>
          <p className="text-sm">{script.closing.memorable_line}</p>
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <span className="font-semibold">CTA:</span> {script.closing.cta}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h3 className="font-semibold">
            Versão reduzida · {script.short_version.duration_seconds}s
          </h3>
          <p className="text-sm">
            <b>Gancho:</b> {script.short_version.hook}
          </p>
          <div className="space-y-2">
            {script.short_version.scenes.map((scene) => (
              <div
                key={`${scene.scene_number}-${scene.start_second}`}
                className="rounded-md border border-border/60 p-3 text-sm"
              >
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {scene.start_second}s–{scene.end_second}s
                  </Badge>
                  <span className="font-medium">Cena {scene.scene_number}</span>
                </div>
                <p className="mt-2">{scene.speech_or_narration}</p>
                <p className="mt-1 text-xs text-muted-foreground">Tela: {scene.on_screen_text}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Gravação: {scene.recording_direction}
                </p>
              </div>
            ))}
          </div>
          <p className="text-sm">
            <b>Fechamento:</b> {script.short_version.closing}
          </p>
          <p className="text-sm">
            <b>CTA:</b> {script.short_version.cta}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Cobertura e validação</h3>
          </div>
          <div className="space-y-2 text-sm">
            {script.coverage.map((entry) => (
              <div
                key={entry.point}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 p-3"
              >
                <span>
                  {entry.covered && entry.covered_in_caption ? "✓" : "⚠"} {entry.point}
                </span>
                <span className="text-xs text-muted-foreground">
                  Cenas: {entry.scene_numbers.join(", ") || "—"} · Legenda:{" "}
                  {entry.covered_in_caption ? "sim" : "não"}
                </span>
              </div>
            ))}
          </div>
          {script.validation.warnings.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              <b>Avisos:</b> {script.validation.warnings.join("; ")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
