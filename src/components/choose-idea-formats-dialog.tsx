import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Layers3, RotateCcw } from "lucide-react";
import { FORMAT_LABELS } from "@/lib/promptBuilder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const FORMAT_GROUPS: Array<{ label: string; formats: string[] }> = [
  { label: "Imagens únicas", formats: ["post", "story", "status_whatsapp", "capa_reel", "comunicado", "banner"] },
  { label: "Sequências", formats: ["carrossel", "sequencia_stories"] },
  { label: "Vídeo", formats: ["reel"] },
  { label: "Texto", formats: ["texto_grupo"] },
  { label: "Impressão", formats: ["impresso"] },
  { label: "Personalizado", formats: ["outro"] },
];

export function ChooseIdeaFormatsDialog({
  open,
  onOpenChange,
  ideaTitle,
  recommendedFormat,
  initialFormats,
  onContinue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ideaTitle: string;
  recommendedFormat?: string | null;
  initialFormats: string[];
  onContinue: (formats: string[]) => void;
}) {
  const initialFormatsKey = initialFormats
    .filter((format) => FORMAT_LABELS[format])
    .join("|");

  const normalizedInitial = useMemo(() => {
    const known = initialFormatsKey ? initialFormatsKey.split("|") : [];
    if (known.length > 0) return Array.from(new Set(known));
    return recommendedFormat && FORMAT_LABELS[recommendedFormat] ? [recommendedFormat] : [];
  }, [initialFormatsKey, recommendedFormat]);

  const [selected, setSelected] = useState<string[]>(normalizedInitial);

  useEffect(() => {
    if (open) setSelected(normalizedInitial);
  }, [open, normalizedInitial]);

  const toggle = (format: string) => {
    setSelected((current) =>
      current.includes(format)
        ? current.filter((item) => item !== format)
        : [...current, format],
    );
  };

  const resetToRecommended = () => {
    setSelected(recommendedFormat && FORMAT_LABELS[recommendedFormat] ? [recommendedFormat] : []);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers3 className="h-5 w-5 text-primary" />
            Em quais formatos você quer produzir esta ideia?
          </DialogTitle>
          <DialogDescription>
            A mesma ideia pode virar várias entregas dentro do mesmo projeto. Escolha agora os formatos e siga direto para o briefing.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ideia escolhida</p>
          <p className="mt-1 font-medium leading-snug">{ideaTitle}</p>
          {recommendedFormat && FORMAT_LABELS[recommendedFormat] && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Formato recomendado:</span>
              <Badge variant="outline">{FORMAT_LABELS[recommendedFormat]}</Badge>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {FORMAT_GROUPS.map((group) => (
            <section key={group.label} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.formats.map((format) => {
                  const checked = selected.includes(format);
                  const recommended = format === recommendedFormat;
                  return (
                    <label
                      key={format}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${
                        checked ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/40"
                      }`}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggle(format)} />
                      <span className="min-w-0 flex-1">{FORMAT_LABELS[format]}</span>
                      {recommended && <Badge variant="secondary" className="shrink-0 text-[10px]">Recomendado</Badge>}
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          {selected.length === 0
            ? "Selecione pelo menos um formato para continuar."
            : selected.length === 1
              ? `Será criado um projeto com ${FORMAT_LABELS[selected[0]]}.`
              : `Será criado um único projeto com ${selected.length} formatos: ${selected.map((format) => FORMAT_LABELS[format]).join(", ")}.`}
        </div>

        <DialogFooter className="gap-2 sm:space-x-0">
          <Button type="button" variant="ghost" onClick={resetToRecommended} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Usar recomendado
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={selected.length === 0}
            onClick={() => onContinue(selected)}
            className="gap-2"
          >
            Continuar com {selected.length || 0} {selected.length === 1 ? "formato" : "formatos"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
