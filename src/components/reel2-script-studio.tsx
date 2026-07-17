import { AlertTriangle, CheckCircle2, Clock3, Hash, ListChecks, MessageSquareText, MonitorPlay, Plus, Trash2, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  buildReel2QualityChecklist,
  normalizeReel2HashtagInput,
  summarizeReel2Quality,
  type Reel2ImportedScene,
  type Reel2ImportedScript,
} from "@/lib/reel2Script";

const SCENE_FUNCTIONS = [
  "gancho",
  "contexto",
  "identificação",
  "explicação",
  "demonstração",
  "orientação",
  "virada",
  "cta",
  "síntese",
];

interface Reel2ScriptStudioProps {
  script: Reel2ImportedScript;
  warnings?: string[];
  needsReview?: boolean;
  onChange: (script: Reel2ImportedScript) => void;
}

export function Reel2ScriptStudio({ script, warnings = [], needsReview = false, onChange }: Reel2ScriptStudioProps) {
  const qualityItems = buildReel2QualityChecklist(script);
  const summary = summarizeReel2Quality(qualityItems);

  const patchScript = (partial: Partial<Reel2ImportedScript>) => onChange({ ...script, ...partial });
  const patchPublication = (partial: Partial<Reel2ImportedScript["publication"]>) => {
    onChange({ ...script, publication: { ...script.publication, ...partial } });
  };
  const patchCover = (partial: Partial<Reel2ImportedScript["cover"]>) => {
    onChange({ ...script, cover: { ...script.cover, ...partial } });
  };
  const patchShortVersion = (partial: Partial<Reel2ImportedScript["short_version"]>) => {
    onChange({ ...script, short_version: { ...script.short_version, ...partial } });
  };

  const chooseHook = (index: number) => {
    const hook = script.hook_options[index];
    if (!hook) return;
    onChange({ ...script, selected_hook: hook });
  };

  const selectedHookIndex = script.hook_options.findIndex(
    (hook) => hook.spoken_hook.trim().toLowerCase() === script.selected_hook.spoken_hook.trim().toLowerCase(),
  );

  return (
    <Card className="border-violet-500/30 bg-violet-500/5">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <MonitorPlay className="h-5 w-5 text-violet-500" /> Estúdio de roteiro Reel 2.0
            </CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Edite promessa, gancho, cenas, versão reduzida, publicação e qualidade antes de levar para o wizard atual.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{summary.ok} ok</Badge>
            <Badge className="bg-amber-500 text-black hover:bg-amber-500">{summary.warning} atenção</Badge>
            <Badge variant={summary.error ? "destructive" : "secondary"}>{summary.error} erro</Badge>
          </div>
        </div>
        {needsReview && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
            Você editou este roteiro depois da importação. Revise o gancho, a duração e o checklist antes de enviar para aprovação.
          </div>
        )}
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="estrutura" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="estrutura">Estrutura</TabsTrigger>
            <TabsTrigger value="roteiro">Roteiro principal</TabsTrigger>
            <TabsTrigger value="reduzida">Versão reduzida</TabsTrigger>
            <TabsTrigger value="publicacao">Publicação e capa</TabsTrigger>
            <TabsTrigger value="qualidade">Checklist</TabsTrigger>
          </TabsList>

          <TabsContent value="estrutura" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Promessa do vídeo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    A promessa responde: o que a pessoa ganha se assistir até o final?
                  </p>
                  <Textarea
                    value={script.promise}
                    onChange={(event) => patchScript({ promise: event.target.value })}
                    rows={4}
                    placeholder="Ex.: Você vai entender por que esse comportamento acontece e como ajustar sua resposta."
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Separação didática</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm text-muted-foreground">
                  <Distinction label="Gancho falado" text="O que a pessoa fala ou narra nos primeiros segundos." />
                  <Distinction label="Texto na tela" text="Frase curta para leitura rápida dentro do vídeo." />
                  <Distinction label="Legenda do vídeo" text="Texto completo para inserir na edição/acessibilidade." />
                  <Distinction label="Legenda da publicação" text="Texto abaixo do Reel no Instagram." />
                  <Distinction label="Título da capa" text="Embalagem do Reel para clique e grade do perfil." />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wand2 className="h-4 w-4 text-orange-500" /> Opções de gancho
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                {script.hook_options.map((hook, index) => (
                  <Card key={`${hook.type}-${index}`} className={cn("min-w-0", index === selectedHookIndex ? "border-orange-500 ring-2 ring-orange-500/20" : "border-border/70")}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={index === selectedHookIndex ? "default" : "secondary"}>{hookLabel(hook.type)}</Badge>
                        <Button size="sm" variant={index === selectedHookIndex ? "default" : "outline"} onClick={() => chooseHook(index)}>
                          {index === selectedHookIndex ? "Escolhido" : "Escolher"}
                        </Button>
                      </div>
                      <EditableText label="Fala inicial" value={hook.spoken_hook} onChange={(value) => updateHook(script, index, { spoken_hook: value }, onChange)} textarea />
                      <EditableText label="Texto na tela" value={hook.on_screen_text} onChange={(value) => updateHook(script, index, { on_screen_text: value }, onChange)} />
                      <EditableText label="Cena sugerida" value={hook.scene_suggestion} onChange={(value) => updateHook(script, index, { scene_suggestion: value }, onChange)} textarea />
                      <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Por que prende: </span>{hook.why_it_works}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roteiro" className="space-y-4">
            <ScriptBlockHeader
              title="Roteiro principal"
              description="Cada cena precisa ter tempo, função, fala, texto na tela e direção visual."
              duration={script.main_script.duration_seconds}
              onDurationChange={(duration_seconds) => onChange({ ...script, main_script: { ...script.main_script, duration_seconds } })}
            />
            <div className="space-y-3">
              {script.main_script.scenes.map((scene, index) => (
                <SceneEditor
                  key={`main-${index}-${scene.start}-${scene.end}`}
                  scene={scene}
                  index={index}
                  onChange={(next) => updateMainScene(script, index, next, onChange)}
                  onRemove={() => removeMainScene(script, index, onChange)}
                  canRemove={script.main_script.scenes.length > 2}
                />
              ))}
            </div>
            <Button type="button" variant="outline" onClick={() => addMainScene(script, onChange)}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar cena
            </Button>
          </TabsContent>

          <TabsContent value="reduzida" className="space-y-4">
            <ScriptBlockHeader
              title="Versão reduzida"
              description="Use para uma versão curta, objetiva e fácil de editar em vídeo."
              duration={script.short_version.duration_seconds}
              onDurationChange={(duration_seconds) => patchShortVersion({ duration_seconds })}
            />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Legenda completa para inserir no vídeo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Este texto é para aparecer dentro do vídeo ou guiar legendagem/acessibilidade. Não é a legenda da publicação.
                </p>
                <Textarea
                  value={script.short_version.full_video_caption}
                  onChange={(event) => patchShortVersion({ full_video_caption: event.target.value })}
                  rows={5}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => patchShortVersion({ full_video_caption: buildCaptionFromScenes(script.short_version.scenes, script.publication.cta) })}
                >
                  Montar a partir das cenas reduzidas
                </Button>
              </CardContent>
            </Card>
            <div className="space-y-3">
              {script.short_version.scenes.map((scene, index) => (
                <SceneEditor
                  key={`short-${index}-${scene.start}-${scene.end}`}
                  scene={scene}
                  index={index}
                  onChange={(next) => updateShortScene(script, index, next, onChange)}
                  onRemove={() => removeShortScene(script, index, onChange)}
                  canRemove={script.short_version.scenes.length > 1}
                />
              ))}
            </div>
            <Button type="button" variant="outline" onClick={() => addShortScene(script, onChange)}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar cena reduzida
            </Button>
          </TabsContent>

          <TabsContent value="publicacao" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><MessageSquareText className="h-4 w-4" /> Legenda da publicação</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea value={script.publication.caption} onChange={(event) => patchPublication({ caption: event.target.value })} rows={7} />
                  <EditableText label="CTA" value={script.publication.cta} onChange={(value) => patchPublication({ cta: value })} />
                  <div className="space-y-2">
                    <Label>Hashtags — máximo 5</Label>
                    <Input
                      value={script.publication.hashtags.join(" ")}
                      onChange={(event) => patchPublication({ hashtags: normalizeReel2HashtagInput(event.target.value) })}
                      placeholder="#viagem #dica #reels"
                    />
                    <p className="text-xs text-muted-foreground">{script.publication.hashtags.length}/5 hashtags</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Hash className="h-4 w-4" /> Capa do Reel</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Precisa de capa?</Label>
                      <Select value={script.cover.needs_cover ? "yes" : "no"} onValueChange={(value) => patchCover({ needs_cover: value === "yes", mode: value === "yes" ? "custom" : "none" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Sim, personalizada</SelectItem>
                          <SelectItem value="no">Não / usar frame</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <EditableText label="Título da capa" value={script.cover.title} onChange={(value) => patchCover({ title: value })} />
                  </div>
                  <EditableText label="Subtítulo" value={script.cover.subtitle} onChange={(value) => patchCover({ subtitle: value })} />
                  <EditableText label="Prompt visual da capa" value={script.cover.visual_prompt} onChange={(value) => patchCover({ visual_prompt: value })} textarea />
                  <EditableText label="Área segura / corte" value={script.cover.safe_area_notes} onChange={(value) => patchCover({ safe_area_notes: value })} textarea />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="qualidade" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListChecks className="h-4 w-4 text-emerald-600" /> Checklist de qualidade
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {qualityItems.map((item) => (
                  <div key={item.id} className={cn("rounded-2xl border p-4", item.status === "error" && "border-destructive/40 bg-destructive/5", item.status === "warning" && "border-amber-500/40 bg-amber-500/10", item.status === "ok" && "border-emerald-500/30 bg-emerald-500/5")}>
                    <div className="flex gap-3">
                      {item.status === "ok" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : item.status === "warning" ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />}
                      <div>
                        <p className="font-semibold">{item.label}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {warnings.length > 0 && (
              <Card className="border-amber-500/30 bg-amber-500/10">
                <CardHeader>
                  <CardTitle className="text-base">Avisos da importação</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
                  </ul>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function Distinction({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <p className="font-medium text-foreground">{label}</p>
      <p>{text}</p>
    </div>
  );
}

function EditableText({ label, value, onChange, textarea = false }: { label: string; value: string; onChange: (value: string) => void; textarea?: boolean }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {textarea ? (
        <Textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} />
      ) : (
        <Input value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </div>
  );
}

function ScriptBlockHeader({ title, description, duration, onDurationChange }: { title: string; description: string; duration: number; onDurationChange: (duration: number) => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="flex items-center gap-2 font-semibold"><Clock3 className="h-4 w-4 text-orange-500" /> {title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="space-y-2 lg:w-48">
          <Label>Duração sugerida</Label>
          <Input type="number" min={1} max={180} value={duration} onChange={(event) => onDurationChange(toNumber(event.target.value, duration))} />
        </div>
      </CardContent>
    </Card>
  );
}

function SceneEditor({ scene, index, onChange, onRemove, canRemove }: { scene: Reel2ImportedScene; index: number; onChange: (scene: Reel2ImportedScene) => void; onRemove: () => void; canRemove: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Cena {index + 1}</CardTitle>
          {canRemove && <Button type="button" size="sm" variant="outline" onClick={onRemove}><Trash2 className="mr-1 h-4 w-4" /> Remover</Button>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Início</Label>
            <Input type="number" min={0} value={scene.start} onChange={(event) => onChange({ ...scene, start: toNumber(event.target.value, scene.start) })} />
          </div>
          <div className="space-y-2">
            <Label>Fim</Label>
            <Input type="number" min={1} value={scene.end} onChange={(event) => onChange({ ...scene, end: toNumber(event.target.value, scene.end) })} />
          </div>
          <div className="space-y-2">
            <Label>Função</Label>
            <Select value={SCENE_FUNCTIONS.includes(scene.function) ? scene.function : "custom"} onValueChange={(value) => onChange({ ...scene, function: value === "custom" ? "outra função" : value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCENE_FUNCTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                <SelectItem value="custom">Outra função</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {!SCENE_FUNCTIONS.includes(scene.function) && (
          <EditableText label="Função personalizada" value={scene.function} onChange={(value) => onChange({ ...scene, function: value })} />
        )}
        <EditableText label="Fala/Narração" value={scene.speech} onChange={(value) => onChange({ ...scene, speech: value })} textarea />
        <EditableText label="Texto na tela" value={scene.on_screen_text} onChange={(value) => onChange({ ...scene, on_screen_text: value })} />
        <EditableText label="Imagem/Ação/Direção visual" value={scene.visual_direction} onChange={(value) => onChange({ ...scene, visual_direction: value })} textarea />
      </CardContent>
    </Card>
  );
}

function updateHook(script: Reel2ImportedScript, index: number, patch: Partial<Reel2ImportedScript["hook_options"][number]>, onChange: (script: Reel2ImportedScript) => void) {
  const hook_options = script.hook_options.map((hook, hookIndex) => hookIndex === index ? { ...hook, ...patch } : hook);
  const selected_hook = script.selected_hook.spoken_hook === script.hook_options[index]?.spoken_hook ? hook_options[index] : script.selected_hook;
  onChange({ ...script, hook_options, selected_hook });
}

function updateMainScene(script: Reel2ImportedScript, index: number, scene: Reel2ImportedScene, onChange: (script: Reel2ImportedScript) => void) {
  const scenes = script.main_script.scenes.map((item, itemIndex) => itemIndex === index ? scene : item);
  onChange({ ...script, main_script: { ...script.main_script, scenes } });
}

function addMainScene(script: Reel2ImportedScript, onChange: (script: Reel2ImportedScript) => void) {
  const last = script.main_script.scenes[script.main_script.scenes.length - 1];
  const start = last ? last.end : 0;
  const scene: Reel2ImportedScene = { start, end: start + 5, function: "orientação", speech: "", on_screen_text: "", visual_direction: "" };
  onChange({ ...script, main_script: { ...script.main_script, scenes: [...script.main_script.scenes, scene], duration_seconds: Math.max(script.main_script.duration_seconds, scene.end) } });
}

function removeMainScene(script: Reel2ImportedScript, index: number, onChange: (script: Reel2ImportedScript) => void) {
  onChange({ ...script, main_script: { ...script.main_script, scenes: script.main_script.scenes.filter((_, itemIndex) => itemIndex !== index) } });
}

function updateShortScene(script: Reel2ImportedScript, index: number, scene: Reel2ImportedScene, onChange: (script: Reel2ImportedScript) => void) {
  const scenes = script.short_version.scenes.map((item, itemIndex) => itemIndex === index ? scene : item);
  onChange({ ...script, short_version: { ...script.short_version, scenes } });
}

function addShortScene(script: Reel2ImportedScript, onChange: (script: Reel2ImportedScript) => void) {
  const last = script.short_version.scenes[script.short_version.scenes.length - 1];
  const start = last ? last.end : 0;
  const scene: Reel2ImportedScene = { start, end: start + 4, function: "síntese", speech: "", on_screen_text: "", visual_direction: "" };
  onChange({ ...script, short_version: { ...script.short_version, scenes: [...script.short_version.scenes, scene], duration_seconds: Math.max(script.short_version.duration_seconds, scene.end) } });
}

function removeShortScene(script: Reel2ImportedScript, index: number, onChange: (script: Reel2ImportedScript) => void) {
  onChange({ ...script, short_version: { ...script.short_version, scenes: script.short_version.scenes.filter((_, itemIndex) => itemIndex !== index) } });
}

function buildCaptionFromScenes(scenes: Reel2ImportedScene[], cta: string) {
  return [...scenes.map((scene) => scene.speech), cta].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function toNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hookLabel(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("curious") || normalized.includes("curioso")) return "Curioso";
  if (normalized.includes("alert") || normalized.includes("alerta")) return "Alerta";
  return "Direto";
}
