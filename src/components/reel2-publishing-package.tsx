import { useMemo, useState } from "react";
import { Captions, Clapperboard, ExternalLink, FileText, Hash, ImageIcon, MessageSquareText, MonitorPlay, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton } from "@/components/copy-button";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { buildReel2StoryboardPrompt, normalizeReel2HashtagInput, type Reel2ImportedScript } from "@/lib/reel2Script";

interface Reel2PublishingPackageProps {
  script: Reel2ImportedScript;
  brand: Tables<"brands"> | null;
  onChange: (script: Reel2ImportedScript) => void;
}

const COVER_OPTIONS = [
  {
    value: "custom",
    title: "Sim, capa personalizada",
    description: "Gera título, prompt visual e orientação de área segura.",
  },
  {
    value: "frame",
    title: "Usar frame do vídeo",
    description: "A capa será escolhida a partir de uma cena gravada.",
  },
  {
    value: "unsure",
    title: "Ainda não sei",
    description: "Mantém a decisão em aberto antes da produção final.",
  },
  {
    value: "none",
    title: "Não precisa",
    description: "O Reel não terá capa personalizada nesta produção.",
  },
] as const;

export function Reel2PublishingPackage({ script, brand, onChange }: Reel2PublishingPackageProps) {
  const [storyboardMode, setStoryboardMode] = useState<"complete" | "quick">("complete");
  const storyboardPrompt = useMemo(() => buildReel2StoryboardPrompt(script, brand, { mode: storyboardMode }), [script, brand, storyboardMode]);
  const hasCustomCover = script.cover.needs_cover || script.cover.mode === "custom";
  const hashtagText = script.publication.hashtags.join(" ");

  const patchCover = (partial: Partial<Reel2ImportedScript["cover"]>) => {
    onChange({ ...script, cover: { ...script.cover, ...partial } });
  };

  const patchPublication = (partial: Partial<Reel2ImportedScript["publication"]>) => {
    onChange({ ...script, publication: { ...script.publication, ...partial } });
  };

  const patchShortVersion = (partial: Partial<Reel2ImportedScript["short_version"]>) => {
    onChange({ ...script, short_version: { ...script.short_version, ...partial } });
  };

  const onOpenChatGPT = () => {
    navigator.clipboard?.writeText(storyboardPrompt).catch(() => undefined);
    toast.success("Pedido do storyboard copiado. Anexe o logo e referência no ChatGPT antes de gerar o PDF.");
    window.open("https://chatgpt.com", "_blank", "noopener,noreferrer");
  };

  return (
    <Card className="border-orange-500/30 bg-orange-500/5">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-orange-500 text-white hover:bg-orange-500">Fase 4</Badge>
          <Badge variant="secondary">Capa · Publicação · Storyboard</Badge>
        </div>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Clapperboard className="h-5 w-5 text-orange-500" /> Pacote final do Reel
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Organize capa, legenda, hashtags e pedido visual do roteiro antes de levar o Reel para aprovação ou produção.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="h-4 w-4 text-orange-500" /> Capa do Reel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {COVER_OPTIONS.map((option) => {
                  const active = script.cover.mode === option.value || (option.value === "custom" && hasCustomCover);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => patchCover({ mode: option.value, needs_cover: option.value === "custom" })}
                      className={cn(
                        "rounded-2xl border bg-card p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md",
                        active ? "border-orange-500 ring-2 ring-orange-500/20" : "border-border/70 hover:border-orange-500/50",
                      )}
                    >
                      <p className="text-sm font-semibold">{option.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                    </button>
                  );
                })}
              </div>

              {hasCustomCover && (
                <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
                  <Field label="Título da capa" value={script.cover.title} onChange={(value) => patchCover({ title: value })} placeholder="Ex.: Antes de fechar sua viagem" />
                  <Field label="Subtítulo opcional" value={script.cover.subtitle} onChange={(value) => patchCover({ subtitle: value })} placeholder="Ex.: 3 pontos para conferir" />
                  <Field label="Prompt visual da capa" value={script.cover.visual_prompt} onChange={(value) => patchCover({ visual_prompt: value })} textarea placeholder="Descreva o visual da capa, mantendo identidade da marca e área segura." />
                  <Field label="Área segura e corte para grade" value={script.cover.safe_area_notes} onChange={(value) => patchCover({ safe_area_notes: value })} textarea placeholder="Ex.: manter texto centralizado para funcionar no corte 1:1 da grade." />
                </div>
              )}

              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-muted-foreground">
                <strong className="text-foreground">Lembrete:</strong> capa não é formato principal. É embalagem estratégica do Reel para clique, perfil e aprovação.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquareText className="h-4 w-4 text-orange-500" /> Publicação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Legenda da publicação" value={script.publication.caption} onChange={(value) => patchPublication({ caption: value })} textarea />
              <Field label="CTA" value={script.publication.cta} onChange={(value) => patchPublication({ cta: value })} placeholder="Ex.: Comente sua dúvida / Peça seu orçamento" />
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> Hashtags — até 5</Label>
                <Input
                  value={hashtagText}
                  onChange={(event) => patchPublication({ hashtags: normalizeReel2HashtagInput(event.target.value) })}
                  placeholder="#viagem #reels #dica"
                />
                <p className="text-xs text-muted-foreground">O Cria Aí mantém no máximo 5 hashtags para evitar poluição.</p>
              </div>
              <Field label="Legenda completa para inserir no vídeo" value={script.short_version.full_video_caption} onChange={(value) => patchShortVersion({ full_video_caption: value })} textarea />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Captions className="h-4 w-4 text-violet-500" /> O que é cada texto?
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Explain label="Texto na tela" text="Frases curtas exibidas durante as cenas do vídeo." />
            <Explain label="Legenda do vídeo" text="Texto completo para edição/acessibilidade, especialmente na versão reduzida." />
            <Explain label="Legenda da publicação" text="Texto abaixo do Reel no Instagram ou rede social." />
            <Explain label="Título da capa" text="Frase de embalagem para clique e organização da grade." />
          </CardContent>
        </Card>

        <Card className="border-violet-500/30 bg-violet-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MonitorPlay className="h-4 w-4 text-violet-500" /> Storyboard visual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Copie este pedido para o ChatGPT gerar o PDF visual do roteiro. O logo e referências precisam ser anexados manualmente na conversa.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={storyboardMode === "complete" ? "default" : "outline"}
                    onClick={() => setStoryboardMode("complete")}
                  >
                    Storyboard completo
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={storyboardMode === "quick" ? "default" : "outline"}
                    onClick={() => setStoryboardMode("quick")}
                  >
                    Storyboard rápido
                  </Button>
                </div>
                <Textarea value={storyboardPrompt} readOnly rows={10} className="font-mono text-xs" />
              </div>
              <div className="space-y-3 rounded-2xl border bg-background p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <Sparkles className="h-4 w-4 text-violet-500" /> Próximo passo
                </div>
                <p className="text-sm text-muted-foreground">
                  Gere o PDF no ChatGPT, depois crie o projeto no wizard atual. O upload do storyboard continua na página de resultado, onde existe projeto e controle de versões.
                </p>
                <CopyButton text={storyboardPrompt} label="Copiar pedido" />
                <Button type="button" className="w-full" onClick={onOpenChatGPT}>
                  <ExternalLink className="mr-2 h-4 w-4" /> Abrir ChatGPT
                </Button>
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-muted-foreground">
                  Storyboard é material de produção e aprovação. Não é peça publicável.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange, textarea = false, placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; textarea?: boolean; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {textarea ? (
        <Textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} placeholder={placeholder} />
      ) : (
        <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      )}
    </div>
  );
}

function Explain({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-2xl border bg-background p-3 text-sm">
      <p className="font-semibold">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
